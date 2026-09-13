// Final customer order continuity layer.
// Keeps server data authoritative and rehydrates the same order list after a reload.
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
    return h;
  };

  const canonical = (row) => {
    if (!row || typeof row !== 'object') return row;
    const n = { ...row };
    n.order_number = String(n.order_number || n.id || '');
    n.id = n.order_number;
    n.createdAt = n.createdAt || n.created_at || new Date().toISOString();
    n.updatedAt = n.updatedAt || n.updated_at || n.createdAt;
    n.statusUpdatedAt = n.statusUpdatedAt || n.status_updated_at || n.updatedAt;
    return n;
  };

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!isOrderRead(url)) return nativeFetch(input, init);
    const options = { ...(init || {}), headers: headers(init), cache: 'no-store' };
    const response = await nativeFetch(input, options);
    if (!response.ok) return response;
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (body?.success && Array.isArray(body.data)) {
        body.data = body.data.map(canonical);
        try {
          const existing = JSON.parse(localStorage.getItem('guli_orders') || '[]');
          const old = Array.isArray(existing) ? existing : [];
          const map = new Map(old.map(o => [String(o.order_number || o.id), o]));
          body.data.forEach(o => map.set(o.order_number, o));
          localStorage.setItem('guli_orders', JSON.stringify([...map.values()]));
          localStorage.setItem('orders', JSON.stringify([...map.values()]));
        } catch {}
      }
      return new Response(JSON.stringify(body), { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch { return response; }
  };
})();
