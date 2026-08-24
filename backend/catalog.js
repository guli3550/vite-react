const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const toProduct = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: Number(row.price || 0),
  oldPrice: row.old_price == null ? undefined : Number(row.old_price),
  image: row.image || "",
  images: Array.isArray(row.images) ? row.images : [],
  description: row.description || "",
  sizes: Array.isArray(row.sizes) ? row.sizes : [],
  colors: Array.isArray(row.colors) ? row.colors : [],
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
    .limit(Math.min(Number(limit) || 100, 100));

  if (category && category !== "Barchasi") {
    query = query.eq("category", category);
  }

  if (search?.trim()) {
    const safe = search.trim().replace(/[%(),]/g, " ");
    query = query.or(`name.ilike.%${safe}%,category.ilike.%${safe}%`);
  }

  if (featured === true) {
    query = query.eq("featured", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toProduct);
}

module.exports = { listProducts, toProduct };
