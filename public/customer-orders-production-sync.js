(() => {
  'use strict';
  if (window.__GULI_CUSTOMER_ORDERS_PRODUCTION_SYNC__) return;
  window.__GULI_CUSTOMER_ORDERS_PRODUCTION_SYNC__ = true;

  const API = String(window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  const nativeFetch = window.fetch.bind(window);
  let polling = false;
  let timer = 0;

  const telegramInitData = () => String(window.Telegram?.WebApp?.initData || '').trim();
  const accessToken = () => {
    const direct = String(window.__GULI_SUPABASE_ACCESS_TOKEN || localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i) || '';
        if (!/supabase.*auth|auth.*supabase/i.test(key)) continue;
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        const token = parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token || parsed?.data?.session?.access_token;
        if (token) return String(token).trim();
      }
    } catch {}
    return '';
  };
  const phone = () => {
    const values = [localStorage.getItem('guli_phone'), localStorage.getItem('guli_customer_phone'), localStorage.getItem('guli_last_order_phone')];
    try {
      const u = JSON.parse(localStorage.getItem('guli_auth_user') || 'null');
      values.push(u?.phone, u?.user_metadata?.phone);
    } catch {}
    for (const value of values) {
      const p = String(value || '').replace(/\D/g, '');
      if (p.length >= 7) return p;
    }
    return '';
  };
  const headers = () => {
    const h = { Accept: 'application/json' };
    const tg = telegramInitData();
    if (tg) h['X-Telegram-Init-Data'] = tg;
    else {
      const token = accessToken();
      if (token) h.Authorization = `Bearer ${token}`;
    }
    const p = phone();
    if (p) h['X-Customer-Phone'] = p;
    return h;
  };

  const ordersUrl = () => {
    const u = new URL(`${API}/api/orders`);
    const tgId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim();
    const p = phone();
    if (tgId) u.searchParams.set('telegram_id', tgId);
    if (p) u.searchParams.set('phone', p);
    u.searchParams.set('_guli_sync', String(Date.now()));
    return u.toString();
  };

  const normalize = (row) => {
    const id = String(row?.order_number || row?.id || '').trim();
    return { ...row, id, order_number: id, status: String(row?.status || '⏳ Buyurtma kutilmoqda') };
  };

  const statusIndex = (status) => {
    const s = String(status || '').toLowerCase().replace(/[‘’]/g, "'");
    if (s.includes('bekor')) return -1;
    if (s.includes('yetkazildi')) return 4;
    if (s.includes('yo‘lda') || s.includes("yo'lda") || s.includes('yolda')) return 3;
    if (s.includes('tayyorlan')) return 2;
    if (s.includes('qabul qil')) return 1;
    return 0;
  };

  const orderNumberFromCard = (card) => {
    const text = String(card?.textContent || '');
    const m = text.match(/GULI-\d{4,}/i);
    return m ? m[0].toUpperCase() : '';
  };

  const patchCard = (card, order) => {
    if (!card || !order) return;
    const status = String(order.status || '⏳ Buyurtma kutilmoqda');
    card.dataset.guliServerStatus = status;

    card.querySelectorAll('.orderStatus').forEach((el) => {
      const time = el.querySelector('.recentStatusTime');
      el.textContent = `● ${status}`;
      if (time) el.appendChild(time);
      el.dataset.liveStatus = status;
    });

    const idx = statusIndex(status);
    card.querySelectorAll('.statusTimeline').forEach((timeline) => {
      [...timeline.children].filter((x) => x.nodeType === 1).forEach((node, i) => {
        node.classList.remove('done', 'current', 'future');
        node.classList.add(idx < 0 ? 'future' : i < idx ? 'done' : i === idx ? 'current' : 'future');
      });
    });

    const active = card.querySelector('[data-guli-live-production-stepper]');
    if (active) {
      const nodes = [...active.querySelectorAll('[data-step-index]')];
      nodes.forEach((node) => {
        const i = Number(node.getAttribute('data-step-index'));
        node.classList.remove('done', 'current', 'future');
        node.classList.add(idx < 0 ? 'future' : i < idx ? 'done' : i === idx ? 'current' : 'future');
      });
    }
  };

  const patchAllCards = (orders) => {
    const map = new Map(orders.map(normalize).filter((o) => o.id).map((o) => [o.id, o]));
    document.querySelectorAll('.ordersPageContainer .orderCard').forEach((card) => {
      const order = map.get(orderNumberFromCard(card));
      if (order) patchCard(card, order);
    });
  };

  const persist = (orders) => {
    try {
      localStorage.setItem('orders', JSON.stringify(orders));
      localStorage.setItem('guli_orders', JSON.stringify(orders));
      localStorage.setItem('guli_server_orders_snapshot_v6', JSON.stringify(orders));
    } catch {}
  };

  const pollOrders = async () => {
    if (polling) return;
    if (!telegramInitData() && !accessToken() && !phone()) return;
    polling = true;
    try {
      const response = await nativeFetch(ordersUrl(), { headers: headers(), cache: 'no-store' });
      if (!response.ok) return;
      const json = await response.json().catch(() => null);
      if (!json?.success || !Array.isArray(json.data)) return;
      const orders = json.data.map(normalize);
      persist(orders);
      patchAllCards(orders);
      window.dispatchEvent(new CustomEvent('guli_orders_server_sync', { detail: { orders } }));
    } catch {} finally {
      polling = false;
    }
  };

  const schedulePoll = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => { void pollOrders(); }, 150);
  };

  // Fix the specific realtime bug in the React subscription indirectly: the existing
  // callback compares DB UUIDs with frontend order_number values. This production
  // bridge does not rely on that comparison and always reads the canonical server state.
  const observer = new MutationObserver(schedulePoll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(pollOrders, 400);
  setInterval(pollOrders, 2000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pollOrders();
  });

  // Receipt upload can finish on the API even when the browser loses the response
  // (CORS/network interruption). Verify the order before surfacing a false error.
  window.fetch = async function(input, init) {
    const method = String(init?.method || input?.method || 'GET').toUpperCase();
    const rawUrl = String(typeof input === 'string' ? input : input?.url || '');
    const match = rawUrl.match(/\/api\/(?:auth\/)?orders\/([^/?#]+)\/(?:receipt|payment-receipt)(?:[/?#]|$)/i);
    if (method !== 'POST' || !match) return nativeFetch(input, init);

    try {
      const response = await nativeFetch(input, init);
      if (response.ok) return response;
      // The backend may have completed the upload before a late non-2xx response.
    } catch {
      // Verify below before exposing a network error to the UI.
    }

    try {
      const orderNumber = decodeURIComponent(match[1]);
      const verifyUrl = new URL(`${API}/api/orders`);
      verifyUrl.searchParams.set('order_numbers', orderNumber);
      verifyUrl.searchParams.set('_guli_receipt_verify', String(Date.now()));
      const verify = await nativeFetch(verifyUrl.toString(), { headers: headers(), cache: 'no-store' });
      const body = await verify.json().catch(() => null);
      const order = Array.isArray(body?.data) ? body.data.map(normalize).find((o) => o.order_number === orderNumber || o.id === orderNumber) : null;
      if (verify.ok && body?.success && order && (order.payment_receipt_path || order.receipt_url || order.payment_status === 'receipt_uploaded' || order.payment_status === 'verified')) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Chek muvaffaqiyatli saqlandi. Admin tez orada tekshiradi.',
          data: order,
          recovered: true,
        }), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      }
    } catch {}

    return new Response(JSON.stringify({ success: false, message: 'Chekni yuborishda xatolik yuz berdi.' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  };
})();
