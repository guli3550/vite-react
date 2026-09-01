(() => {
  'use strict';

  // Admin order compatibility bridge.
  // Normalizes legacy card_manual values, parses legacy JSON items, and attaches
  // a short-lived signed receipt URL so the order drawer can display the real receipt.
  const API = 'https://guli-lingerie-api.onrender.com';
  const originalFetch = window.fetch.bind(window);
  let installed = false;

  const adminHeaders = (input) => {
    const h = new Headers(input && input.headers ? input.headers : {});
    const token = sessionStorage.getItem('guli_admin_token') || '';
    if (token && !h.has('Authorization')) h.set('Authorization', `Bearer ${token}`);
    return h;
  };

  const normalizeOrder = async (order, headers) => {
    const o = { ...(order || {}) };
    if (o.payment === 'card_manual' || o.payment === 'card_manual_transfer' || o.payment === 'uzcard_humo') {
      o.payment = 'card';
    }
    if (typeof o.items === 'string') {
      try { o.items = JSON.parse(o.items); } catch { o.items = []; }
    }
    if (!Array.isArray(o.items)) o.items = [];

    if (!o.receiptUrl && o.payment_receipt_path && o.id) {
      try {
        const r = await originalFetch(`${API}/api/admin/orders/${encodeURIComponent(o.id)}/payment-receipt`, {
          method: 'GET',
          headers,
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.success && j.data?.receipt_url) {
          o.receiptUrl = j.data.receipt_url;
          o.receipt_url = j.data.receipt_url;
        }
      } catch {}
    }
    return o;
  };

  async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    let url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}
    if (!/\/api\/admin\/orders(?:\?|$|\/)/.test(url)) return response;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response;

    try {
      const json = await response.clone().json();
      const data = json?.data;
      const headers = adminHeaders(init || input);
      if (Array.isArray(data)) {
        json.data = await Promise.all(data.map((o) => normalizeOrder(o, headers)));
      } else if (data && typeof data === 'object' && !Array.isArray(data)) {
        json.data = await normalizeOrder(data, headers);
      }
      const body = JSON.stringify(json);
      const h = new Headers(response.headers);
      h.delete('content-length');
      return new Response(body, { status: response.status, statusText: response.statusText, headers: h });
    } catch {
      return response;
    }
  }

  if (!installed) {
    window.fetch = patchedFetch;
    installed = true;
  }
})();
