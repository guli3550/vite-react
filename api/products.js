import { listProducts } from "./_catalog.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const incoming = new URL(req.url || "/api/products", "https://gulii.uz");
    const { data, pagination } = await listProducts({
      category: incoming.searchParams.get("category") || "",
      search: incoming.searchParams.get("search") || "",
      featured: incoming.searchParams.has("featured")
        ? incoming.searchParams.get("featured") === "true"
        : undefined,
      limit: incoming.searchParams.get("limit") || 40,
      offset: incoming.searchParams.get("offset") || 0,
    });

    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Guli-Catalog-Source", "vercel-supabase");

    return res.status(200).json({
      success: true,
      data,
      pagination,
    });
  } catch (error) {
    console.error("Vercel Supabase catalog error:", error);
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("X-Guli-Catalog-Source", "vercel-supabase-error");
    return res.status(502).json({
      success: false,
      message: "Mahsulotlar katalogini yuklashda xatolik",
    });
  }
}
