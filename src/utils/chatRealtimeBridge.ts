// Unified realtime auth bridge for Telegram Mini App, browser-linked users, browser guests and admin.
const API_URL = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const CHANNEL_NAME = "guli_chat_channel_v1";
const STORAGE_KEY = "guli_chat_messages";
const GUEST_ID_KEY = "guli_chat_guest_id";
const GUEST_TOKEN_KEY = "guli_chat_guest_token";
const GUEST_SYNCED_KEY = "guli_chat_guest_synced_ids";
const LINKED_ID_KEY = "guli_chat_linked_telegram_id";
const LINKED_TOKEN_KEY = "guli_chat_linked_token";
let activeConnectionKey = "";
type ChatMessage = { id: string; sender: "user" | "admin"; text: string; timestamp: string; read: boolean; userId?: string | number; userName?: string; type?: string; mediaUrl?: string; fileName?: string };
function normalize(raw: any): ChatMessage { return { ...raw, id: String(raw?.id ?? `rt-${Date.now()}`), sender: raw?.sender === "customer" || raw?.sender === "user" ? "user" : "admin", text: String(raw?.text || ""), timestamp: raw?.created_at || raw?.timestamp || new Date().toISOString(), read: false, userId: raw?.telegram_id }; }
function mergeAndBroadcast(items: any[]) { const messages: ChatMessage[] = []; try { const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); if (Array.isArray(current)) messages.push(...current); } catch {} for (const raw of items) { const m = normalize(raw); if (!messages.some(x => String(x.id) === String(m.id))) messages.push(m); } messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {} try { window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: messages })); } catch {} try { const channel = new BroadcastChannel(CHANNEL_NAME); channel.postMessage({ type: "SYNC_MESSAGES", messages }); channel.close(); } catch {} }
function isAdmin() { return window.location.pathname.replace(/\/$/, "") === "/admin"; }
function telegramInitData() { return window.Telegram?.WebApp?.initData || ""; }
function linkedTelegramId() { const raw = String(localStorage.getItem(LINKED_ID_KEY) || "").trim(); return /^\d+$/.test(raw) ? raw : ""; }
function linkedTelegramToken() { return String(localStorage.getItem(LINKED_TOKEN_KEY) || "").trim(); }
function getGuestId() { const existing = Number(localStorage.getItem(GUEST_ID_KEY) || 0); if (Number.isSafeInteger(existing) && existing < 0) return String(existing); const id = -Math.floor(100000000000000 + Math.random() * 800000000000000); localStorage.setItem(GUEST_ID_KEY, String(id)); return String(id); }
async function ensureGuestSession() { if (isAdmin() || telegramInitData() || linkedTelegramId()) return; const id = getGuestId(); if (localStorage.getItem(GUEST_TOKEN_KEY)) return; try { const res = await nativeFetch(`${API_URL}/api/chat/guest-session/${encodeURIComponent(id)}`, { cache: "no-store" }); const json = await res.json(); if (json?.success && json.token) localStorage.setItem(GUEST_TOKEN_KEY, String(json.token)); } catch (e) { console.warn("[Chat realtime] guest session failed", e); } }
function authHeaders(): Record<string, string> { const headers: Record<string, string> = {}; const tg = telegramInitData(); if (tg) headers["X-Telegram-Init-Data"] = tg; const adminToken = sessionStorage.getItem("guli_admin_token") || ""; if (isAdmin() && adminToken) headers.Authorization = `Bearer ${adminToken}`; const linkedToken = linkedTelegramToken(); if (!isAdmin() && !tg && linkedToken) headers["X-Guli-Linked-Token"] = linkedToken; const guestToken = localStorage.getItem(GUEST_TOKEN_KEY) || ""; if (!isAdmin() && !tg && !linkedToken && guestToken) headers["X-Guli-Guest-Token"] = guestToken; return headers; }
async function fetchHistory(id: string) { try { const path = id === "all" ? "/api/admin/chat/messages" : `/api/chat/messages/${encodeURIComponent(id)}`; const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() }); if (!res.ok) return; const json = await res.json(); if (json?.success && Array.isArray(json.data)) mergeAndBroadcast(json.data); } catch (e) { console.warn("[Chat realtime] history failed", e); } }
async function connect(id: string) { if (id === "all") { if (!authHeaders().Authorization) return; } else if (!telegramInitData() && !linkedTelegramToken() && !localStorage.getItem(GUEST_TOKEN_KEY)) return; await fetchHistory(id); for (;;) { if (document.visibilityState === "hidden") { await new Promise(r => setTimeout(r, 1500)); continue; } try { const response = await fetch(`${API_URL}/api/chat/stream/${encodeURIComponent(id)}`, { headers: authHeaders(), cache: "no-store" }); if (!response.ok || !response.body) throw new Error(`stream ${response.status}`); const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; for (;;) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split("\n\n"); buffer = chunks.pop() || ""; for (const chunk of chunks) { const dataLine = chunk.split("\n").find(line => line.startsWith("data:")); if (!dataLine) continue; try { mergeAndBroadcast([JSON.parse(dataLine.slice(5).trim())]); } catch {} } } } catch (e) { console.warn("[Chat realtime] stream reconnect", e); } await new Promise(r => setTimeout(r, 1500)); } }
async function syncGuestMessages() { if (isAdmin() || telegramInitData() || linkedTelegramId()) return; const guestId = getGuestId(); const token = localStorage.getItem(GUEST_TOKEN_KEY) || ""; if (!token) return; let messages: any[] = []; try { const raw = localStorage.getItem(STORAGE_KEY); const parsed = raw ? JSON.parse(raw) : []; messages = Array.isArray(parsed) ? parsed : []; } catch { return; } let synced = new Set<string>(); try { const raw = localStorage.getItem(GUEST_SYNCED_KEY); const parsed = raw ? JSON.parse(raw) : []; if (Array.isArray(parsed)) synced = new Set(parsed.map(String)); } catch {} for (const m of messages) { if (m?.sender !== "user" || String(m?.userId || "") !== "guest-user" || !m?.text || synced.has(String(m.id))) continue; try { const res = await nativeFetch(`${API_URL}/api/chat/messages`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ telegram_id: guestId, sender: "customer", text: String(m.text).trim() }) }); if (res.ok) synced.add(String(m.id)); } catch {} } try { localStorage.setItem(GUEST_SYNCED_KEY, JSON.stringify(Array.from(synced).slice(-500))); } catch {} }
async function startForCurrentContext() { let id = ""; let key = ""; if (isAdmin()) { const token = sessionStorage.getItem("guli_admin_token") || ""; if (!token) return; id = "all"; key = `admin:${token.slice(0, 16)}`; } else if (telegramInitData()) { id = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || ""); if (!id) return; key = `telegram:${id}`; } else if (linkedTelegramId() && linkedTelegramToken()) { id = linkedTelegramId(); key = `linked:${id}`; } else { await ensureGuestSession(); await syncGuestMessages(); id = getGuestId(); key = `guest:${id}`; } if (!id || activeConnectionKey === key) return; activeConnectionKey = key; await connect(id); }
const OriginalBroadcastChannel = window.BroadcastChannel;
const nativeFetch = window.fetch.bind(window);
void ensureGuestSession();
if (OriginalBroadcastChannel) { const originalAdd = OriginalBroadcastChannel.prototype.addEventListener; OriginalBroadcastChannel.prototype.addEventListener = function(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) { if (listener === null) return; return originalAdd.call(this, type, listener, options); }; }
window.addEventListener("guli_chat_updated", () => { void syncGuestMessages(); });
installAuthFetch();
setTimeout(() => void startForCurrentContext(), 250);
setTimeout(() => void startForCurrentContext(), 1500);
setInterval(() => { if (isAdmin()) { void startForCurrentContext(); } else if (!telegramInitData() && !linkedTelegramId()) void syncGuestMessages(); }, 10000);
function installAuthFetch() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const currentFetch = window.fetch.bind(window);
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(API_URL)) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const tg = telegramInitData();
      const token = sessionStorage.getItem("guli_admin_token") || "";
      const linkedToken = linkedTelegramToken();
      const guestToken = localStorage.getItem(GUEST_TOKEN_KEY) || "";
      if (tg && !headers.has("X-Telegram-Init-Data")) headers.set("X-Telegram-Init-Data", tg);
      if (isAdmin() && token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
      if (!isAdmin() && !tg && linkedToken && !headers.has("X-Guli-Linked-Token")) headers.set("X-Guli-Linked-Token", linkedToken);
      if (!isAdmin() && !tg && !linkedToken && guestToken && !headers.has("X-Guli-Guest-Token")) headers.set("X-Guli-Guest-Token", guestToken);
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
    } catch {
      try {
        (globalThis as any).fetch = customFetch;
      } catch {}
    }
  }
}
console.log("[GULI] unified chat realtime bridge loaded");
