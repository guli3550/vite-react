// Final customer order continuity layer.
// Uses the canonical authenticated orders endpoint for both Telegram WebApp and
// browser accounts so the visible order list always comes from the same source.
(() => {
  'use strict';
  if (window.__GULI_CUSTOMER_ORDERS_UNIFIED_FIX__) return;
  window.__GULI_CUSTOMER_ORDERS_UNIFIED_FIX__ = true;

  const nativeFetch = window.fetch.bind(window);
  const isOrderRead = (url) => /\/api\/(customer\/orders|orders|auth\/orders)(?:[/?]|$)/i.test(String(url || ''));

  const token = () => {
    const direct = String(localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('guli_supabase_auth_token');
      const j = raw ? JSON.parse(raw) : null;
      return String(j?.access_token || j?.currentSession?.access_token || j?.session?.access_token || j?.data?.session?.access_token || '').trim();
    } catch { return ''; }
  };

  const headers = (init) => {
    const h = new Headers((init && init.headers) || {});
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      h.set('X-Telegram-Init-Data', tg.initData);
      h.delete('Authorization');
    } else {
      const t = token();
      if (t) h.set('Authorization', `Bearer ${t}`);
    }
    h.set('Accept', 'application/json');
    return h;
  };

  const canonical = (row) => {
    if (!row || typeof row !== 'object') return row;
    const n = { ...row };
    n.order_number = String(n.order_number || n.id || '');
    n.id = n.order_number;
    n.createdAt = n.createdAt || n.created_at || null;
    n.updatedAt = n.updatedAt || n.updated_at || n.createdAt;
    n.statusUpdatedAt = n.statusUpdatedAt || n.status_updated_at || n.updatedAt;
    return n;
  };

  window.fetch = async (input, init) => {
    const originalUrl = typeof input === 'string' ? input : input?.url || '';
    if (!isOrderRead(originalUrl)) return nativeFetch(input, init);

    const url = new URL(originalUrl, window.location.origin);
    const isCustomerEndpoint = /\/api\/customer\/orders(?:[/?]|$)/i.test(url.pathname);
    // The canonical backend route validates the same Telegram initData or
    // Supabase bearer token and is shared by all customer clients.
    if (isCustomerEndpoint && !/^\/api\/customer\/orders\/[^/]+\//i.test(url.pathname)) {
      url.pathname = '/api/orders';
    }

    const options = { ...(init || {}), headers: headers(init), cache: 'no-store' };
    const response = await nativeFetch(url.toString(), options);
    if (!response.ok) return response;
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body?.success && Array.isArray(body.data)) {
        body.data = body.data.map(canonical);
        try {
          const current = body.data;
          localStorage.setItem('guli_orders', JSON.stringify(current));
          localStorage.setItem('orders', JSON.stringify(current));
        } catch {}
      }
      return new Response(JSON.stringify(body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch {
      return response;
    }
  };
})();