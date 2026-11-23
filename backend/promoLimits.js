const fs = require("fs");
const path = require("path");

const LIMITS_FILE = path.join(__dirname, "promo_limits.json");
const META_FILE = path.join(__dirname, "promo_meta.json");

function getLimitsMap() {
  try {
    if (fs.existsSync(LIMITS_FILE)) {
      const raw = fs.readFileSync(LIMITS_FILE, "utf-8");
      return JSON.parse(raw) || {};
    }
  } catch (e) {
    console.error("Error reading promo_limits.json:", e.message);
  }
  return {};
}

function getPromoLimit(code) {
  if (!code) return null;
  const clean = String(code).trim().toUpperCase();
  const map = getLimitsMap();
  const val = map[clean];
  return val != null && Number(val) > 0 ? Number(val) : null;
}

function setPromoLimit(code, limit) {
  if (!code) return;
  const clean = String(code).trim().toUpperCase();
  try {
    const map = getLimitsMap();
    if (limit == null || limit === "" || Number(limit) <= 0) {
      delete map[clean];
    } else {
      map[clean] = Number(limit);
    }
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving to promo_limits.json:", e.message);
  }
}

function deletePromoLimit(code) {
  if (!code) return;
  const clean = String(code).trim().toUpperCase();
  try {
    const map = getLimitsMap();
    delete map[clean];
    fs.writeFileSync(LIMITS_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("Error deleting from promo_limits.json:", e.message);
  }
}

function getPromoMetaMap() {
  try {
    if (fs.existsSync(META_FILE)) {
      const raw = fs.readFileSync(META_FILE, "utf-8");
      return JSON.parse(raw) || {};
    }
  } catch (e) {
    console.error("Error reading promo_meta.json:", e.message);
  }
  return {};
}

function getPromoMeta(code) {
  if (!code) return { promo_kind: "promo" };
  const clean = String(code).trim().toUpperCase();
  const map = getPromoMetaMap();
  const meta = map[clean];
  if (!meta || typeof meta !== "object") {
    return { promo_kind: "promo" };
  }
  return {
    promo_kind: meta.promo_kind === "qr" ? "qr" : "promo",
    qr_label: typeof meta.qr_label === "string" ? meta.qr_label : "",
    qr_color: typeof meta.qr_color === "string" ? meta.qr_color : "#9f3654",
    starts_at: meta.starts_at || null,
    expires_at: meta.expires_at || null,
  };
}

function setPromoMeta(code, meta) {
  if (!code) return;
  const clean = String(code).trim().toUpperCase();
  try {
    const map = getPromoMetaMap();
    map[clean] = {
      promo_kind: meta?.promo_kind === "qr" ? "qr" : "promo",
      qr_label: typeof meta?.qr_label === "string" ? meta.qr_label.trim().slice(0, 80) : "",
      qr_color: typeof meta?.qr_color === "string" && /^#[0-9a-fA-F]{6}$/.test(meta.qr_color) ? meta.qr_color : "#9f3654",
      starts_at: meta?.starts_at || null,
      expires_at: meta?.expires_at || null,
    };
    fs.writeFileSync(META_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving promo_meta.json:", e.message);
  }
}

function deletePromoMeta(code) {
  if (!code) return;
  const clean = String(code).trim().toUpperCase();
  try {
    const map = getPromoMetaMap();
    delete map[clean];
    fs.writeFileSync(META_FILE, JSON.stringify(map, null, 2), "utf-8");
  } catch (e) {
    console.error("Error deleting promo_meta.json:", e.message);
  }
}

/**
 * Enforces independent operation between manual promo codes and QR voucher codes.
 * @param {"promo" | "qr"} promoKind
 * @param {"manual" | "qr"} applySource
 * @returns {{ ok: boolean, message?: string }}
 */
function validatePromoChannelAccess(promoKind, applySource) {
  const kind = promoKind === "qr" ? "qr" : "promo";
  const source = applySource === "qr" ? "qr" : "manual";
  if (kind === "qr" && source !== "qr") {
    return {
      ok: false,
      message: "Bu QR-vaucher kodi — faqat QR skaner orqali qo‘llanadi",
    };
  }
  if (kind === "promo" && source === "qr") {
    return {
      ok: false,
      message: "Bu oddiy promokod — uni promokod maydoniga qo‘lda kiriting",
    };
  }
  return { ok: true };
}

/**
 * Calculates promo discount respecting maximum discount limit for percentage promos.
 * @param {object} promo - Promo object containing discount_type, discount_value, max_discount_amount, etc.
 * @param {number} subtotal - Subtotal order amount.
 * @returns {{ discount: number, max_discount_amount: number | null, is_limit_applied: boolean }}
 */
function calculatePromoDiscount(promo, subtotal) {
  const code = String(promo?.code || "").trim().toUpperCase();
  const discountType = promo?.discount_type === "fixed" ? "fixed" : "percent";
  const discountValue = Number(promo?.discount_value || 0);

  // Check DB column first, fallback to json storage
  let maxLimit = null;
  if (promo?.max_discount_amount != null && Number(promo.max_discount_amount) > 0) {
    maxLimit = Number(promo.max_discount_amount);
  } else {
    maxLimit = getPromoLimit(code);
  }

  let rawDiscount = 0;
  if (discountType === "percent") {
    rawDiscount = Math.round((subtotal * discountValue) / 100);
  } else {
    rawDiscount = Math.min(subtotal, Math.max(0, discountValue));
  }

  let discount = rawDiscount;
  let isLimitApplied = false;

  if (discountType === "percent" && maxLimit && maxLimit > 0) {
    if (rawDiscount > maxLimit) {
      discount = maxLimit;
      isLimitApplied = true;
    }
  }

  // Discount can never exceed subtotal
  discount = Math.max(0, Math.min(subtotal, discount));

  return {
    discount,
    max_discount_amount: maxLimit,
    is_limit_applied: isLimitApplied,
  };
}

module.exports = {
  getLimitsMap,
  getPromoLimit,
  setPromoLimit,
  deletePromoLimit,
  getPromoMetaMap,
  getPromoMeta,
  setPromoMeta,
  deletePromoMeta,
  validatePromoChannelAccess,
  calculatePromoDiscount,
};
