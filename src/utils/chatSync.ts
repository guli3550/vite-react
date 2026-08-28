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
  text: "Assalomu alaykum! GULI Premium qo‘llab-quvvatlash xizmatiga xush kelibsiz 🌷 Sizga qanday yordam bera olamiz? Savollaringiz bo‘lsa bemalol yozing.",
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

export function sendUserMessage(text: string, user?: { id?: number | string; first_name?: string; last_name?: string; username?: string; photo_url?: string }): ChatMessage {
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
    userPhoto: user?.photo_url
  };

  const updated = [...allMessages, newMsg];
  saveChatMessages(updated);

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
          userName: "GULI Admin"
        };
        saveChatMessages([...getStoredChatMessages(), autoReply]);
        notifyNewAdminMessage(autoReply);
      }
    }, 2000);
  }

  return newMsg;
}

export function sendAdminReply(userId: string, text: string): ChatMessage {
  const allMessages = getStoredChatMessages();
  const reply: ChatMessage = {
    id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: "admin",
    text: text.trim(),
    timestamp: new Date().toISOString(),
    read: false,
    userId: String(userId),
    userName: "GULI Admin"
  };

  const updated = [...allMessages, reply];
  saveChatMessages(updated);
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

  return Array.from(map.entries()).map(([userId, data]) => ({
    userId,
    userName: data.name,
    userPhoto: data.photo,
    lastMessage: data.last.text,
    lastTimestamp: data.last.timestamp,
    unreadCount: data.unread
  })).sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
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
