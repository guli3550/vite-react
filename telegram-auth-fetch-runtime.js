(() => {
  const originalFetch = window.fetch.bind(window);
  const API_BASE = 'https://guli-gateway.parizodabaxtiyorov.workers.dev';
  const FALLBACK_BASE = 'https://guli-lingerie-api.onrender.com';
  const backendHosts = new Set(['guli-lingerie-api.onrender.com']);
  const protectedPaths = ['/api/orders', '/api/save-address', '/api/telegram-user'];
  const resilientGetPaths = new Set(['/api/products', '/api/categories', '/api/reverse-geocode']);
  const isApiPath = path => String(path || '').startsWith('/api/');

  window.__GULI_API__ = window.__GULI_API__ || API_BASE;

  const requestWithTimeout = async (url, init, timeoutMs) => {
    const controller = new AbortController();
    const externalSignal = init?.signal;
    let timer = null;
    const abortFromExternal = () => controller.abort(externalSignal?.reason);
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort(externalSignal.reason);
      else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
    }
    timer = window.setTimeout(() => controller.abort(new DOMException('API timeout', 'TimeoutError')), timeoutMs);
    try {
      return await originalFetch(url, { ...init, signal: controller.signal });
    } finally {
      if (timer) window.clearTimeout(timer);
      externalSignal?.removeEventListener('abort', abortFromExternal);
    }
  };

  const customFetch = async (input, init = {}) => {
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
    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (protectedPaths.includes(path) && tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);
    if (path.startsWith('/api/orders/') && tg?.initData) headers.set('X-Telegram-Init-Data', tg.initData);

    const nextInit = { ...init, headers };
    const isResilientGet = method === 'GET' && resilientGetPaths.has(path);

    if (!isResilientGet) return originalFetch(parsed.toString(), nextInit);

    const gatewayUrl = parsed.toString();
    try {
      const response = await requestWithTimeout(gatewayUrl, nextInit, 7000);
      if (response.ok) return response;
    } catch {}

    // The storefront must remain usable if the Cloudflare gateway is cold,
    // unhealthy, or missing a public route. Fall back to the Render API only
    // for public read endpoints; protected writes remain gateway-only.
    const fallback = new URL(path, FALLBACK_BASE);
    fallback.search = parsed.search;
    try {
      return await requestWithTimeout(fallback.toString(), { ...nextInit, headers: new Headers(headers) }, 12000);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Storefront API unavailable');
    }
  };

  try {
    window.fetch = customFetch;
  } catch {
    try {
      Object.defineProperty(window, 'fetch', { value: customFetch, writable: true, configurable: true });
    } catch {}
  }
})();
