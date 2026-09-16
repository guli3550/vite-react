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

  // Visibility change synchronization (refetches fresh data on return)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pollOrders();
  });

  // Listen to custom update events
  window.addEventListener('guli_order_receipt_updated', () => {
    setTimeout(pollOrders, 300);
  });
})();
