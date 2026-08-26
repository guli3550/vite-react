(() => {
  const params = new URLSearchParams(location.search);
  const webApp = window.Telegram?.WebApp;
  const rawRef = (params.get('product') || params.get('startapp') || webApp?.initDataUnsafe?.start_param || '').trim();
  const ref = rawRef.replace(/^product[_:-]?/i, '').trim();
  if (!ref) return;

  const api = 'https://guli-gateway.parizodabaxtiyorov.workers.dev';
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

  const loadTarget = async () => {
    try {
      const r = await fetch(`${api}/api/products?limit=100&search=${encodeURIComponent(ref)}`);
      const j = await r.json();
      const list = Array.isArray(j.data) ? j.data : [];
      const product = list.find((p) => String(p.product_code || '') === ref) || list.find((p) => String(p.id || '') === ref) || list[0];
      if (product) {
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
