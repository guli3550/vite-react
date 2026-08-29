(() => {
  // Telegram product broadcasts use ?product=<product_code|id>.
  // The storefront itself is a stateful React app, so this tiny bridge resolves
  // the deep-link against the live catalog and clicks the real product card.
  const API = 'https://guli-lingerie-api.onrender.com';
  const params = new URLSearchParams(window.location.search);
  const ref = String(params.get('product') || params.get('product_code') || params.get('productId') || '').trim();
  if (!ref) return;

  let done = false;
  let timer = 0;

  const normalize = value => String(value ?? '').trim().toLowerCase();

  async function resolveProduct() {
    try {
      const response = await fetch(`${API}/api/products?limit=100`, {
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      const json = await response.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      return list.find(p => normalize(p?.product_code) === normalize(ref) || String(p?.id) === ref) || null;
    } catch (error) {
      console.warn('[GULI product deep link] catalog lookup failed:', error);
      return null;
    }
  }

  function openResolvedProduct(product) {
    if (done || !product?.id) return false;
    const card = document.getElementById(`product-card-${product.id}`);
    if (!card) return false;
    done = true;
    window.clearInterval(timer);
    // Use the real React onClick handler instead of inventing a second route.
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    window.history.replaceState(window.history.state, document.title, `${window.location.pathname}${window.location.hash || ''}`);
    return true;
  }

  async function boot() {
    const product = await resolveProduct();
    if (!product) {
      console.warn('[GULI product deep link] product not found:', ref);
      return;
    }
    if (openResolvedProduct(product)) return;

    // App renders asynchronously. Keep this short-lived and event-driven by DOM mutation,
    // with a small fallback timer for React hydration/render timing.
    const observer = new MutationObserver(() => {
      if (openResolvedProduct(product)) observer.disconnect();
    });
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    timer = window.setInterval(() => {
      if (openResolvedProduct(product)) observer.disconnect();
    }, 250);
    window.setTimeout(() => {
      window.clearInterval(timer);
      observer.disconnect();
    }, 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
