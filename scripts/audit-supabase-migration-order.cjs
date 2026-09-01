#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sqlDir = path.join(root, 'supabase');
const read = (name) => fs.readFileSync(path.join(sqlDir, name), 'utf8');

const canonical = read('production_checkout_fix_20260901.sql');
const reservation = read('payment_reservation_hardening_20260901.sql');
const terminal = read('payment_verified_terminal_20260902.sql');
const audit = read('payment_audit_log_hardening_20260902.sql');
const legacy = [
  ['secure_checkout_hardening.sql', read('secure_checkout_hardening.sql')],
  ['checkout_runtime_repair.sql', read('checkout_runtime_repair.sql')],
];

const fail = (message) => { throw new Error(`Supabase migration-order audit: ${message}`); };

if (!/create or replace function public\.create_secure_order\(\s*p_order jsonb,\s*p_telegram_id bigint/i.test(canonical)) {
  fail('canonical checkout RPC signature is missing');
}
if (!/where id::text = product_id_key/i.test(canonical) || !/where id::text = prod\.id::text/i.test(canonical)) {
  fail('canonical checkout does not use text-safe product ID matching');
}
if (!/Migration preflight: fail closed/i.test(reservation)) {
  fail('reservation migration is missing fail-closed preflight');
}
if (!/trg_guli_verified_payment_terminal/i.test(terminal)) {
  fail('verified-payment terminal guard is missing');
}
if (!/trg_guli_payment_audit_log/i.test(audit)) {
  fail('payment audit-log trigger is missing');
}

for (const [name, sql] of legacy) {
  if (!/create or replace function public\.create_secure_order/i.test(sql)) continue;
  if (!/legacy|deprecated|do not run|non-canonical/i.test(sql)) {
    fail(`${name} contains a create_secure_order definition without a deprecation warning`);
  }
}

console.log('Supabase migration-order static audit: PASS');
