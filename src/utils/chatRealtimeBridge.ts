const API_URL = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const CHANNEL_NAME = "guli_chat_channel_v1";
const STORAGE_KEY = "guli_chat_messages";

type ChatMessage = { id: string; sender: "user" | "admin"; text: string; timestamp: string; read: boolean; userId?: string | number; userName?: string; type?: string; mediaUrl?: string; fileName?: string };

function normalize(raw: any): ChatMessage {
  return {
    ...raw,
    id: String(raw?.id ?? `rt-${Date.now()}`),
    sender: raw?.sender === "customer" || raw?.sender === "user" ? "user" : "admin",
    text: String(raw?.text || ""),
    timestamp: raw?.created_at || raw?.timestamp || new Date().toISOString(),
    read: false,
    userId: raw?.telegram_id,
  };
}

function mergeAndBroadcast(items: any[]) {
  const messages: ChatMessage[] = [];
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(current)) messages.push(...current);
  } catch {}
  for (const raw of items) {
    const m = normalize(raw);
    if (!messages.some(x => String(x.id) === String(m.id))) messages.push(m);
  }
  messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  try { window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: messages })); } catch {}
  try { new BroadcastChannel(CHANNEL_NAME).postMessage({ type: "SYNC_MESSAGES", messages }); } catch {}
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const tg = window.Telegram?.WebApp?.initData || "";
  if (tg) headers["X-Telegram-Init-Data"] = tg;
  const adminToken = sessionStorage.getItem("guli_admin_token") || "";
  if (window.location.pathname.replace(/\/$/, "") === "/admin" && adminToken) headers.Authorization = `Bearer ${adminToken}`;
  return headers;
}

async function fetchHistory(id: string) {
  try {
    const path = id === "all" ? "/api/admin/chat/messages" : `/api/chat/messages/${encodeURIComponent(id)}`;
    const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
    if (!res.ok) return;
    const json = await res.json();
    if (json?.success && Array.isArray(json.data)) mergeAndBroadcast(json.data);
  } catch (e) { console.warn("[Chat realtime] history failed", e); }
}

async function connect(id: string) {
  const headers = authHeaders();
  if (id !== "all" && !headers["X-Telegram-Init-Data"]) return;
  if (id === "all" && !headers.Authorization) return;
  await fetchHistory(id);
  while (document.visibilityState !== "hidden") {
    try {
      const response = await fetch(`${API_URL}/api/chat/stream/${encodeURIComponent(id)}`, { headers, cache: "no-store" });
      if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n"); buffer = chunks.pop() || "";
        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find(line => line.startsWith("data:"));
          if (!dataLine) continue;
          try { const data = JSON.parse(dataLine.slice(5).trim()); mergeAndBroadcast([data]); } catch {}
        }
      }
    } catch (e) { console.warn("[Chat realtime] stream reconnect", e); }
    await new Promise(r => setTimeout(r, 1500));
  }
}

// Patch BroadcastChannel listeners so the existing chat UI receives backend events
// without requiring a risky rewrite of the mature chatSync module.
const OriginalBroadcastChannel = window.BroadcastChannel;
if (OriginalBroadcastChannel) {
  const originalAdd = OriginalBroadcastChannel.prototype.addEventListener;
  let bridgeStarted = false;
  OriginalBroadcastChannel.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
    const result = originalAdd.call(this, type, listener, options);
    if (type === "message" && !bridgeStarted) {
      bridgeStarted = true;
      const isAdmin = window.location.pathname.replace(/\/$/, "") === "/admin";
      const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      void connect(isAdmin ? "all" : String(tgId || ""));
    }
    return result;
  };
}

// Make admin replies pass the backend authentication check.
const originalFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith(API_URL)) {
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const tg = window.Telegram?.WebApp?.initData || "";
    const token = sessionStorage.getItem("guli_admin_token") || "";
    if (tg && !headers.has("X-Telegram-Init-Data")) headers.set("X-Telegram-Init-Data", tg);
    if (window.location.pathname.replace(/\/$/, "") === "/admin" && token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
    return originalFetch(input, { ...init, headers });
  }
  return originalFetch(input, init);
};

console.log("[GULI] chat realtime bridge loaded");
