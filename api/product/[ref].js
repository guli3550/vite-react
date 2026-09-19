import { getProductByRef } from "../_catalog.js";

const SITE = "https://gulii.uz";

const esc = (v) => String(v ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const absolute = (v) => {
  try {
    const u = new URL(String(v || ""));
    return /^https?:$/.test(u.protocol) ? u.toString() : "";
  } catch {
    return "";
  }
};

export default async function handler(req, res) {
  const ref = String(req.query?.ref || "").trim();
  if (!ref) return res.status(400).send("Product reference is required");

  try {
    const p = await getProductByRef(ref);
    if (!p) return res.status(404).send("Mahsulot topilmadi");

    const name = String(p.name || p.title || "Mahsulot").trim();
    const category = String(p.category || "").trim();
    const description =
      String(p.description || "").trim() ||
      `${name} — Guli Market onlayn do‘konidagi mahsulot.${category ? ` Kategoriya: ${category}.` : ""}`;
    const images = [p.image, ...(Array.isArray(p.images) ? p.images : [])]
      .map(absolute)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);
    const mainImage = images[0] || `${SITE}/guli-logo.webp`;
    const productUrl = `${SITE}/product/${encodeURIComponent(ref)}/`;
    const appUrl = `${SITE}/?product=${encodeURIComponent(ref)}`;
    const price = Number(p.price || 0);

    const schema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description,
      image: images,
      sku: p.product_code || p.id,
      category,
      brand: { "@type": "Brand", name: "Guli Market" },
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "UZS",
        ...(price > 0 ? { price } : {}),
        availability:
          Number(p.stock || 0) > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    };

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");

    return res.status(200).send(`<!doctype html>
<html lang="uz"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(name)} | Guli Market</title>
<meta name="description" content="${esc(description.slice(0, 300))}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<link rel="canonical" href="${esc(productUrl)}">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">
<meta property="og:site_name" content="Guli Market"><meta property="og:title" content="${esc(name)} | Guli Market">
<meta property="og:description" content="${esc(description.slice(0, 300))}"><meta property="og:type" content="product">
<meta property="og:url" content="${esc(productUrl)}"><meta property="og:image" content="${esc(mainImage)}">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head><body><main><article>
<h1>${esc(name)}</h1>
${category ? `<p>Kategoriya: ${esc(category)}</p>` : ""}
${price > 0 ? `<p>${esc(new Intl.NumberFormat("uz-UZ").format(price))} so‘m</p>` : ""}
<p>${esc(description)}</p>
<img src="${esc(mainImage)}" alt="${esc(name)} — Guli Market" width="800" height="800" loading="eager">
<p><a href="${esc(appUrl)}">Mahsulotni Guli Market ilovasida ochish</a></p>
</article></main></body></html>`);
  } catch (error) {
    console.error("Dynamic product SEO error:", error);
    return res.status(502).send("Mahsulot sahifasi vaqtincha mavjud emas");
  }
}
