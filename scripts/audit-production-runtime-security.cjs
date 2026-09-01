#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const runtimePath = path.join(root, 'backend/productionSecurityRuntime.js');
const packagePath = path.join(root, 'backend/package.json');
const indexPath = path.join(root, 'backend/index.js');
let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}
function pass(message) { console.log(`PASS ${message}`); }

const runtime = fs.readFileSync(runtimePath, 'utf8');
try { new vm.Script(runtime, { filename: 'backend/productionSecurityRuntime.js' }); pass('production security runtime syntax'); }
catch (error) { fail(`production security runtime syntax: ${error.message}`); }

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const start = String(pkg.scripts?.start || '');
if (!start.includes('-r ./productionSecurityRuntime.js')) fail('Render start command does not load productionSecurityRuntime.js');
else pass('Render start command loads productionSecurityRuntime.js');

for (const token of [
  'CORS_ORIGINS',
  '10mb',
  'TELEGRAM_WEBHOOK_SECRET',
  'secret_token',
  'X-Telegram-Bot-Api-Secret-Token',
  'X-Telegram-Init-Data',
  'api/admin/login',
  'api/guest-session',
  'api/promo/validate',
  'api/telegram/webhook',
  'X-Content-Type-Options',
]) {
  if (!runtime.includes(token)) fail(`runtime security control missing: ${token}`);
  else pass(`runtime security control: ${token}`);
}

const index = fs.readFileSync(indexPath, 'utf8');
if (index.includes('app.use(cors({ origin: true }))')) pass('index CORS baseline detected; production runtime guard is required');
else pass('index CORS baseline is already hardened');

if (failed) process.exit(1);
console.log('GULI production runtime security static audit: PASS');
