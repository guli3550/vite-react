// Canonical Unified Customer Order Creation Patch.
// Handles POST /api/orders, POST /api/customer/orders, POST /api/auth/orders, and POST /api/guest/orders.
// Enforces cryptographic server-side authentication (Telegram HMAC or GULI JWT).
// Rejects client-supplied total, prices, status, ownership (auth_user_id / telegram_id), and timestamps.

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry.js");
const { verifyAccessToken } = require("./guliCustomAuth.js");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const INITIAL_STATUS = "⏳ Buyurtma kutilmoqda";

function timingSafeMatch(a, b) {
  const ba = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function verifyTelegramUser(rawInitData) {
  if (!rawInitData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(String(rawInitData));
    const hash = params.get("hash") || "";
    const authDate = Number(params.get("auth_date"));
    if (!hash || !Number.isFinite(authDate)) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - authDate) > 86400) return null; // 24 hours TTL

    params.delete("hash");
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex");

    if (!timingSafeMatch(hash, expectedHash)) return null;

    const user = JSON.parse(params.get("user") || "{}");
    const id = Number(user.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;

    return {
      type: "telegram",
      id,
      username: user.username || null,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
    };
  } catch {
    return null;
  }
}

async function verifyBrowserUser(req) {
  const authHeader = String(req.headers?.authorization || "").trim();
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  let claims = null;
  try {
    claims = verifyAccessToken(token);
  } catch {
    return null;
  }

  if (!claims?.sub) return null;

  if (!supabase) {
    return {
      type: "auth",
      id: String(claims.sub),
      phone: claims.phone || null,
      telegram_id: claims.telegram_id != null ? Number(claims.telegram_id) : null,
      full_name: null,
    };
  }

  try {
    const { data: userRow } = await supabase
      .from("users")
      .select("id, phone_number, telegram_id, full_name")
      .eq("id", String(claims.sub))
      .maybeSingle();

    if (!userRow) return null;

    return {
      type: "auth",
      id: String(userRow.id),
      phone: userRow.phone_number || claims.phone || null,
      telegram_id: userRow.telegram_id != null ? Number(userRow.telegram_id) : null,
      full_name: userRow.full_name || null,
    };
  } catch (err) {
    console.error("[OrderCreation] DB user fetch error:", err);
    return null;
  }
}

async function resolveOrderCustomer(req) {
  const tgInitData = String(req.headers?.["x-telegram-init-data"] || "").trim();
  const authHeader = String(req.headers?.authorization || "").trim();
  const hasTgHeader = Boolean(tgInitData);
  const hasAuthHeader = Boolean(authHeader && /^Bearer\s+\S+$/i.test(authHeader));

  // If no authentication credentials supplied
  if (!hasTgHeader && !hasAuthHeader) {
    return { unauthenticated: true, conflict: false };
  }

  // Case 1: Both headers present -> MUST independently verify both and ensure they match
  if (hasTgHeader && hasAuthHeader) {
    const tgUser = verifyTelegramUser(tgInitData);
    const browserUser = await verifyBrowserUser(req);

    // If either token is cryptographically invalid
    if (!tgUser || !browserUser) {
      return { unauthenticated: true, conflict: false };
    }

    // Both are cryptographically valid. Verify they represent the same user identity.
    const browserTgId = browserUser.telegram_id != null ? Number(browserUser.telegram_id) : null;
    const isMatching = browserTgId !== null && browserTgId === Number(tgUser.id);

    if (!isMatching) {
      console.warn(`[P1-A SECURITY] Identity mismatch: TG id (${tgUser.id}) vs JWT user DB telegram_id (${browserTgId})`);
      return { conflict: true, unauthenticated: false };
    }

    return {
      conflict: false,
      unauthenticated: false,
      tgUser,
      browserUser,
      primaryType: "telegram",
    };
  }

  // Case 2: Telegram only
  if (hasTgHeader && !hasAuthHeader) {
    const tgUser = verifyTelegramUser(tgInitData);
    if (!tgUser) return { unauthenticated: true, conflict: false };
    return {
      conflict: false,
      unauthenticated: false,
      tgUser,
      browserUser: null,
      primaryType: "telegram",
    };
  }

  // Case 3: JWT only
  if (!hasTgHeader && hasAuthHeader) {
    const browserUser = await verifyBrowserUser(req);
    if (!browserUser) return { unauthenticated: true, conflict: false };
    return {
      conflict: false,
      unauthenticated: false,
      tgUser: null,
      browserUser,
      primaryType: "auth",
    };
  }

  return { unauthenticated: true, conflict: false };
}

async function handleSecureOrderCreation(req, res) {
  if (!supabase) {
    return res.status(503).json({ success: false, message: "Buyurtmalar xizmati sozlanmagan." });
  }

  const authResult = await resolveOrderCustomer(req);

  if (authResult.conflict) {
    return res.status(403).json({
      success: false,
      message: "Identifikatsiyalar nomuvofiq: Telegram hisobi va avtorizatsiya foydalanuvchisi mos kelmadi.",
    });
  }

  if (authResult.unauthenticated) {
    return res.status(401).json({
      success: false,
      message: "Mijoz autentifikatsiyasi talab qilinadi. Telegram yoki hisobingiz orqali kiring.",
    });
  }

  const { tgUser, browserUser, primaryType } = authResult;
  const rawBody = req.body || {};

  // Validate items
  const items = Array.isArray(rawBody.items) ? rawBody.items : [];
  if (!items.length || items.length > 100) {
    return res.status(400).json({ success: false, message: "Buyurtma mahsulotlari noto‘g‘ri" });
  }

  // Determine phone number server-side
  let orderPhone = "";
  if (browserUser) {
    orderPhone = String(browserUser.phone || "").trim();
    if (!orderPhone && tgUser) {
      const { data: tu } = await supabase
        .from("telegram_users")
        .select("telegram_phone")
        .eq("telegram_id", tgUser.id)
        .maybeSingle();
      orderPhone = String(tu?.telegram_phone || "").trim();
    }
    if (!orderPhone) {
      return res.status(400).json({ success: false, message: "Mijozning tasdiqlangan telefon raqami topilmadi." });
    }
  } else if (tgUser) {
    const { data: tu } = await supabase
      .from("telegram_users")
      .select("telegram_phone")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();
    orderPhone = String(tu?.telegram_phone || "").trim();
    if (!orderPhone) {
      return res.status(400).json({ success: false, message: "Iltimos telefon raqamingizni kiriting" });
    }
  }

  // Generate unique order number server-side
  const orderNumber = "GULI-" + Math.floor(100000 + Math.random() * 900000);

  // Normalize payment method
  const rawPayment = String(rawBody.payment || "").toLowerCase();
  const payment = rawPayment === "cash" ? "cash" : "card_manual";

  // Promo code
  const promoCode = rawBody.promo_code ? String(rawBody.promo_code).trim().toUpperCase() : "";

  // Customer Name
  const customerName =
    browserUser?.full_name ||
    [rawBody.first_name, rawBody.last_name].filter(Boolean).join(" ").trim() ||
    tgUser?.first_name ||
    "Mijoz";

  // Address
  const address = rawBody.address && typeof rawBody.address === "object" ? rawBody.address : null;

  // Build sanitized order object for RPC.
  // NOTICE: status, created_at, totals, auth_user_id, and telegram_id are strictly server-owned.
  const orderPayload = {
    order_number: orderNumber,
    items,
    address,
    payment,
    status: INITIAL_STATUS,
    promo_code: promoCode,
    customer_name: customerName,
    first_name: String(rawBody.first_name || tgUser?.first_name || "").trim(),
    last_name: String(rawBody.last_name || tgUser?.last_name || "").trim(),
    phone: orderPhone,
  };

  try {
    let createdOrder = null;

    // When a verified browser JWT exists, use the canonical user RPC even if
    // Telegram initData is also present. This keeps auth_user_id + telegram_id
    // ownership and the checkout transaction atomic in one database function.
    if (browserUser) {
      const { data: rpcData, error: rpcError } = await supabase.rpc("create_secure_order_for_user", {
        p_order: orderPayload,
        p_auth_user_id: browserUser.id,
      });

      if (rpcError) {
        console.error("[OrderCreation] create_secure_order_for_user error:", rpcError);
        const userFacing = /telefon|mahsulot|omborda|promo|minimal buyurtma|sotuvda|miqdori/i.test(rpcError.message || "");
        if (userFacing) {
          return res.status(400).json({ success: false, message: rpcError.message });
        }
        throw rpcError;
      }

      createdOrder = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    } else {
      const { data: rpcData, error: rpcError } = await supabase.rpc("create_secure_order", {
        p_order: orderPayload,
        p_telegram_id: tgUser.id,
      });

      if (rpcError) {
        console.error("[OrderCreation] create_secure_order error:", rpcError);
        const userFacing = /telefon|mahsulot|omborda|promo|minimal buyurtma|sotuvda|miqdori/i.test(rpcError.message || "");
        if (userFacing) {
          return res.status(400).json({ success: false, message: rpcError.message });
        }
        throw rpcError;
      }

      createdOrder = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    }

    if (!createdOrder?.id) {
      throw new Error("Buyurtma yaratildi, ammo ma’lumotlar qaytmadi.");
    }

    return res.status(201).json({
      success: true,
      message: "Buyurtma muvaffaqiyatli saqlandi",
      data: createdOrder,
    });
  } catch (error) {
    console.error("[OrderCreation] Final error:", error);
    const status = /telefon|mahsulot|omborda|promo|minimal buyurtma|sotuvda|miqdori/i.test(error.message || "") ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Buyurtmani saqlashda xatolik yuz berdi",
    });
  }
}

// Register on all order creation routes
install("post", "/api/orders", handleSecureOrderCreation);
install("post", "/api/customer/orders", handleSecureOrderCreation);
install("post", "/api/auth/orders", handleSecureOrderCreation);
install("post", "/api/guest/orders", handleSecureOrderCreation);

module.exports = { handleSecureOrderCreation, resolveOrderCustomer };
