// Browser customer-order bridge: always attach the LIVE Supabase access token.
(function () {
  if (window.__GULI_CUSTOMER_ORDER_SESSION_BRIDGE__) return;
  window.__GULI_CUSTOMER_ORDER_SESSION_BRIDGE__ = true;
  function readToken() {
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
  function protectedUrl(input) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    return /\/api\/(customer\/orders|auth\/orders|orders)(?:[/?]|$)/i.test(url);
  }
  var originalFetch = window.fetch.bind(window);
  var customFetch = function (input, init) {
    if (!protectedUrl(input)) return originalFetch(input, init);
    var options = init ? Object.assign({}, init) : {};
    var headers = new Headers(options.headers || (input && input.headers) || {});
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) {
      headers.set('X-Telegram-Init-Data', tg.initData);
    } else {
      var token = readToken();
      if (token) headers.set('Authorization', 'Bearer ' + token);
      else headers.delete('Authorization');
    }
    options.headers = headers;
    options.cache = 'no-store';
    return originalFetch(input, options);
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true
    });
  } catch (_) {
    try {
      window.fetch = customFetch;
    } catch (_) {
      try {
        globalThis.fetch = customFetch;
      } catch (_) {}
    }
  }
})();
