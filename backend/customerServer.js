const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "index.js");
const patchPath = path.join(__dirname, "customerIdentityPatch.js");
let source = fs.readFileSync(indexPath, "utf8");
const patch = fs.readFileSync(patchPath, "utf8");

// Keep the existing server implementation intact while extending it with the
// customer identity/CRM layer. This also makes rollback trivial: remove the
// wrapper from render.yaml and the original index.js remains untouched.
source = source.replace(
  'const { order_number, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at } = req.body;',
  'const { order_number, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at, promo_code } = req.body;'
);
source = source.replace(
  'const order = { order_number: sixDigitOrderNumber, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, telegram_phone, phone: phone.trim(), items: normalizedItems, subtotal: Number(subtotal) || 0, delivery: Number(delivery) || 0, discount: Number(discount) || 0, total: Number(total) || 0, address: address || null, payment: payment || "cash", status: status || "Qabul qilindi", created_at: created_at || new Date().toISOString(), updated_at: new Date().toISOString() };',
  'const order = { order_number: sixDigitOrderNumber, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, telegram_phone, phone: phone.trim(), items: normalizedItems, subtotal: Number(subtotal) || 0, delivery: Number(delivery) || 0, discount: Number(discount) || 0, total: Number(total) || 0, address: address || null, payment: payment || "cash", status: status || "Qabul qilindi", promo_code: promo_code ? String(promo_code).trim().toUpperCase() : null, promo_discount_type: null, promo_discount_value: null, created_at: created_at || new Date().toISOString(), updated_at: new Date().toISOString() };'
);

const marker = '\nconst PORT=process.env.PORT||10000;';
if (!source.includes(marker)) throw new Error("customerServer: backend/index.js marker not found");
source = source.replace(marker, `\n${patch}\n${marker}`);

const runner = new Function("require", "module", "exports", "__filename", "__dirname", source);
runner(require, module, module.exports, indexPath, __dirname);
