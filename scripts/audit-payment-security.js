#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'backend/customerServer.js',
  'backend/manualCardPaymentPatch.js',
  'public/admin-order-payment-bridge.js',
  'public/payment-workflow-guard.js',
];
let failed = false;
for (const relative of files) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8');
  const vm = require('vm');
  try {
    new vm.Script(source, { filename: relative });
    console.log(`PASS syntax: ${relative}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL syntax: ${relative}: ${error.message}`);
  }
}
const generated = fs.readFileSync(path.join(root, 'backend/customerServer.js'), 'utf8');
const declarations = (generated.match(/const GULI_CORS_ORIGINS\s*=/g) || []).length;
const sets = (generated.match(/const GULI_CORS_SET\s*=/g) || []).length;
if (declarations !== 1 || sets !== 1) {
  failed = true;
  console.error(`FAIL CORS declarations: origins=${declarations}, set=${sets}`);
} else console.log('PASS CORS declarations: exactly one origin/set pair');
const required = [
  'TELEGRAM_WEBHOOK_SECRET',
  'payment-receipts',
  'createSignedUrl',
  'payment_status',
  'payment_receipt_path',
  'guli_payment_guard',
];
const all = files.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n') + '\n' + fs.readFileSync(path.join(root, 'supabase/payment_security_hardening_20260901.sql'), 'utf8');
for (const token of required) {
  if (!all.includes(token)) { failed = true; console.error(`FAIL required security control missing: ${token}`); }
  else console.log(`PASS security control: ${token}`);
}
if (failed) process.exit(1);
console.log('GULI payment security static audit: PASS');
