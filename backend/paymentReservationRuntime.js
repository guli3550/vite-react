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

function wrapAfter(method, path, after, allowedStatuses = null) {
  const original = express.application[method];
  express.application[method] = function(routePath, ...handlers) {
    if (routePath !== path || !handlers.length) return original.call(this, routePath, ...handlers);
    const last = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function(req, res, next) {
      await last(req, res, next);
      const statusAllowed = !allowedStatuses || allowedStatuses.includes(res.statusCode);
      if (statusAllowed) {
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

async function releaseByNumber(req) {
  const order = await findOrderByNumber(req.params.orderNumber);
  if (order && String(order.payment_status || '') === 'rejected') await release(order.id);
}

// Payment-state polling can itself expire the order, so it must release too.
wrapAfter('get', '/api/orders/:orderNumber/payment-state', releaseByNumber, [200]);

// Customer timeout route: canonical handler authenticates and checks the 10-minute window.
wrapAfter('post', '/api/orders/:orderNumber/payment-timeout', releaseByNumber, [200]);

// Payment-confirm returns 410 after expireIfNeeded() changes the order to rejected.
wrapAfter('post', '/api/orders/:orderNumber/payment-confirm', releaseByNumber, [410]);

// Admin rejection: release only after the canonical admin route successfully returns 2xx.
wrapAfter('put', '/api/admin/orders/:id/payment', async (req) => {
  if (String(req.body?.payment_status || '') !== 'rejected') return;
  await release(req.params.id);
}, [200, 201, 204]);

// A rejected receipt can be replaced. Re-reserve BEFORE upload so later verification
// cannot succeed against inventory that has already been released.
wrapBefore('post', '/api/orders/:orderNumber/receipt', async (req) => {
  const order = await findOrderByNumber(req.params.orderNumber);
  if (!order) return true;
  if (String(order.payment_status || '') === 'rejected' && order.reservation_released_at) {
    await rereserve(order.id);
  }
  return true;
});
