const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

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
  productCode: /^\d{6}$/.test(String(row.product_code || "")) ? String(row.product_code) : undefined,
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
  discount:
    row.old_price && Number(row.old_price) > Number(row.price)
      ? Math.round((1 - Number(row.price) / Number(row.old_price)) * 100)
      : undefined,
});

async function listProducts({ category, search, featured, limit = 100 } = {}) {
  let query = supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 100, 1), 100));

  if (category && category !== "Barchasi") query = query.eq("category", category);

  if (search?.trim()) {
    const safe = search.trim().replace(/[%(),]/g, " ");
    query = query.or(`name.ilike.%${safe}%,category.ilike.%${safe}%,product_code.eq.${safe}`);
  }

  if (featured !== undefined) query = query.eq("featured", featured);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toProduct);
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
