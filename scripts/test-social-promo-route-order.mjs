#!/usr/bin/env node
// Regression test: Social Promo admin routes must not be shadowed by a
// parameterised sibling.
//
// Root cause it guards against: backend/routeRegistry.js mounts routes in the
// order install() was called. If `PATCH /api/admin/social-promos/:id` is
// installed before `PATCH /api/admin/social-promos/settings`, Express matches
// "settings" as `:id` and the settings endpoint is never reached.
//
// Usage:
//   node scripts/test-social-promo-route-order.mjs                 # static + HTTP checks
//   node scripts/test-social-promo-route-order.mjs --static-only   # no dependencies needed
//   node scripts/test-social-promo-route-order.mjs <path-to-runtime.js> --static-only
//
// The HTTP checks run without Supabase credentials (the client is forced to be
// unconfigured), so they never touch the database or any real promo row.

import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const args = process.argv.slice(2);
const staticOnly = args.includes("--static-only");
const fileArg = args.find((a) => !a.startsWith("--"));
const runtimePath = fileArg
  ? path.resolve(fileArg)
  : path.join(repoRoot, "backend", "socialPromoRuntime.js");

let failures = 0;
function report(ok, name, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
  if (!ok) failures += 1;
}

// ---------------------------------------------------------------------------
// 1. Static check: literal sibling routes must be installed before any
//    parameterised route that would also match them (same HTTP method).
// ---------------------------------------------------------------------------
export function parseInstalls(source) {
  const re = /install\(\s*["'](get|post|put|patch|delete)["']\s*,\s*["']([^"']+)["']/g;
  const routes = [];
  let m;
  while ((m = re.exec(source))) routes.push({ method: m[1], path: m[2] });
  return routes;
}

function patternToRegExp(routePath) {
  const body = routePath
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${body}$`);
}

export function findShadowedRoutes(routes) {
  const shadowed = [];
  routes.forEach((earlier, i) => {
    if (!earlier.path.includes("/:")) return;
    const rx = patternToRegExp(earlier.path);
    for (const later of routes.slice(i + 1)) {
      if (later.method !== earlier.method) continue;
      if (later.path === earlier.path || later.path.includes("/:")) continue;
      if (rx.test(later.path)) shadowed.push({ earlier, later });
    }
  });
  return shadowed;
}

const source = readFileSync(runtimePath, "utf8");
const routes = parseInstalls(source);
const fmt = (r) => `${r.method.toUpperCase()} ${r.path}`;

const idRoute = routes.findIndex((r) => r.method === "patch" && r.path === "/api/admin/social-promos/:id");
const settingsRoute = routes.findIndex((r) => r.method === "patch" && r.path === "/api/admin/social-promos/settings");

report(idRoute !== -1 && settingsRoute !== -1, "both PATCH /:id and PATCH /settings are installed", `parsed routes: ${routes.map(fmt).join(", ")}`);
report(
  idRoute !== -1 && settingsRoute !== -1 && settingsRoute < idRoute,
  "PATCH /settings is installed before PATCH /:id",
  `settings index=${settingsRoute}, :id index=${idRoute}`
);
const shadowed = findShadowedRoutes(routes);
report(
  shadowed.length === 0,
  "no literal route is shadowed by an earlier parameterised route",
  shadowed.map((s) => `${fmt(s.later)} is shadowed by ${fmt(s.earlier)}`).join("; ")
);

// ---------------------------------------------------------------------------
// 2. HTTP check: the two PATCH endpoints must reach their own handlers.
//    Distinguished by their 503 message when Supabase is not configured.
// ---------------------------------------------------------------------------
async function httpChecks() {
  const secret = "social-promo-regression-secret";
  process.env.ADMIN_SECRET = secret; // adminAuth.js reads this at require time
  for (const key of [
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_KEY",
  ]) delete process.env[key];

  const backendDir = path.dirname(runtimePath);
  const backendRequire = createRequire(runtimePath);
  const express = backendRequire("express");
  const { registry } = backendRequire(path.join(backendDir, "routeRegistry.js"));
  backendRequire(runtimePath);

  const app = express();
  app.use(express.json());
  registry.attach(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const tokenBody = Buffer.from(JSON.stringify({ role: "admin", sub: "regression", exp: Date.now() + 60_000 })).toString("base64url");
  const token = `${tokenBody}.${crypto.createHmac("sha256", secret).update(tokenBody).digest("base64url")}`;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const call = async (url, init) => {
    const res = await fetch(`${base}${url}`, init);
    let json = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    return { status: res.status, json };
  };

  try {
    const unauth = await call("/api/admin/social-promos/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    report(unauth.status === 401, "PATCH /settings without admin token -> 401", `status=${unauth.status}`);

    const unauthId = await call("/api/admin/social-promos/00000000-0000-4000-8000-000000000000", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    report(unauthId.status === 401, "PATCH /:id without admin token -> 401", `status=${unauthId.status}`);

    const settings = await call("/api/admin/social-promos/settings", {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ settings: [{ row_number: 1, is_enabled: true, direction: "left", duration_seconds: 30 }] }),
    });
    report(
      settings.status === 503 && /Sozlamalar/.test(settings.json?.message || ""),
      "PATCH /settings reaches the settings handler (not :id)",
      `status=${settings.status} message=${settings.json?.message}`
    );

    const item = await call("/api/admin/social-promos/00000000-0000-4000-8000-000000000000", {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ title: "regression" }),
    });
    report(
      item.status === 503 && /O'zgarish/.test(item.json?.message || ""),
      "PATCH /:id reaches the item-update handler",
      `status=${item.status} message=${item.json?.message}`
    );

    const badUrl = await call("/api/admin/social-promos/00000000-0000-4000-8000-000000000000", {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ target_url: "javascript:alert(1)" }),
    });
    report(badUrl.status === 400, "PATCH /:id still rejects unsafe URLs with 400", `status=${badUrl.status}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (!staticOnly) {
  try {
    await httpChecks();
  } catch (error) {
    report(false, "HTTP checks could not run", error?.message || String(error));
  }
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nAll checks passed");
