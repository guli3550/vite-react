#!/usr/bin/env node
// Static guard for the P1 manual-card reservation lifecycle.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const runtime = read('backend/paymentReservationRuntime.js');
const sql = read('supabase/payment_reservation_hardening_20260901.sql');
const pkg = read('backend/package.json');

const checks = [
  ['reservation runtime is preloaded before payment routes', pkg.indexOf('-r ./paymentReservationRuntime.js -r ./manualCardPaymentRuntime.js -r ./paymentConfirmationRuntime.js') >= 0],
  ['timeout payment-state hook exists', runtime.includes("wrapAfter('get', '/api/orders/:orderNumber/payment-state'" )],
  ['timeout payment-timeout hook exists', runtime.includes("wrapAfter('post', '/api/orders/:orderNumber/payment-timeout'" )],
  ['expired payment-confirm 410 hook exists', runtime.includes("wrapAfter('post', '/api/orders/:orderNumber/payment-confirm'") && runtime.includes('[410]')],
  ['admin rejection hook exists', runtime.includes("wrapAfter('put', '/api/admin/orders/:id/payment'")],
  ['receipt replacement preflight uses the canonical receipt route', runtime.includes("wrapBefore('post', '/api/orders/:orderNumber/receipt'" )],
  ['release RPC locks the order row', /from public\.orders where id = p_order_id for update/i.test(sql)],
  ['release RPC is idempotent', /reservation_released_at is not null/i.test(sql) && /already_released/i.test(sql)],
  ['release RPC restores stock by product id text', /id::text = product_id_key/i.test(sql)],
  ['release RPC decrements promo usage', /used_count = greatest\(0, coalesce\(used_count,0\) - 1\)/i.test(sql)],
  ['rereserve RPC exists', /create or replace function public\.rereserve_order_reservation/i.test(sql)],
  ['reservation RPCs are service-role only', /revoke all on function public\.release_order_reservation\(bigint\) from public, anon, authenticated/i.test(sql) && /revoke all on function public\.rereserve_order_reservation\(bigint\) from public, anon, authenticated/i.test(sql)],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`Payment reservation static audit passed (${checks.length} checks).`);
