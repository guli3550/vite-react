export type ChatSender = "user" | "admin";

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
  type?: "text" | "image" | "file" | "audio" | "poll" | "location";
  mediaUrl?: string;
  fileName?: string;
  audioDuration?: number;
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
};

export type ConversationSource = "telegram" | "webapp" | "callcenter";
export type ConversationMetadata = { source?: ConversationSource; phone?: string; telegramUsername?: string; telegramId?: string | number; assignedOperator?: string; status?: "open" | "closed" | "pending"; notes?: string; orderCount?: number; lastOrderNumber?: string; lastOrderStatus?: string; lastOrderTotal?: number };
export type ConversationSummary = { userId: string; userName: string; userPhoto?: string; lastMessage: string; lastTimestamp: string; unreadCount: number; source: ConversationSource; phone?: string; telegramUsername?: string; assignedOperator?: string; status: "open" | "closed" | "pending"; notes?: string; orderCount?: number; lastOrderNumber?: string; lastOrderStatus?: string; lastOrderTotal?: number };

const STORAGE_KEY = "guli_chat_messages";
const METADATA_KEY = "guli_chat_conv_metadata";
const NOTIFICATIONS_KEY = "guli_unread_notifications_count";
const CHANNEL_NAME = "guli_chat_channel_v1";
const API_URL = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");

export function getStoredMetadataMap(): Record<string, ConversationMetadata> { try { const raw = localStorage.getItem(METADATA_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
export function saveMetadataMap(map: Record<string, ConversationMetadata>): void { try { localStorage.setItem(METADATA_KEY, JSON.stringify(map)); window.dispatchEvent(new CustomEvent("guli_chat_metadata_updated", { detail: map })); } catch (err) { console.error("Failed to save conversation metadata:", err); } }
export function updateConversationMetadata(userId: string | number, meta: Partial<ConversationMetadata>): void { const uId = String(userId); const current = getStoredMetadataMap(); current[uId] = { ...(current[uId] || { source: uId.includes("telegram") ? "telegram" : "webapp", status: "open" }), ...meta }; saveMetadataMap(current); }

export function editChatMessage(messageId: string, newText: string): void { const messages = getStoredChatMessages(); const updated = messages.map(m => m.id === messageId ? { ...m, text: newText.trim(), isEdited: true, editedAt: new Date().toISOString() } : m); if (updated.some((m, i) => m !== messages[i])) saveChatMessages(updated); }
export function deleteChatMessage(messageId: string): void { const messages = getStoredChatMessages(); const filtered = messages.filter(m => m.id !== messageId); if (filtered.length !== messages.length) saveChatMessages(filtered); }
export function toggleMessageReaction(messageId: string, emoji: string): void { const messages = getStoredChatMessages(); let changed = false; const updated = messages.map(m => { if (m.id !== messageId) return m; changed = true; const reactions = { ...(m.reactions || {}) }; if (reactions[emoji]) delete reactions[emoji]; else reactions[emoji] = 1; return { ...m, reactions }; }); if (changed) saveChatMessages(updated); }
export function votePollOption(messageId: string, optionIndex: number): void { const messages = getStoredChatMessages(); let changed = false; const updated = messages.map(m => { if (m.id !== messageId || !m.pollOptions) return m; changed = true; const prev = m.userVotedOption; const options = m.pollOptions.map((opt, idx) => ({ ...opt, votes: Math.max(0, (opt.votes || 0) - (prev === idx ? 1 : 0) + (optionIndex === idx ? 1 : 0)) })); return { ...m, pollOptions: options, userVotedOption: prev === optionIndex ? undefined : optionIndex }; }); if (changed) saveChatMessages(updated); }

export function isChatMessageValid(m: any): boolean {
  if (!m || typeof m !== "object") return false;
  if (m.type === "ping" || m.type === "heartbeat" || m.ping || m.event === "ping") return false;
  const text = String(m.text || "").trim();
  const mediaUrl = m.mediaUrl || m.media_url || m.metadata?.mediaUrl || m.metadata?.media_url;
  const hasPoll = Array.isArray(m.pollOptions) && m.pollOptions.length > 0;
  const hasLocation = Boolean(m.location?.lat && m.location?.lng);
  return Boolean(text || mediaUrl || hasPoll || hasLocation);
}

export async function syncChatWithBackend(telegramId: string | number): Promise<ChatMessage[]> {
  if (!telegramId) return getStoredChatMessages();
  try {
    const res = await fetch(`${API_URL}/api/chat/messages/${encodeURIComponent(telegramId)}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      const backend = json.data
        .map((m: any) => {
          const meta = m.metadata || {};
          const mediaUrl = meta.mediaUrl || m.media_url || meta.media_url || m.mediaUrl;
          const msgType = meta.type || m.type || (mediaUrl ? (mediaUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? "image" : "file") : "text");
          const fileName = meta.fileName || meta.file_name || m.fileName || m.file_name;
          return {
            id: String(m.id),
            sender: m.sender === "customer" ? "user" : "admin",
            text: String(m.text || "").trim(),
            timestamp: m.created_at,
            read: true,
            userId: m.telegram_id,
            type: msgType,
            mediaUrl: mediaUrl ? (mediaUrl.startsWith("http") ? mediaUrl : `${API_URL}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`) : undefined,
            fileName,
          } as ChatMessage;
        })
        .filter(isChatMessageValid);
      const local = getStoredChatMessages(telegramId);
      const combined = [...local];
      backend.forEach((bm: ChatMessage) => {
        const existingIdx = combined.findIndex(lm => String(lm.id) === String(bm.id) || (lm.timestamp === bm.timestamp && lm.text === bm.text));
        if (existingIdx === -1) {
          combined.push(bm);
        } else {
          if (bm.mediaUrl && !combined[existingIdx].mediaUrl) {
            combined[existingIdx] = { ...combined[existingIdx], mediaUrl: bm.mediaUrl, type: bm.type, fileName: bm.fileName };
          }
        }
      });
      combined.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      saveChatMessages(combined);
      return combined;
    }
  } catch (err) {
    console.error("Backend sync failed:", err);
  }
  return getStoredChatMessages(telegramId);
}

export async function sendChatMessage(msg: Partial<ChatMessage>): Promise<ChatMessage | null> {
  if (!msg.userId || (!msg.text?.trim() && !msg.mediaUrl) || !msg.sender) return null;
  try { const res = await fetch(`${API_URL}/api/chat/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ telegram_id: msg.userId, sender: msg.sender, text: msg.text?.trim() || "" }) }); const json = await res.json(); if (json.success) { const newMsg: ChatMessage = { id: json.data.id, sender: json.data.sender === "customer" ? "user" : "admin", text: json.data.text, timestamp: json.data.created_at, read: true, userId: json.data.telegram_id, userName: msg.userName }; saveChatMessages([...getStoredChatMessages(), newMsg]); return newMsg; } } catch (err) { console.error("Failed to send message to backend:", err); } return null;
}

let broadcastChannel: BroadcastChannel | null = null;
try { if (typeof window !== "undefined" && "BroadcastChannel" in window) broadcastChannel = new BroadcastChannel(CHANNEL_NAME); } catch {}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = { id: "welcome-msg-1", sender: "admin", text: "Assalomu alaykum! GULI Premium qo‘llab-quvvatlash xizmatiga xush kelibsiz ✨ Sizga qanday yordam bera olamiz? Savollaringiz bo‘lsa bemalol yozing.", timestamp: new Date().toISOString(), read: true, userName: "GULI Support" };

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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid.length === 0 ? [DEFAULT_WELCOME_MESSAGE] : valid));
    }
    if (valid.length === 0) return [DEFAULT_WELCOME_MESSAGE];
    if (userId) return valid.filter(m => !m.userId || String(m.userId) === String(userId) || m.id === "welcome-msg-1");
    return valid;
  } catch {
    return [DEFAULT_WELCOME_MESSAGE];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    const valid = messages.filter(isChatMessageValid);
    const toSave = valid.length === 0 ? [DEFAULT_WELCOME_MESSAGE] : valid;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    broadcastChannel?.postMessage({ type: "SYNC_MESSAGES", messages: toSave });
    window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: toSave }));
  } catch (err) {
    console.error("Error saving chat messages:", err);
  }
}
export function getUnreadMessages(userId?: string | number): ChatMessage[] { return getStoredChatMessages(userId).filter(m => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1"); }
export function getUnreadAdminMessagesCount(userId?: string | number): number { return getStoredChatMessages(userId).filter(m => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1").length; }
export function markSingleMessageAsRead(messageId: string, userId?: string | number): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map(m => {
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
export function markMessagesAsRead(userId?: string | number, role: "admin" | "user" = "user"): void {
  if (!userId && role === "admin") return;
  const messages = getStoredChatMessages();
  const target = role === "admin" ? "user" : "admin";
  let changed = false;
  const targetUserId = userId ? String(userId) : undefined;
  const updated = messages.map(m => {
    const msgUserId = String(m.userId || "guest-user");
    const matchesUser = targetUserId ? msgUserId === targetUserId : true;
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
    }
  }
}

export function markAllAdminChatRead(): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map(m => {
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

export function getTotalUnreadChatCount(): number { return getAllConversations().reduce((sum, c) => sum + (c.unreadCount || 0), 0); }

export async function sendUserMessage(text: string, user?: { id?: number | string; first_name?: string; last_name?: string; username?: string; photo_url?: string }, media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string; audioDuration?: number }, replyTo?: { id: string; text: string; sender: string }): Promise<ChatMessage | null> {
  const cleanText = text.trim();
  if (!cleanText && !media?.mediaUrl) return null;
  const allMessages = getStoredChatMessages();
  const userId = user?.id ? String(user.id) : "guest-user";
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Mijoz";
  const newMsg: ChatMessage = { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sender: "user", text: cleanText, timestamp: new Date().toISOString(), read: false, userId, userName, userPhoto: user?.photo_url, type: media?.type || "text", mediaUrl: media?.mediaUrl, fileName: media?.fileName, audioDuration: media?.audioDuration, replyToId: replyTo?.id, replyToText: replyTo?.text, replyToSender: replyTo?.sender };
  saveChatMessages([...allMessages, newMsg]);

  // Persist both Telegram users and browser guests immediately. The realtime bridge adds the guest auth header.
  const backendId = user?.id ? String(user.id) : String(localStorage.getItem("guli_chat_guest_id") || "");
  if (backendId) {
    try {
      await fetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_id: backendId,
          sender: "customer",
          text: cleanText,
          media_url: media?.mediaUrl,
          metadata: {
            userName,
            userPhoto: user?.photo_url,
            type: media?.type || "text",
            mediaUrl: media?.mediaUrl,
            fileName: media?.fileName,
            replyToId: replyTo?.id,
            replyToText: replyTo?.text,
            replyToSender: replyTo?.sender,
          }
        })
      });
    } catch (e) {
      console.error("Chat backend sync failed:", e);
    }
  }
  return newMsg;
}

export async function sendAdminReply(userId: string, text: string, media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string; audioDuration?: number }, replyTo?: { id: string; text: string; sender: string }): Promise<ChatMessage | null> {
  const cleanText = text.trim();
  if (!cleanText && !media?.mediaUrl) return null;
  const allMessages = getStoredChatMessages();
  const reply: ChatMessage = { id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sender: "admin", text: cleanText, timestamp: new Date().toISOString(), read: false, userId: String(userId), userName: "GULI Admin", type: media?.type || "text", mediaUrl: media?.mediaUrl, fileName: media?.fileName, audioDuration: media?.audioDuration, replyToId: replyTo?.id, replyToText: replyTo?.text, replyToSender: replyTo?.sender };
  saveChatMessages([...allMessages, reply]);
  try {
    await fetch(`${API_URL}/api/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: userId,
        sender: "admin",
        text: cleanText,
        media_url: media?.mediaUrl,
        metadata: {
          userName: "GULI Admin",
          type: media?.type || "text",
          mediaUrl: media?.mediaUrl,
          fileName: media?.fileName,
          replyToId: replyTo?.id,
          replyToText: replyTo?.text,
          replyToSender: replyTo?.sender,
        }
      })
    });
  } catch (e) {
    console.error("Admin chat backend sync failed:", e);
  }
  notifyNewAdminMessage(reply);
  return reply;
}

function notifyNewAdminMessage(msg: ChatMessage): void { const currentCount = getUnreadAdminMessagesCount(msg.userId); localStorage.setItem(NOTIFICATIONS_KEY, String(currentCount)); window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: currentCount })); window.dispatchEvent(new CustomEvent("guli_new_admin_message", { detail: msg })); }

export function getAllConversations(): ConversationSummary[] {
  const messages = getStoredChatMessages(); const metaMap = getStoredMetadataMap(); const map = new Map<string, { messages: ChatMessage[]; last: ChatMessage; unread: number; name: string; photo?: string }>();
  for (const m of messages) { const uId = String(m.userId || "guest-user"); if (m.id === "welcome-msg-1") continue; if (!map.has(uId)) map.set(uId, { messages: [], last: m, unread: 0, name: m.userName || (uId === "guest-user" ? "Mijoz" : `Foydalanuvchi #${uId}`), photo: m.userPhoto }); const item = map.get(uId)!; item.messages.push(m); item.last = m; if (m.userName) item.name = m.userName; if (m.userPhoto) item.photo = m.userPhoto; if (m.sender === "user" && !m.read) item.unread++; }
  if (map.size === 0) { const meta = metaMap["guest-user"] || {}; return [{ userId: "guest-user", userName: "GULI mijozi", lastMessage: DEFAULT_WELCOME_MESSAGE.text, lastTimestamp: DEFAULT_WELCOME_MESSAGE.timestamp, unreadCount: 0, source: meta.source || "webapp", phone: meta.phone || "+998 90 123 45 67", telegramUsername: meta.telegramUsername || "guli_user", assignedOperator: meta.assignedOperator || "Operator (Dilnoza)", status: meta.status || "open", notes: meta.notes || "Xaridga qiziqish bildirgan", orderCount: meta.orderCount || 1, lastOrderNumber: meta.lastOrderNumber || "104291", lastOrderStatus: meta.lastOrderStatus || "Tayyorlanmoqda", lastOrderTotal: meta.lastOrderTotal || 185000 }]; }
  return Array.from(map.entries()).map(([userId, data]) => { let lastText = data.last.text || ""; if (data.last.type === "image") lastText = "📷 Rasm"; else if (data.last.type === "audio") lastText = "🎙️ Ovozli xabar"; else if (data.last.type === "file") lastText = `📁 ${data.last.fileName || "Fayl"}`; const meta = metaMap[userId] || {}; let source: ConversationSource = meta.source || "webapp"; if (!meta.source) { if (userId.includes("telegram") || data.name.toLowerCase().includes("telegram")) source = "telegram"; else if (userId.includes("call") || data.name.toLowerCase().includes("call")) source = "callcenter"; } return { userId, userName: data.name, userPhoto: data.photo, lastMessage: lastText, lastTimestamp: data.last.timestamp, unreadCount: data.unread, source, phone: meta.phone || (userId.startsWith("998") ? `+${userId}` : "+998 90 123 45 67"), telegramUsername: meta.telegramUsername || (source === "telegram" ? `@${data.name.split(" ")[0].toLowerCase()}` : undefined), assignedOperator: meta.assignedOperator || "Navbatchi Operator", status: meta.status || "open", notes: meta.notes || "", orderCount: meta.orderCount ?? (userId === "guest-user" ? 1 : 2), lastOrderNumber: meta.lastOrderNumber || "104291", lastOrderStatus: meta.lastOrderStatus || "Tayyorlanmoqda", lastOrderTotal: meta.lastOrderTotal || 185000 }; }).sort((a,b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
}

export function subscribeToChat(callback: (messages: ChatMessage[]) => void): () => void {
  const onCustomEvent = (e: Event) => { const detail = (e as CustomEvent).detail; callback(Array.isArray(detail) ? detail : getStoredChatMessages()); };
  const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY || e.key === NOTIFICATIONS_KEY) callback(getStoredChatMessages()); };
  const onBroadcast = (e: MessageEvent) => { if (e.data?.type === "SYNC_MESSAGES" && Array.isArray(e.data?.messages)) callback(e.data.messages); };
  window.addEventListener("guli_chat_updated", onCustomEvent); window.addEventListener("guli_notifications_updated", onCustomEvent); window.addEventListener("guli_new_admin_message", onCustomEvent); window.addEventListener("storage", onStorage); broadcastChannel?.addEventListener("message", onBroadcast);
  return () => { window.removeEventListener("guli_chat_updated", onCustomEvent); window.removeEventListener("guli_notifications_updated", onCustomEvent); window.removeEventListener("guli_new_admin_message", onCustomEvent); window.removeEventListener("storage", onStorage); broadcastChannel?.removeEventListener("message", onBroadcast); };
}
