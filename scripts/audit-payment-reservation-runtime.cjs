const fs = require('fs');
const runtime = fs.readFileSync('backend/paymentReservationRuntime.js', 'utf8');
const required = [
  'function runAfterResponse(res, after)',
  "res.once('finish', once)",
  "res.once('close', once)",
  'res.writableEnded',
  'wrapAfter(\'get\', \'/api/orders/:orderNumber/payment-state\'',
  'wrapAfter(\'post\', \'/api/orders/:orderNumber/payment-timeout\'',
  'wrapAfter(\'post\', \'/api/orders/:orderNumber/payment-confirm\'',
  'wrapAfter(\'put\', \'/api/admin/orders/:id/payment\'',
  'wrapBefore(\'post\', \'/api/orders/:orderNumber/receipt\'',
  'wrapBefore(\'post\', \'/api/admin/orders/:id/payment-receipt\'',
];
for (const marker of required) if (!runtime.includes(marker)) throw new Error(`Missing reservation runtime marker: ${marker}`);
if (/await after\(req, res\)/.test(runtime)) throw new Error('Reservation after-hook must not block the route response');
console.log(`Payment reservation runtime static audit passed (${required.length} checks).`);
