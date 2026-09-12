// GULI admin auth environment normalization
// Keep ADMIN_SECRET identical across index.js and legacy patch modules.
// This runs before the other preload patches and does not change the secret value,
// only removes accidental surrounding whitespace/quotes from the deployment env.
const raw = process.env.ADMIN_SECRET;
if (typeof raw === "string") {
  process.env.ADMIN_SECRET = raw.trim().replace(/^['"]|['"]$/g, "");
}
