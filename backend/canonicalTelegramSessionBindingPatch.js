// Final Telegram auth-session binding boundary.
// Atomically binds auth_sessions.telegram_id on /start auth_<session>.
// A session can never be rebound to a different Telegram account.
const { createClient } = require('@supabase/supabase-js');
const { registry } = require('./routeRegistry.js');

const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const supabase = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

if (supabase) {
  for (const route of registry.routes) {
    if (route.method !== 'post' || route.path !== '/api/telegram/webhook' || route.__canonicalBindingWrapped) continue;
    const originalHandlers = route.handlers.slice();
    route.handlers = [async function canonicalTelegramSessionBinding(req, res, next) {
      const message = req.body?.message;
      const chatId = Number(message?.chat?.id || 0);
      const fromId = Number(message?.from?.id || chatId || 0);
      const text = String(message?.text || '').trim();
      const match = text.match(/^\/start(?:@\w+)?\s+auth_([0-9a-f-]{36})$/i);
      if (chatId && fromId && match) {
        const sessionId = match[1];
        const now = new Date().toISOString();
        const { data: bound, error } = await supabase
          .from('auth_sessions')
          .update({ telegram_id: fromId })
          .eq('session_id', sessionId)
          .eq('is_verified', false)
          .eq('otp_used', false)
          .eq('exchange_ticket_used', false)
          .gt('expires_at', now)
          .or(`telegram_id.is.null,telegram_id.eq.${fromId}`)
          .select('session_id,telegram_id')
          .maybeSingle();
        if (error || !bound || Number(bound.telegram_id) !== fromId) {
          return res.status(409).json({ success: false, message: 'Bu autentifikatsiya sessiyasi boshqa Telegram account bilan bog‘langan yoki yaroqsiz.' });
        }
      }
      for (const handler of originalHandlers) {
        let finished = false;
        await new Promise((resolve, reject) => {
          const localNext = (err) => { if (err) reject(err); else { finished = true; resolve(); } };
          try {
            const result = handler(req, res, localNext);
            if (result && typeof result.then === 'function') result.then(() => { if (!finished && res.headersSent) resolve(); }).catch(reject);
            else if (res.headersSent) resolve();
          } catch (err) { reject(err); }
        });
        if (res.headersSent) return;
      }
      return next();
    }];
    route.__canonicalBindingWrapped = true;
  }
  console.log('[CanonicalTelegramSessionBinding] auth session Telegram binding is single-owner');
}
