#!/usr/bin/env node
// Static guard for rejected-receipt replacement on both customer and admin paths.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runtime = fs.readFileSync(path.join(root, 'backend/paymentReservationRuntime.js'), 'utf8');

const checks = [
  ['customer rejected receipt replacement re-reserves', runtime.includes("wrapBefore('post', '/api/orders/:orderNumber/receipt'") && runtime.includes('await rereserve(order.id)')],
  ['admin rejected receipt replacement hook exists', runtime.includes("wrapBefore('post', '/api/admin/orders/:id/payment-receipt'")],
  ['admin replacement checks rejected state', runtime.includes("String(order.payment_status || '') === 'rejected'")],
  ['admin replacement requires released reservation marker', runtime.includes('order.reservation_released_at')],
  ['admin replacement calls re-reservation RPC', runtime.includes('await rereserve(order.id)')],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Rejected receipt replacement static audit passed (${checks.length} checks).`);
