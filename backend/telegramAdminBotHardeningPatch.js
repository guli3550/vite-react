// Hardening layer for the admin Telegram bot.
// Fixes Telegram multipart media references and durably suppresses repeated online-chat sends.
(() => {
  const crypto = require('crypto');
  const { createClient } = require('@supabase/supabase-js');
  const ADMIN_TOKEN = String(process.env.TELEGRAM_ADMIN_BOT_TOKEN || '').trim();
  const URL_ = String(process.env.SUPABASE_URL || '').trim();
  const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
  const db = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const nativeFetch = globalThis.fetch;
  if (!nativeFetch || globalThis.__GULI_ADMIN_BOT_HARDENING__) return;
  globalThis.__GULI_ADMIN_BOT_HARDENING__ = true;

  async function claimChatText(text) {
    const normalized = String(text || '').trim();
    if (!db || !/^💬 ONLINE CHAT/i.test(normalized)) return true;
    const key = `admin-online-chat:${crypto.createHash('sha256').update(normalized).digest('hex')}`;
    try {
      const { error } = await db.from('telegram_admin_bot_events').insert({ event_key: key, event_type: 'online_chat', order_id: null });
      if (!error) return true;
      if (String(error.code) === '23505') return false;
    } catch {}
    return true;
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

    // The final worker sends online-chat alerts as JSON, not multipart FormData.
    if (ADMIN_TOKEN && url.includes(`/bot${ADMIN_TOKEN}/sendMessage`) && init?.body) {
      try {
        const raw = typeof init.body === 'string' ? init.body : '';
        const payload = raw ? JSON.parse(raw) : null;
        if (payload?.text && /^💬 ONLINE CHAT/i.test(String(payload.text).trim())) {
          const allow = await claimChatText(payload.text);
          if (!allow) return new Response(JSON.stringify({ ok: true, result: { message_id: 0, __guli_duplicate: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
      } catch {}
    }
    return nativeFetch(input, init);
  };
})();
