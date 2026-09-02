/* GULI chat client integrity fixes: optimistic/realtime dedupe, Telegram source classification,
   admin unread state, and mobile reaction touch handling. */
(function () {
  const STORAGE = "guli_chat_messages";
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
        const optimisticPair =
          (a.startsWith("msg-") && b !== a && !b.startsWith("msg-")) ||
          (b.startsWith("msg-") && a !== b && !a.startsWith("msg-"));
        const sameOptimisticMessage = Boolean(
          last && optimisticPair &&
          last.sender === m.sender &&
          String(last.userId || "") === String(m.userId || "") &&
          String(last.text || "").trim() === String(m.text || "").trim() &&
          Math.abs(new Date(last.timestamp).getTime() - new Date(m.timestamp).getTime()) <= DEDUPE_WINDOW
        );
        if (sameOptimisticMessage) {
          const keep = a.startsWith("msg-") ? m : last;
          out[out.length - 1] = { ...keep, read: Boolean(last.read && m.read) };
          changed = true;
        } else {
          out.push(m);
        }
      }
      if (changed || out.length !== source.length) write(out);
    } finally { running = false; }
  }

  // The existing global outside-touch handler closes the reaction bar before React's
  // click handler can run on Android. Keep reaction-button touch events inside the menu.
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
    const userIds = new Set(
      messages.filter((m) => visibleIds.has(String(m.id)) && m.userId != null).map((m) => String(m.userId))
    );
    if (!userIds.size) return;
    let changed = false;
    const updated = messages.map((m) => {
      if (m.sender === "user" && userIds.has(String(m.userId)) && !m.read) {
        changed = true;
        return { ...m, read: true };
      }
      return m;
    });
    if (changed) write(updated);
  }

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
