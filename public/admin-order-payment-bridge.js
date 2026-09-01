(() => {
  'use strict';

  // GULI payment/order compatibility bridge.
  // One canonical response shape is required by the admin drawer, payments tab,
  // dashboard recent orders and customer order detail. Legacy card_manual data
  // remains valid in the database but is exposed to the UI as a card payment.
  const API = 'https://guli-lingerie-api.onrender.com';
  const originalFetch = window.fetch.bind(window);
  let installed = false;
  let localStoragePatched = false;

  const adminHeaders = (input) => {
    const h = new Headers(input && input.headers ? input.headers : {});
    const token = sessionStorage.getItem('guli_admin_token') || '';
    if (token && !h.has('Authorization')) h.set('Authorization', `Bearer ${token}`);
    return h;
  };

  const normalizePayment = (value) => {
    const v = String(value || '').trim().toLowerCase();
    if (v === 'card_manual' || v === 'card_manual_transfer' || v === 'uzcard_humo' || v === 'card') return 'card';
    return value || 'cash';
  };

  const parseItems = (items) => {
    if (typeof items === 'string') {
      try { items = JSON.parse(items); } catch { items = []; }
    }
    return Array.isArray(items) ? items : [];
  };

  const normalizeOrder = async (order, headers, attachReceipt = false) => {
    const o = { ...(order || {}) };
    o.payment = normalizePayment(o.payment);
    o.items = parseItems(o.items);

    // Accept all known legacy receipt property names.
    const existingReceipt = o.receiptUrl || o.receipt_url || o.payment_receipt_url || '';
    if (existingReceipt) {
      o.receiptUrl = existingReceipt;
      o.receipt_url = existingReceipt;
    }

    if (attachReceipt && !o.receiptUrl && o.id) {
      try {
        const r = await originalFetch(`${API}/api/admin/orders/${encodeURIComponent(o.id)}/payment-receipt`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success && j.data?.receipt_url) {
          o.receiptUrl = j.data.receipt_url;
          o.receipt_url = j.data.receipt_url;
          o.payment_receipt_path = j.data.payment_receipt_path || o.payment_receipt_path || '';
          o.payment_status = j.data.payment_status || o.payment_status || '';
        }
      } catch {}
    }
    return o;
  };

  const normalizePayload = async (json, url, headers) => {
    if (!json || typeof json !== 'object') return json;
    const data = json.data;
    const isAdmin = /\/api\/admin\//.test(url);
    const isOrderEndpoint = /\/api\/orders(?:\/|\?|$)/.test(url);
    if (!isAdmin && !isOrderEndpoint) return json;

    // /api/admin/dashboard contains recentOrders; /api/admin/orders and
    // /api/orders contain a direct array/object. Normalize every known shape.
    if (Array.isArray(data)) {
      json.data = await Promise.all(data.map((o) => normalizeOrder(o, headers, isAdmin)));
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.recentOrders)) {
        data.recentOrders = await Promise.all(data.recentOrders.map((o) => normalizeOrder(o, headers, true)));
      }
      if (data.order && typeof data.order === 'object') {
        data.order = await normalizeOrder(data.order, headers, isAdmin);
      }
      if (!Array.isArray(data.recentOrders) && !data.order && (data.id || data.order_number || data.payment)) {
        json.data = await normalizeOrder(data, headers, isAdmin);
      }
    }
    return json;
  };

  async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    let url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}
    if (!/\/api\/(?:admin\/|orders(?:\/|\?|$))/.test(url)) return response;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response;

    try {
      const json = await response.clone().json();
      const headers = /\/api\/admin\//.test(url) ? adminHeaders(init || input) : new Headers(init?.headers || input?.headers || {});
      const normalized = await normalizePayload(json, url, headers);
      const body = JSON.stringify(normalized);
      const h = new Headers(response.headers);
      h.delete('content-length');
      return new Response(body, { status: response.status, statusText: response.statusText, headers: h });
    } catch {
      return response;
    }
  }

  // Legacy localStorage order snapshots can otherwise re-introduce card_manual
  // and make the customer order drawer show "Naqd" after a reload.
  function normalizeStoredOrders(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return value;
      return JSON.stringify(parsed.map((o) => ({ ...o, payment: normalizePayment(o?.payment), items: parseItems(o?.items) })));
    } catch {
      return value;
    }
  }

  if (!localStoragePatched) {
    try {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (key, value) => originalSetItem(key, key === 'orders' ? normalizeStoredOrders(value) : value);
      const current = localStorage.getItem('orders');
      if (current) originalSetItem('orders', normalizeStoredOrders(current));
      localStoragePatched = true;
    } catch {}
  }

  if (!installed) {
    window.fetch = patchedFetch;
    installed = true;
  }
})();