// Customer-only payment state and private receipt preview.
// Keeps receipt objects private while giving the customer a short-lived signed URL.
const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || '').trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '').trim();
const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const RECEIPT_BUCKET = 'payment-receipts';

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function verifyTelegramInitData(raw) {
  if (!raw || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(String(raw));
    const received = params.get('hash') || '';
    params.delete('hash');
    const dataCheck = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expected = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
    if (!safeEqual(received, expected)) return null;
    const user = JSON.parse(params.get('user') || '{}');
    return Number.isSafeInteger(Number(user.id)) ? { id: Number(user.id) } : null;
  } catch {
    return null;
  }
}

function verifyGuestToken(token) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature || !ADMIN_SECRET) return null;
    const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('base64url');
    if (!safeEqual(signature, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const id = Number(data.guestId);
    if (!Number.isSafeInteger(id) || id >= 0 || Number(data.exp) < Date.now()) return null;
    return { id };
  } catch {
    return null;
  }
}

function requireCustomer(req, res, next) {
  const telegram = verifyTelegramInitData(req.headers['x-telegram-init-data'] || '');
  if (telegram) {
    req.customerPaymentUser = telegram;
    return next();
  }
  const guest = verifyGuestToken(req.headers['x-guli-guest-token'] || '');
  if (guest) {
    req.customerPaymentUser = guest;
    return next();
  }
  return res.status(401).json({ success: false, message: 'Mijoz sessiyasi topilmadi.' });
}

const originalGet = express.application.get;
express.application.get = function customerPaymentStateGet(routePath, ...handlers) {
  if (routePath === '/api/orders/:orderNumber/payment-state') {
    return originalGet.call(this, routePath, requireCustomer, async (req, res) => {
      try {
        if (!supabase) return res.status(503).json({ success: false, message: 'To‘lov xizmati sozlanmagan.' });
        const orderNumber = String(req.params.orderNumber || '').trim();
        const customerId = Number(req.customerPaymentUser.id);
        const { data: order, error } = await supabase
          .from('orders')
          .select('id,order_number,total,subtotal,delivery,discount,phone,payment,payment_status,payment_receipt_path,payment_receipt_uploaded_at,payment_verified_at,telegram_id,address,items,updated_at')
          .eq('order_number', orderNumber)
          .eq('telegram_id', customerId)
          .maybeSingle();
        if (error) throw error;
        if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi.' });

        let receiptUrl = '';
        if (order.payment_receipt_path) {
          const { data: signed, error: signedError } = await supabase.storage
            .from(RECEIPT_BUCKET)
            .createSignedUrl(String(order.payment_receipt_path).replace(/^\/+/, ''), 900);
          if (!signedError) receiptUrl = String(signed?.signedUrl || '');
        }

        res.setHeader('Cache-Control', 'private, no-store');
        return res.json({
          success: true,
          data: {
            ...order,
            receipt_path: order.payment_receipt_path || '',
            receipt_url: receiptUrl,
            receipt_available: Boolean(order.payment_receipt_path),
          },
        });
      } catch (error) {
        console.error('[Customer payment state]', error);
        return res.status(500).json({ success: false, message: 'To‘lov ma’lumotlarini olishda xatolik.' });
      }
    });
  }
  return originalGet.call(this, routePath, ...handlers);
};
