(() => {
  const params = new URLSearchParams(location.search);
  const webApp = window.Telegram?.WebApp;
  const rawRef = (params.get('product') || params.get('startapp') || webApp?.initDataUnsafe?.start_param || '').trim();
  const ref = rawRef.replace(/^product[_:-]?/i, '').trim();
  if (!ref) return;

  // Resolve the product through the current storefront API.
  // Never depend on a cached/old Vercel or gateway catalog for deep links.
  const api = location.origin + '/api';
  let targetName = '';
  let targetCode = ref;
  let opened = false;
  let searchStarted = false;

  const setReactInput = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const openCatalogSearch = () => {
    if (searchStarted) return;
    const catalogButton = [...document.querySelectorAll('button')].find((el) => (el.textContent || '').trim() === 'Katalog');
    const catalogInput = document.querySelector('input[placeholder*="6 xonali mahsulot"]');
    if (!catalogInput && catalogButton) {
      searchStarted = true;
      catalogButton.click();
      window.setTimeout(openCatalogSearch, 250);
      return;
    }
    if (catalogInput) {
      searchStarted = true;
      setReactInput(catalogInput, targetCode);
    }
  };

  const updateSeo = (product) => {
    const name = String(product?.name || '').trim();
    if (!name) return;
    const category = String(product?.category || '').trim();
    const description = String(product?.description || '').trim() || `${name} — Guli Market onlayn do‘konida. ${category}`;
    const canonical = `${location.origin}${location.pathname}${location.search}`;
    document.title = `${name} | Guli Market`;
    const setMeta = (selector, attrs) => {
      let el = document.head.querySelector(selector);
      if (!el) { el = document.createElement('meta'); document.head.appendChild(el); }
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    };
    setMeta('meta[name="description"]', { name: 'description', content: description.slice(0, 300) });
    setMeta('meta[property="og:title"]', { property: 'og:title', content: `${name} | Guli Market` });
    setMeta('meta[property="og:description"]', { property: 'og:description', content: description.slice(0, 300) });
    setMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    const image = product.image || (Array.isArray(product.images) ? product.images[0] : '');
    if (image) setMeta('meta[property="og:image"]', { property: 'og:image', content: image });
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
    link.setAttribute('href', canonical);
    const oldLd = document.head.querySelector('script[data-guli-product-schema]');
    oldLd?.remove();
    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.setAttribute('data-guli-product-schema', 'true');
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      description,
      image: [product.image, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean),
      sku: product.product_code || product.id,
      category,
      brand: { '@type': 'Brand', name: 'Guli Market' },
      offers: { '@type': 'Offer', url: canonical, priceCurrency: 'UZS', price: Number(product.price || 0), availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    });
    document.head.appendChild(ld);
  };

  const loadTarget = async () => {
    try {
      const r = await fetch(`${api}/products?limit=100&search=${encodeURIComponent(ref)}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      const j = await r.json().catch(() => ({}));
      const list = Array.isArray(j.data) ? j.data : [];
      const normalized = ref.toLowerCase();
      const product =
        list.find((p) => String(p.product_code || '').trim().toLowerCase() === normalized) ||
        list.find((p) => String(p.id || '').trim() === ref) ||
        null;
      if (product) {
        updateSeo(product);
        targetName = String(product.name || '').trim();
        targetCode = String(product.product_code || ref).trim();
      }
    } catch {}
  };

  const findAndOpen = () => {
    if (opened || !targetName) return;
    const cards = [...document.querySelectorAll('article.productCard, .productCard')];
    const card = cards.find((el) => {
      const text = (el.textContent || '').toLowerCase();
      return (targetCode && text.includes(targetCode.toLowerCase())) || text.includes(targetName.toLowerCase());
    });
    if (card) {
      opened = true;
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } else {
      openCatalogSearch();
    }
  };

  loadTarget().then(findAndOpen);
  const observer = new MutationObserver(findAndOpen);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setInterval(findAndOpen, 350);
  window.setTimeout(() => { observer.disconnect(); clearInterval(timer); }, 15000);
})();
