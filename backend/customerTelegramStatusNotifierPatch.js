// Customer-facing Telegram notifications for admin web changes.
// Loaded before index.js: wraps Express PUT registration for the two admin order routes.
(() => {
  const crypto = require('crypto');
  const express = require('express');
  const { createClient } = require('@supabase/supabase-js');
  const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const URL_ = String(process.env.SUPABASE_URL || '').trim();
  const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  const db = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  if (globalThis.__GULI_CUSTOMER_STATUS_NOTIFIER__) return;
  globalThis.__GULI_CUSTOMER_STATUS_NOTIFIER__ = true;

  async function tg(body) {
    if (!BOT) return;
    const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.description || `Telegram ${r.status}`);
  }

  async function notify(order, kind) {
    const id = Number(order?.telegram_id || 0);
    if (!id || !BOT) return;
    const orderNo = String(order?.order_number || order?.id || '—');
    const status = String(order?.status || '').trim();
    const payment = String(order?.payment_status || '').toLowerCase();
    let text = '';
    if (kind === 'payment') {
      if (payment === 'verified') text = `✅ To‘lov tasdiqlandi!\n\nBuyurtma № ${orderNo}\nSumma: ${Math.round(Number(order?.total || 0)).toLocaleString('uz-UZ')} so‘m\n\nBuyurtma holati: ${status || 'Qabul qilindi'}`;
      else if (payment === 'rejected') text = `⚠️ To‘lov cheki rad etildi.\n\nBuyurtma № ${orderNo}\nIltimos, chekni qayta yuboring.`;
      else return;
    } else {
      if (!status || status === '⏳ Buyurtma kutilmoqda') return;
      text = `📦 Buyurtma holati yangilandi!\n\nBuyurtma № ${orderNo}\n\nHozirgi holat: ${status}`;
    }
    const version = `${order?.updated_at || order?.status_updated_at || Date.now()}`;
    const key = `customer-notify:${kind}:${order?.id}:${payment}:${status}:${version}`;
    if (db) {
      try {
        const { error } = await db.from('telegram_admin_bot_events').insert({ event_key: crypto.createHash('sha256').update(key).digest('hex'), event_type: `customer_${kind}_notice`, order_id: order.id || null });
        if (error && String(error.code) === '23505') return;
      } catch {}
    }
    await tg({ chat_id: id, text, disable_web_page_preview: true });
  }

  const originalPut = express.application.put;
  express.application.put = function patchedPut(path, ...handlers) {
    if (path === '/api/admin/orders/:id' || path === '/api/admin/orders/:id/payment') {
      const last = handlers.length - 1;
      const original = handlers[last];
      if (typeof original === 'function' && !original.__guliWrappedCustomerStatus) {
        const wrapped = async function(req, res, next) {
          let payload = null;
          const originalJson = res.json.bind(res);
          res.json = (body) => { payload = body; return originalJson(body); };
          const result = await original.call(this, req, res, next);
          if (payload?.success && payload?.data) {
            const kind = path.endsWith('/payment') ? 'payment' : 'status';
            notify(payload.data, kind).catch((e) => console.warn('[Customer Telegram notifier]', e.message));
          }
          return result;
        };
        wrapped.__guliWrappedCustomerStatus = true;
        handlers[last] = wrapped;
      }
    }
    return originalPut.call(this, path, ...handlers);
  };
})();
