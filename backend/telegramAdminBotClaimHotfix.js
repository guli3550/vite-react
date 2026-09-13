// Hotfix for the durable admin-bot event ledger.
// telegramAdminBotFinalPatch intentionally treats a unique-violation as a normal result
// for message locks, but its generic claim() also handles online-chat/payment notices.
// For those notice event types, convert a duplicate 23505 into a non-23505 error so
// claim() returns false and the same notification is never sent again.
const supabaseJs = require('@supabase/supabase-js');
const originalCreateClient = supabaseJs.createClient;

if (!globalThis.__GULI_ADMIN_EVENT_CLAIM_HOTFIX__) {
  globalThis.__GULI_ADMIN_EVENT_CLAIM_HOTFIX__ = true;
  supabaseJs.createClient = function (...args) {
    const client = originalCreateClient(...args);
    return new Proxy(client, {
      get(target, prop, receiver) {
        if (prop !== 'from') return Reflect.get(target, prop, receiver);
        return function (table) {
          const builder = target.from(table);
          if (table !== 'telegram_admin_bot_events') return builder;
          return new Proxy(builder, {
            get(q, method, qReceiver) {
              if (method !== 'insert') return Reflect.get(q, method, qReceiver);
              return async function (...insertArgs) {
                const result = await q.insert(...insertArgs);
                const payload = insertArgs[0];
                const type = Array.isArray(payload) ? payload[0]?.event_type : payload?.event_type;
                if (type === 'online_chat' || type === 'customer_payment_notice') {
                  if (result?.error && String(result.error.code) === '23505') {
                    return {
                      ...result,
                      error: { ...result.error, code: 'GULI_DUPLICATE_NOTICE' }
                    };
                  }
                }
                return result;
              };
            }
          });
        };
      }
    });
  };
  console.log('[GULI Admin bot] duplicate notice claim hotfix enabled.');
}
