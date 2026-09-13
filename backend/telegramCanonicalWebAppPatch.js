// Keep Telegram's default Web App menu button on the canonical production URL.
// This prevents old Vercel aliases from continuing to open stale storefront builds.
const TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const WEB_APP_URL = 'https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260913';

async function setCanonicalMenu() {
  if (!TOKEN) return;
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Guli 3550 Online Market 🛍️',
          web_app: { url: WEB_APP_URL },
        },
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) console.warn('[Telegram canonical WebApp] menu:', j?.description || r.status);
    else console.log('[Telegram canonical WebApp] menu URL synchronized.');
  } catch (e) {
    console.warn('[Telegram canonical WebApp] menu:', e.message);
  }
}

setTimeout(() => void setCanonicalMenu(), 1800);
