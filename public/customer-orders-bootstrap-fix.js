// Guarantees the legacy order guard sees the live Supabase session before React mounts.
// Supabase remains the source of truth; this bridge must never force-refresh the app.
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
    if (mirror() || tries >= 40) clearInterval(timer);
  }, 250);
})();
