(() => {
  const API = 'https://guli-lingerie-api.onrender.com';
  const CATEGORY_URL = `${API}/api/categories?stage1=${Date.now()}`;
  const CATEGORY_FALLBACKS = [
    { name: 'Pinyuar', slug: 'pinyuar' },
    { name: 'Pijama', slug: 'pijama' },
    { name: 'Byusgalter', slug: 'byustgalter' },
    { name: 'Mayka', slug: 'mayka' },
    { name: 'Tursik', slug: 'tursik' },
  ];
  let categories = [];
  let refreshTimer = 0;

  const css = document.createElement('style');
  css.id = 'guli-stage1-style';
  css.textContent = `
    @media (max-width:699px){
      .guli-category-modern{display:flex!important;gap:8px!important;overflow-x:auto!important;scrollbar-width:none!important;padding:2px 0 12px!important}
      .guli-category-modern::-webkit-scrollbar{display:none!important}
      .guli-category-modern .categoryCard{flex:1 1 0!important;min-width:0!important;width:calc((100% - 32px)/5)!important;height:151px!important;padding:0!important;border:0!important;border-radius:22px!important;overflow:hidden!important;position:relative!important;display:flex!important;align-items:flex-end!important;background:#f8e8ec!important;box-shadow:0 9px 24px rgba(75,35,45,.07)!important}
      .guli-category-modern .categoryCard img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important}
      .guli-category-modern .categoryCard:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0) 48%,rgba(255,239,243,.86) 100%);pointer-events:none!important}
      .guli-category-modern .categoryCard span{display:none!important}
      .guli-category-modern .categoryCard b{position:relative!important;z-index:2!important;width:100%!important;padding:0 3px 11px!important;color:#9f4057!important;font-size:11px!important;line-height:1.1!important;text-align:center!important;text-shadow:none!important;white-space:nowrap!important}
      .guli-bottom-nav-modern{left:14px!important;right:14px!important;bottom:10px!important;height:72px!important;padding:5px!important;border-radius:34px!important;background:rgba(255,252,253,.97)!important;box-shadow:0 10px 34px rgba(55,30,38,.14)!important;border:1px solid rgba(234,221,225,.8)!important}
      .guli-bottom-nav-modern button{height:60px!important;margin:0!important;border-radius:22px!important;position:relative!important;font-size:0!important;overflow:visible!important}
      .guli-bottom-nav-modern button span{font-size:8px!important;line-height:1!important;font-weight:800!important;letter-spacing:.1px!important;color:inherit!important;height:auto!important;margin-top:36px!important}
      .guli-bottom-nav-modern button:after{position:absolute!important;top:3px!important;left:50%!important;transform:translateX(-50%)!important;width:34px!important;height:34px!important;border-radius:12px!important;display:grid!important;place-items:center!important;font-size:23px!important;line-height:1!important;background:linear-gradient(145deg,#fff,#f8e5e9)!important;border:1px solid rgba(255,255,255,.9)!important;box-shadow:0 6px 13px rgba(75,35,45,.15),inset 0 1px 0 rgba(255,255,255,.9)!important;filter:saturate(1.05)!important}
      .guli-bottom-nav-modern button:nth-child(1):after{content:'🏠'}
      .guli-bottom-nav-modern button:nth-child(2):after{content:'🔎'}
      .guli-bottom-nav-modern button:nth-child(3):after{content:'💗'}
      .guli-bottom-nav-modern button:nth-child(4):after{content:'🛍️'}
      .guli-bottom-nav-modern button:nth-child(5):after{content:'👤'}
      .guli-bottom-nav-modern button.active:before{z-index:0!important;top:1px!important;width:38px!important;height:38px!important;background:#f9dfe5!important;box-shadow:0 4px 12px rgba(180,75,101,.12)!important}
      .guli-bottom-nav-modern button.active:after{z-index:2!important}
      .guli-bottom-nav-modern button em{font-size:8px!important;z-index:4!important;right:22%!important;top:-1px!important}
    }
    @media (min-width:700px){
      .guli-category-modern{display:flex!important;gap:12px!important;overflow-x:auto!important}
      .guli-category-modern .categoryCard{min-width:130px!important;height:160px!important}
      .guli-bottom-nav-modern{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:620px!important;border-radius:22px!important}
    }
  `;
  document.head.appendChild(css);

  const slug = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function loadCategories() {
    try {
      const response = await fetch(CATEGORY_URL, { cache: 'no-store', headers: { Accept: 'application/json' } });
      const json = await response.json();
      if (response.ok && json?.success && Array.isArray(json.data) && json.data.length) {
        categories = json.data.filter(item => item?.image_url).slice(0, 5);
      }
    } catch {
      // Keep the storefront usable if the category API is temporarily unavailable.
    }
    paintCategories();
  }

  function paintCategories() {
    const scroll = document.querySelector('.categoryScroll');
    if (!scroll) return;
    scroll.classList.add('guli-category-modern');
    const cards = Array.from(scroll.querySelectorAll('.categoryCard'));
    if (!cards.length) return;
    const data = categories.length ? categories : CATEGORY_FALLBACKS;
    cards.slice(0, 5).forEach((card, index) => {
      const item = data[index] || CATEGORY_FALLBACKS[index];
      if (!item) return;
      const image = item.image_url || '';
      const name = item.name || CATEGORY_FALLBACKS[index]?.name || 'Kategoriya';
      const currentImage = card.querySelector('img');
      const currentLabel = card.querySelector('b');
      if (image && (!currentImage || currentImage.getAttribute('src') !== image)) {
        const img = currentImage || document.createElement('img');
        img.src = image;
        img.alt = name;
        img.loading = index < 5 ? 'eager' : 'lazy';
        img.decoding = 'async';
        img.onerror = () => img.remove();
        if (!currentImage) card.insertBefore(img, card.firstChild);
      }
      if (currentLabel) currentLabel.textContent = name;
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
        const firstTab = document.querySelector('.categoryTabs .tab');
        if (firstTab instanceof HTMLElement) firstTab.click();
        window.setTimeout(() => {
          const input = document.querySelector('.categoryTabs')?.previousElementSibling?.querySelector('input') || document.querySelector('.searchBox input');
          if (!(input instanceof HTMLInputElement)) return;
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          setter?.call(input, name);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, 80);
      }, 120);
    }, true);
  }

  function setupRefresh() {
    const refresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadCategories, 120);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    const observer = new MutationObserver(() => {
      if (document.querySelector('.categoryScroll') && !document.querySelector('.categoryScroll')?.classList.contains('guli-category-modern')) refresh();
      const nav = document.querySelector('.bottomNav');
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
