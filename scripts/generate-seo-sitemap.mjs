import { mkdir, readdir, writeFile } from "node:fs/promises";

const API = "https://guli-gateway.parizodabaxtiyorov.workers.dev";
const SITE = "https://www.gulii.uz";

const escapeXml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const absolute = (value) => {
  try {
    const u = new URL(String(value || ""));
    return /^https?:$/.test(u.protocol) ? u.toString() : "";
  } catch {
    return "";
  }
};

const priceText = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? new Intl.NumberFormat("uz-UZ").format(n) + " so‘m" : "";
};

async function main() {
  let products = [];
  try {
    const response = await fetch(`${API}/api/products?limit=1000`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    products = Array.isArray(json?.data)
      ? json.data.filter((p) => p?.active !== false)
      : [];
  } catch (error) {
    console.warn("[SEO sitemap] Product API unavailable:", error?.message || error);
  }

  const urls = [
    `  <url>\n    <loc>${SITE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ];

  const distAssets = await readdir("dist/assets").catch(() => []);
  const css = distAssets.find((name) => /^index-.*\\.css$/.test(name)) || "";
  const appJs = distAssets.find((name) => /^index-.*\\.js$/.test(name)) || "";

  for (const p of products) {
    const ref = String(p.product_code || p.id || "").trim();
    if (!ref) continue;

    const productUrl = `${SITE}/product/${encodeURIComponent(ref)}/`;
    const appUrl = `${SITE}/?product=${encodeURIComponent(ref)}`;
    const images = [p.image, ...(Array.isArray(p.images) ? p.images : [])]
      .map(absolute)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 10);

    const imageXml = images.map((image) =>
      `\n    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`
    ).join("");

    urls.push(
      `  <url>\n    <loc>${escapeXml(productUrl)}</loc>${imageXml}\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );

    const name = String(p.name || "Mahsulot").trim();
    const category = String(p.category || "").trim();
    const description = String(p.description || "").trim() ||
      `${name} — Guli Market onlayn do‘konidagi mahsulot.${category ? ` Kategoriya: ${category}.` : ""}`;
    const mainImage = images[0] || `${SITE}/guli_logo.png`;
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
        price: price > 0 ? price : undefined,
        availability: Number(p.stock || 0) > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };

    const html = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(name)} | Guli Market</title>
<meta name="description" content="${escapeHtml(description.slice(0, 300))}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${escapeHtml(productUrl)}">
<meta property="og:site_name" content="Guli Market">
<meta property="og:title" content="${escapeHtml(name)} | Guli Market">
<meta property="og:description" content="${escapeHtml(description.slice(0, 300))}">
<meta property="og:type" content="product">
<meta property="og:url" content="${escapeHtml(productUrl)}">
<meta property="og:image" content="${escapeHtml(mainImage)}">
${css ? `<link rel="stylesheet" href="/assets/${escapeHtml(css)}">` : ""}
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>
</head>
<body>
<main>
<article>
<h1>${escapeHtml(name)}</h1>
${category ? `<p>Kategoriya: ${escapeHtml(category)}</p>` : ""}
${priceText(price) ? `<p>${escapeHtml(priceText(price))}</p>` : ""}
<p>${escapeHtml(description)}</p>
<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(name)} — Guli Market" width="800" height="800" loading="eager">
<p><a href="${escapeHtml(appUrl)}">Mahsulotni Guli Market ilovasida ochish</a></p>
</article>
</main>
${appJs ? `<!-- Product SEO landing page is intentionally crawlable; the main SPA remains available via the link above. -->` : ""}
</body>
</html>
`;

    await mkdir(`dist/product/${ref}`, { recursive: true });
    await writeFile(`dist/product/${ref}/index.html`, html, "utf8");
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>
`;
  await writeFile("dist/sitemap.xml", xml, "utf8");
  console.log(`[SEO sitemap] Generated ${products.length} active product URLs and crawlable product pages.`);
}

main().catch((error) => {
  console.error("[SEO sitemap] Fatal error:", error);
  process.exitCode = 0;
});
