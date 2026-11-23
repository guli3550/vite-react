// Unified realtime + offline sync bridge for Telegram Mini App, browser-linked users, guests, and admin.
import { getApiBaseUrl, CANONICAL_GATEWAY_URL } from "../lib/apiOrigin";
import {
  ensureGuestChatSession,
  flushOfflineOutbox,
  getChatAuthHeaders,
  getStoredChatMessages,
  mergeIncomingChatMessages,
  saveChatMessages,
} from "./chatSync";

const API_URL = getApiBaseUrl();
const GUEST_ID_KEY = "guli_chat_guest_id";
const GUEST_TOKEN_KEY = "guli_chat_guest_token";
const LINKED_ID_KEY = "guli_chat_linked_telegram_id";
const LINKED_TOKEN_KEY = "guli_chat_linked_token";

let activeConnectionKey = "";
let sseConnected = false;
let currentScopeId = "";
let wakeupResolver: (() => void) | null = null;
const lastSyncedAtByScope = new Map<string, string>();
const historyInFlightByScope = new Map<string, Promise<void>>();

function isAdmin(): boolean {
  return typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "") === "/admin";
}

function telegramInitData(): string {
  return typeof window !== "undefined" ? String((window as any).Telegram?.WebApp?.initData || "") : "";
}

function linkedTelegramId(): string {
  const raw = String(localStorage.getItem(LINKED_ID_KEY) || "").trim();
  return /^\d+$/.test(raw) ? raw : "";
}

function linkedTelegramToken(): string {
  return String(localStorage.getItem(LINKED_TOKEN_KEY) || "").trim();
}

function getGuestId(): string {
  const existing = Number(localStorage.getItem(GUEST_ID_KEY) || 0);
  if (Number.isSafeInteger(existing) && existing < 0) return String(existing);
  const id = -Math.floor(100000000000000 + Math.random() * 800000000000000);
  try {
    localStorage.setItem(GUEST_ID_KEY, String(id));
  } catch {}
  return String(id);
}

function setStreamStatus(connected: boolean, scope: string) {
  sseConnected = connected;
  try {
    window.dispatchEvent(
      new CustomEvent("guli_chat_stream_status", { detail: { connected, scope } })
    );
  } catch {}
}

function wakeupLoop() {
  if (wakeupResolver) {
    const fn = wakeupResolver;
    wakeupResolver = null;
    fn();
  }
}

function waitInterruptible(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (wakeupResolver === done) wakeupResolver = null;
      resolve();
    }, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    wakeupResolver = done;
  });
}

function resolveFetchBase(): string {
  return API_URL || CANONICAL_GATEWAY_URL;
}

function computeSinceCursor(scopeId: string): string | undefined {
  const known = lastSyncedAtByScope.get(scopeId);
  if (known) return known;
  try {
    const stored = getStoredChatMessages().filter((m) => m.id !== "welcome-msg-1" && m.deliveryStatus !== "queued" && m.deliveryStatus !== "sending");
    let latestMs = 0;
    for (const m of stored) {
      if (scopeId !== "all" && String(m.userId || "") !== String(scopeId) && !(Number(scopeId) < 0 && (String(m.userId) === "guest-user" || Number(m.userId) < 0))) {
        continue;
      }
      const ms = new Date(m.timestamp).getTime();
      if (Number.isFinite(ms) && ms > latestMs) latestMs = ms;
    }
    if (latestMs > 0) {
      // Subtract 5 seconds overlap to avoid boundary misses
      return new Date(Math.max(0, latestMs - 5000)).toISOString();
    }
  } catch {}
  return undefined;
}

async function fetchHistory(id: string, useIncremental = true): Promise<void> {
  if (!id || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
  const existing = historyInFlightByScope.get(id);
  if (existing) return existing;

  const task = (async () => {
    try {
      const headers = getChatAuthHeaders(id === "all" ? "admin" : "customer");
      if (id === "all" && !headers.Authorization) return;
      if (id !== "all" && !Object.keys(headers).length) return;

      const since = useIncremental ? computeSinceCursor(id) : undefined;
      const basePath = id === "all" ? "/api/admin/chat/messages" : `/api/chat/messages/${encodeURIComponent(id)}`;
      const query = since ? `?since=${encodeURIComponent(since)}` : "";
      const res = await fetch(`${resolveFetchBase()}${basePath}${query}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.data)) {
        if (json.data.length > 0) {
          mergeIncomingChatMessages(json.data);
        }
        const cursorTime =
          json?.meta?.serverTime ||
          json.data[json.data.length - 1]?.created_at ||
          json.data[json.data.length - 1]?.timestamp ||
          new Date().toISOString();
        lastSyncedAtByScope.set(id, String(cursorTime));
      }
    } catch (err) {
      console.warn("[Chat realtime] history failed", err);
    } finally {
      historyInFlightByScope.delete(id);
    }
  })();

  historyInFlightByScope.set(id, task);
  return task;
}

function handleSseChunk(scopeId: string, chunk: string) {
  const lines = chunk.split("\n");
  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLines = lines.filter((line) => line.startsWith("data:")).map((l) => l.slice(5).trim());
  if (!dataLines.length) return;

  const eventName = eventLine ? eventLine.slice(6).trim() : "message";
  const rawPayload = dataLines.join("\n");

  if (eventName === "ping" || eventName === "heartbeat") return;

  if (eventName === "ready") {
    setStreamStatus(true, scopeId);
    void fetchHistory(scopeId, true);
    void flushOfflineOutbox();
    return;
  }

  if (eventName === "presence") {
    try {
      const payload = JSON.parse(rawPayload || "{}");
      window.dispatchEvent(new CustomEvent("guli_chat_presence_updated", { detail: payload }));
    } catch {}
    return;
  }

  if (eventName === "read_receipt") {
    try {
      const receipt = JSON.parse(rawPayload || "{}");
      const ids = new Set((receipt.message_ids || []).map(String));
      if (!ids.size) return;
      const current = getStoredChatMessages();
      let changed = false;
      const updated = current.map((m) => {
        if (ids.has(String(m.id)) && !m.read) {
          changed = true;
          return { ...m, read: true };
        }
        return m;
      });
      if (changed) saveChatMessages(updated);
    } catch {}
    return;
  }

  try {
    const parsed = JSON.parse(rawPayload);
    if (parsed && typeof parsed === "object") {
      mergeIncomingChatMessages([parsed]);
      const ts = parsed.created_at || parsed.timestamp;
      if (ts) lastSyncedAtByScope.set(scopeId, String(ts));
    }
  } catch {}
}

async function connect(id: string): Promise<void> {
  if (id === "all") {
    if (!getChatAuthHeaders("admin").Authorization) return;
  } else if (
    !telegramInitData() &&
    !linkedTelegramToken() &&
    !localStorage.getItem(GUEST_TOKEN_KEY) &&
    !localStorage.getItem("guli_access_token")
  ) {
    return;
  }

  currentScopeId = id;
  await fetchHistory(id, true);
  void flushOfflineOutbox();

  let attempt = 0;
  for (;;) {
    if (currentScopeId !== id) return;

    if (
      (typeof document !== "undefined" && document.visibilityState === "hidden") ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      setStreamStatus(false, id);
      await waitInterruptible(15000);
      continue;
    }

    const controller = new AbortController();
    const onOfflineAbort = () => controller.abort();
    window.addEventListener("offline", onOfflineAbort, { once: true });

    try {
      const streamBase = CANONICAL_GATEWAY_URL || API_URL;
      const response = await fetch(`${streamBase}/api/chat/stream/${encodeURIComponent(id)}`, {
        headers: getChatAuthHeaders(id === "all" ? "admin" : "customer"),
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`stream ${response.status}`);
      }

      attempt = 0;
      setStreamStatus(true, id);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          if (chunk.trim()) handleSseChunk(id, chunk);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Offline / intentional abort
      } else {
        console.warn("[Chat realtime] stream reconnect", err);
      }
    } finally {
      window.removeEventListener("offline", onOfflineAbort);
      setStreamStatus(false, id);
    }

    attempt = Math.min(attempt + 1, 5);
    const baseDelay = Math.min(30000, 1500 * Math.pow(2, attempt - 1));
    const jitter = Math.floor(Math.random() * 800);
    await waitInterruptible(baseDelay + jitter);
  }
}

async function startForCurrentContext(): Promise<void> {
  let id = "";
  let key = "";

  if (isAdmin()) {
    const token = sessionStorage.getItem("guli_admin_token") || localStorage.getItem("guli_admin_token") || "";
    if (!token) return;
    id = "all";
    key = `admin:${token.slice(0, 16)}`;
  } else if (telegramInitData() || localStorage.getItem("guli_access_token")) {
    let idValue = String((window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id || "").trim();
    if (!idValue) {
      try {
        idValue = String(JSON.parse(localStorage.getItem("guli_auth_user") || "{}")?.telegram_id || "").trim();
      } catch {}
    }
    if (!idValue && linkedTelegramId()) idValue = linkedTelegramId();
    if (!idValue) return;
    id = idValue;
    key = `telegram:${id}`;
  } else if (linkedTelegramId() && linkedTelegramToken()) {
    id = linkedTelegramId();
    key = `linked:${id}`;
  } else {
    await ensureGuestChatSession();
    id = getGuestId();
    key = `guest:${id}`;
  }

  if (!id || activeConnectionKey === key) return;
  activeConnectionKey = key;
  void connect(id);
}

function installAuthFetch() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  if ((window as any).__guliAuthFetchInstalled) return;
  (window as any).__guliAuthFetchInstalled = true;

  const currentFetch = window.fetch.bind(window);
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(API_URL) || (CANONICAL_GATEWAY_URL && url.startsWith(CANONICAL_GATEWAY_URL))) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const defaults = getChatAuthHeaders();
      for (const [k, v] of Object.entries(defaults)) {
        if (v && !headers.has(k)) headers.set(k, v);
      }
      return currentFetch(input, { ...init, headers });
    }
    return currentFetch(input, init);
  };

  try {
    Object.defineProperty(window, "fetch", {
      value: customFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      (window as any).fetch = customFetch;
    } catch {}
  }
}

if (typeof window !== "undefined") {
  const OriginalBroadcastChannel = window.BroadcastChannel;
  if (OriginalBroadcastChannel && !(OriginalBroadcastChannel.prototype as any).__guliGuarded) {
    const originalAdd = OriginalBroadcastChannel.prototype.addEventListener;
    OriginalBroadcastChannel.prototype.addEventListener = function (
      type: string,
      listener: EventListener | EventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ) {
      if (listener === null) return;
      return originalAdd.call(this, type, listener, options);
    };
    (OriginalBroadcastChannel.prototype as any).__guliGuarded = true;
  }

  installAuthFetch();
  void ensureGuestChatSession();

  window.addEventListener("online", () => {
    wakeupLoop();
    void flushOfflineOutbox();
    if (currentScopeId) void fetchHistory(currentScopeId, true);
    else void startForCurrentContext();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      wakeupLoop();
      if (navigator.onLine !== false) {
        void flushOfflineOutbox();
        if (currentScopeId && !sseConnected) {
          void fetchHistory(currentScopeId, true);
        }
      }
    }
  });

  setTimeout(() => void startForCurrentContext(), 200);
  setTimeout(() => void startForCurrentContext(), 1500);

  // Low-overhead safety recovery ONLY when SSE is disconnected AND tab is active & online
  setInterval(() => {
    if (
      sseConnected ||
      document.visibilityState !== "visible" ||
      (typeof navigator !== "undefined" && navigator.onLine === false)
    ) {
      return;
    }
    if (currentScopeId) {
      void fetchHistory(currentScopeId, true);
      void flushOfflineOutbox();
    } else {
      void startForCurrentContext();
    }
  }, 45000);
}
