import { mkdir, writeFile } from "node:fs/promises";

const API = "https://guli-gateway.parizodabaxtiyorov.workers.dev";
const SITE = "https://www.gulii.uz";

const escapeXml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const absolute = (value) => {
  try {
    const u = new URL(String(value || ""));
    return /^https?:$/.test(u.protocol) ? u.toString() : "";
  } catch {
    return "";
  }
};

async function main() {
  let products = [];
  try {
    const response = await fetch(`${API}/api/products?limit=1000`, {
      headers: { "Accept": "application/json" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    products = Array.isArray(json?.data) ? json.data.filter((p) => p?.active !== false) : [];
  } catch (error) {
    console.warn("[SEO sitemap] Product API unavailable:", error?.message || error);
  }

  const urls = [
    `  <url>\n    <loc>${SITE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ];

  for (const p of products) {
    const ref = String(p.product_code || p.id || "").trim();
    if (!ref) continue;

    const productUrl = `${SITE}/?product=${encodeURIComponent(ref)}`;
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
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>\n`;
  await mkdir("public", { recursive: true });
  await writeFile("public/sitemap.xml", xml, "utf8");
  console.log(`[SEO sitemap] Generated ${products.length} active product URLs.`);
}

main().catch((error) => {
  console.error("[SEO sitemap] Fatal error:", error);
  process.exitCode = 0;
});
