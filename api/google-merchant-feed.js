const SITE = "https://gulii.uz";
const API = "https://guli-gateway.parizodabaxtiyorov.workers.dev";

const xml = (v) => String(v ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const absolute = (v) => {
  try {
    const u = new URL(String(v || ""));
    return /^https?:$/.test(u.protocol) ? u.toString() : "";
  } catch { return ""; }
};

async function loadProducts() {
  const products = []; let offset = 0; const limit = 100;
  for (;;) {
    const response = await fetch(API + "/api/products?limit=" + limit + "&offset=" + offset, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Products API HTTP " + response.status);
    const json = await response.json();
    const batch = Array.isArray(json?.data) ? json.data : [];
    products.push(...batch);
    if (!json?.pagination?.hasMore || batch.length === 0) break;
    offset += batch.length;
  }
  return products.filter((p) => p?.active !== false);
}

export default async function handler(req, res) {
  try {
    const products = await loadProducts();
    const items = products.map((p) => {
      const ref = String(p.product_code || p.id || "").trim();
      const name = String(p.name || p.title || "Mahsulot").trim();
      const description = String(p.description || (name + " — GULI MARKET onlayn do‘konidagi mahsulot.")).trim();
      const images = [p.image, ...(Array.isArray(p.images) ? p.images : [])].map(absolute).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
      const price = Number(p.price || 0);
      if (!ref || !images[0] || !(price > 0)) return "";
      const availability = Number(p.stock || 0) > 0 ? "in_stock" : "out_of_stock";
      const category = String(p.category || "Ayollar kiyimlari").trim();
      const productUrl = SITE + "/product/" + encodeURIComponent(ref) + "/";
      return "<item>" +
        "<g:id>" + xml(ref) + "</g:id>" +
        "<g:title>" + xml(name) + "</g:title>" +
        "<g:description>" + xml(description.slice(0, 5000)) + "</g:description>" +
        "<g:link>" + xml(productUrl) + "</g:link>" +
        "<g:image_link>" + xml(images[0]) + "</g:image_link>" +
        images.slice(1).map((image) => "<g:additional_image_link>" + xml(image) + "</g:additional_image_link>").join("") +
        "<g:availability>" + availability + "</g:availability>" +
        "<g:price>" + xml(price) + " UZS</g:price>" +
        "<g:condition>new</g:condition>" +
        "<g:brand>GULI MARKET</g:brand>" +
        "<g:product_type>" + xml(category) + "</g:product_type>" +
        "<g:gender>female</g:gender>" +
        "</item>";
    }).filter(Boolean).join("\n");
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>GULI MARKET</title><link>' + SITE + '/</link><description>GULI MARKET — O‘zbekiston premium ayollar kiyimlari va uy kiyimlari onlayn do‘koni.</description>\n' + items + "\n</channel></rss>");
  } catch (error) {
    console.error("Google Merchant feed error:", error);
    return res.status(502).send("Merchant feed temporarily unavailable");
  }
}