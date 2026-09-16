const DEFAULT_BACKEND = "https://guli-lingerie-api.onrender.com";

function backend(env) {
  return String(env.BACKEND_URL || DEFAULT_BACKEND).replace(/\/$/, "");
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Telegram-Init-Data, X-GULI-Client",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Vary": "Origin",
  };
}

async function proxy(request, env) {
  const url = new URL(request.url);
  const target = `${backend(env)}${url.pathname}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("X-GULI-Edge", "cloudflare");

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "follow",
  });

  const outHeaders = new Headers(upstream.headers);
  const origin = request.headers.get("Origin") || "*";
  for (const [key, value] of Object.entries(corsHeaders(origin))) outHeaders.set(key, value);
  outHeaders.set("X-GULI-Gateway", "cloudflare-proxy");
  outHeaders.set("X-GULI-Canonical-Upstream", "guli-api");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    try {
      return await proxy(request, env);
    } catch (error) {
      console.error("GULI canonical proxy error:", error);
      return new Response(
        JSON.stringify({ success: false, code: "GULI_UPSTREAM_UNAVAILABLE", message: "GULI server vaqtincha mavjud emas" }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...corsHeaders(origin),
            "Cache-Control": "no-store",
          },
        },
      );
    }
  },
};
