// Prevent legacy startup code from overwriting Telegram's secure webhook configuration.
// Loaded after telegramRuntimePatch.js and before index.js.
const originalFetch = global.fetch;
const WEBHOOK_PATH = "/setWebhook";

if (typeof originalFetch === "function") {
  global.fetch = async function patchedTelegramFetch(input, init = {}) {
    const url = typeof input === "string" ? input : String(input?.url || "");
    if (url.includes("api.telegram.org/bot") && url.endsWith(WEBHOOK_PATH)) {
      try {
        const headers = new Headers(init.headers || (typeof input !== "string" ? input?.headers : undefined));
        const rawBody = init.body ?? (typeof input !== "string" ? input?.body : undefined);
        if (rawBody) {
          const body = JSON.parse(String(rawBody));
          const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
          if (secret && !body.secret_token) {
            body.secret_token = secret;
            init = { ...init, headers, body: JSON.stringify(body) };
            headers.set("Content-Type", "application/json");
            init.headers = headers;
          }
        }
      } catch (error) {
        console.warn("[Telegram] webhook persistence patch could not inspect request:", error.message);
      }
    }
    return originalFetch.call(this, input, init);
  };
}
