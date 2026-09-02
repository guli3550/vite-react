const fs = require("fs");
const path = require("path");

const LIMITS_FILE = path.join(__dirname, "promo_limits.json");

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
  calculatePromoDiscount,
};
