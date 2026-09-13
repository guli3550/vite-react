// Canonical browser order identity bridge.
// The database UUID remains internal; the customer-facing order ID is always GULI-******.
(function () {
  'use strict';
  if (window.__GULI_ORDER_CANONICAL_RUNTIME__) return;
  window.__GULI_ORDER_CANONICAL_RUNTIME__ = true;

  function normalizeOrder(o) {
    if (!o || typeof o !== 'object') return o;
    var n = Object.assign({}, o);
    if (n.order_number) n.id = String(n.order_number);
    if (String(n.payment || '').toLowerCase() === 'card_manual') n.payment = 'Karta (Uzcard / Humo)';
    return n;
  }

  function normalizePayload(j, method) {
    if (!j || !j.success) return j;
    var out = Object.assign({}, j);
    if (Array.isArray(out.data)) out.data = out.data.map(normalizeOrder);
    else if (out.data && typeof out.data === 'object' && /post/i.test(method || '')) out.data = normalizeOrder(out.data);
    return out;
  }

  var nativeFetch = window.fetch.bind(window);
  var customFetch = async function (input, init) {
    var res = await nativeFetch(input, init);
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!/\/api\/(customer\/orders|orders)(?:[/?]|$)/i.test(url)) return res;
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var clone = res.clone();
      var json = await clone.json();
      var normalized = normalizePayload(json, method);
      return new Response(JSON.stringify(normalized), {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers
      });
    } catch (_) {
      return res;
    }
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

  // Repair stale local order cards created by older builds.
  function repairStorage() {
    ['orders', 'guli_orders'].forEach(function (key) {
      try {
        var raw = localStorage.getItem(key);
        if (!raw) return;
        var list = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        var next = list.map(normalizeOrder);
        if (JSON.stringify(next) !== JSON.stringify(list)) localStorage.setItem(key, JSON.stringify(next));
      } catch (_) {}
    });
  }
  repairStorage();
  setInterval(repairStorage, 1500);
})();
