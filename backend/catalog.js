const { createClient } = require("@supabase/supabase-js");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "");
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim().replace(/^['"]|['"]$/g, "");

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = getSupabaseClient();
  }
  return _supabase;
}

const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error("Supabase is not configured (SUPABASE_URL or SUPABASE_SECRET_KEY missing)");
    }
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toProduct = (row) => ({
  id: row.id,
  product_code: /^\d{6}$/.test(String(row.product_code || "")) ? String(row.product_code) : undefined,
  name: row.name,
  category: row.category,
  price: Number(row.price || 0),
  oldPrice: row.old_price == null ? undefined : Number(row.old_price),
  image: row.image || "",
  images: toArray(row.images),
  description: row.description || "",
  sizes: toArray(row.sizes),
  colors: toArray(row.colors),
  rating: Number(row.rating || 0),
  reviews: Number(row.reviews || 0),
  stock: Number(row.stock || 0),
  featured: Boolean(row.featured),
  active: row.active !== false,
  sort_order: Number(row.sort_order || 0),
  discount:
    row.old_price && Number(row.old_price) > Number(row.price)
      ? Math.round((1 - Number(row.price) / Number(row.old_price)) * 100)
      : undefined,
});

async function listProducts({ category, search, featured, limit = 100, offset = 0 } = {}) {
  const numLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const numOffset = Math.max(Number(offset) || 0, 0);

  let query = supabase
    .from("products")
    .select("*", { count: "exact" })
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(numOffset, numOffset + numLimit - 1);

  if (category && category !== "Barchasi") {
    const trimmedCat = String(category).trim();
    const lower = trimmedCat.toLowerCase();
    if (lower === "tursik" || lower === "trusik") {
      query = query.or("category.ilike.%tursik%,category.ilike.%trusik%");
    } else if (lower === "penyuar" || lower === "pinyuar") {
      query = query.or("category.ilike.%penyuar%,category.ilike.%pinyuar%");
    } else if (lower.includes("byus") || lower.includes("begalter") || lower.includes("bra")) {
      query = query.or("category.ilike.%byus%,category.ilike.%begalter%,category.ilike.%bra%");
    } else {
      query = query.ilike("category", `%${trimmedCat}%`);
    }
  }

  if (search?.trim()) {
    const safe = search.trim().replace(/[%(),]/g, " ").trim();
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,category.ilike.%${safe}%,description.ilike.%${safe}%,product_code.ilike.%${safe}%`);
    }
  }

  if (featured !== undefined) query = query.eq("featured", featured);

  const { data, error, count } = await query;
  if (error) throw error;
  const products = (data || []).map(toProduct);
  products.totalCount = typeof count === "number" ? count : products.length;
  products.count = products.totalCount;
  return products;
}

async function getProduct(id) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return data ? toProduct(data) : null;
}

module.exports = { listProducts, getProduct, toProduct };
