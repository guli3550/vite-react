(() => {
  'use strict';

  // GULI payment/order compatibility bridge.
  // The bridge MUST use the same API selected by the admin session. A hardcoded
  // Render URL creates split-brain data and can return stale/expired receipts.
  const getApiBase = () => {
    try {
      const configured = sessionStorage.getItem('guli_custom_api_url') || '';
      if (configured.trim()) return configured.trim().replace(/\/$/, '');
    } catch {}
    return (window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  };
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

    // Receipt URLs are sensitive and must never be copied into ordinary order payloads.
    // The Payments section explicitly requests /payment-receipt to obtain a short-lived URL.
    if (!attachReceipt) {
      delete o.receiptUrl;
      delete o.receipt_url;
      delete o.payment_receipt_url;
      delete o.receipt_path;
    }

    if (attachReceipt && o.id) {
      try {
        const API = getApiBase();
        const r = await originalFetch(`${API}/api/admin/orders/${encodeURIComponent(o.id)}/payment-receipt`, {
          method: 'GET',
          headers,
          cache: 'no-store',
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success) {
          const receiptUrl = String(j.data?.receipt_url || '');
          o.receiptUrl = receiptUrl;
          o.receipt_url = receiptUrl;
          o.payment_receipt_path = j.data?.payment_receipt_path || o.payment_receipt_path || '';
          o.payment_status = j.data?.payment_status || o.payment_status || '';
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
    const paymentReceiptEndpoint = /\/payment-receipt(?:\?|$)/.test(url);

    if (Array.isArray(data)) {
      json.data = await Promise.all(data.map((o) => normalizeOrder(o, headers, isAdmin && paymentReceiptEndpoint)));
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.recentOrders)) {
        data.recentOrders = await Promise.all(data.recentOrders.map((o) => normalizeOrder(o, headers, false)));
      }
      if (data.order && typeof data.order === 'object') {
        data.order = await normalizeOrder(data.order, headers, isAdmin && paymentReceiptEndpoint);
      }
      if (!Array.isArray(data.recentOrders) && !data.order && (data.id || data.order_number || data.payment)) {
        json.data = await normalizeOrder(data, headers, isAdmin && paymentReceiptEndpoint);
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

  function normalizeStoredOrders(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      if (!Array.isArray(parsed)) return value;
      return JSON.stringify(parsed.map((o) => {
        const copy = { ...(o || {}), payment: normalizePayment(o?.payment), items: parseItems(o?.items) };
        delete copy.receipt_url;
        delete copy.receiptUrl;
        delete copy.payment_receipt_url;
        delete copy.receipt_path;
        return copy;
      }));
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
    try {
      Object.defineProperty(window, 'fetch', {
        value: patchedFetch,
        writable: true,
        configurable: true,
      });
    } catch {
      try {
        window.fetch = patchedFetch;
      } catch {
        try {
          globalThis.fetch = patchedFetch;
        } catch {}
      }
    }
    installed = true;
  }
})();
