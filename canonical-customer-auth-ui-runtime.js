(() => {
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  const processed = new WeakSet();

  function applyCanonicalAuthUI() {
    document.querySelectorAll("main.modernProfilePage button").forEach((button) => {
      const text = normalize(button.textContent);
      if (!text) return;

      // Customer profile: one authentication action only.
      if (text.includes("ro‘yxatdan o‘tish") || text.includes("ro'yxatdan o'tish")) {
        button.style.display = "none";
        return;
      }

      if (text.includes("tizimga kirish")) {
        button.innerHTML = "<span>📱</span> Telegram orqali kirish";
        button.setAttribute("aria-label", "Telegram orqali kirish");
      }
    });
  }

  // Eliminate legacy Google/Email customer entry points and route them to the
  // same canonical Telegram authentication modal.
  function unifyLegacyAuthButtons() {
    document.querySelectorAll("button").forEach((button) => {
      if (processed.has(button)) return;
      const text = normalize(button.textContent);
      if (!text.includes("google / email orqali kirish")) return;
      processed.add(button);
      button.textContent = "📱 Telegram orqali kirish";
      button.setAttribute("aria-label", "Telegram orqali kirish");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (typeof window.openGuliCustomerAuthModal === "function") {
          window.openGuliCustomerAuthModal("signin");
        }
      }, true);
    });
  }

  function run() {
    applyCanonicalAuthUI();
    unifyLegacyAuthButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();

  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true });
})();
