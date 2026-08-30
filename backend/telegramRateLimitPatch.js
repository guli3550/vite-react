// Retry Telegram Bot API 429 responses during startup/configuration.
// This keeps transient Telegram rate limits from making configuration appear broken.
const originalFetch = global.fetch;
if (typeof originalFetch === "function") {
  global.fetch = async function telegramAwareFetch(input, init) {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (!url.includes("api.telegram.org/bot")) return originalFetch(input, init);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await originalFetch(input, init);
      if (response.status !== 429 || attempt === 2) return response;
      const retryAfterHeader = Number(response.headers.get("retry-after") || 0);
      let retryAfterBody = 0;
      try {
        const clone = response.clone();
        const data = await clone.json();
        retryAfterBody = Number(data?.parameters?.retry_after || 0);
      } catch {}
      const delaySeconds = Math.min(Math.max(retryAfterHeader, retryAfterBody, 1), 10);
      await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
    }
    return originalFetch(input, init);
  };
}
