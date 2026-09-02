(() => {
  const GATEWAY = 'https://guli-gateway.parizodabaxtiyorov.workers.dev';
  const RENDER = 'https://guli-lingerie-api.onrender.com';
  const normalize = value => String(value || '').trim().replace(/\/$/, '');
  const configured = normalize(window.__GULI_API__ || '');
  window.__GULI_API__ = configured || GATEWAY;
  window.__GULI_API_GATEWAY__ = GATEWAY;
  window.__GULI_API_FALLBACK__ = RENDER;
})();