// Customer identity bridge: attach the current Supabase/Telegram identity to customer APIs.
// The storefront remains fully usable from any browser; Telegram is the identity provider,
// not a platform restriction.

if (typeof window !== "undefined" && !(globalThis as any).__guliCustomerFetchPatched) {
  (globalThis as any).__guliCustomerFetchPatched = true;

  const telegramWebApp = (window as any).Telegram?.WebApp;
  const originalTelegramUser = telegramWebApp?.initDataUnsafe?.user || null;
  (globalThis as any).__guliOriginalTelegramUser = originalTelegramUser;

  const syncTelegramLogoutState = () => {
    const webApp = (window as any).Telegram?.WebApp;
    if (!webApp || !webApp.initDataUnsafe) return;
    const loggedOut = localStorage.getItem("guli_telegram_logged_out") === "1";
    try {
      webApp.initDataUnsafe = {
        ...(webApp.initDataUnsafe || {}),
        user: loggedOut ? undefined : ((globalThis as any).__guliOriginalTelegramUser || webApp.initDataUnsafe?.user),
      };
    } catch {
      // Telegram may expose this object as readonly in some clients.
    }
  };

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  if (!(globalThis as any).__guliStorageIdentityPatched) {
    (globalThis as any).__guliStorageIdentityPatched = true;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "guli_auth_user") {
        try { originalSetItem.call(this, "guli_telegram_logged_out", "0"); } catch {}
        syncTelegramLogoutState();
      }
      return originalSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function (key: string) {
      if (key === "guli_auth_user") {
        try { originalSetItem.call(this, "guli_telegram_logged_out", "1"); } catch {}
        syncTelegramLogoutState();
      }
      return originalRemoveItem.call(this, key);
    };
  }
  syncTelegramLogoutState();

  const nativeFetch = window.fetch.bind(window);
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url || ""
    );

    const needsIdentity =
      url.includes("/api/orders") ||
      url.includes("/api/customer/") ||
      url.includes("/api/reviews");

    if (needsIdentity) {
      const headers = new Headers(
        init?.headers || (input instanceof Request ? input.headers : undefined)
      );
      const token = localStorage.getItem("guli_access_token") || "";
      const tg = (window as any).Telegram?.WebApp?.initData || "";
      if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (tg && !headers.has("X-Telegram-Init-Data")) {
        headers.set("X-Telegram-Init-Data", tg);
      }
      init = { ...(init || {}), headers };
    }
    return nativeFetch(input, init);
  };

  try {
    Object.defineProperty(window, "fetch", {
      value: customFetch,
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      (window as any).fetch = customFetch;
    } catch {
      try {
        (globalThis as any).fetch = customFetch;
      } catch (err) {
        console.warn("[GULI] Could not intercept fetch:", err);
      }
    }
  }

  const tg = (window as any).Telegram?.WebApp?.initData || "";
  if (tg && localStorage.getItem("guli_telegram_logged_out") !== "1") {
    nativeFetch("/api/customer/sync", {
      method: "POST",
      headers: { "X-Telegram-Init-Data": tg, "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
  }

  const token = localStorage.getItem("guli_access_token") || "";
  if (token) {
    nativeFetch("/api/customer/sync", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: localStorage.getItem("guli_phone") || "" }),
    }).catch(() => {});
  }
}

export {};
