(() => {
  const originalFetch = window.fetch.bind(window);
  const configuredApiHost = (() => {
    try { return new URL(document.querySelector('meta[name="guli-api-url"]')?.content || '').host; } catch { return ''; }
  })();
  const apiHosts = new Set([
    configuredApiHost,
    'guli-lingerie-api.onrender.com',
    'guli-gateway.parizodabaxtiyorov.workers.dev'
  ].filter(Boolean));
  const protectedPaths = ['/api/orders', '/api/save-address', '/api/telegram-user'];
  window.fetch = (input, init = {}) => {
    let url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}
    let isProtected = false;
    try {
      const parsed = new URL(url, location.href);
      isProtected = apiHosts.has(parsed.host) && protectedPaths.some(path => parsed.pathname === path);
    } catch {}
    if (!isProtected) return originalFetch(input, init);
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData || '';
    if (!initData) return originalFetch(input, init);
    const headers = new Headers(init instanceof Request ? init.headers : init.headers || {});
    headers.set('X-Telegram-Init-Data', initData);
    return originalFetch(input, { ...init, headers });
  };
})();
