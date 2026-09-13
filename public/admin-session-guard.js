/* GULI admin session guard
 * If any protected admin request returns 401, the current browser session is
 * stale/invalid. Clear it and reload once so the admin login screen appears
 * instead of leaving the dashboard filled with repeated "session expired" errors.
 * Never touches /api/admin/login so normal wrong-password responses are preserved.
 */
(function () {
  if (window.__GULI_ADMIN_SESSION_GUARD__) return;
  window.__GULI_ADMIN_SESSION_GUARD__ = true;

  var originalFetch = window.fetch;
  var customFetch = async function () {
    var response = await originalFetch.apply(this, arguments);
    try {
      var input = arguments[0];
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var pathname = new URL(url, window.location.origin).pathname;
      if (
        response.status === 401 &&
        pathname.indexOf("/api/admin/") !== -1 &&
        pathname !== "/api/admin/login" &&
        sessionStorage.getItem("guli_admin_token")
      ) {
        sessionStorage.removeItem("guli_admin_token");
        window.location.reload();
      }
    } catch (_) {}
    return response;
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true
    });
  } catch (_) {
    try {
      window.fetch = customFetch;
    } catch (_) {
      try {
        globalThis.fetch = customFetch;
      } catch (_) {}
    }
  }
})();
