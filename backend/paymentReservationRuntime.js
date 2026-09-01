// GULI payment reservation runtime.
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || '';
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

async function release(id) {
  if (!supabase || id == null) return null;
  const { data, error } = await supabase.rpc('release_order_reservation', { p_order_id: String(id) });
  if (error) throw error;
  return data;
}
async function rereserve(id) {
  if (!supabase || id == null) return null;
  const { data, error } = await supabase.rpc('rereserve_order_reservation', { p_order_id: String(id) });
  if (error) throw error;
  return data;
}

function runAfterResponse(res, after) {
  let settled = false;
  const once = () => {
    if (settled) return;
    settled = true;
    Promise.resolve().then(after).catch((e) => console.error('Payment reservation lifecycle error:', e.message));
  };
  if (res.writableEnded) return once();
  res.once('finish', once);
  res.once('close', once);
}

function wrapAfter(method, path, after, allowedStatuses = null) {
  const original = express.application[method];
  express.application[method] = function(routePath, ...handlers) {
    if (routePath !== path || !handlers.length) return original.call(this, routePath, ...handlers);
    const last = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = async function(req, res, next) {
      await last(req, res, next);
      if (!allowedStatuses || allowedStatuses.includes(res.statusCode)) runAfterResponse(res, () => after(req, res));
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
        if (await before(req, res) === false) return;
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
  const { data, error } = await supabase.from('orders').select('id,order_number,payment_status,reservation_released_at').eq('order_number', String(orderNumber || '').trim()).maybeSingle();
  if (error) throw error;
  return data;
}
async function releaseByNumber(req) {
  const order = await findOrderByNumber(req.params.orderNumber);
  if (order && String(order.payment_status || '') === 'rejected') await release(order.id);
}

wrapAfter('get', '/api/orders/:orderNumber/payment-state', releaseByNumber, [200]);
wrapAfter('post', '/api/orders/:orderNumber/payment-timeout', releaseByNumber, [200]);
wrapAfter('post', '/api/orders/:orderNumber/payment-confirm', releaseByNumber, [410]);
wrapAfter('put', '/api/admin/orders/:id/payment', async (req) => {
  if (String(req.body?.payment_status || '') === 'rejected') await release(req.params.id);
}, [200, 201, 204]);

wrapBefore('post', '/api/orders/:orderNumber/receipt', async (req) => {
  const order = await findOrderByNumber(req.params.orderNumber);
  if (order && String(order.payment_status || '') === 'rejected' && order.reservation_released_at) await rereserve(order.id);
  return true;
});
wrapBefore('post', '/api/admin/orders/:id/payment-receipt', async (req) => {
  const id = String(req.params.id || '').trim();
  if (!id || !supabase) return true;
  const { data: order, error } = await supabase.from('orders').select('id,payment_status,reservation_released_at').eq('id', id).maybeSingle();
  if (error) throw error;
  if (order && String(order.payment_status || '') === 'rejected' && order.reservation_released_at) await rereserve(order.id);
  return true;
});
