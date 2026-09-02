(() => {
  'use strict';

  const originalFetch = window.fetch.bind(window);
  let installed = false;

  function normalizeAddress(value) {
    if (!value) return null;
    if (typeof value === 'string') {
      const text = value.trim();
      return text ? { formatted_address: text, address: text, street: text } : null;
    }
    const source = value.location && typeof value.location === 'object' ? { ...value, ...value.location } : { ...value };
    const addressText = String(source.formatted_address || source.formattedAddress || source.address || source.delivery_address || '').trim();
    const out = {
      ...source,
      region: source.region || source.region_name || source.state || source.province || '',
      district: source.district || source.district_name || source.county || '',
      street: source.street || source.street_name || source.road || addressText || '',
      house: source.house || source.house_number || source.building || '',
      apartment: source.apartment || source.flat || source.unit || '',
      landmark: source.landmark || source.reference || '',
      latitude: source.latitude ?? source.lat ?? source.location?.lat ?? source.location?.latitude,
      longitude: source.longitude ?? source.lng ?? source.location?.lng ?? source.location?.longitude,
      address: addressText,
      formatted_address: addressText,
    };
    return out;
  }

  function normalizeOrder(order) {
    if (!order || typeof order !== 'object') return order;
    const o = { ...order };
    const rawAddress = o.address || o.delivery_address || o.deliveryAddress || o.location;
    const address = normalizeAddress(rawAddress);
    if (address) {
      o.address = address;
      o.delivery_address = address;
      o.deliveryAddress = address;
      o.address_text = [address.region, address.district, address.street, address.house, address.apartment].filter(Boolean).join(', ') || address.formatted_address || address.address || '';
    }
    if (typeof o.items === 'string') {
      try { o.items = JSON.parse(o.items); } catch { o.items = []; }
    }
    o.payment = ['card_manual', 'card_manual_transfer', 'uzcard_humo', 'card'].includes(String(o.payment || '').toLowerCase()) ? 'card' : (o.payment || 'cash');
    if (o.payment_receipt_path && !o.receipt_url && !o.receiptUrl) o.receipt_pending = true;
    try { window.__GULI_LAST_ADMIN_ORDER = o; } catch {}
    return o;
  }

  function normalizeData(data) {
    if (Array.isArray(data)) return data.map(normalizeOrder);
    if (!data || typeof data !== 'object') return data;
    const out = { ...data };
    if (Array.isArray(out.recentOrders)) out.recentOrders = out.recentOrders.map(normalizeOrder);
    if (out.order && typeof out.order === 'object') out.order = normalizeOrder(out.order);
    if (out.data && typeof out.data === 'object') out.data = normalizeData(out.data);
    if ((out.order_number || out.payment || out.address || out.delivery_address) && !out.recentOrders && !out.order) return normalizeOrder(out);
    return out;
  }

  async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    let url = '';
    try { url = typeof input === 'string' ? input : input?.url || ''; } catch {}
    if (!/\/api\/admin\//.test(url)) return response;
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return response;
    try {
      const json = await response.clone().json();
      const normalized = { ...json, data: normalizeData(json.data) };
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(JSON.stringify(normalized), { status: response.status, statusText: response.statusText, headers });
    } catch {
      return response;
    }
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
