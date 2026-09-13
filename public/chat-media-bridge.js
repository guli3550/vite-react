/* GULI chat media bridge.
   1) Moves browser chat attachments from localStorage/base64 into private Supabase Storage via backend.
   2) Adds media metadata to the existing chat message POST without changing chat UI code.
   3) Lifts Telegram/storage media metadata onto top-level chat messages so admin/customer renderers can display it.
   4) Resilient fallback: network or storage issues never break or block message delivery.
*/
(function () {
  const API = String(window.__GULI_API_URL || sessionStorage.getItem("guli_custom_api_url") || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
  const STORAGE = "guli_chat_messages";
  const baseFetch = window.fetch.bind(window);

  function authHeaders() {
    const h = {};
    const tg = window.Telegram?.WebApp?.initData || "";
    const admin = sessionStorage.getItem("guli_admin_token") || localStorage.getItem("guli_admin_token") || "";
    const linked = localStorage.getItem("guli_chat_linked_token") || "";
    const guest = localStorage.getItem("guli_chat_guest_token") || "";
    const customer = localStorage.getItem("guli_access_token") || "";
    if (tg) h["X-Telegram-Init-Data"] = tg;
    if (admin) h.Authorization = `Bearer ${admin}`;
    else if (customer) h.Authorization = `Bearer ${customer}`;
    if (!tg && !admin && linked) h["X-Guli-Linked-Token"] = linked;
    if (!tg && !admin && !linked && guest) h["X-Guli-Guest-Token"] = guest;
    return h;
  }

  async function ensureGuestSession() {
    const tg = window.Telegram?.WebApp?.initData || "";
    const admin = sessionStorage.getItem("guli_admin_token") || localStorage.getItem("guli_admin_token") || "";
    if (tg || admin) return "";
    let guestToken = localStorage.getItem("guli_chat_guest_token") || "";
    let guestId = localStorage.getItem("guli_chat_guest_id") || "";
    if (guestToken && guestId && Number.isSafeInteger(Number(guestId)) && Number(guestId) < 0) {
      return guestToken;
    }
    try {
      const res = await baseFetch(`${API}/api/chat/guest-session`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.token && Number.isSafeInteger(Number(json.guest_id))) {
        localStorage.setItem("guli_chat_guest_id", String(json.guest_id));
        localStorage.setItem("guli_chat_guest_token", String(json.token));
        return String(json.token);
      }
    } catch {}
    return "";
  }

  function read() {
    try {
      const x = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return Array.isArray(x) ? x : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: items }));
    } catch {}
  }

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
    const source = read();
    let changed = false;
    const out = source.map(item => {
      const next = liftMedia(item);
      if (JSON.stringify(next) !== JSON.stringify(item)) changed = true;
      return next;
    });
    if (changed) write(out);
  }

  function resolveEffectiveTelegramId(rawId) {
    if (Number.isSafeInteger(Number(rawId)) && Number(rawId) !== 0) return Number(rawId);
    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (Number.isSafeInteger(Number(tgId))) return Number(tgId);
    const linkedId = Number(localStorage.getItem("guli_chat_linked_telegram_id") || 0);
    if (Number.isSafeInteger(linkedId) && linkedId > 0) return linkedId;
    const guestId = Number(localStorage.getItem("guli_chat_guest_id") || 0);
    if (Number.isSafeInteger(guestId) && guestId < 0) return guestId;
    return null;
  }

  async function uploadAttachment(id, item) {
    if (!item?.mediaUrl || !String(item.mediaUrl).startsWith("data:")) return null;
    await ensureGuestSession();
    const effectiveId = resolveEffectiveTelegramId(id) ?? (sessionStorage.getItem("guli_admin_token") || localStorage.getItem("guli_admin_token") ? 0 : null);
    if (effectiveId === null) {
      console.warn("[GULI chat media] no valid session/ID found, keeping local attachment");
      return null;
    }
    const comma = String(item.mediaUrl).indexOf(",");
    if (comma < 0) return null;
    const header = String(item.mediaUrl).slice(0, comma);
    const data = String(item.mediaUrl).slice(comma + 1);
    const mimeType = (header.match(/^data:([^;]+);base64$/i) || [])[1] || "application/octet-stream";

    const res = await baseFetch(`${API}/api/chat/media-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ telegram_id: effectiveId, data, mimeType, fileName: item.fileName || "file", type: item.type || "file" })
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success || !json?.data?.mediaUrl) {
      throw new Error(json?.message || `media upload ${res.status}`);
    }
    return json.data;
  }

  function findLocalAttachment(body) {
    const items = read();
    const id = String(body?.telegram_id || "");
    const sender = body?.sender === "admin" ? "admin" : "user";
    const text = String(body?.text || "").trim();
    const isGuest = Number(id) < 0 || id === "guest-user";
    const candidates = items.filter(m => {
      const userMatches = isGuest ? (String(m?.userId || "") === "guest-user" || Number(m?.userId || 0) < 0) : String(m?.userId || "") === id;
      return userMatches && m?.sender === sender && String(m?.text || "").trim() === text && m?.mediaUrl;
    });
    return candidates[candidates.length - 1] || null;
  }

  const chatMediaFetch = async function (input, init) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input?.url || "";
    if (!url.startsWith(`${API}/api/chat/messages`) || String(init?.method || "GET").toUpperCase() !== "POST") {
      return baseFetch(input, init);
    }
    try {
      let originalBody = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (originalBody && !originalBody.mediaUrl) {
        const item = findLocalAttachment(originalBody);
        if (item && String(item.mediaUrl).startsWith("data:")) {
          try {
            const uploaded = await uploadAttachment(originalBody.telegram_id, item);
            if (uploaded?.mediaUrl) {
              originalBody = {
                ...originalBody,
                mediaUrl: uploaded.mediaUrl,
                mediaPath: uploaded.mediaPath,
                fileName: uploaded.fileName || item.fileName,
                type: uploaded.type || item.type,
                mimeType: uploaded.mimeType
              };
              const updated = read().map(m =>
                String(m?.id) === String(item.id)
                  ? { ...m, mediaUrl: uploaded.mediaUrl, mediaPath: uploaded.mediaPath, fileName: uploaded.fileName || item.fileName, type: uploaded.type || item.type }
                  : m
              );
              write(updated);
            }
          } catch (uploadErr) {
            console.warn("[GULI chat media] remote upload bypassed (fallback to local attachment):", uploadErr?.message || uploadErr);
          }
        }
        if (originalBody) init = { ...(init || {}), body: JSON.stringify(originalBody) };
      }
    } catch (e) {
      console.warn("[GULI chat media] attachment processing bypassed:", e?.message || e);
    }
    return baseFetch(input, init);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: chatMediaFetch,
      writable: true,
      configurable: true
    });
  } catch (_) {
    try {
      window.fetch = chatMediaFetch;
    } catch (_) {
      try {
        globalThis.fetch = chatMediaFetch;
      } catch (_) {}
    }
  }

  function normalizeEventMessages() {
    const source = read();
    let changed = false;
    const out = source.map(item => {
      const next = liftMedia(item);
      if (JSON.stringify(next) !== JSON.stringify(item)) changed = true;
      return next;
    });
    if (changed) write(out);
  }

  window.addEventListener("guli_chat_updated", () => setTimeout(normalizeEventMessages, 0));
  liftStoredMedia();
  setTimeout(liftStoredMedia, 1000);
  console.log("[GULI] chat media bridge loaded");
})();
