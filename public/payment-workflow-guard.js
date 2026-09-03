(() => {
  'use strict';

  // GULI payment workflow guard.
  // Clean runtime that does not inject unwanted DOM buttons into chat or customer UI.
  function normalizeCustomerPaymentText() {
    try {
      document.querySelectorAll('body *').forEach((el) => {
        if (el.children.length) return;
        const t = String(el.textContent || '').trim();
        if (t === 'card_manual') el.textContent = '💳 Karta (Uzcard / Humo)';
      });
    } catch {}
  }

  const scan = () => {
    try {
      normalizeCustomerPaymentText();
    } catch {}
  };

  const observer = new MutationObserver(() => scan());
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  setTimeout(scan, 500);
})();
