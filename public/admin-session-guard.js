/* Deprecated legacy guard intentionally disabled.
 * AdminPro owns admin-session expiry and returns to its login state without
 * reloading the page. Keeping this file as a no-op also prevents old cached
 * pages or legacy includes from reintroducing the reload loop.
 */
(function () {
  'use strict';
  if (window.__GULI_ADMIN_SESSION_GUARD__) return;
  window.__GULI_ADMIN_SESSION_GUARD__ = true;
})();
