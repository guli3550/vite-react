import { getApiBaseUrl, CANONICAL_GATEWAY_URL } from "../lib/apiOrigin";
import {
  saveOfflineMedia,
  getOfflineMedia,
  deleteOfflineMedia,
  enqueueOfflineMessage,
  getOfflineOutbox,
  updateOfflineOutboxItem,
  removeOfflineOutboxItem,
  computeNextRetryDelay,
  type OfflineOutboxItem,
} from "./chatOfflineQueue";

export type ChatSender = "user" | "admin";
export type ChatDeliveryStatus = "queued" | "sending" | "sent" | "failed";

export type ChatMessage = {
  id: string;
  sender: ChatSender;
  text: string;
  timestamp: string;
  read: boolean;
  userId?: number | string;
  userName?: string;
  userPhoto?: string;
  orderNumber?: string;
  type?: "text" | "image" | "file" | "audio" | "video" | "video_note" | "poll" | "location";
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  audioDuration?: number;
  videoDuration?: number;
  deliveryStatus?: ChatDeliveryStatus;
  deliveryError?: string;
  clientMessageId?: string;
  offlineMediaKey?: string;
  isEdited?: boolean;
  editedAt?: string;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  reactions?: Record<string, number>;
  pollQuestion?: string;
  pollOptions?: { id: number; text: string; votes: number }[];
  userVotedOption?: number;
  location?: { lat: number; lng: number; address: string; mapUrl?: string };
  pinned?: boolean;
  isBookmarked?: boolean;
  metadata?: Record<string, any>;
};

export type ConversationSource = "telegram" | "webapp" | "callcenter";
export type ConversationMetadata = {
  source?: ConversationSource;
  phone?: string;
  telegramUsername?: string;
  telegramId?: string | number;
  assignedOperator?: string;
  status?: "open" | "closed" | "pending";
  notes?: string;
  orderCount?: number;
  lastOrderNumber?: string;
  lastOrderStatus?: string;
  lastOrderTotal?: number;
};
export type ConversationSummary = {
  userId: string;
  userName: string;
  userPhoto?: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  source: ConversationSource;
  phone?: string;
  telegramUsername?: string;
  assignedOperator?: string;
  status: "open" | "closed" | "pending";
  notes?: string;
  orderCount?: number;
  lastOrderNumber?: string;
  lastOrderStatus?: string;
  lastOrderTotal?: number;
};

const STORAGE_KEY = "guli_chat_messages";
const METADATA_KEY = "guli_chat_conv_metadata";
const NOTIFICATIONS_KEY = "guli_unread_notifications_count";
const GUEST_ID_KEY = "guli_chat_guest_id";
const GUEST_TOKEN_KEY = "guli_chat_guest_token";
const LINKED_ID_KEY = "guli_chat_linked_telegram_id";
const LINKED_TOKEN_KEY = "guli_chat_linked_token";
const CHANNEL_NAME = "guli_chat_channel_v1";
const API_URL = getApiBaseUrl();
const MAX_LOCAL_MEDIA_DATAURL_LEN = 120_000;

let flushInFlight: Promise<number> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const memoryMediaPreviewUrls = new Map<string, string>();

export function getChatAuthHeaders(role?: "customer" | "admin"): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const isAdminPath = role === "admin" || (role !== "customer" && window.location.pathname.replace(/\/$/, "") === "/admin");
  const adminToken = sessionStorage.getItem("guli_admin_token") || localStorage.getItem("guli_admin_token") || "";
  if (isAdminPath) {
    if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
    return headers;
  }
  const tgInit = String((window as any).Telegram?.WebApp?.initData || "");
  if (tgInit) {
    headers["X-Telegram-Init-Data"] = tgInit;
    return headers;
  }
  const linkedToken = String(localStorage.getItem(LINKED_TOKEN_KEY) || "").trim();
  const accessToken = String(localStorage.getItem("guli_access_token") || "").trim();
  const guestToken = String(localStorage.getItem(GUEST_TOKEN_KEY) || "").trim();
  if (linkedToken) headers["X-Guli-Linked-Token"] = linkedToken;
  else if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else if (guestToken) headers["X-Guli-Guest-Token"] = guestToken;
  return headers;
}

export async function chatFetch(path: string, init: RequestInit): Promise<Response> {
  const primary = API_URL + path;
  try {
    const response = await fetch(primary, init);
    if (response.ok || response.status < 500 || API_URL === CANONICAL_GATEWAY_URL) {
      return response;
    }
  } catch (error) {
    if (API_URL === CANONICAL_GATEWAY_URL) throw error;
    try {
      return await fetch(CANONICAL_GATEWAY_URL + path, init);
    } catch {
      throw error;
    }
  }
  return fetch(CANONICAL_GATEWAY_URL + path, init);
}

export async function ensureGuestChatSession(): Promise<{ guestId: string; token: string } | null> {
  if (typeof window === "undefined") return null;
  if (window.location.pathname.replace(/\/$/, "") === "/admin") return null;
  const tgInit = String((window as any).Telegram?.WebApp?.initData || "");
  if (tgInit) return null;
  const linkedId = String(localStorage.getItem(LINKED_ID_KEY) || "").trim();
  const linkedToken = String(localStorage.getItem(LINKED_TOKEN_KEY) || "").trim();
  if (linkedId && linkedToken) return null;

  const existingId = Number(localStorage.getItem(GUEST_ID_KEY) || 0);
  const existingToken = String(localStorage.getItem(GUEST_TOKEN_KEY) || "").trim();
  if (Number.isSafeInteger(existingId) && existingId < 0 && existingToken) {
    return { guestId: String(existingId), token: existingToken };
  }

  try {
    const res = await chatFetch("/api/chat/guest-session", { cache: "no-store" });
    const json = await res.json().catch(() => null);
    const guestId = Number(json?.guest_id);
    if (res.ok && json?.success && json?.token && Number.isSafeInteger(guestId) && guestId < 0) {
      localStorage.setItem(GUEST_ID_KEY, String(guestId));
      localStorage.setItem(GUEST_TOKEN_KEY, String(json.token));
      return { guestId: String(guestId), token: String(json.token) };
    }
  } catch {}
  return null;
}

export function resolveBackendCustomerId(user?: { id?: number | string }): string {
  if (user?.id !== undefined && user?.id !== null && String(user.id).trim() && String(user.id) !== "guest-user") {
    return String(user.id);
  }
  if (typeof window !== "undefined") {
    const tgUserId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tgUserId) return String(tgUserId);
    const linkedId = String(localStorage.getItem(LINKED_ID_KEY) || "").trim();
    if (/^\d+$/.test(linkedId)) return linkedId;
    const storedGuest = Number(localStorage.getItem(GUEST_ID_KEY) || 0);
    if (Number.isSafeInteger(storedGuest) && storedGuest < 0) return String(storedGuest);
    const createdGuest = String(-Math.floor(100000000000000 + Math.random() * 800000000000000));
    try {
      localStorage.setItem(GUEST_ID_KEY, createdGuest);
    } catch {}
    return createdGuest;
  }
  return "guest-user";
}

export function matchesCustomerChatScope(msgUserId: unknown, scopeUserId?: string | number): boolean {
  if (!scopeUserId) return true;
  const scope = String(scopeUserId);
  const target = msgUserId !== undefined && msgUserId !== null ? String(msgUserId) : "";
  if (!target) return true;
  if (target === scope) return true;
  const storedGuest =
    typeof localStorage !== "undefined" ? String(localStorage.getItem(GUEST_ID_KEY) || "").trim() : "";
  const isScopeGuest = scope === "guest-user" || Number(scope) < 0;
  if (isScopeGuest) {
    if (target === "guest-user") return true;
    if (storedGuest && target === storedGuest) return true;
    if (Number.isFinite(Number(target)) && Number(target) < 0) return true;
  }
  return false;
}

function resolveAbsoluteUrl(rawUrl: unknown, apiBase = API_URL): string | undefined {
  if (!rawUrl) return undefined;
  const s = String(rawUrl).trim();
  if (!s) return undefined;
  if (
    s.startsWith("http://") ||
    s.startsWith("https://") ||
    s.startsWith("data:") ||
    s.startsWith("blob:")
  ) {
    return s;
  }
  return `${apiBase}${s.startsWith("/") ? "" : "/"}${s}`;
}

function inferMessageType(rawType: unknown, mediaUrl?: string, mimeType?: string, fileName?: string, hasLocation?: boolean, hasPoll?: boolean): ChatMessage["type"] {
  const t = String(rawType || "").toLowerCase();
  if (t === "video_note" || t === "video" || t === "audio" || t === "image" || t === "file" || t === "location" || t === "poll" || t === "text") {
    return t;
  }
  if (t === "voice") return "audio";
  if (hasLocation) return "location";
  if (hasPoll) return "poll";
  const m = String(mimeType || "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  const probe = `${mediaUrl || ""} ${fileName || ""}`.toLowerCase();
  if (/\.(jpe?g|png|webp|gif|bmp)(\?|$)/i.test(probe)) return "image";
  if (/\.(mp4|mov|m4v|3gp)(\?|$)/i.test(probe)) return "video";
  if (/\.(ogg|oga|opus|mp3|wav|aac|m4a)(\?|$)/i.test(probe)) return "audio";
  if (mediaUrl) return "file";
  return "text";
}

export function normalizeChatMessage(raw: any, apiBase = API_URL): ChatMessage {
  const meta = raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  const rawMedia = raw?.mediaUrl || raw?.media_url || meta.mediaUrl || meta.media_url;
  const mediaUrl = resolveAbsoluteUrl(rawMedia, apiBase);
  const rawPhoto =
    raw?.userPhoto ||
    raw?.user_photo ||
    meta.userPhoto ||
    meta.user_photo ||
    meta.customer?.photoUrl ||
    meta.customer?.photo_url;
  const userPhoto = resolveAbsoluteUrl(rawPhoto, apiBase);
  const fileName = raw?.fileName || raw?.file_name || meta.fileName || meta.file_name;
  const mimeType = raw?.mimeType || raw?.mime_type || meta.mimeType || meta.mime_type;
  const location = raw?.location || meta.location;
  const pollOptions = Array.isArray(raw?.pollOptions)
    ? raw.pollOptions
    : Array.isArray(meta.pollOptions)
      ? meta.pollOptions
      : undefined;
  const pollQuestion = raw?.pollQuestion || meta.pollQuestion;
  const type = inferMessageType(
    raw?.type || meta.type || meta.messageType,
    mediaUrl,
    mimeType,
    fileName,
    Boolean(location?.lat && location?.lng),
    Boolean(pollOptions?.length)
  );
  const audioDuration = raw?.audioDuration ?? meta.audioDuration;
  const videoDuration = raw?.videoDuration ?? meta.videoDuration;
  const customer = meta.customer || raw?.customer || {};
  const userName =
    raw?.userName ||
    meta.userName ||
    meta.user_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ").trim() ||
    customer.full_name ||
    customer.username ||
    undefined;

  const clientMessageId = raw?.clientMessageId || raw?.client_message_id || meta.clientMessageId || meta.client_message_id;
  const sender: ChatSender = raw?.sender === "customer" || raw?.sender === "user" ? "user" : "admin";
  const readFromServer = Boolean(raw?.read || raw?.read_at || meta.read_at);
  const isLocalUnsent = raw?.deliveryStatus === "queued" || raw?.deliveryStatus === "sending" || raw?.deliveryStatus === "failed";

  return {
    ...raw,
    id: String(raw?.id ?? `rt-${Date.now()}`),
    sender,
    read: sender === "user" ? readFromServer : Boolean(raw?.read || meta.read_at),
    text: String(raw?.text || "").trim(),
    timestamp: raw?.created_at || raw?.timestamp || new Date().toISOString(),
    userId: raw?.telegram_id ?? raw?.userId,
    userName,
    userPhoto,
    mediaUrl,
    fileName,
    mimeType,
    type,
    audioDuration: audioDuration !== undefined ? Number(audioDuration) : undefined,
    videoDuration: videoDuration !== undefined ? Number(videoDuration) : undefined,
    location,
    pollOptions,
    pollQuestion,
    replyToId: raw?.replyToId || meta.replyToId,
    replyToText: raw?.replyToText || meta.replyToText,
    replyToSender: raw?.replyToSender || meta.replyToSender,
    clientMessageId: clientMessageId ? String(clientMessageId) : undefined,
    deliveryStatus: raw?.deliveryStatus || (isLocalUnsent ? raw.deliveryStatus : "sent"),
    metadata: { ...meta, ...(customer && Object.keys(customer).length ? { customer } : {}) },
  };
}

export async function resolveQueuedMediaUrl(offlineMediaKey?: string): Promise<string | undefined> {
  if (!offlineMediaKey) return undefined;
  const cached = memoryMediaPreviewUrls.get(offlineMediaKey);
  if (cached) return cached;
  const record = await getOfflineMedia(offlineMediaKey);
  if (record?.dataUrl) {
    memoryMediaPreviewUrls.set(offlineMediaKey, record.dataUrl);
    return record.dataUrl;
  }
  return undefined;
}

export function getStoredMetadataMap(): Record<string, ConversationMetadata> {
  try {
    const raw = localStorage.getItem(METADATA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveMetadataMap(map: Record<string, ConversationMetadata>): void {
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("guli_chat_metadata_updated", { detail: map }));
  } catch (err) {
    console.error("Failed to save conversation metadata:", err);
  }
}

export function updateConversationMetadata(userId: string | number, meta: Partial<ConversationMetadata>): void {
  const uId = String(userId);
  const current = getStoredMetadataMap();
  current[uId] = {
    ...(current[uId] || { source: uId.includes("telegram") ? "telegram" : "webapp", status: "open" }),
    ...meta,
  };
  saveMetadataMap(current);
}

export function editChatMessage(messageId: string, newText: string): void {
  const messages = getStoredChatMessages();
  const updated = messages.map((m) =>
    m.id === messageId ? { ...m, text: newText.trim(), isEdited: true, editedAt: new Date().toISOString() } : m
  );
  if (updated.some((m, i) => m !== messages[i])) saveChatMessages(updated);
}

export function deleteChatMessage(messageId: string): void {
  const messages = getStoredChatMessages();
  const target = messages.find((m) => String(m.id) === String(messageId));
  if (target?.clientMessageId) {
    void removeOfflineOutboxItem(target.clientMessageId);
  }
  if (target?.offlineMediaKey) {
    void deleteOfflineMedia(target.offlineMediaKey);
  }
  const filtered = messages.filter((m) => String(m.id) !== String(messageId));
  if (filtered.length !== messages.length) saveChatMessages(filtered);
}

export function toggleMessageReaction(messageId: string, emoji: string): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map((m) => {
    if (m.id !== messageId) return m;
    changed = true;
    const reactions = { ...(m.reactions || {}) };
    if (reactions[emoji]) delete reactions[emoji];
    else reactions[emoji] = 1;
    return { ...m, reactions };
  });
  if (changed) saveChatMessages(updated);
}

export function votePollOption(messageId: string, optionIndex: number): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map((m) => {
    if (m.id !== messageId || !m.pollOptions) return m;
    changed = true;
    const prev = m.userVotedOption;
    const options = m.pollOptions.map((opt, idx) => ({
      ...opt,
      votes: Math.max(0, (opt.votes || 0) - (prev === idx ? 1 : 0) + (optionIndex === idx ? 1 : 0)),
    }));
    return { ...m, pollOptions: options, userVotedOption: prev === optionIndex ? undefined : optionIndex };
  });
  if (changed) saveChatMessages(updated);
}

export function togglePinMessage(messageId: string): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map((m) => {
    if (m.id !== messageId) return m;
    changed = true;
    return { ...m, pinned: !m.pinned };
  });
  if (changed) saveChatMessages(updated);
}

export function toggleBookmarkMessage(messageId: string): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map((m) => {
    if (m.id !== messageId) return m;
    changed = true;
    return { ...m, isBookmarked: !m.isBookmarked };
  });
  if (changed) saveChatMessages(updated);
}

export function clearChatMessages(userId?: string | number): void {
  const messages = getStoredChatMessages();
  if (!userId) {
    saveChatMessages([DEFAULT_WELCOME_MESSAGE]);
    return;
  }
  const remaining = messages.filter(
    (m) => m.id === "welcome-msg-1" || !matchesCustomerChatScope(m.userId, userId)
  );
  saveChatMessages(remaining.length === 0 ? [DEFAULT_WELCOME_MESSAGE] : remaining);
}

export function isChatMessageValid(m: any): boolean {
  if (!m || typeof m !== "object") return false;
  if (m.type === "ping" || m.type === "heartbeat" || m.ping || m.event === "ping") return false;
  const text = String(m.text || "").trim();
  const mediaUrl = m.mediaUrl || m.media_url || m.metadata?.mediaUrl || m.metadata?.media_url;
  const hasOfflineMedia = Boolean(m.offlineMediaKey);
  const hasPoll = Array.isArray(m.pollOptions) && m.pollOptions.length > 0;
  const hasLocation = Boolean(m.location?.lat && m.location?.lng);
  return Boolean(text || mediaUrl || hasOfflineMedia || hasPoll || hasLocation);
}

export function mergeIncomingChatMessages(rawItems: any[]): ChatMessage[] {
  const list = Array.isArray(rawItems) ? rawItems : [];
  const current = getStoredChatMessages();
  const combined: ChatMessage[] = current.filter((m) => !String(m.id || "").startsWith("msg-sample-"));

  for (const raw of list) {
    if (!isChatMessageValid(raw)) continue;
    const m = normalizeChatMessage(raw);
    const clientKey = String(m.clientMessageId || m.metadata?.clientMessageId || m.metadata?.client_message_id || "").trim();
    const existingIdx = combined.findIndex(
      (lm) =>
        String(lm.id) === String(m.id) ||
        (clientKey &&
          String(lm.clientMessageId || lm.metadata?.clientMessageId || lm.metadata?.client_message_id || "").trim() ===
            clientKey)
    );
    if (existingIdx === -1) {
      combined.push(m);
    } else {
      const existing = combined[existingIdx];
      combined[existingIdx] = {
        ...existing,
        ...m,
        read: Boolean(existing.read || m.read),
        deliveryStatus: m.deliveryStatus || existing.deliveryStatus || "sent",
        mediaUrl: m.mediaUrl || existing.mediaUrl,
        fileName: m.fileName || existing.fileName,
        mimeType: m.mimeType || existing.mimeType,
        type: m.type || existing.type,
        audioDuration: m.audioDuration ?? existing.audioDuration,
        videoDuration: m.videoDuration ?? existing.videoDuration,
      };
    }
  }

  combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  saveChatMessages(combined);
  return combined;
}

export async function syncChatWithBackend(telegramId: string | number, sinceIso?: string): Promise<ChatMessage[]> {
  if (!telegramId) return getStoredChatMessages();
  try {
    const query = sinceIso ? `?since=${encodeURIComponent(sinceIso)}` : "";
    const res = await chatFetch(`/api/chat/messages/${encodeURIComponent(telegramId)}${query}`, {
      headers: getChatAuthHeaders(),
    });
    const json = await res.json().catch(() => null);
    if (json?.success && Array.isArray(json.data)) {
      return mergeIncomingChatMessages(json.data);
    }
  } catch {
    // Offline fallback cleanly keeps local cache
  }
  return getStoredChatMessages(telegramId);
}

export async function sendChatMessage(msg: Partial<ChatMessage>): Promise<ChatMessage | null> {
  if (!msg.userId || (!msg.text?.trim() && !msg.mediaUrl) || !msg.sender) return null;
  if (msg.sender === "user") {
    return sendUserMessage(
      msg.text || "",
      { id: msg.userId, first_name: msg.userName },
      msg.mediaUrl ? { type: msg.type as any, mediaUrl: msg.mediaUrl, fileName: msg.fileName } : undefined
    );
  }
  return sendAdminReply(
    String(msg.userId),
    msg.text || "",
    msg.mediaUrl ? { type: msg.type as any, mediaUrl: msg.mediaUrl, fileName: msg.fileName } : undefined
  );
}

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-msg-1",
  sender: "admin",
  text: "Assalomu alaykum! GULI Premium qo‘llab-quvvatlash xizmatiga xush kelibsiz ✨ Sizga qanday yordam bera olamiz? Savollaringiz bo‘lsa bemalol yozing.",
  timestamp: new Date().toISOString(),
  read: true,
  userName: "GULI Support",
};

export function getStoredChatMessages(userId?: string | number): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([DEFAULT_WELCOME_MESSAGE]));
      return [DEFAULT_WELCOME_MESSAGE];
    }
    const parsed: ChatMessage[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_WELCOME_MESSAGE];
    const valid = parsed.filter(isChatMessageValid);
    if (valid.length !== parsed.length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(valid.length === 0 ? [DEFAULT_WELCOME_MESSAGE] : valid));
      } catch {}
    }
    if (valid.length === 0) return [DEFAULT_WELCOME_MESSAGE];
    const hydrated = valid.map((m) => {
      if (m.offlineMediaKey && !m.mediaUrl) {
        const memUrl = memoryMediaPreviewUrls.get(m.offlineMediaKey);
        if (memUrl) return { ...m, mediaUrl: memUrl };
      }
      return m;
    });
    if (userId) {
      return hydrated.filter((m) => m.id === "welcome-msg-1" || matchesCustomerChatScope(m.userId, userId));
    }
    return hydrated;
  } catch {
    return [DEFAULT_WELCOME_MESSAGE];
  }
}

function compactForStorage(messages: ChatMessage[], aggressive = false): ChatMessage[] {
  return messages.map((m) => {
    const rawUrl = String(m.mediaUrl || "");
    if (rawUrl.startsWith("data:") && (aggressive || rawUrl.length > MAX_LOCAL_MEDIA_DATAURL_LEN) && m.offlineMediaKey) {
      memoryMediaPreviewUrls.set(m.offlineMediaKey, rawUrl);
      return { ...m, mediaUrl: undefined };
    }
    return m;
  });
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    const valid = messages.filter(isChatMessageValid);
    const toSave = valid.length === 0 ? [DEFAULT_WELCOME_MESSAGE] : valid;
    const storageList = compactForStorage(toSave, false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storageList));
    } catch {
      const ultraCompact = compactForStorage(storageList.slice(-250), true);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraCompact));
    }

    const unreadCount = toSave.filter((m) => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1").length;
    localStorage.setItem(NOTIFICATIONS_KEY, String(unreadCount));

    broadcastChannel?.postMessage({ type: "SYNC_MESSAGES", messages: storageList });
    window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: toSave }));
    window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: unreadCount }));
  } catch (err) {
    console.error("Error saving chat messages:", err);
  }
}

export function getUnreadMessages(userId?: string | number): ChatMessage[] {
  return getStoredChatMessages(userId).filter((m) => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1");
}

export function getUnreadAdminMessagesCount(userId?: string | number): number {
  return getStoredChatMessages(userId).filter((m) => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1").length;
}

export function markSingleMessageAsRead(messageId: string, userId?: string | number): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map((m) => {
    if (String(m.id) === String(messageId) && !m.read) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });
  if (changed) {
    saveChatMessages(updated);
    const unreadCount = getUnreadAdminMessagesCount(userId);
    localStorage.setItem(NOTIFICATIONS_KEY, String(unreadCount));
    window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: unreadCount }));
  }
}

export async function markServerCustomerMessagesRead(userId?: string | number): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.location.pathname.replace(/\/$/, "") === "/admin") return;
  const unread = getUnreadMessages(userId);
  if (!unread.length) return;
  const headers = getChatAuthHeaders("customer");
  if (!Object.keys(headers).length) return;
  try {
    await chatFetch("/api/chat/customer-read", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({}),
    });
  } catch {}
}

export function markMessagesAsRead(userId?: string | number, role: "admin" | "user" = "user"): void {
  if (!userId && role === "admin") return;
  const messages = getStoredChatMessages();
  const target = role === "admin" ? "user" : "admin";
  let changed = false;
  const updated = messages.map((m) => {
    const matchesUser = userId ? matchesCustomerChatScope(m.userId || "guest-user", userId) : true;
    if (m.sender === target && !m.read && matchesUser) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });
  if (changed) {
    saveChatMessages(updated);
    if (role === "user") {
      localStorage.setItem(NOTIFICATIONS_KEY, "0");
      window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: 0 }));
      void markServerCustomerMessagesRead(userId);
    }
  }
}

export function markAllAdminChatRead(): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map((m) => {
    if (m.sender === "user" && !m.read) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });
  if (changed) {
    saveChatMessages(updated);
  }
}

export function getTotalUnreadChatCount(): number {
  return getAllConversations().reduce((sum, c) => sum + (c.unreadCount || 0), 0);
}

function updateStoredMessageByKey(optimisticId: string, clientMessageId: string, updater: (m: ChatMessage) => ChatMessage): void {
  const current = getStoredChatMessages();
  let changed = false;
  const next = current.map((m) => {
    const cId = m.clientMessageId || m.metadata?.clientMessageId;
    if (String(m.id) === String(optimisticId) || (clientMessageId && cId === clientMessageId)) {
      changed = true;
      return updater(m);
    }
    return m;
  });
  if (changed) saveChatMessages(next);
}

async function uploadMediaPayload(
  backendId: string,
  role: "customer" | "admin",
  dataUrl: string,
  type: string,
  fileName?: string,
  mimeType?: string
): Promise<{ mediaUrl: string; telegramMediaUrl: string; mediaPath: string; fileName: string; mimeType: string; type: ChatMessage["type"] }> {
  const match = dataUrl.match(/^data:([^;]+)(?:;[^;,]+)*;base64,(.+)$/i);
  if (!match) throw new Error("Fayl formati noto‘g‘ri");
  const resolvedMime = String(mimeType || match[1] || "application/octet-stream").toLowerCase();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...getChatAuthHeaders(role) };
  const uploadRes = await chatFetch("/api/chat/media-upload", {
    method: "POST",
    headers,
    body: JSON.stringify({
      telegram_id: backendId,
      type: type || "file",
      data: dataUrl,
      mimeType: resolvedMime,
      fileName: fileName || "guli-chat-media",
    }),
  });
  const uploadJson = await uploadRes.json().catch(() => null);
  if (!uploadRes.ok || !uploadJson?.success || !uploadJson?.data?.mediaUrl) {
    const err = new Error(uploadJson?.message || `Media yuklash xatoligi: ${uploadRes.status}`) as Error & { status?: number };
    err.status = uploadRes.status;
    throw err;
  }
  return {
    mediaUrl: String(uploadJson.data.mediaUrl),
    telegramMediaUrl: String(uploadJson.data.telegramMediaUrl || ""),
    mediaPath: String(uploadJson.data.mediaPath || ""),
    fileName: String(uploadJson.data.fileName || fileName || "file"),
    mimeType: String(uploadJson.data.mimeType || resolvedMime),
    type: (uploadJson.data.type || type || "file") as ChatMessage["type"],
  };
}

function isPermanentHttpError(err: unknown): boolean {
  const status = Number((err as any)?.status || 0);
  // 400 Bad Request, 413 Payload Too Large, 415 Unsupported Media Type are permanent
  return status === 400 || status === 413 || status === 415;
}

async function transmitOutboxItem(item: OfflineOutboxItem): Promise<ChatMessage> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw Object.assign(new Error("Internet aloqasi yo‘q"), { offline: true });
  }

  let backendId = item.backendId;
  if (item.role === "customer") {
    const guestSess = await ensureGuestChatSession();
    if (guestSess?.guestId && (!backendId || backendId === "guest-user")) {
      backendId = guestSess.guestId;
    }
  }

  let persistedMediaUrl = item.remoteMediaUrl || "";
  let telegramMediaUrl = item.telegramMediaUrl || "";
  let resolvedType = item.type;
  let resolvedFileName = item.fileName;
  let resolvedMimeType = item.mimeType;

  if (!persistedMediaUrl && item.offlineMediaKey) {
    const blobRec = await getOfflineMedia(item.offlineMediaKey);
    if (blobRec?.dataUrl?.startsWith("data:")) {
      const uploaded = await uploadMediaPayload(
        backendId,
        item.role,
        blobRec.dataUrl,
        item.type,
        item.fileName || blobRec.fileName,
        item.mimeType || blobRec.mimeType
      );
      persistedMediaUrl = uploaded.mediaUrl;
      telegramMediaUrl = uploaded.telegramMediaUrl;
      resolvedType = uploaded.type || resolvedType;
      resolvedFileName = uploaded.fileName || resolvedFileName;
      resolvedMimeType = uploaded.mimeType || resolvedMimeType;

      // Save remote URL onto outbox item so if message POST fails, media doesn't need re-uploading
      await updateOfflineOutboxItem(item.clientMessageId, {
        remoteMediaUrl: persistedMediaUrl,
        telegramMediaUrl,
        type: resolvedType || item.type,
        fileName: resolvedFileName,
        mimeType: resolvedMimeType,
      });
    }
  }

  const endpoint = item.role === "admin" ? "/api/chat/admin-reply" : "/api/chat/messages";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getChatAuthHeaders(item.role),
  };

  const payloadMetadata = {
    ...(item.metadata || {}),
    clientMessageId: item.clientMessageId,
    type: resolvedType,
    mediaUrl: persistedMediaUrl || undefined,
    telegramMediaUrl: telegramMediaUrl || undefined,
    fileName: resolvedFileName,
    mimeType: resolvedMimeType,
    audioDuration: item.audioDuration,
    videoDuration: item.videoDuration,
    location: item.location,
    pollQuestion: item.pollQuestion,
    pollOptions: item.pollOptions,
    replyToId: item.replyTo?.id,
    replyToText: item.replyTo?.text,
    replyToSender: item.replyTo?.sender,
  };

  const body: Record<string, any> = {
    telegram_id: backendId,
    text: item.text,
    media_url: persistedMediaUrl || undefined,
    client_message_id: item.clientMessageId,
    type: resolvedType,
    fileName: resolvedFileName,
    metadata: payloadMetadata,
  };
  if (item.role === "customer") {
    body.sender = "customer";
  }

  const res = await chatFetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const failed = await res.json().catch(() => null);
    const err = new Error(failed?.message || `Server xatoligi: ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const saved = await res.json().catch(() => null);
  if (!saved?.success || !saved?.data?.id) {
    throw new Error(saved?.message || "Xabar serverda saqlanmadi");
  }

  const normalized = normalizeChatMessage({
    ...saved.data,
    deliveryStatus: "sent",
    clientMessageId: item.clientMessageId,
  });

  await removeOfflineOutboxItem(item.clientMessageId);
  if (item.offlineMediaKey) {
    memoryMediaPreviewUrls.delete(item.offlineMediaKey);
    await deleteOfflineMedia(item.offlineMediaKey);
  }

  updateStoredMessageByKey(item.optimisticId, item.clientMessageId, (prev) => ({
    ...prev,
    ...normalized,
    id: String(normalized.id),
    timestamp: normalized.timestamp || prev.timestamp,
    mediaUrl: normalized.mediaUrl || persistedMediaUrl || prev.mediaUrl,
    deliveryStatus: "sent",
    deliveryError: undefined,
    offlineMediaKey: undefined,
  }));

  if (item.role === "admin") {
    notifyNewAdminMessage(normalized);
  }
  return normalized;
}

function scheduleOutboxFlush(delayMs: number): void {
  if (typeof window === "undefined") return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushOfflineOutbox();
  }, Math.max(500, delayMs));
}

export async function flushOfflineOutbox(): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  if (flushInFlight) return flushInFlight;

  flushInFlight = (async () => {
    let sentCount = 0;
    try {
      const items = await getOfflineOutbox();
      const now = Date.now();
      let earliestNextRetry = Infinity;

      for (const item of items) {
        if (item.permanentFailure) continue;
        if (item.nextRetryAt > now) {
          earliestNextRetry = Math.min(earliestNextRetry, item.nextRetryAt - now);
          continue;
        }
        updateStoredMessageByKey(item.optimisticId, item.clientMessageId, (m) => ({
          ...m,
          deliveryStatus: "sending",
          deliveryError: undefined,
        }));
        try {
          await transmitOutboxItem(item);
          sentCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Yuborishda xatolik";
          if (isPermanentHttpError(err)) {
            await updateOfflineOutboxItem(item.clientMessageId, {
              permanentFailure: true,
              lastError: message,
            });
            updateStoredMessageByKey(item.optimisticId, item.clientMessageId, (m) => ({
              ...m,
              deliveryStatus: "failed",
              deliveryError: message,
            }));
          } else {
            const nextCount = (item.retryCount || 0) + 1;
            const delay = computeNextRetryDelay(nextCount);
            const nextAt = Date.now() + delay;
            earliestNextRetry = Math.min(earliestNextRetry, delay);
            await updateOfflineOutboxItem(item.clientMessageId, {
              retryCount: nextCount,
              nextRetryAt: nextAt,
              lastError: message,
            });
            updateStoredMessageByKey(item.optimisticId, item.clientMessageId, (m) => ({
              ...m,
              deliveryStatus: "queued",
              deliveryError: message,
            }));
          }
        }
      }

      if (Number.isFinite(earliestNextRetry)) {
        scheduleOutboxFlush(earliestNextRetry);
      }
    } finally {
      flushInFlight = null;
    }
    return sentCount;
  })();

  return flushInFlight;
}

export async function retryQueuedChatMessage(messageIdOrClientId: string): Promise<ChatMessage | null> {
  const items = await getOfflineOutbox();
  const target = items.find(
    (i) => i.clientMessageId === messageIdOrClientId || i.optimisticId === messageIdOrClientId
  );
  if (!target) return null;

  const refreshed: OfflineOutboxItem = {
    ...target,
    permanentFailure: false,
    nextRetryAt: 0,
    lastError: undefined,
  };
  await enqueueOfflineMessage(refreshed);
  updateStoredMessageByKey(refreshed.optimisticId, refreshed.clientMessageId, (m) => ({
    ...m,
    deliveryStatus: "sending",
    deliveryError: undefined,
  }));

  try {
    return await transmitOutboxItem(refreshed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Yuborilmadi";
    const isPerm = isPermanentHttpError(err);
    await updateOfflineOutboxItem(refreshed.clientMessageId, {
      permanentFailure: isPerm,
      retryCount: refreshed.retryCount + 1,
      nextRetryAt: Date.now() + computeNextRetryDelay(refreshed.retryCount + 1),
      lastError: message,
    });
    updateStoredMessageByKey(refreshed.optimisticId, refreshed.clientMessageId, (m) => ({
      ...m,
      deliveryStatus: isPerm ? "failed" : "queued",
      deliveryError: message,
    }));
    if (!isPerm) scheduleOutboxFlush(computeNextRetryDelay(refreshed.retryCount + 1));
    return null;
  }
}

export async function sendUserMessage(
  text: string,
  user?: { id?: number | string; first_name?: string; last_name?: string; username?: string; photo_url?: string; phone?: string },
  media?: { type?: "image" | "file" | "audio" | "video" | "video_note"; mediaUrl?: string; fileName?: string; mimeType?: string; audioDuration?: number; videoDuration?: number },
  replyTo?: { id: string; text: string; sender: string }
): Promise<ChatMessage | null> {
  const cleanText = text.trim();
  if (!cleanText && !media?.mediaUrl) return null;

  const userId = user?.id ? String(user.id) : resolveBackendCustomerId(user);
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Mijoz";
  let persistedPhone = user?.phone || "";
  try {
    if (!persistedPhone) persistedPhone = String(JSON.parse(localStorage.getItem("guli_auth_user") || "{}")?.phone || "").trim();
  } catch {}
  const persistedTelegramUsername = String(user?.username || "").trim().replace(/^@+/, "");

  const clientMessageId = `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const optimisticId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const msgType = media?.type || "text";
  const rawMedia = String(media?.mediaUrl || "");
  let offlineMediaKey: string | undefined;

  if (rawMedia.startsWith("data:")) {
    offlineMediaKey = clientMessageId;
    memoryMediaPreviewUrls.set(offlineMediaKey, rawMedia);
    await saveOfflineMedia({
      key: offlineMediaKey,
      dataUrl: rawMedia,
      mimeType: media?.mimeType || (rawMedia.match(/^data:([^;]+);/i)?.[1] || "application/octet-stream"),
      fileName: media?.fileName || "guli-chat-media",
      createdAt: Date.now(),
    });
  }

  const newMsg: ChatMessage = {
    id: optimisticId,
    sender: "user",
    text: cleanText,
    timestamp: new Date().toISOString(),
    read: false,
    userId,
    userName,
    userPhoto: user?.photo_url,
    type: msgType,
    mediaUrl: rawMedia || undefined,
    fileName: media?.fileName,
    mimeType: media?.mimeType,
    audioDuration: media?.audioDuration,
    videoDuration: media?.videoDuration,
    deliveryStatus: typeof navigator !== "undefined" && navigator.onLine === false ? "queued" : "sending",
    clientMessageId,
    offlineMediaKey,
    replyToId: replyTo?.id,
    replyToText: replyTo?.text,
    replyToSender: replyTo?.sender,
    metadata: {
      clientMessageId,
      userName,
      userPhoto: user?.photo_url,
      phone: persistedPhone || undefined,
      telegramUsername: persistedTelegramUsername || undefined,
    },
  };

  saveChatMessages([...getStoredChatMessages(), newMsg]);

  const outboxItem: OfflineOutboxItem = {
    clientMessageId,
    optimisticId,
    role: "customer",
    targetUserId: userId,
    backendId: resolveBackendCustomerId(user),
    text: cleanText,
    type: msgType,
    fileName: media?.fileName,
    mimeType: media?.mimeType,
    audioDuration: media?.audioDuration,
    videoDuration: media?.videoDuration,
    offlineMediaKey,
    remoteMediaUrl: rawMedia && !rawMedia.startsWith("data:") && !rawMedia.startsWith("blob:") ? rawMedia : undefined,
    replyTo,
    metadata: {
      userName,
      userPhoto: user?.photo_url,
      phone: persistedPhone || undefined,
      telegramUsername: persistedTelegramUsername || undefined,
    },
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: newMsg.timestamp,
  };

  await enqueueOfflineMessage(outboxItem);

  try {
    const delivered = await transmitOutboxItem(outboxItem);
    return delivered;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Xabar navbatga qo‘yildi";
    const isPerm = isPermanentHttpError(error);
    await updateOfflineOutboxItem(clientMessageId, {
      permanentFailure: isPerm,
      retryCount: 1,
      nextRetryAt: Date.now() + computeNextRetryDelay(1),
      lastError: msg,
    });
    updateStoredMessageByKey(optimisticId, clientMessageId, (m) => ({
      ...m,
      deliveryStatus: isPerm ? "failed" : "queued",
      deliveryError: msg,
    }));

    if (isPerm) {
      window.dispatchEvent(
        new CustomEvent("guli_chat_send_error", {
          detail: { message: msg, status: (error as any)?.status, code: "CHAT_REQUEST_ERROR" },
        })
      );
      return null;
    }

    scheduleOutboxFlush(computeNextRetryDelay(1));
    // Return queued optimistic message so offline users keep sending seamlessly
    return { ...newMsg, deliveryStatus: "queued", deliveryError: msg };
  }
}

export async function sendAdminReply(
  userId: string,
  text: string,
  media?: {
    type?: "image" | "file" | "audio" | "video" | "video_note" | "location" | "poll";
    mediaUrl?: string;
    fileName?: string;
    mimeType?: string;
    audioDuration?: number;
    videoDuration?: number;
    location?: { lat: number; lng: number; address: string; mapUrl?: string };
    pollQuestion?: string;
    pollOptions?: { id: number; text: string; votes: number }[];
  },
  replyTo?: { id: string; text: string; sender: string }
): Promise<ChatMessage | null> {
  const cleanText = text.trim();
  const hasRich = Boolean(media?.mediaUrl || media?.location || media?.pollOptions?.length);
  if (!cleanText && !hasRich) return null;

  const clientMessageId = `acmsg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const optimisticId = `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const msgType = media?.type || "text";
  const rawMedia = String(media?.mediaUrl || "");
  let offlineMediaKey: string | undefined;

  if (rawMedia.startsWith("data:")) {
    offlineMediaKey = clientMessageId;
    memoryMediaPreviewUrls.set(offlineMediaKey, rawMedia);
    await saveOfflineMedia({
      key: offlineMediaKey,
      dataUrl: rawMedia,
      mimeType: media?.mimeType || (rawMedia.match(/^data:([^;]+);/i)?.[1] || "application/octet-stream"),
      fileName: media?.fileName || "guli-admin-media",
      createdAt: Date.now(),
    });
  }

  const reply: ChatMessage = {
    id: optimisticId,
    sender: "admin",
    text: cleanText,
    timestamp: new Date().toISOString(),
    read: false,
    userId: String(userId),
    userName: "GULI Admin",
    type: msgType,
    mediaUrl: rawMedia || undefined,
    fileName: media?.fileName,
    mimeType: media?.mimeType,
    audioDuration: media?.audioDuration,
    videoDuration: media?.videoDuration,
    location: media?.location,
    pollQuestion: media?.pollQuestion,
    pollOptions: media?.pollOptions,
    deliveryStatus: typeof navigator !== "undefined" && navigator.onLine === false ? "queued" : "sending",
    clientMessageId,
    offlineMediaKey,
    replyToId: replyTo?.id,
    replyToText: replyTo?.text,
    replyToSender: replyTo?.sender,
    metadata: { clientMessageId, userName: "GULI Admin" },
  };

  saveChatMessages([...getStoredChatMessages(), reply]);

  const outboxItem: OfflineOutboxItem = {
    clientMessageId,
    optimisticId,
    role: "admin",
    targetUserId: String(userId),
    backendId: String(userId),
    text: cleanText,
    type: msgType,
    fileName: media?.fileName,
    mimeType: media?.mimeType,
    audioDuration: media?.audioDuration,
    videoDuration: media?.videoDuration,
    offlineMediaKey,
    remoteMediaUrl: rawMedia && !rawMedia.startsWith("data:") && !rawMedia.startsWith("blob:") ? rawMedia : undefined,
    location: media?.location,
    pollQuestion: media?.pollQuestion,
    pollOptions: media?.pollOptions,
    replyTo,
    metadata: { userName: "GULI Admin" },
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: reply.timestamp,
  };

  await enqueueOfflineMessage(outboxItem);

  try {
    return await transmitOutboxItem(outboxItem);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Javob navbatga qo‘yildi";
    const isPerm = isPermanentHttpError(error);
    await updateOfflineOutboxItem(clientMessageId, {
      permanentFailure: isPerm,
      retryCount: 1,
      nextRetryAt: Date.now() + computeNextRetryDelay(1),
      lastError: msg,
    });
    updateStoredMessageByKey(optimisticId, clientMessageId, (m) => ({
      ...m,
      deliveryStatus: isPerm ? "failed" : "queued",
      deliveryError: msg,
    }));

    if (isPerm) {
      window.dispatchEvent(
        new CustomEvent("guli_chat_send_error", {
          detail: { message: msg, code: "CHAT_ADMIN_SEND_ERROR" },
        })
      );
      return null;
    }

    scheduleOutboxFlush(computeNextRetryDelay(1));
    return { ...reply, deliveryStatus: "queued", deliveryError: msg };
  }
}

export async function sendAdminLocation(
  userId: string,
  location: { lat: number; lng: number; address: string; mapUrl?: string },
  replyTo?: { id: string; text: string; sender: string }
): Promise<ChatMessage | null> {
  const mapUrl = location.mapUrl || `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  return sendAdminReply(
    userId,
    `📍 ${location.address}\n${mapUrl}`,
    {
      type: "location",
      location: { ...location, mapUrl },
    },
    replyTo
  );
}

export async function sendAdminPoll(
  userId: string,
  pollQuestion: string,
  pollOptions: { id: number; text: string; votes: number }[],
  replyTo?: { id: string; text: string; sender: string }
): Promise<ChatMessage | null> {
  return sendAdminReply(
    userId,
    pollQuestion.trim(),
    {
      type: "poll",
      pollQuestion: pollQuestion.trim(),
      pollOptions,
    },
    replyTo
  );
}

function notifyNewAdminMessage(msg: ChatMessage): void {
  const currentCount = getUnreadAdminMessagesCount(msg.userId);
  localStorage.setItem(NOTIFICATIONS_KEY, String(currentCount));
  window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: currentCount }));
  window.dispatchEvent(new CustomEvent("guli_new_admin_message", { detail: msg }));
}

export function getAllConversations(): ConversationSummary[] {
  const messages = getStoredChatMessages();
  const metaMap = getStoredMetadataMap();
  const map = new Map<string, { messages: ChatMessage[]; last: ChatMessage; unread: number; name: string; photo?: string }>();

  for (const m of messages) {
    const uId = String(m.userId || "guest-user");
    if (m.id === "welcome-msg-1") continue;
    if (!map.has(uId)) {
      const defaultName =
        Number(uId) < 0 || uId === "guest-user" ? `Web Mijoz #${uId === "guest-user" ? "Guest" : String(Math.abs(Number(uId))).slice(-4)}` : `Foydalanuvchi #${uId}`;
      map.set(uId, {
        messages: [],
        last: m,
        unread: 0,
        name: m.userName || defaultName,
        photo: m.userPhoto,
      });
    }
    const item = map.get(uId)!;
    item.messages.push(m);
    item.last = m;
    if (m.userName) item.name = m.userName;
    if (m.userPhoto) item.photo = m.userPhoto;
    if (m.sender === "user" && !m.read) item.unread++;
  }

  if (map.size === 0) return [];

  return Array.from(map.entries())
    .map(([userId, data]) => {
      let lastText = data.last.text || "";
      if (data.last.type === "image") lastText = "📷 Rasm";
      else if (data.last.type === "video_note") lastText = "📹 Dumaloq video";
      else if (data.last.type === "video") lastText = "🎬 Video";
      else if (data.last.type === "audio") lastText = "🎙️ Ovozli xabar";
      else if (data.last.type === "file") lastText = `📄 ${data.last.fileName || "Fayl"}`;
      else if (data.last.type === "location") lastText = `📍 ${data.last.location?.address || "Geolokatsiya"}`;
      else if (data.last.type === "poll") lastText = `📊 ${data.last.pollQuestion || "So‘rovnoma"}`;

      const meta = metaMap[userId] || {};
      const crm = data.last.metadata?.customer || {};
      let source: ConversationSource = meta.source || crm.source || data.last.metadata?.source || "webapp";
      if (!meta.source && !crm.source && !data.last.metadata?.source) {
        if (Number(userId) > 0 || userId.includes("telegram") || crm.telegram_id) source = "telegram";
        else if (userId.includes("call")) source = "callcenter";
      }
      const phone =
        meta.phone ||
        crm.phone ||
        crm.telegram_phone ||
        (data.last as any).phone ||
        (data.last as any).telegram_phone ||
        data.last.metadata?.phone ||
        undefined;
      const telegramUsername =
        meta.telegramUsername ||
        crm.telegramUsername ||
        crm.username ||
        (data.last as any).telegramUsername ||
        data.last.metadata?.telegramUsername ||
        (source === "telegram" && crm.username ? `@${crm.username}` : undefined);

      return {
        userId,
        userName: data.name,
        userPhoto: data.photo || crm.photoUrl,
        lastMessage: lastText,
        lastTimestamp: data.last.timestamp,
        unreadCount: data.unread,
        source,
        phone,
        telegramUsername,
        assignedOperator: meta.assignedOperator || "Navbatchi Operator",
        status: meta.status || "open",
        notes: meta.notes || "",
        orderCount: meta.orderCount ?? (crm.orderCount !== undefined ? Number(crm.orderCount) : undefined),
        lastOrderNumber: meta.lastOrderNumber || crm.lastOrderNumber || undefined,
        lastOrderStatus: meta.lastOrderStatus || crm.lastOrderStatus || undefined,
        lastOrderTotal: meta.lastOrderTotal ?? crm.lastOrderTotal ?? undefined,
      };
    })
    .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
}

export function subscribeToChat(callback: (messages: ChatMessage[]) => void): () => void {
  const onCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    callback(Array.isArray(detail) ? detail : getStoredChatMessages());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === NOTIFICATIONS_KEY) callback(getStoredChatMessages());
  };
  const onBroadcast = (e: MessageEvent) => {
    if (e.data?.type === "SYNC_MESSAGES" && Array.isArray(e.data?.messages)) callback(e.data.messages);
  };
  window.addEventListener("guli_chat_updated", onCustomEvent);
  window.addEventListener("guli_notifications_updated", onCustomEvent);
  window.addEventListener("guli_new_admin_message", onCustomEvent);
  window.addEventListener("storage", onStorage);
  broadcastChannel?.addEventListener("message", onBroadcast);
  return () => {
    window.removeEventListener("guli_chat_updated", onCustomEvent);
    window.removeEventListener("guli_notifications_updated", onCustomEvent);
    window.removeEventListener("guli_new_admin_message", onCustomEvent);
    window.removeEventListener("storage", onStorage);
    broadcastChannel?.removeEventListener("message", onBroadcast);
  };
}
