// Browser customer-order bridge: always attach the live Supabase access token
// to customer order-history requests. This keeps Buyurtmalarim tied to the
// currently authenticated Supabase account instead of stale localStorage state.
(function () {
  if (window.__GULI_CUSTOMER_ORDER_SESSION_BRIDGE__) return;
  window.__GULI_CUSTOMER_ORDER_SESSION_BRIDGE__ = true;

  function readSupabaseToken() {
    try {
      var keys = ["guli_supabase_auth_token"];
      for (var i = 0; i < keys.length; i++) {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        var token = parsed && (parsed.access_token || (parsed.currentSession && parsed.currentSession.access_token));
        if (token) return String(token);
      }
    } catch (_) {}
    return String(localStorage.getItem("guli_access_token") || "").trim();
  }

  function isCustomerOrderUrl(input) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      return /\/api\/(customer\/orders|orders)(?:[/?]|$)/.test(url);
    } catch (_) {
      return false;
    }
  }

  var originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (!isCustomerOrderUrl(input)) return originalFetch(input, init);

    var token = readSupabaseToken();
    var options = init ? Object.assign({}, init) : {};
    var headers = new Headers(options.headers || (input && input.headers) || {});
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", "Bearer " + token);
    }

    var tgData = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
    if (tgData && !headers.has("X-Telegram-Init-Data")) {
      headers.set("X-Telegram-Init-Data", tgData);
    }
    options.headers = headers;
    return originalFetch(input, options);
  };
})();
