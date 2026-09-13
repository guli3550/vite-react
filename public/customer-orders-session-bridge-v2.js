// Strong browser auth bridge for customer order/payment requests.
// Always prefer the live Supabase session token over stale legacy mirrors.
(function () {
  'use strict';
  if (window.__GULI_CUSTOMER_ORDER_SESSION_BRIDGE_V2__) return;
  window.__GULI_CUSTOMER_ORDER_SESSION_BRIDGE_V2__ = true;

  function liveToken() {
    var memory = String(window.__GULI_SUPABASE_ACCESS_TOKEN || '').trim();
    if (memory) return memory;
    try {
      var raw = localStorage.getItem('guli_supabase_auth_token');
      if (raw) {
        var parsed = JSON.parse(raw);
        var token = parsed && (parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token) || (parsed.session && parsed.session.access_token));
        if (token) return String(token).trim();
      }
    } catch (_) {}
    return String(localStorage.getItem('guli_access_token') || '').trim();
  }

  function protectedCustomerUrl(input) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    return /\/api\/(customer\/orders|auth\/orders|orders)(?:[/?]|$)/i.test(url);
  }

  var originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (!protectedCustomerUrl(input)) return originalFetch(input, init);
    var options = init ? Object.assign({}, init) : {};
    var headers = new Headers(options.headers || (input && input.headers) || {});
    var tg = window.Telegram && window.Telegram.WebApp;
    var tgData = tg && tg.initData;

    if (tgData) {
      headers.set('X-Telegram-Init-Data', tgData);
      // Do not replace a valid Telegram identity with a browser Supabase token.
    } else {
      var token = liveToken();
      if (token) headers.set('Authorization', 'Bearer ' + token);
    }

    options.headers = headers;
    options.cache = 'no-store';
    return originalFetch(input, options);
  };
})();
