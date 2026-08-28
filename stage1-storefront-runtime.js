(() => {
  const API = 'https://guli-lingerie-api.onrender.com';
  const CATEGORY_URL = `${API}/api/categories?stage1=${Date.now()}`;
  const FALLBACKS = [
    { name: 'Pinyuar', slug: 'pinyuar' },
    { name: 'Pijama', slug: 'pijama' },
    { name: 'Byusgalter', slug: 'byustgalter' },
    { name: 'Mayka', slug: 'mayka' },
    { name: 'Tursik', slug: 'tursik' },
  ];
  let categories = [];
  let refreshTimer = 0;
  let observer;

  const css = document.createElement('style');
  css.id = 'guli-stage1-style';
  css.textContent = `
    @media (max-width:699px){
      .guli-category-modern{display:flex!important;gap:10px!important;overflow-x:auto!important;scrollbar-width:none!important;padding:2px 0 8px!important;align-items:flex-start!important}
      .guli-category-modern::-webkit-scrollbar{display:none!important}
      .guli-category-modern .categoryCard{flex:0 0 calc((100% - 40px)/5)!important;min-width:58px!important;width:calc((100% - 40px)/5)!important;height:184px!important;padding:0!important;border:0!important;border-radius:0!important;overflow:visible!important;position:relative!important;display:block!important;background:transparent!important;box-shadow:none!important;color:inherit!important}
      .guli-category-modern .categoryCard img{position:absolute!important;left:0!important;top:0!important;width:100%!important;height:151px!important;object-fit:cover!important;display:block!important;border-radius:22px!important;background:#f8e8ec!important;box-shadow:0 9px 24px rgba(75,35,45,.10)!important;border:1px solid rgba(255,255,255,.75)!important}
      .guli-category-modern .categoryCard:after{content:""!important;position:absolute!important;left:0!important;right:0!important;top:0!important;height:151px!important;border-radius:22px!important;background:linear-gradient(180deg,rgba(255,255,255,0) 48%,rgba(255,239,243,.28) 100%)!important;pointer-events:none!important}
      .guli-category-modern .categoryCard span{display:none!important}
      .guli-category-modern .categoryCard b{position:absolute!important;z-index:3!important;left:0!important;right:0!important;bottom:8px!important;padding:0 2px!important;color:#9f4057!important;font-size:11px!important;line-height:1.1!important;font-weight:800!important;text-align:center!important;text-shadow:none!important;white-space:normal!important;overflow-wrap:anywhere!important}

      .guli-bottom-nav-modern{left:14px!important;right:14px!important;bottom:calc(8px + var(--safe-bottom, 0px))!important;height:68px!important;padding:4px!important;border-radius:32px!important;background:rgba(255,252,253,.96)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important;box-shadow:0 14px 38px rgba(55,30,38,.16),0 1px 0 rgba(255,255,255,.9) inset!important;border:1px solid rgba(234,221,225,.9)!important}
      .guli-bottom-nav-modern button{height:100%!important;margin:0!important;border-radius:24px!important;position:relative!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important}
      .guli-bottom-nav-modern button:after{display:none!important;content:none!important}
      .guli-bottom-nav-modern button em{font-size:9px!important;z-index:5!important;right:18%!important;top:2px!important;min-width:17px!important;height:17px!important;padding:0 4px!important;border-radius:999px!important;background:#d94f79!important;color:#fff!important;font-style:normal!important;display:grid!important;place-items:center!important;box-shadow:0 2px 7px rgba(180,55,90,.28)!important}
    }
    @media (min-width:700px){
      .guli-category-modern{display:flex!important;gap:12px!important;overflow-x:auto!important}
      .guli-category-modern .categoryCard{min-width:130px!important;height:180px!important;overflow:visible!important;position:relative!important}
      .guli-category-modern .categoryCard img{height:155px!important;width:100%!important;object-fit:cover!important;border-radius:22px!important;display:block!important}
      .guli-category-modern .categoryCard b{position:absolute!important;bottom:7px!important;left:0!important;right:0!important;text-align:center!important}
      .guli-bottom-nav-modern{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:620px!important;border-radius:24px!important}
    }
  `;
  document.head.appendChild(css);

  const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function loadCategories() {
    try {
      const response = await fetch(CATEGORY_URL, { cache: 'no-store', headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
      const json = await response.json();
      if (response.ok && json?.success && Array.isArray(json.data) && json.data.length) {
        categories = json.data.filter(item => item?.active !== false).slice(0, 5);
      }
    } catch {
      // Preserve the storefront if the API is temporarily unavailable.
    }
    paintCategories();
  }

  function paintCategories() {
    const scroll = document.querySelector('.categoryScroll');
    if (!scroll) return;
    scroll.classList.add('guli-category-modern');
    const cards = Array.from(scroll.querySelectorAll('.categoryCard')).slice(0, 5);
    if (!cards.length) return;
    cards.forEach((card, index) => {
      const item = categories[index] || FALLBACKS[index];
      if (!item) return;
      const image = item.image_url || '';
      const name = item.name || FALLBACKS[index]?.name || 'Kategoriya';
      let img = card.querySelector('img');
      if (image) {
        if (!img) { img = document.createElement('img'); card.insertBefore(img, card.firstChild); }
        if (img.getAttribute('src') !== image) img.src = image;
        img.alt = name;
        img.loading = 'eager';
        img.decoding = 'async';
      }
      const label = card.querySelector('b');
      if (label) label.textContent = name;
      card.dataset.guliCategorySlug = item.slug || slug(name);
      card.dataset.guliCategoryName = name;
      card.title = `${name} kategoriyasi`;
    });
  }

  function setupCategoryNavigation() {
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('.categoryCard') : null;
      if (!target || !target.closest('.categoryScroll')) return;
      const name = target.getAttribute('data-guli-category-name');
      if (!name) return;
      window.setTimeout(() => {
        const input = document.querySelector('.searchBox input');
        if (!(input instanceof HTMLInputElement)) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, name);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }, 60);
    }, true);
  }

  function setupRefresh() {
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadCategories, 100);
    };
    window.addEventListener('focus', refresh, { passive: true });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    observer = new MutationObserver(() => {
      const scroll = document.querySelector('.categoryScroll');
      const nav = document.querySelector('.bottomNav');
      if (scroll && !scroll.classList.contains('guli-category-modern')) refresh();
      if (nav && !nav.classList.contains('guli-bottom-nav-modern')) nav.classList.add('guli-bottom-nav-modern');
    });
    observer.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
  }

  function boot() {
    setupCategoryNavigation();
    setupRefresh();
    loadCategories();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();