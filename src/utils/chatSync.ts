export type ChatSender = "user" | "admin";

export type ChatMessage = {
  id: string;
  sender: ChatSender;
  text: string;
  timestamp: string; // ISO string
  read: boolean;
  userId?: number | string;
  userName?: string;
  userPhoto?: string;
  orderNumber?: string;
  type?: "text" | "image" | "file" | "audio";
  mediaUrl?: string;
  fileName?: string;
};

export type ConversationSummary = {
  userId: string;
  userName: string;
  userPhoto?: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
};

const STORAGE_KEY = "guli_chat_messages";
const NOTIFICATIONS_KEY = "guli_unread_notifications_count";
const CHANNEL_NAME = "guli_chat_channel_v1";

const API_URL = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");

export async function syncChatWithBackend(telegramId: string | number): Promise<ChatMessage[]> {
  if (!telegramId) return getStoredChatMessages();
  try {
    const res = await fetch(`${API_URL}/api/chat/messages/${telegramId}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      const backendMessages: ChatMessage[] = json.data.map((m: any) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.created_at,
        read: true,
        userId: m.telegram_id
      }));
      
      // Merge with local (optional, but good for robust sync)
      const local = getStoredChatMessages(telegramId);
      const combined = [...local];
      
      backendMessages.forEach(bm => {
        if (!combined.some(lm => lm.timestamp === bm.timestamp && lm.text === bm.text)) {
          combined.push(bm);
        }
      });
      
      combined.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      saveChatMessages(combined);
      return combined;
    }
  } catch (err) {
    console.error("Backend sync failed:", err);
  }
  return getStoredChatMessages(telegramId);
}

export async function sendChatMessage(msg: Partial<ChatMessage>): Promise<ChatMessage | null> {
  if (!msg.userId || !msg.text || !msg.sender) return null;
  
  try {
    const res = await fetch(`${API_URL}/api/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_id: msg.userId,
        sender: msg.sender,
        text: msg.text
      })
    });
    const json = await res.json();
    if (json.success) {
      const newMsg: ChatMessage = {
        id: json.data.id,
        sender: json.data.sender,
        text: json.data.text,
        timestamp: json.data.created_at,
        read: true,
        userId: json.data.telegram_id,
        userName: msg.userName
      };
      
      const all = getStoredChatMessages();
      saveChatMessages([...all, newMsg]);
      return newMsg;
    }
  } catch (err) {
    console.error("Failed to send message to backend:", err);
  }
  return null;
}

let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  // Fallback if BroadcastChannel is not supported
}

const DEFAULT_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-msg-1",
  sender: "admin",
  text: "Assalomu alaykum! GULI Premium qo‘llab-quvvatlash xizmatiga xush kelibsiz ✨ Sizga qanday yordam bera olamiz? Savollaringiz bo‘lsa bemalol yozing.",
  timestamp: new Date().toISOString(),
  read: true,
  userName: "GULI Support"
};

export function getStoredChatMessages(userId?: string | number): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = [DEFAULT_WELCOME_MESSAGE];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: ChatMessage[] = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [DEFAULT_WELCOME_MESSAGE];
    }
    if (userId) {
      // Return messages belonging to this user or welcome message
      return parsed.filter(m => !m.userId || String(m.userId) === String(userId) || m.id === "welcome-msg-1");
    }
    return parsed;
  } catch {
    return [DEFAULT_WELCOME_MESSAGE];
  }
}

export function saveChatMessages(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    // Broadcast change
    broadcastChannel?.postMessage({ type: "SYNC_MESSAGES", messages });
    window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: messages }));
  } catch (err) {
    console.error("Error saving chat messages:", err);
  }
}

export function getUnreadMessages(userId?: string | number): ChatMessage[] {
  const messages = getStoredChatMessages(userId);
  return messages.filter(m => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1");
}

export function getUnreadAdminMessagesCount(userId?: string | number): number {
  const messages = getStoredChatMessages(userId);
  return messages.filter(m => m.sender === "admin" && !m.read && m.id !== "welcome-msg-1").length;
}

export function markMessagesAsRead(userId?: string | number): void {
  const messages = getStoredChatMessages();
  let changed = false;
  const updated = messages.map(m => {
    if (m.sender === "admin" && !m.read && (!userId || !m.userId || String(m.userId) === String(userId))) {
      changed = true;
      return { ...m, read: true };
    }
    return m;
  });
  if (changed) {
    saveChatMessages(updated);
    localStorage.setItem(NOTIFICATIONS_KEY, "0");
    window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: 0 }));
  }
}

export async function sendUserMessage(
  text: string,
  user?: { id?: number | string; first_name?: string; last_name?: string; username?: string; photo_url?: string },
  media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string }
): Promise<ChatMessage> {
  const allMessages = getStoredChatMessages();
  const userId = user?.id ? String(user.id) : "guest-user";
  const userName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Mijoz";
  
  const newMsg: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: "user",
    text: text.trim(),
    timestamp: new Date().toISOString(),
    read: false,
    userId,
    userName,
    userPhoto: user?.photo_url,
    type: media?.type || "text",
    mediaUrl: media?.mediaUrl,
    fileName: media?.fileName
  };

  const updated = [...allMessages, newMsg];
  saveChatMessages(updated);

  // Persistence to backend
  if (user?.id) {
    try {
      fetch(`${API_URL}/api/chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: user.id, sender: 'customer', text: text.trim() })
      }).catch(e => console.error("Chat backend sync failed:", e));
    } catch {
      // Ignore background sync errors
    }
  }

  // Optional: Auto-reply simulation if this is the user's first inquiry and admin isn't immediately replying
  if (allMessages.filter(m => m.sender === "user").length === 0) {
    setTimeout(() => {
      const current = getStoredChatMessages();
      if (!current.some(m => m.sender === "admin" && m.timestamp > newMsg.timestamp)) {
        const autoReply: ChatMessage = {
          id: `admin-auto-${Date.now()}`,
          sender: "admin",
          text: "Xabaringiz qabul qilindi! Operatorimiz tez orada sizga javob beradi. Shoshilinch savollar uchun Call Center: +998905811117",
          timestamp: new Date().toISOString(),
          read: false,
          userId,
          userName: "GULI Admin",
          type: "text"
        };
        saveChatMessages([...getStoredChatMessages(), autoReply]);
        notifyNewAdminMessage(autoReply);
      }
    }, 2000);
  }

  return newMsg;
}

export async function sendAdminReply(
  userId: string,
  text: string,
  media?: { type?: "image" | "file" | "audio"; mediaUrl?: string; fileName?: string }
): Promise<ChatMessage> {
  const allMessages = getStoredChatMessages();
  const reply: ChatMessage = {
    id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: "admin",
    text: text.trim(),
    timestamp: new Date().toISOString(),
    read: false,
    userId: String(userId),
    userName: "GULI Admin",
    type: media?.type || "text",
    mediaUrl: media?.mediaUrl,
    fileName: media?.fileName
  };

  const updated = [...allMessages, reply];
  saveChatMessages(updated);

  // Persistence to backend
  try {
    fetch(`${API_URL}/api/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: userId, sender: 'admin', text: text.trim() })
    }).catch(e => console.error("Admin chat backend sync failed:", e));
  } catch {
    // Ignore background sync errors
  }

  notifyNewAdminMessage(reply);
  return reply;
}

function notifyNewAdminMessage(msg: ChatMessage): void {
  const currentCount = getUnreadAdminMessagesCount(msg.userId);
  localStorage.setItem(NOTIFICATIONS_KEY, String(currentCount));
  window.dispatchEvent(new CustomEvent("guli_notifications_updated", { detail: currentCount }));
  window.dispatchEvent(new CustomEvent("guli_new_admin_message", { detail: msg }));
}

export function getAllConversations(): ConversationSummary[] {
  const messages = getStoredChatMessages();
  const map = new Map<string, { messages: ChatMessage[]; last: ChatMessage; unread: number; name: string; photo?: string }>();

  for (const m of messages) {
    const uId = String(m.userId || "guest-user");
    if (m.id === "welcome-msg-1") continue;

    if (!map.has(uId)) {
      map.set(uId, {
        messages: [],
        last: m,
        unread: 0,
        name: m.userName || (uId === "guest-user" ? "Mijoz" : `Foydalanuvchi #${uId}`),
        photo: m.userPhoto
      });
    }
    const item = map.get(uId)!;
    item.messages.push(m);
    item.last = m;
    if (m.userName) item.name = m.userName;
    if (m.userPhoto) item.photo = m.userPhoto;
    if (m.sender === "user" && !m.read) {
      item.unread++;
    }
  }

  // If no user messages yet, provide at least the active session entry
  if (map.size === 0) {
    return [{
      userId: "guest-user",
      userName: "GULI mijozi",
      lastMessage: DEFAULT_WELCOME_MESSAGE.text,
      lastTimestamp: DEFAULT_WELCOME_MESSAGE.timestamp,
      unreadCount: 0
    }];
  }

  return Array.from(map.entries()).map(([userId, data]) => {
    let lastText = data.last.text || "";
    if (data.last.type === "image") lastText = "📷 Rasm";
    else if (data.last.type === "audio") lastText = "🎙️ Ovozli xabar";
    else if (data.last.type === "file") lastText = `📁 ${data.last.fileName || "Fayl"}`;

    return {
      userId,
      userName: data.name,
      userPhoto: data.photo,
      lastMessage: lastText,
      lastTimestamp: data.last.timestamp,
      unreadCount: data.unread
    };
  }).sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
}

export function subscribeToChat(callback: (messages: ChatMessage[]) => void): () => void {
  const onCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (Array.isArray(detail)) callback(detail);
    else callback(getStoredChatMessages());
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === NOTIFICATIONS_KEY) callback(getStoredChatMessages());
  };
  const onBroadcast = (e: MessageEvent) => {
    if (e.data?.type === "SYNC_MESSAGES" && Array.isArray(e.data?.messages)) {
      callback(e.data.messages);
    }
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
