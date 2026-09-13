// Customer identity bridge: attach the current Supabase/Telegram identity to customer API calls
// and trigger customer profile synchronization on startup.

if (typeof window !== "undefined" && !(globalThis as any).__guliCustomerFetchPatched) {
  (globalThis as any).__guliCustomerFetchPatched = true;

  const nativeFetch = window.fetch.bind(window);
  const customFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url || ""
    );

    if (url.includes("/api/orders") || url.includes("/api/customer/")) {
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
  if (tg) {
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
