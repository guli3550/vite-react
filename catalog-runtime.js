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
  const CACHE_KEY = 'guli_catalog_cache_v3';
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const readCache = () => { try { const v = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return Array.isArray(v?.data) && v.data.length ? v.data : null; } catch { return null; } };
  const saveCache = data => { try { if (Array.isArray(data) && data.length) localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch {} };
  const isCatalog = input => { const url = typeof input === 'string' ? input : input?.url || ''; return API_RE.test(String(url)); };
  window.fetch = async (input, init) => {
    if (!isCatalog(input)) return nativeFetch(input, init);
    let lastError = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await nativeFetch(input, init);
        const copy = response.clone();
        const json = await copy.json().catch(() => null);
        if (response.ok && json && json.success !== false && Array.isArray(json.data)) {
          saveCache(json.data);
          return new Response(JSON.stringify(json), { status: response.status, headers: { 'Content-Type': 'application/json' } });
        }
        lastError = new Error(json?.message || `Catalog HTTP ${response.status}`);
      } catch (error) { lastError = error; }
      await sleep(Math.min(8000, 700 * (attempt + 1)));
    }
    const cached = readCache();
    if (cached) return new Response(JSON.stringify({ success: true, data: cached, source: 'stale-cache' }), { status: 200, headers: { 'Content-Type': 'application/json', 'X-Guli-Catalog-Source': 'cache' } });
    throw lastError || new Error('Mahsulotlar serveri vaqtincha javob bermadi');
  };
})();
