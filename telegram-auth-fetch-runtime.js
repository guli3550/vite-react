(() => {
  const originalFetch = window.fetch.bind(window);
  const API_BASE = 'https://guli-gateway.parizodabaxtiyorov.workers.dev';
  const backendHosts = new Set(['guli-lingerie-api.onrender.com']);
  const protectedPaths = ['/api/orders', '/api/save-address', '/api/telegram-user'];
  const isApiPath = path => String(path || '').startsWith('/api/');

  window.__GULI_API__ = window.__GULI_API__ || API_BASE;

  window.fetch = (input, init = {}) => {
    let rawUrl = '';
    try { rawUrl = typeof input === 'string' ? input : input?.url || ''; } catch {}

    let parsed;
    try { parsed = new URL(rawUrl || '', location.href); } catch { return originalFetch(input, init); }

    const shouldRoute = isApiPath(parsed.pathname) || backendHosts.has(parsed.host);
    if (!shouldRoute) return originalFetch(input, init);

    if (backendHosts.has(parsed.host)) {
      parsed.protocol = 'https:';
      parsed.host = new URL(API_BASE).host;
    } else if (parsed.origin === location.origin) {
      parsed.protocol = 'https:';
      parsed.host = new URL(API_BASE).host;
    }

    const tg = window.Telegram?.WebApp;
    const headers = new Headers(init instanceof Request ? init.headers : init.headers || {});
    const path = parsed.pathname;
    if (protectedPaths.includes(path) && tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);
    if (path.startsWith('/api/orders/') && tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);

    const nextInit = { ...init, headers };
    return originalFetch(parsed.toString(), nextInit);
  };
})();
