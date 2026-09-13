// Keep customer order retrieval protected at the HTTP boundary.
// The canonical order runtime handles valid Telegram/Supabase identities.
// This guard prevents legacy route layers from returning an empty/filtered
// response to unauthenticated callers and prevents order-number enumeration.
const { install } = require('./routeRegistry');

function hasCustomerAuth(req) {
  const initData = String(req.headers['x-telegram-init-data'] || '').trim();
  const authorization = String(req.headers.authorization || '').trim();
  return Boolean(initData || /^Bearer\s+\S+$/i.test(authorization));
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
install('get', '/api/guest/orders', guard);
