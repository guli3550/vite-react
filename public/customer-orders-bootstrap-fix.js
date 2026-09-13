// Guarantees the legacy order guard sees the live Supabase session before React mounts.
// This is intentionally a browser-only compatibility bridge; Supabase remains the source of truth.
(function () {
  'use strict';
  if (window.__GULI_ORDER_BOOTSTRAP_FIX__) return;
  window.__GULI_ORDER_BOOTSTRAP_FIX__ = true;

  function extract(value) {
    if (!value) return '';
    try {
      var parsed = typeof value === 'string' ? JSON.parse(value) : value;
      if (!parsed || typeof parsed !== 'object') return '';
      if (parsed.access_token) return String(parsed.access_token).trim();
      if (parsed.currentSession && parsed.currentSession.access_token) return String(parsed.currentSession.access_token).trim();
      if (parsed.session && parsed.session.access_token) return String(parsed.session.access_token).trim();
      if (parsed.data && parsed.data.session && parsed.data.session.access_token) return String(parsed.data.session.access_token).trim();
    } catch (_) {}
    return '';
  }

  function findToken() {
    var direct = String(localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    var known = extract(localStorage.getItem('guli_supabase_auth_token'));
    if (known) return known;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i) || '';
        if (!/supabase|auth/i.test(key)) continue;
        var token = extract(localStorage.getItem(key));
        if (token) return token;
      }
    } catch (_) {}
    return '';
  }

  function mirror() {
    var token = findToken();
    if (!token) return false;
    try {
      localStorage.setItem('guli_access_token', token);
      window.__GULI_SUPABASE_ACCESS_TOKEN = token;
      return true;
    } catch (_) { return false; }
  }

  if (mirror()) return;

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (mirror()) {
      clearInterval(timer);
      // React may already have mounted and returned an empty order list before auth initialized.
      // Reload once so the normal App loadOrders path runs with the real session.
      try {
        if (!sessionStorage.getItem('guli_order_bootstrap_reloaded')) {
          sessionStorage.setItem('guli_order_bootstrap_reloaded', '1');
          location.reload();
        }
      } catch (_) {}
    } else if (tries >= 40) {
      clearInterval(timer);
    }
  }, 250);

  setTimeout(function () {
    try { sessionStorage.removeItem('guli_order_bootstrap_reloaded'); } catch (_) {}
  }, 15000);
})();
