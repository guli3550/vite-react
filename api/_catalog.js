import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://qttwufydrvdwmhxcpgjb.supabase.co";
// Publishable key is intentionally safe for public/client use; RLS remains the security boundary.
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_L0uxrZ6QTpHQUyWVDqfRdg_DTLXuqHX";
let cachedClient = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL)
    .trim().replace(/\/$/, "");
  const key = String(
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  if (!url || !key) throw new Error("Supabase catalog is not configured");
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cachedClient;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

export function toProduct(row) {
  return {
    id: row.id,
    product_code: /^\d{6}$/.test(String(row.product_code || "")) ? String(row.product_code) : undefined,
    name: row.name || row.title || "",
    title: row.title || row.name || "",
    category: row.category || "",
    price: Number(row.price || 0),
    oldPrice: row.old_price == null ? undefined : Number(row.old_price),
    old_price: row.old_price == null ? undefined : Number(row.old_price),
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
    updated_at: row.updated_at || null,
    created_at: row.created_at || null,
    discount: row.old_price && Number(row.old_price) > Number(row.price)
      ? Math.round((1 - Number(row.price) / Number(row.old_price)) * 100)
      : undefined,
  };
}

function applyCategory(query, category) {
  const trimmed = String(category || "").trim();
  if (!trimmed || trimmed === "Barchasi") return query;
  const lower = trimmed.toLowerCase();
  if (lower === "tursik" || lower === "trusik") return query.or("category.ilike.%tursik%,category.ilike.%trusik%");
  if (lower === "penyuar" || lower === "pinyuar") return query.or("category.ilike.%penyuar%,category.ilike.%pinyuar%");
  if (lower.includes("byus") || lower.includes("begalter") || lower.includes("bra")) {
    return query.or("category.ilike.%byus%,category.ilike.%begalter%,category.ilike.%bra%");
  }
  return query.ilike("category", `%${trimmed}%`);
}


function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .replace(/ʻ|ʼ|‘|’|\`/g, "'")
    .replace(/[^a-z0-9\\u0400-\\u04ff]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (!left) return right.length;
  if (!right) return left.length;
  if (Math.abs(left.length - right.length) > 3) return 99;
  let prev = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 0; i < left.length; i += 1) {
    const cur = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      const cost = left[i] === right[j] ? 0 : 1;
      cur.push(Math.min(cur[j] + 1, prev[j + 1] + 1, prev[j] + cost));
    }
    prev = cur;
  }
  return prev[right.length];
}

const SEARCH_SYNONYMS = [
  ["tungi", "uxlash", "uyqu", "yotoq", "kechki", "sleep", "night", "pijama", "pajama"],
  ["kiyim", "libos", "outfit", "kostyum", "pijama", "pajama", "xalat"],
  ["pijama", "pajama", "uy kiyimi", "tungi kiyim", "uxlash kiyimi", "sleepwear"],
  ["byusgalter", "byustgalter", "byust", "lifchik", "sutyen", "bra"],
  ["tursik", "trusik", "ichki ishton", "ichki kiyim", "slip", "brief"],
  ["penyuar", "pinyuar", "xalat", "halat", "robe", "peignoir"],
  ["mayka", "mayska", "futbolka", "top", "tank top"],
];

function expandSearchTokens(query) {
  const normalized = normalizeSearchText(query);
  const tokens = normalized.split(" ").filter(Boolean);
  const expanded = new Set(tokens);
  for (const group of SEARCH_SYNONYMS) {
    if (group.some((term) => tokens.includes(normalizeSearchText(term)))) {
      group.forEach((term) => expanded.add(normalizeSearchText(term)));
    }
  }
  return { normalized, tokens, expanded: [...expanded].filter(Boolean) };
}

function searchProductScore(product, query) {
  const { normalized, tokens, expanded } = expandSearchTokens(query);
  const text = normalizeSearchText([
    product.name,
    product.title,
    product.category,
    product.description,
    product.product_code,
  ].join(" "));
  if (!text) return 0;
  const words = text.split(" ").filter(Boolean);
  let score = 0;

  if (text.includes(normalized)) score += 100;
  if (String(product.product_code || "").toLowerCase() === normalized) score += 500;

  for (const token of tokens) {
    if (!token) continue;
    if (text.includes(token)) {
      score += 45;
      continue;
    }
    const close = words.some((word) => {
      if (word.length < 3 || token.length < 3) return false;
      const distance = levenshtein(token, word);
      const maxDistance = token.length >= 7 ? 2 : 1;
      return distance <= maxDistance;
    });
    if (close) score += 28;
  }

  for (const token of expanded) {
    if (tokens.includes(token)) continue;
    if (text.includes(token)) score += 18;
  }

  if (tokens.length > 1) {
    const matched = tokens.filter((token) => text.includes(token)).length;
    score += Math.round((matched / tokens.length) * 50);
  }

  return score;
}

async function smartSearchProducts(search, category) {
  const queryText = String(search || "").trim().slice(0, 120);
  if (!queryText) return null;

  let query = getClient()
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1000);

  query = applyCategory(query, category);
  const { data, error } = await query;
  if (error) throw error;

  return (data || [])
    .map((row) => ({ row, score: searchProductScore(row, queryText) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);
}

function applySearch(query, search) {
  const safe = String(search || "").trim()
    .replace(/[,%()'"\\\\]/g, " ")
    .replace(/\\s+/g, " ")
    .slice(0, 120);
  if (!safe) return query;
  return query.or("name.ilike.%" + safe + "%,title.ilike.%" + safe + "%,category.ilike.%" + safe + "%,description.ilike.%" + safe + "%,product_code.ilike.%" + safe + "%");
}


export async function listProducts({ category, search, featured, limit = 40, offset = 0 } = {}) {
  const numLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const numOffset = Math.max(Number(offset) || 0, 0);
  let query = getClient()
    .from("products")
    .select("*", { count: "exact" })
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(numOffset, numOffset + numLimit - 1);

  if (String(search || "").trim()) {
    const rankedRows = await smartSearchProducts(search, category);
    const paged = rankedRows.slice(numOffset, numOffset + numLimit);
    return {
      data: paged.map(toProduct),
      pagination: {
        limit: numLimit,
        offset: numOffset,
        total: rankedRows.length,
        hasMore: numOffset + paged.length < rankedRows.length,
      },
    };
  }

  query = applyCategory(query, category);
  if (featured !== undefined) query = query.eq("featured", Boolean(featured));

  const { data, error, count } = await query;
  if (error) throw error;
  const products = (data || []).map(toProduct);
  const total = typeof count === "number" ? count : products.length;
  return {
    data: products,
    pagination: {
      limit: numLimit,
      offset: numOffset,
      total,
      hasMore: numOffset + products.length < total,
    },
  };
}

export async function getProductByRef(ref) {
  const value = String(ref || "").trim();
  if (!value) return null;
  let query = getClient().from("products").select("*").eq("active", true).limit(1);
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value)) query = query.eq("id", value);
  else query = query.eq("product_code", value);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : null;
}
