// GULI payment reservation runtime.
// Loaded BEFORE manualCardPaymentRuntime/paymentConfirmationRuntime so it can
// wrap the canonical route registrations without replacing route implementations.
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

function wrapAfter(method, path, after) {
  const original = express.application[method];
  express.application[method] = function(routePath, ...handlers) {
    if (routePath !== path || !handlers.length) return original.call(this, routePath, ...handlers);
    const last = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function(req, res, next) {
      await last(req, res, next);
      if (res.headersSent && res.statusCode >= 200 && res.statusCode < 300) {
        try { await after(req, res); }
        catch (e) { console.error('Payment reservation lifecycle error:', e.message); }
      }
    };
    return original.call(this, routePath, ...handlers);
  };
}

function wrapBefore(method, path, before) {
  const original = express.application[method];
  express.application[method] = function(routePath, ...handlers) {
    if (routePath !== path || !handlers.length) return original.call(this, routePath, ...handlers);
    const last = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function(req, res, next) {
      try {
        const allowed = await before(req, res);
        if (allowed === false) return;
      } catch (e) {
        console.error('Payment reservation preflight error:', e.message);
        return res.status(409).json({ success: false, message: e.message || 'Mahsulot rezervatsiyasini qayta tiklab bo‘lmadi' });
      }
      return last(req, res, next);
    };
    return original.call(this, routePath, ...handlers);
  };
}

async function findOrderByNumber(orderNumber) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,payment_status,reservation_released_at')
    .eq('order_number', String(orderNumber || '').trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Customer timeout: paymentConfirmationRuntime must first authenticate the customer
// and confirm the 10-minute window. We only release after that route returns 2xx.
wrapAfter('post', '/api/orders/:orderNumber/payment-timeout', async (req) => {
  const order = await findOrderByNumber(req.params.orderNumber);
  if (order) await release(order.id);
});

// Admin rejection: release only after the canonical admin route successfully changes
// payment_status to rejected. Verified payments never enter this hook.
wrapAfter('put', '/api/admin/orders/:id/payment', async (req) => {
  if (String(req.body?.payment_status || '') !== 'rejected') return;
  await release(req.params.id);
});

// A rejected receipt can be replaced. Re-reserve BEFORE upload so a later verification
// cannot succeed against inventory that was already released.
wrapBefore('post', '/api/orders/:orderNumber/receipt', async (req) => {
  const order = await findOrderByNumber(req.params.orderNumber);
  if (!order) return true;
  if (String(order.payment_status || '') === 'rejected' && order.reservation_released_at) {
    await rereserve(order.id);
  }
  return true;
});
