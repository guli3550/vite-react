// GULI UI compatibility layer.
// The canonical category/navigation renderer lives in public/category-ui-runtime.js.
// Keep this file free of hard-coded product/category images so admin-managed media wins.
(() => {
  const API = 'https://guli-gateway.parizodabaxtiyorov.workers.dev';
  window.__GULI_API__ = window.__GULI_API__ || API;
})();
