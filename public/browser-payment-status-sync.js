(() => {
  'use strict';
  const API = '/api';
  const ACCESS = 'guli_access_token';
  const KEY = 'guli_payment_status_snapshot_v1';
  let running = false;

  const token = () => {
    const direct = localStorage.getItem(ACCESS) || '';
    if (direct) return direct;
    try {
      const raw = localStorage.getItem('guli_supabase_auth_token');
      const j = raw ? JSON.parse(raw) : null;
      return j?.access_token || j?.currentSession?.access_token || '';
    } catch { return ''; }
  };
  const headers = () => {
    const h = { Accept: 'application/json' };
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) h['X-Telegram-Init-Data'] = tg.initData;
    else { const t = token(); if (t) h.Authorization = `Bearer ${t}`; }
    return h;
  };
  const hasSession = () => Boolean(window.Telegram?.WebApp?.initData || token());

  function toast(text) {
    let el = document.querySelector('[data-guli-payment-toast]');
    if (!el) {
      el = document.createElement('div'); el.dataset.guliPaymentToast = '1';
      el.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:100002;background:#261e20;color:#fff;padding:14px 17px;border-radius:17px;font:700 13px/1.4 system-ui;max-width:calc(100vw - 28px);text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.28)';
      document.body.appendChild(el);
    }
    el.textContent = text; clearTimeout(el._timer); el._timer = setTimeout(() => el.remove(), 4000);
  }

  function pushWebNotification(order, kind) {
    try {
      const raw = localStorage.getItem('guli_chat_messages');
      const list = raw ? JSON.parse(raw) : [];
      const messages = Array.isArray(list) ? list : [];
      const number = String(order.order_number || order.id || '—');
      const text = kind === 'verified'
        ? `✅ To‘lov tasdiqlandi!\n\nBuyurtma № ${number}\nSumma: ${Number(order.total || 0).toLocaleString('uz-UZ')} so‘m\n\nBuyurtma holati: ${order.status || 'Qabul qilindi'}`
        : kind === 'rejected'
          ? `⚠️ To‘lov cheki rad etildi.\n\nBuyurtma № ${number}\nIltimos, to‘lov chekini qayta yuboring.`
          : `🧾 Chek qabul qilindi.\n\nBuyurtma № ${number}\nAdmin tekshiruvi kutilmoqda.`;
      const key = `payment-${number}-${kind}-${order.updated_at || order.status}`;
      if (!messages.some(m => String(m.id) === key)) {
        messages.push({ id: key, sender: 'admin', text, timestamp: new Date().toISOString(), read: false, userId: order.auth_user_id || undefined, type: 'text' });
        localStorage.setItem('guli_chat_messages', JSON.stringify(messages));
        window.dispatchEvent(new CustomEvent('guli_chat_updated', { detail: messages }));
        localStorage.setItem('guli_unread_notifications_count', String(messages.filter(m => m.sender === 'admin' && !m.read && m.id !== 'welcome-msg-1').length));
        window.dispatchEvent(new CustomEvent('guli_notifications_updated', { detail: Number(localStorage.getItem('guli_unread_notifications_count') || 0) }));
      }
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
      const current = j.data.map(o => ({ ...o, id: String(o.id || ''), order_number: String(o.order_number || o.id || '') })).filter(o => o.order_number);
      let previous = [];
      try { previous = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
      if (!Array.isArray(previous)) previous = [];
      const oldMap = new Map(previous.map(o => [String(o.order_number || o.id), o]));
      for (const next of current) {
        const key = String(next.order_number);
        const old = oldMap.get(key);
        if (!old || old.payment_status === next.payment_status) continue;
        if (next.payment_status === 'verified') { toast(`✅ To‘lov tasdiqlandi\n${key}\nBuyurtma: ${next.status || 'Qabul qilindi'}`); pushWebNotification(next, 'verified'); }
        else if (next.payment_status === 'rejected') { toast(`⚠️ To‘lov cheki rad etildi\n${key}\nChekni qayta yuboring.`); pushWebNotification(next, 'rejected'); }
        else if (next.payment_status === 'receipt_uploaded') { toast(`🧾 Chek qabul qilindi\n${key}\nAdmin tekshiruvi kutilmoqda.`); pushWebNotification(next, 'receipt_uploaded'); }
      }
      localStorage.setItem(KEY, JSON.stringify(current));
    } catch {} finally { running = false; }
  }

  setTimeout(sync, 1200); setInterval(sync, 5000);
})();
