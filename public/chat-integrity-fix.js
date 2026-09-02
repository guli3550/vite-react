/* GULI chat client integrity fixes: optimistic/realtime dedupe, Telegram source classification,
   admin unread state, mobile reaction touch handling, and notification group clearing. */
(function () {
  const STORAGE = "guli_chat_messages";
  const NOTIF_STORAGE = "guli_dismissed_notifs";
  const DEDUPE_WINDOW = 15000;
  let running = false;

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function write(messages) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(messages));
      window.dispatchEvent(new CustomEvent("guli_chat_updated", { detail: messages }));
    } catch {}
  }
  function dismissed() {
    try {
      const value = JSON.parse(localStorage.getItem(NOTIF_STORAGE) || "[]");
      return Array.isArray(value) ? value.map(String) : [];
    } catch { return []; }
  }
  function saveDismissed(ids) {
    try { localStorage.setItem(NOTIF_STORAGE, JSON.stringify(Array.from(new Set(ids.map(String))).slice(-1000))); } catch {}
  }

  function normalizeAndDedupe() {
    if (running) return;
    running = true;
    try {
      const source = read();
      const out = [];
      let changed = false;
      for (const message of source) {
        const m = { ...message };
        const metadata = m.metadata || {};
        if (metadata.source === "telegram") {
          if (!m.userName) {
            const username = metadata.telegram_username || metadata.telegramUsername;
            m.userName = username ? `Telegram @${username}` : `Telegram ${m.userId || "mijoz"}`;
            changed = true;
          }
        }
        const last = out[out.length - 1];
        const a = String(last?.id || "");
        const b = String(m.id || "");
        const optimisticPrefix = (id) => id.startsWith("msg-") || id.startsWith("admin-");
        const optimisticPair =
          (optimisticPrefix(a) && b !== a && !optimisticPrefix(b)) ||
          (optimisticPrefix(b) && a !== b && !optimisticPrefix(a));
        const sameOptimisticMessage = Boolean(
          last && optimisticPair &&
          last.sender === m.sender &&
          String(last.userId || "") === String(m.userId || "") &&
          String(last.text || "").trim() === String(m.text || "").trim() &&
          Math.abs(new Date(last.timestamp).getTime() - new Date(m.timestamp).getTime()) <= DEDUPE_WINDOW
        );
        if (sameOptimisticMessage) {
          const keep = optimisticPrefix(a) ? m : last;
          out[out.length - 1] = { ...keep, read: Boolean(last.read && m.read) };
          changed = true;
        } else {
          out.push(m);
        }
      }
      if (changed || out.length !== source.length) write(out);
    } finally { running = false; }
  }

  document.addEventListener("touchstart", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".chatReactionEmojiBtn") : null;
    if (target) event.stopPropagation();
  }, true);
  document.addEventListener("mousedown", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".chatReactionEmojiBtn") : null;
    if (target) event.stopPropagation();
  }, true);

  function markVisibleAdminConversationRead() {
    if (!location.pathname.replace(/\/$/, "").endsWith("/admin")) return;
    const rows = document.querySelectorAll("[id^='admin-swipe-row-'], [id^='chat-bubble-']");
    if (!rows.length) return;
    const messages = read();
    const visibleIds = new Set();
    rows.forEach((row) => {
      const id = String(row.id || "").replace(/^admin-swipe-row-/, "").replace(/^chat-bubble-/, "");
      if (id) visibleIds.add(id);
    });
    const userIds = new Set(messages.filter((m) => visibleIds.has(String(m.id)) && m.userId != null).map((m) => String(m.userId)));
    if (!userIds.size) return;
    let changed = false;
    const updated = messages.map((m) => {
      if (m.sender === "user" && userIds.has(String(m.userId)) && !m.read) { changed = true; return { ...m, read: true }; }
      return m;
    });
    if (changed) write(updated);
  }

  // When one notification in a semantic group is opened, clear all currently visible
  // notifications of the same category/title/message instead of leaving duplicates behind.
  document.addEventListener("click", (event) => {
    const card = event.target instanceof Element ? event.target.closest(".notifFeedCard") : null;
    if (!card) return;
    const title = String(card.querySelector(".notifFeedTitle")?.textContent || "").trim();
    const text = String(card.querySelector(".notifFeedText")?.textContent || "").trim();
    const ids = dismissed();
    document.querySelectorAll(".notifFeedCard").forEach((other) => {
      const otherTitle = String(other.querySelector(".notifFeedTitle")?.textContent || "").trim();
      const otherText = String(other.querySelector(".notifFeedText")?.textContent || "").trim();
      if (otherTitle === title && otherText === text) {
        const id = String(other.id || "").replace(/^notif-card-/, "");
        if (id) ids.push(id);
      }
    });
    saveDismissed(ids);
  }, true);

  window.addEventListener("guli_chat_updated", () => setTimeout(normalizeAndDedupe, 0));
  const observer = new MutationObserver(() => {
    normalizeAndDedupe();
    markVisibleAdminConversationRead();
  });
  const start = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start, { once: true });
  setTimeout(normalizeAndDedupe, 500);
  setTimeout(markVisibleAdminConversationRead, 1200);
})();
