const BACKEND = String(
  process.env.GULI_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "https://guli-lingerie-api.onrender.com"
).replace(/\/$/, "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const incoming = new URL(req.url || "/api/products", "https://gulii.uz");
  const target = new URL("/api/products", BACKEND);
  for (const [key, value] of incoming.searchParams) target.searchParams.set(key, value);

  let lastStatus = 502;
  let lastBody = null;

  // Render can briefly return 502/503 while waking or recycling. Retry server-side
  // so the customer browser does not have to refresh the entire storefront.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(target.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      lastStatus = response.status;
      const text = await response.text();
      try { lastBody = JSON.parse(text); } catch { lastBody = null; }

      if (response.ok) {
        res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("X-Guli-Catalog-Proxy", "vercel-render");
        return res.status(200).send(text);
      }

      if (![429, 500, 502, 503, 504].includes(response.status)) {
        res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
        return res.status(response.status).send(text);
      }
    } catch (error) {
      lastBody = { success: false, message: error instanceof Error ? error.message : "Backend network error" };
      lastStatus = 502;
    }

    if (attempt < 2) await sleep(350 * (attempt + 1));
  }

  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("X-Guli-Catalog-Proxy", "vercel-render-failed");
  return res.status(502).json({
    success: false,
    message: "Mahsulotlar serveri vaqtincha javob bermadi",
    upstreamStatus: lastStatus,
    upstream: lastBody?.message || null,
  });
}
