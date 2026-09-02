// GULI payment reservation lifecycle.
// Attaches only to the live Express app instance; never mutates Express globally.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

async function release(orderId) {
  if (!supabase || orderId == null) return null;
  const { data, error } = await supabase.rpc('release_order_reservation', { p_order_id: String(orderId) });
  if (error) throw error;
  return data;
}

async function rereserve(orderId) {
  if (!supabase || orderId == null) return null;
  const { data, error } = await supabase.rpc('rereserve_order_reservation', { p_order_id: String(orderId) });
  if (error) throw error;
  return data;
}

function afterResponse(res, fn) {
  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    Promise.resolve().then(fn).catch((error) => {
      console.error('[Payment reservation lifecycle]', error.message);
    });
  };
  if (res.writableEnded) return run();
  res.once('finish', run);
  res.once('close', run);
}

function wrapRoute(app, method, path, handlerFactory) {
  const original = app[method];
  if (typeof original !== 'function') return;
  app[method] = function(routePath, ...handlers) {
    if (routePath !== path || handlers.length === 0) return original.call(this, routePath, ...handlers);
    const last = handlers[handlers.length - 1];
    handlers[handlers.length - 1] = handlerFactory(last);
    return original.call(this, routePath, ...handlers);
  };
}

async function findOrder(orderNumber) {
  if (!supabase) return null;
  const key = String(orderNumber || '').trim();
  if (!key) return null;
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,payment_status,reservation_released_at')
    .eq('order_number', key)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function attachPaymentReservationLifecycle(app) {
  if (!app || app.__guliPaymentReservationLifecycleAttached) return app;
  app.__guliPaymentReservationLifecycleAttached = true;

  wrapRoute(app, 'get', '/api/orders/:orderNumber/payment-state', (last) => async (req, res, next) => {
    await last(req, res, next);
    if (res.statusCode === 200) afterResponse(res, async () => {
      const order = await findOrder(req.params.orderNumber);
      if (order?.payment_status === 'rejected') await release(order.id);
    });
  });

  wrapRoute(app, 'post', '/api/orders/:orderNumber/payment-timeout', (last) => async (req, res, next) => {
    await last(req, res, next);
    if (res.statusCode === 200) afterResponse(res, async () => {
      const order = await findOrder(req.params.orderNumber);
      if (order?.payment_status === 'rejected') await release(order.id);
    });
  });

  wrapRoute(app, 'post', '/api/orders/:orderNumber/payment-confirm', (last) => async (req, res, next) => {
    await last(req, res, next);
    if (res.statusCode === 410) afterResponse(res, async () => {
      const order = await findOrder(req.params.orderNumber);
      if (order?.payment_status === 'rejected') await release(order.id);
    });
  });

  wrapRoute(app, 'put', '/api/admin/orders/:id/payment', (last) => async (req, res, next) => {
    await last(req, res, next);
    if (res.statusCode === 200 && String(req.body?.payment_status || '') === 'rejected') {
      afterResponse(res, () => release(req.params.id));
    }
  });

  const replacement = async (req, res, next) => {
    try {
      const order = await findOrder(req.params.orderNumber);
      if (order?.payment_status === 'rejected' && order.reservation_released_at) {
        await rereserve(order.id);
      }
      return next();
    } catch (error) {
      console.error('[Payment reservation preflight]', error.message);
      return res.status(409).json({ success: false, message: 'Mahsulot rezervatsiyasini qayta tiklab bo‘lmadi' });
    }
  };
  wrapRoute(app, 'post', '/api/orders/:orderNumber/receipt', (last) => async (req, res, next) => {
    await replacement(req, res, async () => last(req, res, next));
  });

  wrapRoute(app, 'post', '/api/admin/orders/:id/payment-receipt', (last) => async (req, res, next) => {
    try {
      const id = String(req.params.id || '').trim();
      if (id && supabase) {
        const { data: order, error } = await supabase
          .from('orders')
          .select('id,payment_status,reservation_released_at')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (order?.payment_status === 'rejected' && order.reservation_released_at) await rereserve(order.id);
      }
      return last(req, res, next);
    } catch (error) {
      console.error('[Payment reservation admin preflight]', error.message);
      return res.status(409).json({ success: false, message: 'Mahsulot rezervatsiyasini qayta tiklab bo‘lmadi' });
    }
  });

  return app;
}

module.exports = { attachPaymentReservationLifecycle };
