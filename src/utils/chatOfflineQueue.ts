export type OutboxSenderRole = "customer" | "admin";

export interface OfflineMediaBlobRecord {
  key: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  createdAt: number;
}

export interface OfflineOutboxItem {
  clientMessageId: string;
  optimisticId: string;
  role: OutboxSenderRole;
  targetUserId: string;
  backendId: string;
  text: string;
  type: "text" | "image" | "file" | "audio" | "video" | "video_note" | "poll" | "location";
  fileName?: string;
  mimeType?: string;
  audioDuration?: number;
  videoDuration?: number;
  offlineMediaKey?: string;
  remoteMediaUrl?: string;
  telegramMediaUrl?: string;
  replyTo?: { id: string; text: string; sender: string };
  location?: { lat: number; lng: number; address: string; mapUrl?: string };
  pollQuestion?: string;
  pollOptions?: { id: number; text: string; votes: number }[];
  metadata?: Record<string, any>;
  retryCount: number;
  nextRetryAt: number;
  createdAt: string;
  lastError?: string;
  permanentFailure?: boolean;
}

const DB_NAME = "guli_chat_offline_db_v1";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const MEDIA_STORE = "media";
const FALLBACK_OUTBOX_KEY = "guli_chat_offline_outbox_v1";
const MAX_LOCAL_MEDIA_BYTES = 1_500_000;

const memoryMedia = new Map<string, OfflineMediaBlobRecord>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDb()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          db.createObjectStore(OUTBOX_STORE, { keyPath: "clientMessageId" });
        }
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE, { keyPath: "key" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function readFallbackOutbox(): OfflineOutboxItem[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(FALLBACK_OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackOutbox(items: OfflineOutboxItem[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(FALLBACK_OUTBOX_KEY, JSON.stringify(items.slice(-200)));
  } catch {}
}

export function computeNextRetryDelay(retryCount: number): number {
  const step = Math.max(0, Math.min(Number(retryCount) || 0, 6));
  const base = Math.min(60_000, 2_000 * Math.pow(2, step));
  const jitter = Math.floor(base * 0.15 * Math.random());
  return base + jitter;
}

export async function saveOfflineMedia(record: OfflineMediaBlobRecord): Promise<void> {
  memoryMedia.set(record.key, record);
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(MEDIA_STORE, "readwrite");
        tx.objectStore(MEDIA_STORE).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    return;
  }
  // Safe fallback only for moderately sized blobs when IDB is unavailable
  if (record.dataUrl.length <= MAX_LOCAL_MEDIA_BYTES && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(`guli_chat_media_${record.key}`, JSON.stringify(record));
    } catch {}
  }
}

export async function getOfflineMedia(key: string): Promise<OfflineMediaBlobRecord | null> {
  if (!key) return null;
  const cached = memoryMedia.get(key);
  if (cached) return cached;
  const db = await openDb();
  if (db) {
    const found = await new Promise<OfflineMediaBlobRecord | null>((resolve) => {
      try {
        const tx = db.transaction(MEDIA_STORE, "readonly");
        const req = tx.objectStore(MEDIA_STORE).get(key);
        req.onsuccess = () => resolve((req.result as OfflineMediaBlobRecord) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (found) {
      memoryMedia.set(key, found);
      return found;
    }
  }
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(`guli_chat_media_${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as OfflineMediaBlobRecord;
        if (parsed?.dataUrl) {
          memoryMedia.set(key, parsed);
          return parsed;
        }
      }
    }
  } catch {}
  return null;
}

export async function deleteOfflineMedia(key: string): Promise<void> {
  if (!key) return;
  memoryMedia.delete(key);
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(`guli_chat_media_${key}`);
  } catch {}
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(MEDIA_STORE, "readwrite");
      tx.objectStore(MEDIA_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getOfflineOutbox(): Promise<OfflineOutboxItem[]> {
  const db = await openDb();
  if (db) {
    const rows = await new Promise<OfflineOutboxItem[]>((resolve) => {
      try {
        const tx = db.transaction(OUTBOX_STORE, "readonly");
        const req = tx.objectStore(OUTBOX_STORE).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
    if (rows.length) {
      return rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
  }
  return readFallbackOutbox().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function enqueueOfflineMessage(item: OfflineOutboxItem): Promise<void> {
  const db = await openDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(OUTBOX_STORE, "readwrite");
        tx.objectStore(OUTBOX_STORE).put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    // Also mirror compact metadata into fallback without large data
    const fb = readFallbackOutbox().filter(x => x.clientMessageId !== item.clientMessageId);
    fb.push(item);
    writeFallbackOutbox(fb);
    return;
  }
  const fb = readFallbackOutbox().filter(x => x.clientMessageId !== item.clientMessageId);
  fb.push(item);
  writeFallbackOutbox(fb);
}

export async function updateOfflineOutboxItem(
  clientMessageId: string,
  patch: Partial<OfflineOutboxItem>
): Promise<void> {
  const items = await getOfflineOutbox();
  const existing = items.find(i => i.clientMessageId === clientMessageId);
  if (!existing) return;
  await enqueueOfflineMessage({ ...existing, ...patch });
}

export async function removeOfflineOutboxItem(clientMessageId: string): Promise<void> {
  const fb = readFallbackOutbox().filter(x => x.clientMessageId !== clientMessageId);
  writeFallbackOutbox(fb);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).delete(clientMessageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
