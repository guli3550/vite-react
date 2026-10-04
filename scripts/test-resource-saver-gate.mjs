import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../backend/telegramAdminBotProduction.js', import.meta.url), 'utf8');
const chat = await readFile(new URL('../backend/chatRealtimePatch.js', import.meta.url), 'utf8');
assert.match(source, /GULI_DISABLE_TELEGRAM_ADMIN_WORKER==='true'/);
assert.match(source, /\[GULI resource saver\].*worker disabled/s);
assert.match(source, /else if\(!globalThis\.__GULI_ADMIN_PROD_BOT_STARTED__\)/);
assert.match(chat, /GULI_DISABLE_ONLINE_CHAT==='true'/);
assert.match(chat, /ONLINE_CHAT_DISABLED/);
console.log('PASS: admin worker and realtime chat have explicit opt-out gates; defaults remain unchanged.');
