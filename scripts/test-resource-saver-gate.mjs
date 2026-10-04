import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../backend/telegramAdminBotProduction.js', import.meta.url), 'utf8');
assert.match(source, /GULI_DISABLE_TELEGRAM_ADMIN_WORKER==='true'/);
assert.match(source, /\[GULI resource saver\].*worker disabled/s);
assert.match(source, /else if\(!globalThis\.__GULI_ADMIN_PROD_BOT_STARTED__\)/);
console.log('PASS: admin worker has an explicit opt-out gate; default behavior remains unchanged.');
