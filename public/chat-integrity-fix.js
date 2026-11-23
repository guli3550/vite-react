/* GULI chat client integrity helpers: mobile reaction touch handling and notification group dismissal sync.
   (Deduplication & unread tracking are now handled natively inside chatSync.ts without DOM MutationObserver loops.) */
(function () {
  const NOTIF_STORAGE = "guli_dismissed_notifs";
  function dismissed() {
    try {
      const value = JSON.parse(localStorage.getItem(NOTIF_STORAGE) || "[]");
      return Array.isArray(value) ? value.map(String) : [];
    } catch {
      return [];
    }
  }
  function saveDismissed(ids) {
    try {
      localStorage.setItem(NOTIF_STORAGE, JSON.stringify(Array.from(new Set(ids.map(String))).slice(-1000)));
    } catch {}
  }

  document.addEventListener(
    "touchstart",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(".chatReactionEmojiBtn") : null;
      if (target) event.stopPropagation();
    },
    true
  );
  document.addEventListener(
    "mousedown",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(".chatReactionEmojiBtn") : null;
      if (target) event.stopPropagation();
    },
    true
  );

  document.addEventListener(
    "click",
    (event) => {
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
    },
    true
  );
})();
