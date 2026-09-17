(() => {
  'use strict';
  if (window.__GULI_CUSTOMER_ORDERS_LIVE_V2__) return;
  window.__GULI_CUSTOMER_ORDERS_LIVE_V2__ = true;

  const API = String(window.__GULI_API_URL || 'https://guli-gateway.parizodabaxtiyorov.workers.dev').replace(/\/$/, '');
  const nativeFetch = window.fetch.bind(window);
  const statusSteps = [
    { label: 'Buyurtma kutilmoqda', icon: '📝' },
    { label: 'Qabul qilindi', icon: '✓' },
    { label: 'Tayyorlanmoqda', icon: '⚙' },
    { label: 'Yo‘lda', icon: '🚚' },
    { label: 'Yetkazildi', icon: '✓' },
  ];

  function token() {
    const direct = String(window.__GULI_SUPABASE_ACCESS_TOKEN || localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('guli_supabase_auth_token');
      const j = raw ? JSON.parse(raw) : null;
      const t = j?.access_token || j?.currentSession?.access_token || j?.session?.access_token || j?.data?.session?.access_token;
      if (t) return String(t).trim();
    } catch {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        if (!/supabase.*auth|auth.*supabase/i.test(k)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const j = JSON.parse(raw);
        const t = j?.access_token || j?.currentSession?.access_token || j?.session?.access_token || j?.data?.session?.access_token;
        if (t) return String(t).trim();
      }
    } catch {}
    return '';
  }

  function phone() {
    const values = [localStorage.getItem('guli_phone'), localStorage.getItem('guli_customer_phone'), localStorage.getItem('guli_last_order_phone')];
    try {
      const u = JSON.parse(localStorage.getItem('guli_auth_user') || 'null');
      values.push(u?.phone, u?.user_metadata?.phone);
    } catch {}
    for (const v of values) {
      const p = String(v || '').replace(/\D/g, '');
      if (p.length >= 7) return p;
    }
    return '';
  }

  function headers() {
    const h = { Accept: 'application/json' };
    const tg = String(window.Telegram?.WebApp?.initData || '').trim();
    if (tg) h['X-Telegram-Init-Data'] = tg;
    else {
      const t = token();
      if (t) h.Authorization = `Bearer ${t}`;
    }
    const p = phone();
    if (p) h['X-Customer-Phone'] = p;
    return h;
  }

  function canonicalUrl() {
    const u = new URL(`${API}/api/orders`);
    const p = phone();
    const tgId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim();
    if (p) u.searchParams.set('phone', p);
    if (tgId) u.searchParams.set('telegram_id', tgId);
    return u.toString();
  }

  function normalize(row) {
    const id = String(row?.order_number || row?.id || '').trim();
    return { ...row, id, order_number: id, status: String(row?.status || '⏳ Buyurtma kutilmoqda') };
  }

  function orderIdFrom(el) {
    const text = String(el?.textContent || '');
    const m = text.match(/GULI-\d{4,}/i);
    return m ? m[0].toUpperCase() : '';
  }

  function statusIndex(status) {
    const s = String(status || '').toLowerCase().replace(/[‘’]/g, "'");
    if (s.includes('bekor')) return -1;
    if (s.includes('yetkazildi')) return 4;
    if (s.includes('yo') && s.includes('lda')) return 3;
    if (s.includes('tayyorlan')) return 2;
    if (s.includes('qabul qil')) return 1;
    return 0;
  }

  function cardFor(el) {
    let n = el;
    for (let i = 0; i < 9 && n; i++, n = n.parentElement) {
      if (orderIdFrom(n)) return n;
    }
    return null;
  }

  function renderStepper(root, order) {
    const id = order.id;
    let box = root.querySelector('[data-guli-live-stepper-v2]');
    if (!box) {
      box = document.createElement('div');
      box.dataset.guliLiveStepperV2 = '1';
      const bottom = root.querySelector('.orderBottom');
      if (bottom?.parentNode) bottom.parentNode.insertBefore(box, bottom);
      else root.appendChild(box);
    }
    const idx = statusIndex(order.status);
    box.innerHTML = `<div class="guliOrderStepperV2" data-order-id="${id}">${statusSteps.map((s, i) => {
      const state = idx < 0 ? 'future' : i < idx ? 'done' : i === idx ? 'current' : 'future';
      const connector = i < 4 ? `<i class="guliOrderStepLineV2 ${!idx < 0 && i < idx ? 'done' : ''}"></i>` : '';
      return `<div class="guliOrderStepV2 ${state}"><span class="guliOrderStepIconV2">${state === 'done' ? '✓' : s.icon}</span><b>${s.label}</b></div>${connector}`;
    }).join('')}</div>${idx < 0 ? '<div class="guliOrderCancelledV2">✕ Buyurtma bekor qilindi</div>' : ''}`;
  }

  function patchStatus(root, order) {
    const status = String(order.status || '⏳ Buyurtma kutilmoqda');
    root.querySelectorAll('.orderStatus').forEach((el) => {
      const time = el.querySelector('.recentStatusTime');
      const keep = time ? time.outerHTML : '';
      el.textContent = `● ${status}`;
      if (keep) el.insertAdjacentHTML('beforeend', keep);
      el.className = 'orderStatus guli-live-status';
      el.dataset.liveStatus = status;
    });
    root.querySelectorAll('.statusTimeline').forEach((timeline) => {
      const idx = statusIndex(status);
      const nodes = [...timeline.children].filter((x) => x.nodeType === 1);
      nodes.forEach((node, i) => {
        node.classList.remove('done', 'current', 'future');
        node.classList.add(idx < 0 ? 'future' : i < idx ? 'done' : i === idx ? 'current' : 'future');
      });
    });
    root.dataset.guliLiveStatus = status;
    root.dataset.guliLiveOrder = order.id;
    renderStepper(root, order);
  }

  function render(orders) {
    const list = orders.map(normalize).filter(x => x.id);
    const map = new Map(list.map(x => [x.id, x]));
    const roots = new Set();
    document.querySelectorAll('.ordersPageContainer .orderMain, .ordersPageContainer .statusTimeline').forEach((el) => {
      const root = cardFor(el);
      if (root) roots.add(root);
    });
    roots.forEach((root) => {
      const id = orderIdFrom(root);
      const order = map.get(id);
      if (order) patchStatus(root, order);
    });
  }

  async function sync() {
    if (!window.Telegram?.WebApp?.initData && !token() && !phone()) return;
    try {
      const r = await nativeFetch(canonicalUrl(), { headers: headers(), cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (!j?.success || !Array.isArray(j.data)) return;
      const data = j.data.map(normalize);
      localStorage.setItem('orders', JSON.stringify(data));
      localStorage.setItem('guli_orders', JSON.stringify(data));
      render(data);
    } catch {}
  }

  setTimeout(sync, 600);
  setInterval(sync, 2500);
  const observer = new MutationObserver(() => setTimeout(sync, 100));
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();