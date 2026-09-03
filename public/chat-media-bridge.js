/* GULI chat media bridge.
   1) Moves browser chat attachments from localStorage/base64 into private Supabase Storage via backend.
   2) Adds media metadata to the existing chat message POST without changing chat UI code.
   3) Lifts Telegram/storage media metadata onto top-level chat messages so admin/customer renderers can display it.
*/
(function () {
  const API = String(window.__GULI_API_URL || sessionStorage.getItem("guli_custom_api_url") || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
  const STORAGE = "guli_chat_messages";
  const baseFetch = window.fetch.bind(window);

  function authHeaders() {
    const h = {};
    const tg = window.Telegram?.WebApp?.initData || "";
    const admin = sessionStorage.getItem("guli_admin_token") || "";
    const linked = localStorage.getItem("guli_chat_linked_token") || "";
    const guest = localStorage.getItem("guli_chat_guest_token") || "";
    if (tg) h["X-Telegram-Init-Data"] = tg;
    if (admin && location.pathname.replace(/\/$/, "") === "/admin") h.Authorization = `Bearer ${admin}`;
    if (!tg && !admin && linked) h["X-Guli-Linked-Token"] = linked;
    if (!tg && !admin && !linked && guest) h["X-Guli-Guest-Token"] = guest;
    return h;
  }
  function read() { try { const x = JSON.parse(localStorage.getItem(STORAGE) || "[]"); return Array.isArray(x) ? x : []; } catch { return []; } }
  function write(items) { try { localStorage.setItem(STORAGE, JSON.stringify(items)); window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: items })); } catch {} }
  function liftMedia(message) {
    const m = { ...message };
    const meta = m.metadata || {};
    if (!m.mediaUrl && (meta.mediaUrl || meta.media_url)) m.mediaUrl = meta.mediaUrl || meta.media_url;
    if (!m.fileName && (meta.fileName || meta.file_name)) m.fileName = meta.fileName || meta.file_name;
    if (!m.type && meta.type) m.type = meta.type;
    if (!m.audioDuration && meta.audioDuration) m.audioDuration = meta.audioDuration;
    return m;
  }
  function liftStoredMedia() {
    const source = read(); let changed = false;
    const out = source.map(item => { const next = liftMedia(item); if (JSON.stringify(next) !== JSON.stringify(item)) changed = true; return next; });
    if (changed) write(out);
  }
  async function uploadAttachment(id, item) {
    if (!item?.mediaUrl || !String(item.mediaUrl).startsWith("data:")) return null;
    const comma = String(item.mediaUrl).indexOf(",");
    if (comma < 0) return null;
    const header = String(item.mediaUrl).slice(0, comma);
    const data = String(item.mediaUrl).slice(comma + 1);
    const mimeType = (header.match(/^data:([^;]+);base64$/i) || [])[1] || "application/octet-stream";
    const res = await baseFetch(`${API}/api/chat/media-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ telegram_id: id, data, mimeType, fileName: item.fileName || "file", type: item.type || "file" })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json?.data?.mediaUrl) throw new Error(json?.message || `media upload ${res.status}`);
    return json.data;
  }
  function findLocalAttachment(body) {
    const items = read(); const id = String(body?.telegram_id || ""); const sender = body?.sender === "admin" ? "admin" : "user"; const text = String(body?.text || "").trim();
    const candidates = items.filter(m => String(m?.userId || "") === id && m?.sender === sender && String(m?.text || "").trim() === text && m?.mediaUrl);
    return candidates[candidates.length - 1] || null;
  }

  window.fetch = async function chatMediaFetch(input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url || "";
    if (!url.startsWith(`${API}/api/chat/messages`) || String(init?.method || "GET").toUpperCase() !== "POST") return baseFetch(input, init);
    try {
      const originalBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (originalBody && !originalBody.mediaUrl) {
        const item = findLocalAttachment(originalBody);
        if (item && String(item.mediaUrl).startsWith("data:")) {
          const uploaded = await uploadAttachment(originalBody.telegram_id, item);
          originalBody.mediaUrl = uploaded.mediaUrl;
          originalBody.mediaPath = uploaded.mediaPath;
          originalBody.fileName = uploaded.fileName || item.fileName;
          originalBody.type = uploaded.type || item.type;
          originalBody.mimeType = uploaded.mimeType;
          const updated = read().map(m => String(m?.id) === String(item.id) ? { ...m, mediaUrl: uploaded.mediaUrl, mediaPath: uploaded.mediaPath, fileName: uploaded.fileName || item.fileName, type: uploaded.type || item.type } : m);
          write(updated);
        }
        if (originalBody) init = { ...(init || {}), body: JSON.stringify(originalBody) };
      }
    } catch (e) {
      console.error("[GULI chat media] attachment upload failed:", e);
      throw e;
    }
    return baseFetch(input, init);
  };

  function normalizeEventMessages() {
    const source = read(); let changed = false;
    const out = source.map(item => { const next = liftMedia(item); if (JSON.stringify(next) !== JSON.stringify(item)) changed = true; return next; });
    if (changed) write(out);
  }
  window.addEventListener("guli_chat_updated", () => setTimeout(normalizeEventMessages, 0));
  liftStoredMedia();
  setTimeout(liftStoredMedia, 1000);
  console.log("[GULI] chat media bridge loaded");
})();
