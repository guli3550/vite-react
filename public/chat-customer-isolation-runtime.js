// GULI customer chat isolation guard.
// The backend already authorizes every history/stream/write request. This client guard
// prevents stale localStorage chat records from another customer account being rendered
// after account switching on the same browser/device.
(() => {
  'use strict';
  if (window.__GULI_CHAT_CUSTOMER_ISOLATION__) return;
  window.__GULI_CHAT_CUSTOMER_ISOLATION__ = true;

  const STORAGE_KEY = 'guli_chat_messages';
  const isAdmin = () => window.location.pathname.replace(/\/$/, '') === '/admin';

  function currentCustomerId() {
    const tg = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (tg) return String(tg);
    const linked = String(localStorage.getItem('guli_chat_linked_telegram_id') || '').trim();
    if (/^\d+$/.test(linked)) return linked;
    return null;
  }

  function isValidMessage(m) {
    if (!m || typeof m !== 'object') return false;
    if (m.type === 'ping' || m.type === 'heartbeat' || m.ping || m.event === 'ping') return false;
    const text = String(m.text || '').trim();
    const media = m.mediaUrl || m.media_url || m.metadata?.mediaUrl || m.metadata?.media_url;
    const poll = Array.isArray(m.pollOptions) && m.pollOptions.length > 0;
    const location = Boolean(m.location?.lat && m.location?.lng);
    return Boolean(text || media || poll || location);
  }

  function sanitize() {
    if (isAdmin()) return;
    const id = currentCustomerId();
    if (!id) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const filtered = parsed.filter(m => {
        if (!isValidMessage(m)) return false;
        if (m.id === 'welcome-msg-1' || !m.userId) return true;
        return String(m.userId) === id;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('guli_chat_customer_isolation_applied', { detail: filtered }));
    } catch {}
  }

  sanitize();
  window.addEventListener('guli_chat_updated', sanitize);
  window.addEventListener('guli_auth_changed', sanitize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sanitize(); });
  setTimeout(sanitize, 500);
  setTimeout(sanitize, 2000);
  setInterval(sanitize, 15000);
})();
