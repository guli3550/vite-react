(() => {
  const styleHref = '/marketplace-fixes.css';
  if (!document.querySelector(`link[href="${styleHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${styleHref}?v=1`;
    document.head.appendChild(link);
  }
  const nativeFetch = window.fetch.bind(window);
  const API_RE = /https?:\/\/[^/]+\/api\/products(?:\?|$)|\/api\/products(?:\?|$)/i;
  const CACHE_KEY = 'guli_catalog_cache_v4';
  const readCache = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      return Array.isArray(v?.data) && v.data.length ? v.data : null;
    } catch { return null; }
  };
  const saveCache = data => {
    try {
      if (Array.isArray(data) && data.length) localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {}
  };
  const isCatalog = input => {
    const url = typeof input === 'string' ? input : input?.url || '';
    return API_RE.test(String(url));
  };
  const refresh = (input, init) => {
    nativeFetch(input, init).then(async response => {
      if (!response.ok) return;
      const json = await response.clone().json().catch(() => null);
      if (json?.success !== false && Array.isArray(json?.data) && json.data.length) saveCache(json.data);
    }).catch(() => {});
  };
  const customFetch = async (input, init) => {
    if (!isCatalog(input)) return nativeFetch(input, init);
    const cached = readCache();
    if (cached) {
      // Never make a returning customer wait for Render/API cold-starts.
      refresh(input, init);
      return new Response(JSON.stringify({ success: true, data: cached, source: 'local-cache' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Guli-Catalog-Source': 'local-cache' }
      });
    }
    try {
      const response = await nativeFetch(input, init);
      const copy = response.clone();
      const json = await copy.json().catch(() => null);
      if (response.ok && json && json.success !== false && Array.isArray(json.data)) {
        saveCache(json.data);
        return response;
      }
      throw new Error(json?.message || `Catalog HTTP ${response.status}`);
    } catch (error) {
      const fallback = readCache();
      if (fallback) return new Response(JSON.stringify({ success: true, data: fallback, source: 'stale-cache' }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Guli-Catalog-Source': 'cache' } });
      throw error instanceof Error ? error : new Error('Mahsulotlar serveri vaqtincha javob bermadi');
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
