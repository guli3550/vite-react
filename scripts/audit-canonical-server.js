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

// Inspect the local dependency closure of active preloads. A missing direct
// dependency can crash the canonical server even when the preload itself exists.
const visited = new Set();
const missingDeps = new Set();
const localRequire = /require\(\s*['"](\.\/[^'"]+)['"]\s*\)/g;
function resolveLocal(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, `${base}.json`, path.join(base, 'index.js')];
  return candidates.find(p => fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}
function scanDeps(file) {
  const abs = path.resolve(file);
  if (visited.has(abs) || !fs.existsSync(abs)) return;
  visited.add(abs);
  const source = fs.readFileSync(abs, 'utf8');
  for (const match of source.matchAll(localRequire)) {
    const spec = match[1];
    const dep = resolveLocal(abs, spec);
    if (!dep) {
      missingDeps.add(`${path.relative(root, abs)} -> ${spec}`);
      continue;
    }
    scanDeps(dep);
  }
}
for (const file of preloads) {
  if (!missing.includes(file)) scanDeps(path.join(backendDir, file));
}
if (missingDeps.size) {
  console.error('WARN canonical runtime has unresolved local dependencies:');
  for (const item of [...missingDeps].sort()) console.error(`  - ${item}`);
  console.error('These must be resolved before patch-chain consolidation/cutover.');
} else {
  console.log(`PASS canonical runtime local dependency closure: ${visited.size} files resolved`);
}

// routeRegistry deduplicates by method+path. Multiple installs of the same
// route therefore do not compose as middleware; only the first registered route
// is attached. Report collisions before any consolidation removes or reorders code.
const routeDefs = new Map();
const routeRegex = /install\(\s*['"](get|post|put|patch|delete|options)['"]\s*,\s*['"]([^'"]+)['"]/gi;
for (const file of preloads) {
  const abs = path.join(backendDir, file);
  if (!fs.existsSync(abs)) continue;
  const source = fs.readFileSync(abs, 'utf8');
  for (const match of source.matchAll(routeRegex)) {
    const key = `${match[1].toUpperCase()} ${match[2]}`;
    const list = routeDefs.get(key) || [];
    list.push(file);
    routeDefs.set(key, list);
  }
}
const collisions = [...routeDefs.entries()].filter(([, files]) => files.length > 1);
if (collisions.length) {
  console.error(`WARN routeRegistry collisions detected: ${collisions.length}`);
  for (const [route, files] of collisions.sort()) {
    console.error(`  - ${route}: ${files.join(', ')}`);
  }
  console.error('Resolve collisions by consolidating handlers or converting guards into explicit middleware before deleting patches.');
} else {
  console.log('PASS active preload route inventory: no duplicate method/path registrations');
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
