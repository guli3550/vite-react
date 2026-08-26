const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "index.js");
const identityPatchPath = path.join(__dirname, "customerIdentityPatch.js");
const reviewPatchPath = path.join(__dirname, "reviewPatchV2.js");
const manualPaymentPatchPath = path.join(__dirname, "manualCardPaymentPatch.js");
const telegramBotPatchPath = path.join(__dirname, "telegramBotPatch.js");
const customerAuthPatchPath = path.join(__dirname, "customerAuthPatch.js");
const paymentConfirmationRuntimePath = path.join(__dirname, "paymentConfirmationRuntime.js");
const reviewRuntimePath = path.join(__dirname, "reviewRuntime.js");
const receiptWindowRuntimePath = path.join(__dirname, "receiptWindowRuntime.js");
let source = fs.readFileSync(indexPath, "utf8");
const patch = fs.readFileSync(identityPatchPath, "utf8") + "\n" + fs.readFileSync(reviewPatchPath, "utf8");
const manualPaymentPatch = fs.readFileSync(manualPaymentPatchPath, "utf8");
const telegramBotPatch = fs.readFileSync(telegramBotPatchPath, "utf8");
const customerAuthPatch = fs.readFileSync(customerAuthPatchPath, "utf8");
const paymentConfirmationRuntime = fs.readFileSync(paymentConfirmationRuntimePath, "utf8");
const reviewRuntime = fs.readFileSync(reviewRuntimePath, "utf8");
const receiptWindowRuntime = fs.readFileSync(receiptWindowRuntimePath, "utf8");

source = source.replace(
  'const { order_number, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at } = req.body;',
  'const { order_number, phone, items, subtotal, delivery, discount, total, address, payment, status, created_at, promo_code } = req.body;'
);
source = source.replace(
  'const order = { order_number: sixDigitOrderNumber, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, telegram_phone, phone: phone.trim(), items: normalizedItems, subtotal: Number(subtotal) || 0, delivery: Number(delivery) || 0, discount: Number(discount) || 0, total: Number(total) || 0, address: address || null, payment: payment || "cash", status: status || "Qabul qilindi", created_at: created_at || new Date().toISOString(), updated_at: new Date().toISOString() };',
  'let promoMeta = null; if (promo_code) { const { data: promoRow } = await supabase.from("promo_codes").select("code,discount_type,discount_value").eq("code",String(promo_code).trim().toUpperCase()).maybeSingle(); if (promoRow) promoMeta = promoRow; } const order = { order_number: sixDigitOrderNumber, telegram_id: req.telegramUser.id, username: req.telegramUser.username || null, first_name: req.telegramUser.first_name || null, telegram_phone, phone: phone.trim(), items: normalizedItems, subtotal: Number(subtotal) || 0, delivery: Number(delivery) || 0, discount: Number(discount) || 0, total: Number(total) || 0, address: address || null, payment: payment || "cash", payment_status: payment === "card_manual" ? "pending" : "pending", status: status || "Qabul qilindi", promo_code: promoMeta?.code || null, promo_discount_type: promoMeta?.discount_type || null, promo_discount_value: promoMeta ? Number(promoMeta.discount_value) : null, created_at: created_at || new Date().toISOString(), updated_at: new Date().toISOString() };'
);
source = source.replace(
  'return { id: Number(user.id), username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null };',
  'return { id: Number(user.id), username: user.username || null, first_name: user.first_name || null, last_name: user.last_name || null, photo_url: user.photo_url || null };'
);
source = source.replace('express.json({ limit: "4mb" })', 'express.json({ limit: "10mb" })');

const marker = '\nconst PORT=process.env.PORT||10000;';
if (!source.includes(marker)) throw new Error("customerServer: backend/index.js marker not found");
source = source.replace(marker, `\n${patch}\n${manualPaymentPatch}\n${telegramBotPatch}\n${customerAuthPatch}\n${paymentConfirmationRuntime}\n${reviewRuntime}\n${receiptWindowRuntime}\n${marker}`);

const runner = new Function("require", "module", "exports", "__filename", "__dirname", source);
runner(require, module, module.exports, indexPath, __dirname);
