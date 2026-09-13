// Hardening layer for the admin Telegram bot.
// Fixes Telegram multipart media references and durably suppresses repeated notifications.
(() => {
  const crypto = require('crypto');
  const { createClient } = require('@supabase/supabase-js');
  const ADMIN_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || '').trim();
  const CUSTOMER_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const URL_ = String(process.env.SUPABASE_URL || '').trim();
  const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  const db = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const nativeFetch = globalThis.fetch;
  if (!nativeFetch || globalThis.__GULI_ADMIN_BOT_HARDENING__) return;
  globalThis.__GULI_ADMIN_BOT_HARDENING__ = true;

  async function claim(key, type, orderId = null) {
    if (!db) return true;
    try {
      const { error } = await db.from('telegram_admin_bot_events').insert({ event_key: key, event_type: type, order_id: orderId || null });
      if (!error) return true;
      if (String(error.code) === '23505') return false;
    } catch {}
    return true;
  }

  async function claimChatText(chatId, text) {
    const normalized = String(text || '').trim();
    if (!/^💬 ONLINE CHAT/i.test(normalized)) return true;
    const minute = Math.floor(Date.now() / 60000);
    const hash = crypto.createHash('sha256').update(`${chatId}|${minute}|${normalized}`).digest('hex');
    return claim(`admin-online-chat:${hash}`, 'online_chat');
  }

  globalThis.fetch = async (input, init) => {
    const url = String(typeof input === 'string' ? input : input?.url || '');
    if (!url.includes('api.telegram.org')) return nativeFetch(input, init);

    // The final worker used attach://order.jpg while the multipart FIELD is "photo".
    if (ADMIN_TOKEN && url.includes(`/bot${ADMIN_TOKEN}/editMessageMedia`) && init?.body && typeof init.body.get === 'function') {
      try {
        const original = init.body;
        const mediaRaw = String(original.get('media') || '');
        if (mediaRaw.includes('attach://order.jpg')) {
          const media = JSON.parse(mediaRaw);
          media.media = 'attach://photo';
          const form = new FormData();
          for (const [k, v] of original.entries()) form.append(k, k === 'media' ? JSON.stringify(media) : v);
          init = { ...(init || {}), body: form };
          if (init.headers) { const h = new Headers(init.headers); h.delete('content-type'); init.headers = h; }
        }
      } catch {}
    }

    // Admin bot online-chat alerts are JSON sendMessage calls.
    if (ADMIN_TOKEN && url.includes(`/bot${ADMIN_TOKEN}/sendMessage`) && init?.body) {
      try {
        const raw = typeof init.body === 'string' ? init.body : '';
        const payload = raw ? JSON.parse(raw) : null;
        if (payload?.text && /^💬 ONLINE CHAT/i.test(String(payload.text).trim())) {
          if (!await claimChatText(payload.chat_id, payload.text)) {
            return new Response(JSON.stringify({ ok: true, result: { message_id: 0, __guli_duplicate: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
        }
      } catch {}
    }

    // Customer payment notifications must be delivered once per order/decision.
    if (CUSTOMER_TOKEN && url.includes(`/bot${CUSTOMER_TOKEN}/sendMessage`) && init?.body) {
      try {
        const raw = typeof init.body === 'string' ? init.body : '';
        const payload = raw ? JSON.parse(raw) : null;
        const text = String(payload?.text || '');
        if (/^(?:✅ To‘lov tasdiqlandi!|⚠️ To‘lov cheki rad etildi\.)/i.test(text.trim())) {
          const number = text.match(/Buyurtma №\s*([^\n]+)/i)?.[1]?.trim() || '';
          const decision = /^✅/.test(text.trim()) ? 'verified' : 'rejected';
          const key = `customer-payment-send:${payload?.chat_id}:${number}:${decision}`;
          if (!await claim(crypto.createHash('sha256').update(key).digest('hex'), 'customer_payment_notice')) {
            return new Response(JSON.stringify({ ok: true, result: { message_id: 0, __guli_duplicate: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
          }
        }
      } catch {}
    }
    return nativeFetch(input, init);
  };
})();
