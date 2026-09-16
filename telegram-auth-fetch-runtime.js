(() => {
  // GULI canonical API policy: browser + Telegram Mini App use ONE API origin.
  // Cloudflare may proxy this origin, but the client must never fail over
  // directly to the Render origin.
  const API_BASE = String(window.__GULI_CANONICAL_API__ || 'https://guli-gateway.parizodabaxtiyorov.workers.dev').replace(/\/$/, '');
  const originalFetch = window.fetch.bind(window);
  const isApiPath = path => String(path || '').startsWith('/api/');

  window.__GULI_API__ = API_BASE;
  window.__GULI_CANONICAL_API__ = API_BASE;

  const customFetch = async (input, init = {}) => {
    let rawUrl = '';
    try { rawUrl = typeof input === 'string' ? input : input?.url || ''; } catch {}
    let parsed;
    try { parsed = new URL(rawUrl || '', location.href); } catch {
      return originalFetch(input, init);
    }

    // Rewrite only same-origin API calls to the canonical API origin.
    // Absolute external URLs are intentionally left untouched.
    if (!isApiPath(parsed.pathname)) return originalFetch(input, init);
    if (parsed.origin === location.origin) {
      parsed.protocol = 'https:';
      parsed.host = new URL(API_BASE).host;
    }

    const tg = window.Telegram?.WebApp;
    const headers = new Headers(init instanceof Request ? init.headers : init.headers || {});
    const path = parsed.pathname;

    // Telegram initData is a verified bootstrap credential at the canonical
    // server. Never add client-supplied phone/user/order identity fields.
    if (tg?.initData && (
      path === '/api/telegram-user' ||
      path === '/api/customer/sync' ||
      path.startsWith('/api/orders') ||
      path.startsWith('/api/reviews')
    )) {
      headers.set('X-Telegram-Init-Data', tg.initData);
    }

    return originalFetch(parsed.toString(), { ...init, headers });
  };

  try {
    Object.defineProperty(window, 'fetch', { value: customFetch, writable: true, configurable: true });
  } catch {
    try { window.fetch = customFetch; } catch {}
  }
})();
