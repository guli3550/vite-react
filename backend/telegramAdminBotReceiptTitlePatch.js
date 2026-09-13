// Admin notification UX: receipt upload is part of the order notification.
// Never expose a separate "CHEK YUKLANDI" title; keep the persistent order message as YANGI ORDER.
if (!globalThis.__GULI_RECEIPT_TITLE_PATCH__) {
  globalThis.__GULI_RECEIPT_TITLE_PATCH__ = true;
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async function(input, init) {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (/api\.telegram\.org\/bot.*\/(sendMessage|editMessageMedia|sendPhoto|editMessageText)/.test(url) && init?.body) {
      try {
        if (typeof init.body === "string") {
          init = { ...init, body: init.body.replace(/🧾 CHEK YUKLANDI/g, "🛒 YANGI ORDER") };
        } else if (typeof FormData !== "undefined" && init.body instanceof FormData) {
          const form = new FormData();
          for (const [key, value] of init.body.entries()) {
            if (key === "media" || key === "caption" || key === "text") {
              const s = String(value).replace(/🧾 CHEK YUKLANDI/g, "🛒 YANGI ORDER");
              form.append(key, s);
            } else form.append(key, value);
          }
          init = { ...init, body: form };
        }
      } catch (_) {}
    }
    return nativeFetch.call(this, input, init);
  };
}
