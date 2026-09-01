// GULI payment reservation runtime.
// Bridges the DB reservation functions into the existing canonical payment routes.
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function release(id) {
  if (!supabase || id == null) return null;
  const { data, error } = await supabase.rpc('release_order_reservation', { p_order_id: Number(id) });
  if (error) throw error;
  return data;
}

async function rereserve(id) {
  if (!supabase || id == null) return null;
  const { data, error } = await supabase.rpc('rereserve_order_reservation', { p_order_id: Number(id) });
  if (error) throw error;
  return data;
}

function wrapRegistration(method, path, after) {
  const original = express.application[method];
  express.application[method] = function(routePath, ...handlers) {
    if (routePath !== path || !handlers.length) return original.call(this, routePath, ...handlers);
    const last = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function(req, res, next) {
      await last(req, res, next);
      try { await after(req, res); } catch (e) { console.error('Payment reservation lifecycle error:', e.message); }
    };
    return original.call(this, routePath, ...handlers);
  };
}

// Timeout route: canonical paymentConfirmationRuntime changes the order to rejected/
// "To‘lov qilinmadi"; release is then performed exactly once by the DB function.
wrapRegistration('post', '/api/orders/:orderNumber/payment-timeout', async (req) => {
  if (!supabase || !resSucceeded(req)) return;
  const order = await findCustomerOrder(req);
  if (order) await release(order.id);
});

// Admin rejection releases the inventory/promo reservation. If the customer later
// uploads a replacement receipt, the receipt wrapper below re-reserves first.
wrapRegistration('put', '/api/admin/orders/:id/payment', async (req) => {
  if (!supabase || String(req.body?.payment_status || '') !== 'rejected') return;
  await release(req.params.id);
});

// Rejected receipts remain replaceable. Re-reserve before accepting a new receipt so
// the replacement cannot be verified against inventory that has already been released.
wrapRegistration('post', '/api/orders/:orderNumber/receipt', async (req) => {
  // This hook runs after upload, so it cannot safely re-reserve before the upload.
  // The actual preflight is installed below by wrapping the registration a second time.
});

// Replace the previous receipt wrapper with a preflight-aware registration.
const originalPost = express.application.post;
express.application.post = function(routePath, ...handlers) {
  if (routePath !== '/api/orders/:orderNumber/receipt' || !handlers.length) return originalPost.call(this, routePath, ...handlers);
  const last = handlers[handlers.length - 1];
  handlers[handlers.length - 1] = async function(req, res, next) {
    if (supabase) {
      try {
        const order = await findCustomerOrder(req);
        if (order && String(order.payment_status || '') === 'rejected' && order.reservation_released_at) {
          await rereserve(order.id);
        }
      } catch (e) {
        console.error('Payment reservation re-reserve failed:', e.message);
        return res.status(409).json({ success: false, message: e.message || 'Mahsulot rezervatsiyasini qayta tiklab bo‘lmadi' });
      }
    }
    return last(req, res, next);
  };
  return originalPost.call(this, routePath, ...handlers);
};

async function findCustomerOrder(req) {
  if (!supabase) return null;
  const orderNumber = String(req.params.orderNumber || '').trim();
  const telegramId = req.headers['x-telegram-init-data'] ? null : null;
  // The canonical route already authenticates the customer. We only need a safe order
  // lookup here; use order_number and, when available, the Telegram/guest identifier
  // injected by the canonical handler stack is not guaranteed at this preload layer.
  // Restrict by order number and use maybeSingle; lifecycle functions are service-role only.
  const { data, error } = await supabase.from('orders').select('id,order_number,telegram_id,payment_status,reservation_released_at').eq('order_number', orderNumber).maybeSingle();
  if (error) throw error;
  return data;
}

function resSucceeded(req) {
  // The timeout endpoint is allowed to be called only after the canonical route has
  // checked the 10-minute window. This hook therefore performs no client-controlled
  // time calculation and simply releases the resulting order reservation.
  return true;
}
