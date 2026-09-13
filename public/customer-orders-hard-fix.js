(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  if (window.__GULI_CUSTOMER_ORDERS_HARD_FIX__) return;
  window.__GULI_CUSTOMER_ORDERS_HARD_FIX__ = true;

  function normalizeOrder(row) {
    if (!row || typeof row !== 'object') return row;
    const paymentStatus = String(row.payment_status || '').toLowerCase();
    let payment = String(row.payment || row.payment_method || '').trim();
    // A receipt/verified card order must never be rendered as Naqd because of stale local data.
    if ((!payment || /^naqd|cash$/i.test(payment)) && (row.payment_receipt_path || ['receipt_uploaded', 'verified', 'rejected'].includes(paymentStatus))) {
      payment = 'card_manual';
    }
    const number = String(row.order_number || row.id || '').trim();
    return {
      ...row,
      id: number || String(row.id || ''),
      order_number: number || undefined,
      payment,
      payment_status: row.payment_status || 'pending',
      status: row.status || '⏳ Buyurtma kutilmoqda',
    };
  }

  function patchResponse(response) {
    const originalJson = response.json.bind(response);
    response.json = async () => {
      const body = await originalJson();
      if (!body || !Array.isArray(body.data)) return body;
      return { ...body, data: body.data.map(normalizeOrder) };
    };
    return response;
  }

  window.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    const isOrders = /\/api\/(customer\/orders|orders)(?:[/?]|$)/.test(url);
    if (!isOrders) return nativeFetch(input, init);
    return patchResponse(await nativeFetch(input, init));
  };

  // Keep stale local order caches canonical as well.
  for (const key of ['guli_orders', 'orders']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) localStorage.setItem(key, JSON.stringify(parsed.map(normalizeOrder)));
    } catch {}
  }
})();
