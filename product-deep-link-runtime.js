(() => {
  // Telegram product broadcasts use ?product=<product_code|id>.
  // Resolve through the storefront's canonical /api rewrite so the browser
  // never needs a second hardcoded backend origin.
  const API = `${window.location.origin}/api`;
  const params = new URLSearchParams(window.location.search);
  const ref = String(params.get('product') || params.get('product_code') || params.get('productId') || '').trim();
  if (!ref) return;

  let done = false;
  let timer = 0;
  const normalize = value => String(value ?? '').trim().toLowerCase();

  async function resolveProduct() {
    try {
      const response = await fetch(`${API}/products?limit=100`, {
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

    const root = document.getElementById('root') || document.body;
    const observer = new MutationObserver(() => {
      if (openResolvedProduct(product)) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
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
