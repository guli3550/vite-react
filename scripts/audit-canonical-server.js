#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(root, 'backend');
const pkg = JSON.parse(fs.readFileSync(path.join(backendDir, 'package.json'), 'utf8'));
const start = String(pkg.scripts?.start || '');

let failed = false;

if (!start.includes('index.js')) {
  failed = true;
  console.error('FAIL canonical start: backend start command does not terminate in index.js');
}

const preloads = [...start.matchAll(/-r\s+\.\/([^\s]+)/g)].map(m => m[1]);
const missing = preloads.filter(file => !fs.existsSync(path.join(backendDir, file)));
if (missing.length) {
  failed = true;
  console.error('FAIL canonical preload files missing:');
  for (const file of missing) console.error(`  - backend/${file}`);
} else {
  console.log(`PASS canonical preload integrity: ${preloads.length} local modules exist`);
}

const unique = new Set(preloads);
if (unique.size !== preloads.length) {
  failed = true;
  console.error('FAIL canonical preload chain contains duplicate modules');
} else {
  console.log('PASS canonical preload chain has no duplicate modules');
}

const worker = fs.readFileSync(path.join(root, 'cloudflare-worker/index.js'), 'utf8');
const forbiddenWorkerTokens = [
  'TELEGRAM_BOT_TOKEN',
  'api.telegram.org',
  '@supabase/supabase-js',
  'createClient(',
  'sendMessage',
  'sendPhoto',
  'supabase.from(',
];
for (const token of forbiddenWorkerTokens) {
  if (worker.includes(token)) {
    failed = true;
    console.error(`FAIL Cloudflare worker contains backend/business token: ${token}`);
  }
}
if (!forbiddenWorkerTokens.some(token => worker.includes(token))) {
  console.log('PASS Cloudflare worker boundary: proxy/CORS only');
}

const workerBusinessRoutes = [/\/api\/telegram\/webhook/, /\/api\/products/, /\/api\/orders/];
for (const pattern of workerBusinessRoutes) {
  if (pattern.test(worker)) {
    failed = true;
    console.error(`FAIL Cloudflare worker contains business route pattern: ${pattern}`);
  }
}

const render = fs.readFileSync(path.join(root, 'render.yaml'), 'utf8');
if (/customerServer\.js/.test(render)) {
  failed = true;
  console.error('FAIL deployment references legacy generated customerServer.js');
} else {
  console.log('PASS deployment boundary: Render starts canonical backend package');
}

const boundary = fs.readFileSync(path.join(backendDir, 'canonicalAuthOnlyGuard.js'), 'utf8');
if (!boundary.includes('TELEGRAM_ONLY_AUTH')) {
  failed = true;
  console.error('FAIL Telegram-only auth guard marker missing');
} else {
  console.log('PASS Telegram-only auth boundary present');
}

if (failed) process.exit(1);
console.log('GULI canonical server static audit: PASS');
