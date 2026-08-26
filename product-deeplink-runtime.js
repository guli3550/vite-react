(() => {
  const ref = (new URLSearchParams(location.search).get('product') || '').trim();
  if (!ref) return;
  const api = 'https://guli-lingerie-api.onrender.com';
  let targetName = '';
  let opened = false;
  const loadTarget = async () => {
    try {
      const r = await fetch(`${api}/api/products?limit=100&search=${encodeURIComponent(ref)}`);
      const j = await r.json();
      const list = Array.isArray(j.data) ? j.data : [];
      const product = list.find(p => String(p.product_code || '') === ref) || list[0];
      if (product) targetName = String(product.name || '').trim();
    } catch {}
  };
  const findAndOpen = () => {
    if (opened || !targetName) return;
    const cards = [...document.querySelectorAll('article.productCard, .productCard')];
    const card = cards.find(el => (el.textContent || '').toLowerCase().includes(targetName.toLowerCase()));
    if (card) {
      opened = true;
      card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  };
  loadTarget().then(findAndOpen);
  const observer = new MutationObserver(findAndOpen);
  observer.observe(document.body, { childList: true, subtree: true });
  const timer = window.setInterval(findAndOpen, 400);
  window.setTimeout(() => { observer.disconnect(); clearInterval(timer); }, 12000);
})();
