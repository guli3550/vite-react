// Keep customer order retrieval protected at the HTTP boundary.
// The canonical order runtime handles valid Telegram/Supabase identities.
// This guard prevents an unauthenticated request from being turned into a
// successful empty response by a legacy route layer.
const { install } = require('./routeRegistry');

function hasCustomerAuth(req) {
  const initData = String(req.headers['x-telegram-init-data'] || '').trim();
  const authorization = String(req.headers.authorization || '').trim();
  return Boolean(initData || authorization);
}

function guard(req, res, next) {
  if (!hasCustomerAuth(req)) {
    return res.status(401).json({
      success: false,
      message: 'Mijoz autentifikatsiyasi talab qilinadi.'
    });
  }
  return next();
}

install('get', '/api/orders', guard);
