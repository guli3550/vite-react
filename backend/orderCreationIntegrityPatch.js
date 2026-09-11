// Customer checkout integrity: initial order state and creation time are server-owned.
// Loaded before index.js and registered ahead of the legacy checkout handlers.
const { install } = require('./routeRegistry.js');

const INITIAL_STATUS = '⏳ Buyurtma kutilmoqda';

function sanitizeCheckout(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    // Never allow a customer to create an order as delivered/cancelled/accepted.
    req.body.status = INITIAL_STATUS;
    // created_at is also authoritative server metadata; the RPC supplies now().
    delete req.body.created_at;
  }
  next();
}

install('post', '/api/orders', sanitizeCheckout);
install('post', '/api/guest/orders', sanitizeCheckout);
