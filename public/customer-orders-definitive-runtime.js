(() => {
  'use strict';
  if (window.__GULI_CUSTOMER_ORDERS_DEFINITIVE_RUNTIME__) return;
  window.__GULI_CUSTOMER_ORDERS_DEFINITIVE_RUNTIME__ = true;

  const API = String(window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  const nativeFetch = window.fetch.bind(window);
  const STATUS_STEPS = [
    { key: 'pending', label: 'Buyurtma kutilmoqda', icon: '📝' },
    { key: 'accepted', label: 'Qabul qilindi', icon: '✓' },
    { key: 'preparing', label: 'Tayyorlanmoqda', icon: '⚙️' },
    { key: 'onroad', label: 'Yo‘lda', icon: '🚚' },
    { key: 'delivered', label: 'Yetkazildi', icon: '✓' },
  ];

  const getToken = () => {
    const direct = String(localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('guli_supabase_auth_token');
      const parsed = raw ? JSON.parse(raw) : null;
      return String(parsed?.access_token || parsed?.currentSession?.access_token || parsed?.session?.access_token || parsed?.data?.session?.access_token || '').trim();
    } catch { return ''; }
  };

  const getPhone = () => {
    const candidates = [
      localStorage.getItem('guli_phone'),
      localStorage.getItem('guli_customer_phone'),
      localStorage.getItem('guli_last_order_phone'),
    ];
    try {
      const u = JSON.parse(localStorage.getItem('guli_auth_user') || 'null');
      candidates.push(u?.phone, u?.user_metadata?.phone);
    } catch {}
    for (const value of candidates) {
      const digits = String(value || '').replace(/\D/g, '');
      if (digits.length >= 7) return digits;
    }
    return '';
  };

  const getTelegramInitData = () => String(window.Telegram?.WebApp?.initData || '').trim();

  const makeHeaders = (base) => {
    const h = new Headers(base || {});
    h.set('Accept', 'application/json');
    const tg = getTelegramInitData();
    if (tg) {
      h.set('X-Telegram-Init-Data', tg);
      h.delete('Authorization');
    } else {
      const token = getToken();
      if (token) h.set('Authorization', `Bearer ${token}`);
    }
    const phone = getPhone();
    if (phone) h.set('X-Customer-Phone', phone);
    return h;
  };

  const isOrderRead = (input, init) => {
    const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET') return false;
    const url = String(typeof input === 'string' ? input : input?.url || '');
    return /\/api\/(customer\/orders|orders|auth\/orders)(?:[/?]|$)/i.test(url);
  };

  const buildCanonicalUrl = (input) => {
    const raw = String(typeof input === 'string' ? input : input?.url || '');
    const u = new URL(raw, window.location.origin);
    const params = new URLSearchParams(u.search);
    const phone = getPhone();
    const tgId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim();
    if (phone && !params.get('phone')) params.set('phone', phone);
    if (tgId && !params.get('telegram_id')) params.set('telegram_id', tgId);
    u.pathname = '/api/orders';
    u.search = params.toString();
    return u.toString();
  };

  const normalize = (row) => {
    const number = String(row?.order_number || row?.id || '').trim();
    return {
      ...row,
      id: number,
      order_number: number,
      status: String(row?.status || '⏳ Buyurtma kutilmoqda'),
      payment_status: String(row?.payment_status || 'pending'),
      createdAt: row?.createdAt || row?.created_at,
      updatedAt: row?.updatedAt || row?.updated_at,
      statusUpdatedAt: row?.statusUpdatedAt || row?.status_updated_at || row?.updated_at,
    };
  };

  const parseResponse = async (response) => {
    try {
      const body = await response.clone().json();
      if (!body || !Array.isArray(body.data)) return null;
      return { ...body, data: body.data.map(normalize).filter((x) => x.id) };
    } catch { return null; }
  };

  const persist = (data) => {
    try {
      localStorage.setItem('orders', JSON.stringify(data));
      localStorage.setItem('guli_orders', JSON.stringify(data));
      localStorage.setItem('guli_server_orders_snapshot_v5', JSON.stringify(data));
    } catch {}
  };

  const fetchCanonical = async (originalInput, init) => {
    const url = buildCanonicalUrl(originalInput);
    const options = { ...(init || {}), headers: makeHeaders(init?.headers), cache: 'no-store' };
    let response = await nativeFetch(url, options);
    let body = await parseResponse(response);

    // A valid browser account can briefly have no mirrored JWT while Supabase restores it.
    // Retry by the account phone, which the production orders endpoint already supports.
    const phone = getPhone();
    if ((!response.ok || !body?.data?.length) && phone) {
      const retryUrl = new URL(`${API}/api/orders`);
      retryUrl.searchParams.set('phone', phone);
      const tgId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '').trim();
      if (tgId) retryUrl.searchParams.set('telegram_id', tgId);
      const retryHeaders = new Headers(options.headers);
      retryHeaders.delete('Authorization');
      retryHeaders.delete('X-Telegram-Init-Data');
      retryHeaders.set('X-Customer-Phone', phone);
      retryHeaders.set('Accept', 'application/json');
      const retry = await nativeFetch(retryUrl.toString(), { ...options, headers: retryHeaders, cache: 'no-store' });
      const retryBody = await parseResponse(retry);
      if (retryBody && Array.isArray(retryBody.data) && (retryBody.data.length || !body)) {
        response = retry;
        body = retryBody;
      }
    }

    if (body?.success && Array.isArray(body.data)) {
      persist(body.data);
      try { window.dispatchEvent(new CustomEvent('guli_orders_server_sync', { detail: { orders: body.data } })); } catch {}
      return new Response(JSON.stringify(body), {
        status: response.status,
        statusText: response.statusText,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    return response;
  };

  window.fetch = function(input, init) {
    if (!isOrderRead(input, init)) return nativeFetch(input, init);
    return fetchCanonical(input, init);
  };

  const statusIndex = (status) => {
    const s = String(status || '').toLowerCase().replace(/['’]/g, "'");
    if (s.includes('bekor')) return -1;
    if (s.includes('yetkazildi')) return 4;
    if (s.includes('yo‘lda') || s.includes("yo'lda") || s.includes('yolda')) return 3;
    if (s.includes('tayyorlan')) return 2;
    if (s.includes('qabul qil')) return 1;
    return 0;
  };

  const orderNumberFrom = (root) => {
    const text = String(root?.textContent || '');
    return text.match(/(?:№|No\.?|#)\s*(GULI-\d{4,})/i)?.[1] || '';
  };

  const ensureStepper = (card, order) => {
    if (!card || !order) return;
    let wrap = card.querySelector('[data-guli-live-status-stepper]');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.dataset.guliLiveStatusStepper = '1';
      const bottom = card.querySelector('.orderBottom');
      if (bottom) bottom.parentNode.insertBefore(wrap, bottom);
      else card.appendChild(wrap);
    }
    const idx = statusIndex(order.status);
    const isCancelled = idx < 0;
    wrap.innerHTML = `<div class="guliLiveStepper ${isCancelled ? 'isCancelled' : ''}" role="list" aria-label="Buyurtma holati">${STATUS_STEPS.map((step, i) => {
      const state = isCancelled ? 'future' : i < idx ? 'done' : i === idx ? 'current' : 'future';
      return `<div class="guliLiveStep ${state}" role="listitem"><div class="guliLiveStepNode"><span>${state === 'done' ? '✓' : step.icon}</span></div><div class="guliLiveStepLabel">${step.label}</div></div>${i < STATUS_STEPS.length - 1 ? `<div class="guliLiveConnector ${!isCancelled && i < idx ? 'done' : ''}"></div>` : ''}`;
    }).join('')}</div>${isCancelled ? '<div class="guliLiveCancelled">✕ Buyurtma bekor qilindi</div>' : ''}`;
  };

  const patchCardStatus = (card, order) => {
    if (!card || !order) return;
    const status = String(order.status || '⏳ Buyurtma kutilmoqda');
    const statusEl = card.querySelector('.orderBottom .orderStatus');
    if (statusEl) {
      const time = statusEl.querySelector('.recentStatusTime');
      statusEl.childNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && String(node.textContent || '').trim()) node.textContent = ` ${status} `;
      });
      if (!time && statusEl.lastChild?.nodeType === Node.TEXT_NODE) statusEl.lastChild.textContent = ` ${status}`;
    }
    ensureStepper(card, order);
    card.dataset.guliLiveOrderStatus = status;
  };

  let lastSignature = '';
  const renderLiveStatus = (orders) => {
    if (!Array.isArray(orders) || !orders.length) return;
    const map = new Map(orders.map(normalize).map((o) => [o.id, o]));
    document.querySelectorAll('.ordersPageContainer .orderCard').forEach((card) => {
      const number = orderNumberFrom(card);
      const order = map.get(number);
      if (order) patchCardStatus(card, order);
    });
    const signature = orders.map((o) => `${o.id}:${o.status}:${o.payment_status}`).join('|');
    if (signature !== lastSignature) {
      lastSignature = signature;
      try { window.dispatchEvent(new CustomEvent('guli_order_status_rendered', { detail: { orders } })); } catch {}
    }
  };

  let timer = 0;
  let running = false;
  const poll = async () => {
    if (running) return;
    if (!window.Telegram?.WebApp?.initData && !getToken() && !getPhone()) return;
    running = true;
    try {
      const response = await nativeFetch(buildCanonicalUrl('/api/orders'), { headers: makeHeaders(), cache: 'no-store' });
      const body = await parseResponse(response);
      if (body?.success && Array.isArray(body.data)) {
        persist(body.data);
        renderLiveStatus(body.data);
      }
    } catch {} finally { running = false; }
  };

  const observer = new MutationObserver(() => {
    if (timer) return;
    timer = window.setTimeout(() => { timer = 0; void poll(); }, 250);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(poll, 800);
  setInterval(poll, 3000);
})();