(() => {
  'use strict';

  // Browser/Telegram customer order synchronization bridge.
  // The React app historically kept orders only in localStorage, while browser checkout
  // creates the order on the server. This bridge hydrates the local cache from the
  // authenticated server session and refreshes the app when a server-side status changes.
  const API = '/api';
  const TOKEN_KEY = 'guli_guest_token';
  const SNAPSHOT_KEY = 'guli_server_orders_snapshot_v1';
  const FINGERPRINT_KEY = 'guli_server_orders_fingerprint_v1';
  const LAST_NOTIFICATION_KEY = 'guli_last_order_status_notification_v1';
  let running = false;

  const headers = () => {
    const h = { Accept: 'application/json' };
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData;
    else {
      const token = localStorage.getItem(TOKEN_KEY) || '';
      if (token) h['X-Guli-Guest-Token'] = token;
    }
    return h;
  };

  const hasSession = () => Boolean(
    window.Telegram?.WebApp?.initData || localStorage.getItem(TOKEN_KEY)
  );

  const normalize = (row) => ({
    id: String(row.order_number || row.id || ''),
    order_number: row.order_number || undefined,
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    customer_name: row.customer_name || undefined,
    phone: row.phone || '',
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal || 0),
    delivery: Number(row.delivery || 0),
    discount: Number(row.discount || 0),
    total: Number(row.total || 0),
    address: row.address || undefined,
    payment: row.payment || '',
    payment_status: row.payment_status || 'pending',
    payment_receipt_path: row.payment_receipt_path || undefined,
    status: row.status || '⏳ Buyurtma kutilmoqda',
    createdAt: row.createdAt || row.created_at || new Date().toISOString(),
    updatedAt: row.updatedAt || row.updated_at || undefined,
    statusUpdatedAt: row.statusUpdatedAt || row.status_updated_at || row.updated_at || undefined,
  });

  const fingerprint = (orders) => orders.map((o) => [
    o.id,
    o.status,
    o.payment_status,
    o.updatedAt,
    o.statusUpdatedAt,
  ].join('|')).join('||');

  const toast = (text) => {
    let el = document.querySelector('[data-guli-order-sync-toast]');
    if (!el) {
      el = document.createElement('div');
      el.dataset.guliOrderSyncToast = '1';
      el.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:100001;background:#261e20;color:#fff;padding:13px 16px;border-radius:16px;font:700 13px/1.35 system-ui;max-width:calc(100vw - 30px);text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.25)';
      document.body.appendChild(el);
    }
    el.textContent = text;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.remove(), 2600);
  };

  const notifyStatusChange = (previous, current) => {
    const oldById = new Map((previous || []).map((o) => [o.id, o]));
    const changed = (current || []).find((o) => {
      const old = oldById.get(o.id);
      return old && old.status !== o.status;
    });
    if (!changed) return false;
    const old = oldById.get(changed.id);
    const message = `📦 ${changed.id}: buyurtma holati o‘zgardi — ${changed.status}`;
    try {
      localStorage.setItem(LAST_NOTIFICATION_KEY, JSON.stringify({
        id: changed.id,
        from: old?.status || '',
        to: changed.status,
        at: new Date().toISOString(),
      }));
    } catch {}
    toast(message);
    try {
      if (document.visibilityState === 'visible' && navigator.vibrate) navigator.vibrate(80);
    } catch {}
    return true;
  };

  async function sync() {
    if (running || !hasSession()) return;
    running = true;
    try {
      const response = await fetch(`${API}/orders`, {
        method: 'GET',
        headers: headers(),
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!response.ok) return;
      const json = await response.json().catch(() => null);
      if (!json?.success || !Array.isArray(json.data)) return;

      const current = json.data.map(normalize).filter((o) => o.id);
      const currentFp = fingerprint(current);
      const previousFp = localStorage.getItem(FINGERPRINT_KEY) || '';
      let previous = [];
      try {
        previous = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || '[]');
        if (!Array.isArray(previous)) previous = [];
      } catch { previous = []; }

      // Always hydrate the cache. This fixes browser checkout orders disappearing
      // after reload because checkout is intentionally persisted server-side.
      localStorage.setItem('orders', JSON.stringify(current));
      localStorage.setItem('guli_orders', JSON.stringify(current));
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(current));

      if (currentFp !== previousFp) {
        const statusChanged = previousFp ? notifyStatusChange(previous, current) : false;
        localStorage.setItem(FINGERPRINT_KEY, currentFp);

        // React state is initialized from localStorage and does not observe same-tab
        // storage writes. A single reload is therefore the safe compatibility bridge.
        // The fingerprint prevents reload loops.
        if (statusChanged || previousFp !== '') {
          setTimeout(() => location.reload(), statusChanged ? 900 : 250);
        } else {
          // First hydration: reload once so Buyurtmalarim and notification feed receive it.
          setTimeout(() => location.reload(), 250);
        }
      }
    } catch {
      // Offline/network errors are non-fatal; next poll retries.
    } finally {
      running = false;
    }
  }

  setTimeout(sync, 400);
  setInterval(sync, 5000);
})();
