const DEFAULT_BACKEND = "https://guli-lingerie-api.onrender.com";
const PRODUCT_CACHE_SECONDS = 60;
const DETAIL_CACHE_SECONDS = 120;

function backend(env) {
  return String(env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, "");
}
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Init-Data",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Vary": "Origin",
  };
}
function cacheKey(request) {
  const url = new URL(request.url);
  return new Request(url.toString(), { method: "GET" });
}
async function cachedGet(request, env, ttl) {
  const cache = caches.default;
  const key = cacheKey(request);
  const hit = await cache.match(key);
  if (hit) {
    const headers = new Headers(hit.headers);
    headers.set("X-GULI-Cache", "HIT");
    return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
  }
  const url = new URL(request.url);
  const upstreamUrl = `${backend(env)}${url.pathname}${url.search}`;
  const upstream = await fetch(upstreamUrl, { method: "GET", headers: request.headers, redirect: "follow" });
  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 5}`);
  headers.set("X-GULI-Cache", "MISS");
  const response = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  if (upstream.ok) await cache.put(key, response.clone());
  return response;
}
async function proxy(request, env) {
  const url = new URL(request.url);
  const target = `${backend(env)}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });
  const out = new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: new Headers(upstream.headers) });
  out.headers.set("X-GULI-Gateway", "cloudflare-worker");
  return out;
}
async function warmBackend(env) {
  const response = await fetch(`${backend(env)}/api/health`, {
    method: "GET",
    headers: { "User-Agent": "GULI-Cloudflare-Warmup/1.0" },
  });
  return response.ok;
}
async function handleTelegramWebhook(request, env) {
  if (request.method !== "POST" || !env.TELEGRAM_BOT_TOKEN) return new Response("OK", { status: 200 });
  const update = await request.json().catch(() => ({}));
  const message = update?.message;
  const chatId = Number(message?.chat?.id || 0);
  if (!chatId) return new Response("OK", { status: 200 });
  const text = String(message?.text || "").trim();
  const tg = async (method, body) => fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (/^\/start(?:@\w+)?/i.test(text)) {
    await tg("sendMessage", { chat_id: chatId, text: "🌷 <b>GULI PREMIUM</b> ga xush kelibsiz!\n\n🛍 Onlayn do‘konni Telegram menyusidan ochishingiz mumkin.", parse_mode: "HTML" });
    return new Response("OK", { status: 200 });
  }
  if (/^\/(shop|store)(?:@\w+)?/i.test(text)) {
    await tg("sendMessage", { chat_id: chatId, text: "🛍 Do‘konni Telegram menyusidagi tugma orqali oching." });
    return new Response("OK", { status: 200 });
  }
  return proxy(request, env);
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    const url = new URL(request.url);
    if (url.pathname === "/api/telegram/webhook") return handleTelegramWebhook(request, env);
    if (url.pathname === "/api/health") return new Response(JSON.stringify({ success: true, status: "online", gateway: "cloudflare", coldStart: false }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders(origin), "Cache-Control": "no-store" } });
    if (request.method === "GET" && url.pathname === "/api/products") {
      const response = await cachedGet(request, env, PRODUCT_CACHE_SECONDS);
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("X-GULI-Gateway", "cloudflare-worker");
      return response;
    }
    if (request.method === "GET" && /^\/api\/products\/[^/]+$/.test(url.pathname)) {
      const response = await cachedGet(request, env, DETAIL_CACHE_SECONDS);
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("X-GULI-Gateway", "cloudflare-worker");
      return response;
    }
    const response = await proxy(request, env);
    response.headers.set("Access-Control-Allow-Origin", origin);
    return response;
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(warmBackend(env).catch((error) => console.error("GULI warmup failed:", error.message)));
  },
};
