(() => {
  'use strict';

  // GULI canonical auth stabilizer.
  // Loaded after the legacy runtime bridges so all customer requests share:
  //   1) one API origin,
  //   2) one access token source,
  //   3) one cross-tab refresh lock,
  //   4) bounded retry for transient auth-network failures.
  if (window.__GULI_CANONICAL_AUTH_STABILIZER__) return;
  window.__GULI_CANONICAL_AUTH_STABILIZER__ = true;

  const API = String(
    window.__GULI_API_URL ||
    'https://guli-gateway.parizodabaxtiyorov.workers.dev'
  ).replace(/\/$/, '');

  const ACCESS = 'guli_access_token';
  const REFRESH = 'guli_refresh_token';
  const USER = 'guli_auth_user';
  const LOCK = 'guli_auth_refresh_lock_v1';
  const CHANNEL = 'guli_auth_channel_v1';

  const nativeFetch = window.fetch.bind(window);
  let refreshInFlight = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const read = (key) => {
    try { return String(localStorage.getItem(key) || '').trim(); } catch { return ''; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, value); } catch {}
  };
  const remove = (key) => {
    try { localStorage.removeItem(key); } catch {}
  };

  function urlOf(input) {
    return String(typeof input === 'string'
      ? input
      : input instanceof URL
      ? input.href
      : input?.url || '');
  }

  function isCanonical(url) {
    return url === API || url.startsWith(API + '/');
  }

  function isAuthEndpoint(url) {
    return /\/api\/v1\/auth\/(init-session|check-status|exchange|refresh)(?:[/?]|$)/i.test(url);
  }

  function isCustomerApi(url) {
    return /\/api\/(orders|customer\/|auth\/orders(?:\/|$)|auth\/payment(?:\/|$)|reviews|save-address)(?:[/?]|$)/i.test(url);
  }

  function withAccess(input, init, token) {
    const options = init ? { ...init } : {};
    const sourceHeaders = options.headers || (input instanceof Request ? input.headers : undefined);
    const headers = new Headers(sourceHeaders || {});
    if (token) headers.set('Authorization', 'Bearer ' + token);
    else headers.delete('Authorization');
    headers.set('Cache-Control', 'no-cache');
    options.headers = headers;
    options.cache = 'no-store';
    return options;
  }

  async function refreshNow() {
    if (refreshInFlight) return refreshInFlight;

    const token = read(REFRESH);
    if (!token) return '';

    refreshInFlight = (async () => {
      // Cross-tab lock: only one tab rotates the refresh token.
      const me = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      const deadline = Date.now() + 9000;

      while (Date.now() < deadline) {
        const raw = read(LOCK);
        let lock = null;
        try { lock = raw ? JSON.parse(raw) : null; } catch {}
        if (!lock || !lock.until || Number(lock.until) < Date.now()) {
          write(LOCK, JSON.stringify({ id: me, until: Date.now() + 7000 }));
          const verify = read(LOCK);
          if (verify.includes(me)) break;
        }
        await sleep(250);
        const current = read(ACCESS);
        if (current && current !== token) return current;
      }

      const current = read(ACCESS);
      if (current && current !== token) return current;

      try {
        const response = await nativeFetch(API + '/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ refresh_token: token }),
          cache: 'no-store',
        });
        const body = await response.json().catch(() => ({}));

        if (!response.ok || body?.success === false || !body?.data?.access_token) {
          if (response.status === 401 || response.status === 409) {
            remove(ACCESS);
            remove(REFRESH);
            remove(USER);
          }
          return '';
        }

        write(ACCESS, body.data.access_token);
        if (body.data.refresh_token) write(REFRESH, body.data.refresh_token);
        if (body.data.user) write(USER, JSON.stringify({
          id: String(body.data.user.id || ''),
          phone: body.data.user.phone_number || null,
          full_name: body.data.user.full_name || null,
          username: body.data.user.telegram_username || null,
          telegram_username: body.data.user.telegram_username || null,
          telegram_id: body.data.user.telegram_id ?? null,
          avatar_url: body.data.user.telegram_photo_url || null,
          telegram_photo_url: body.data.user.telegram_photo_url || null,
          provider: 'telegram',
          created_at: body.data.user.created_at,
        }));
        return String(body.data.access_token);
      } catch {
        return '';
      } finally {
        if (read(LOCK).includes(me)) remove(LOCK);
      }
    })();

    try { return await refreshInFlight; }
    finally { refreshInFlight = null; }
  }

  async function authNetworkRetry(input, options, url) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await nativeFetch(input, options);
      } catch (error) {
        lastError = error;
        if (attempt < 2) await sleep(450 * (attempt + 1));
      }
    }
    throw lastError;
  }

  const stabilizedFetch = async (input, init) => {
    const url = urlOf(input);
    const canonical = isCanonical(url);
    const authEndpoint = isAuthEndpoint(url);
    const protectedCustomer = isCustomerApi(url);
    const token = read(ACCESS);

    let options = (canonical && (protectedCustomer || authEndpoint))
      ? withAccess(input, init, token)
      : (init || undefined);

    // Auth bootstrap/status/exchange calls get bounded network retry.
    if (canonical && authEndpoint) {
      return authNetworkRetry(input, options, url);
    }

    let response = await nativeFetch(input, options);

    if (canonical && protectedCustomer && response.status === 401 && read(REFRESH)) {
      const fresh = await refreshNow();
      if (fresh) {
        options = withAccess(input, init, fresh);
        response = await nativeFetch(input, options);
      }
    }

    return response;
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: stabilizedFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    try { window.fetch = stabilizedFetch; } catch {}
  }

  // Another tab may rotate the session. All subsequent requests read the
  // current localStorage token, so no stale in-memory token is retained here.
  window.addEventListener('storage', (event) => {
    if (event.key === ACCESS || event.key === REFRESH) {
      window.dispatchEvent(new CustomEvent('guli-auth-session-changed'));
    }
  });

  // If the browser comes back online while an auth dialog is open, let the
  // next request use the canonical retry path instead of requiring cache clear.
  window.addEventListener('online', () => {
    window.dispatchEvent(new CustomEvent('guli-auth-network-restored'));
  });
})();
