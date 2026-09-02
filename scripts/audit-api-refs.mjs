import fs from 'node:fs';

const index = fs.readFileSync('index.html', 'utf8');
const config = fs.readFileSync('public/guli-api-config.js', 'utf8');
const auth = fs.readFileSync('telegram-auth-fetch-runtime.js', 'utf8');
const failures = [];
const configPos = index.indexOf('/guli-api-config.js');
const authPos = index.indexOf('/telegram-auth-fetch-runtime.js');
const mainPos = index.indexOf('/src/main.tsx');
if (configPos < 0) failures.push('index.html does not load guli-api-config.js');
if (authPos < 0) failures.push('index.html does not load telegram-auth-fetch-runtime.js');
if (configPos >= 0 && authPos >= 0 && configPos > authPos) failures.push('API config must load before auth fetch runtime');
if (authPos >= 0 && mainPos >= 0 && authPos > mainPos) failures.push('auth fetch runtime must load before main.tsx');
if (!config.includes('window.__GULI_API__')) failures.push('canonical API global is missing');
if (!config.includes('guli-gateway.parizodabaxtiyorov.workers.dev')) failures.push('Gateway is missing from canonical API config');
if (!auth.includes('window.__GULI_API__')) failures.push('auth runtime does not expose canonical API');
if (!auth.includes('guli-gateway.parizodabaxtiyorov.workers.dev')) failures.push('auth runtime Gateway is missing');
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('GULI canonical API runtime audit passed.');
