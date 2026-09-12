(() => {
  'use strict';
  const API = '/api';
  const ACCESS = 'guli_access_token';
  const KEY = 'guli_payment_status_snapshot_v1';
  let running = false;

  const headers = () => {
    const h = { Accept: 'application/json' };
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData;
    else {
      const token = localStorage.getItem(ACCESS) || '';
      if (token) h.Authorization = `Bearer ${token}`;
    }
    return h;
  };
  const hasSession = () => Boolean(window.Telegram?.WebApp?.initData || localStorage.getItem(ACCESS));

  function toast(text) {
    let el = document.querySelector('[data-guli-payment-toast]');
    if (!el) {
      el = document.createElement('div');
      el.dataset.guliPaymentToast = '1';
      el.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:100002;background:#261e20;color:#fff;padding:14px 17px;border-radius:17px;font:700 13px/1.4 system-ui;max-width:calc(100vw - 28px);text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.28)';
      document.body.appendChild(el);
    }
    el.textContent = text;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.remove(), 4000);
  }

  function notifyTelegram(text) {
    try {
      const tg = window.Telegram?.WebApp;
      tg?.HapticFeedback?.notificationOccurred?.('success');
    } catch {}
  }

  async function sync() {
    if (running || !hasSession()) return;
    running = true;
    try {
      const r = await fetch(`${API}/customer/orders`, { headers: headers(), cache: 'no-store', credentials: 'same-origin' });
      if (!r.ok) return;
      const j = await r.json().catch(() => null);
      if (!j?.success || !Array.isArray(j.data)) return;

      const current = j.data
        .map(o => ({
          id: String(o.order_number || o.id || ''),
          status: String(o.status || ''),
          payment: String(o.payment || ''),
          payment_status: String(o.payment_status || 'pending'),
          updated_at: String(o.updated_at || ''),
        }))
        .filter(o => o.id);

      let previous = [];
      try { previous = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      if (!Array.isArray(previous)) previous = [];

      const oldMap = new Map(previous.map(o => [o.id, o]));
      for (const next of current) {
        const old = oldMap.get(next.id);
        if (!old || old.payment_status === next.payment_status) continue;
        if (next.payment_status === 'verified') {
          toast(`✅ To‘lov tasdiqlandi\n${next.id}\nBuyurtma: ${next.status || 'Qabul qilindi'}`);
          notifyTelegram(`To‘lov tasdiqlandi: ${next.id}`);
        } else if (next.payment_status === 'rejected') {
          toast(`⚠️ To‘lov cheki rad etildi\n${next.id}\nChekni qayta yuboring.`);
        } else if (next.payment_status === 'receipt_uploaded') {
          toast(`🧾 Chek qabul qilindi\n${next.id}\nAdmin tekshiruvi kutilmoqda.`);
        }
      }
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {} finally {
      running = false;
    }
  }

  setTimeout(sync, 1200);
  setInterval(sync, 5000);
})();
