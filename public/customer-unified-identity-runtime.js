// GULI unified customer identity bridge.
// Telegram: identity is derived from signed WebApp initData (no registration).
// Browser: identity is the Supabase Auth session (email/Google registration).
// Both use the same backend customer/order APIs.
(() => {
  'use strict';
  if (window.__GULI_UNIFIED_IDENTITY_RUNTIME__) return;
  window.__GULI_UNIFIED_IDENTITY_RUNTIME__ = true;

  const nativeFetch = window.fetch.bind(window);
  const apiOrder = (url) => /\/api\/(customer\/orders|orders|auth\/orders)(?:[/?]|$)/i.test(String(url || ''));

  function supabaseToken() {
    const direct = String(localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('guli_supabase_auth_token');
      const j = raw ? JSON.parse(raw) : null;
      return String(j?.access_token || j?.currentSession?.access_token || j?.session?.access_token || j?.data?.session?.access_token || '').trim();
    } catch { return ''; }
  }

  function identityHeaders(init) {
    const h = new Headers((init && init.headers) || {});
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      h.set('X-Telegram-Init-Data', tg.initData);
      h.delete('Authorization');
    } else {
      const token = supabaseToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
    }
    return h;
  }

  window.fetch = async (input, init) => {
    if (!apiOrder(typeof input === 'string' ? input : input?.url)) return nativeFetch(input, init);
    const options = Object.assign({}, init || {});
    options.headers = identityHeaders(options);
    options.cache = 'no-store';
    return nativeFetch(input, options);
  };
})();
