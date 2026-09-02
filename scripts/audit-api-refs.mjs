import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const allowed = new Set([
  'backend/index.js',
  'backend/productionConfigPatch.js',
  'cloudflare-worker/index.js',
  'telegram-auth-fetch-runtime.js',
  '.env.example',
  'README.md',
  'public/guli-api-config.js',
]);
const roots = ['src', 'public'];
const files = [];
for (const base of roots) {
  const dir = path.join(root, base);
  if (!fs.existsSync(dir)) continue;
  const walk = d => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) files.push(path.relative(root, p));
    }
  };
  walk(dir);
}
const offenders = [];
for (const file of files) {
  if (allowed.has(file)) continue;
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (text.includes('https://guli-lingerie-api.onrender.com')) offenders.push(file);
}
if (offenders.length) {
  console.error('Unapproved hardcoded Render API URL found:');
  for (const file of offenders) console.error(` - ${file}`);
  process.exit(1);
}
console.log('GULI API URL audit passed.');
