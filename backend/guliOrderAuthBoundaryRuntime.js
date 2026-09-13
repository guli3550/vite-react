// Hard HTTP boundary for customer order retrieval.
// This runs before Express route registration and therefore cannot be bypassed
// by older /api/orders handlers that return an empty 200 response.
const express = require('express');

if (!globalThis.__GULI_ORDER_AUTH_BOUNDARY__) {
  globalThis.__GULI_ORDER_AUTH_BOUNDARY__ = true;
  const originalHandle = express.application.handle;

  express.application.handle = function guliOrderAuthBoundary(req, res, next) {
    const path = String(req.url || '').split('?')[0].replace(/\/$/, '') || '/';
    const protectedOrderPath = path === '/api/orders' || path === '/api/guest/orders';

    if (protectedOrderPath) {
      const initData = String(req.headers?.['x-telegram-init-data'] || '').trim();
      const authorization = String(req.headers?.authorization || '').trim();
      const guestToken = String(req.headers?.['x-guli-guest-token'] || '').trim();

      if (!initData && !/^Bearer\s+\S+$/i.test(authorization) && !guestToken) {
        res.statusCode = 401;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        return res.end(JSON.stringify({
          success: false,
          message: 'Mijoz autentifikatsiyasi talab qilinadi.'
        }));
      }
    }

    return originalHandle.call(this, req, res, next);
  };
}
