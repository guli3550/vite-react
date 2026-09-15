(() => {
  // Keeps GULI's server-signed customer JWT alive without depending on
  // Supabase Phone Auth/SMS. A single refresh request is shared by concurrent
  // 401 responses so multiple tabs/components do not rotate the same token.
  const API = (window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  let refreshInFlight = null;

  function getAccess() { try { return localStorage.getItem('guli_access_token') || ''; } catch { return ''; } }
  function getRefresh() { try { return localStorage.getItem('guli_refresh_token') || ''; } catch { return ''; } }
  function save(data) {
    if (!data?.access_token) return false;
    try {
      localStorage.setItem('guli_access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('guli_refresh_token', data.refresh_token);
      window.__GULI_SUPABASE_ACCESS_TOKEN = data.access_token;
    } catch {}
    return true;
  }

  async function refresh() {
    const token = getRefresh();
    if (!token) return false;
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = fetch(`${API}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
      cache: 'no-store',
    }).then(async r => {
      const j = await r.json().catch(() => null);
      if (!r.ok || j?.success === false) return false;
      return save(j?.data || j);
    }).catch(() => false).finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const requestUrl = typeof input === 'string' ? input : (input?.url || '');
    const isApi = requestUrl.startsWith(API) || requestUrl.startsWith('/api/');
    const isAuthRoute = /\/api\/v1\/auth\/(?:refresh|init-session|check-status|exchange|verify-otp)(?:\/|$)/.test(requestUrl);
    const response = await originalFetch(input, init);
    if (response.status !== 401 || !isApi || isAuthRoute || !getRefresh()) return response;

    const ok = await refresh();
    if (!ok) return response;

    // Rebuild the Authorization header using the freshly rotated access token.
    const access = getAccess();
    const retryInit = { ...(init || {}) };
    const headers = new Headers((init && init.headers) || (typeof input !== 'string' ? input.headers : undefined));
    if (access) headers.set('Authorization', `Bearer ${access}`);
    retryInit.headers = headers;
    return originalFetch(input, retryInit);
  };

  // Refresh shortly before the 15-minute access token expires while the app
  // remains open. Failure is intentionally silent; the next API 401 retries.
  window.setInterval(() => { if (getAccess() && getRefresh()) void refresh(); }, 12 * 60 * 1000);
})();
