// Production configuration guard. Load before all other backend runtime patches.
// One canonical Mini App URL; secrets stay server-side.
const CANONICAL_MINI_APP_URL = String(
  process.env.MINI_APP_URL || process.env.VERCEL_APP_URL || "https://vite-react-seven-inky-10.vercel.app/"
).trim().replace(/\/$/, "");
process.env.MINI_APP_URL = CANONICAL_MINI_APP_URL;

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn("[Production config] TELEGRAM_BOT_TOKEN is not configured; Telegram features will remain disabled.");
}

// Never expose the bot token to frontend configuration.
delete process.env.VITE_TELEGRAM_BOT_TOKEN;

console.log(`[Production config] MINI_APP_URL=${process.env.MINI_APP_URL}`);
