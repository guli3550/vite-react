(() => {
  const API = (window.__GULI_API__ || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  const CATEGORY_ORDER = ['pinyuar','pijama','byustgalter','mayka','tursik'];
  const CATEGORY_NAMES = { pinyuar:'Pinyuar', pijama:'Pijama', byustgalter:'Byusgalter', mayka:'Mayka', tursik:'Tursik' };
  const FALLBACKS = {
    pinyuar:'https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?auto=format&fit=crop&w=900&q=82',
    pijama:'https://images.unsplash.com/photo-1608234807905-4466023792f5?auto=format&fit=crop&w=900&q=82',
    byustgalter:'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=82',
    mayka:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=82',
    tursik:'https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=900&q=82'
  };
  const oldCategoryAliases = { pinyuar:['uy kiyimlari','pinyuar'], pijama:['komplektlar','pijama'], byustgalter:['byustgalter','byusgalter'], mayka:['mayka'], tursik:['trusik','tursik'] };
  let categories = [];
  let products = [];

  const normalize = value => String(value || '').trim().toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ');
  const slugMatch = (product, slug) => {
    const hay = normalize(`${product?.category || ''} ${product?.name || ''}`);
    return (oldCategoryAliases[slug] || [slug]).some(alias => hay.includes(normalize(alias)));
  };
  const imageOf = p => p?.image || (Array.isArray(p?.images) ? p.images[0] : '') || '';

  async function loadStoreData() {
    try {
      const [c, p] = await Promise.all([
        fetch(`${API}/api/categories?ts=${Date.now()}`).then(r => r.json()),
        fetch(`${API}/api/products?limit=100&ts=${Date.now()}`).then(r => r.json())
      ]);
      categories = Array.isArray(c?.data) ? c.data : [];
      products = Array.isArray(p?.data) ? p.data : [];
    } catch {}
  }

  function categoryData(slug) {
    const saved = categories.find(c => c.slug === slug);
    const candidates = products.filter(p => slugMatch(p, slug));
    candidates.sort((a,b) => (Number(b.featured)-Number(a.featured)) || (Number(a.sort_order||999999)-Number(b.sort_order||999999)));
    return { name: saved?.name || CATEGORY_NAMES[slug], image: saved?.image_url || imageOf(candidates[0]) || FALLBACKS[slug] };
  }

  function injectStyles() {
    if (document.getElementById('guli-category-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'guli-category-ui-styles';
    style.textContent = `
      .guli-category-scroll{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px!important;overflow:visible!important}
      .guli-category-card{min-width:0!important;padding:0!important;overflow:hidden;position:relative;border-radius:20px!important;background:#fff!important;border:1px solid #f0dfe3!important;box-shadow:0 9px 22px rgba(86,45,56,.06)!important;text-align:left!important}
      .guli-category-card .guli-cat-image{display:block;width:100%;aspect-ratio:.82;object-fit:cover;background:#f5e8eb}
      .guli-category-card .guli-cat-shade{position:absolute;left:0;right:0;bottom:0;height:55%;background:linear-gradient(transparent,rgba(35,18,24,.72));pointer-events:none}
      .guli-category-card .guli-cat-label{position:absolute;left:11px;right:7px;bottom:10px;color:#fff;font-size:11px;font-weight:800;line-height:1.15;text-shadow:0 2px 7px rgba(0,0,0,.25);z-index:2}
      .guli-category-card:active{transform:scale(.98)}
      @media(max-width:480px){.guli-category-scroll{gap:8px!important}.guli-category-card{border-radius:17px!important}.guli-category-card .guli-cat-label{font-size:10px;left:8px;bottom:8px}}
      .bottomNav{left:10px!important;right:10px!important;bottom:10px!important;height:68px!important;padding:7px 6px!important;border:1px solid rgba(235,219,224,.9)!important;border-radius:25px!important;background:rgba(255,252,253,.92)!important;box-shadow:0 14px 40px rgba(74,37,47,.15)!important;backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;gap:2px!important}
      .bottomNav button{position:relative!important;height:54px!important;border-radius:19px!important;background:transparent!important;color:#9d8b91!important;font-size:21px!important;transition:transform .18s,background .18s,color .18s!important}
      .bottomNav button span{font-size:9px!important;font-weight:800!important;letter-spacing:.2px!important;margin-top:3px!important}
      .bottomNav button.active{color:#b94760!important;background:linear-gradient(180deg,#fff,#fff4f6)!important;box-shadow:0 5px 14px rgba(185,71,96,.09)!important}
      .bottomNav button.active::before{content:'';position:absolute;top:4px;left:50%;width:22px;height:3px;border-radius:999px;background:#c9526b;transform:translateX(-50%)}
      .bottomNav button em{top:0!important;right:12px!important;border:2px solid #fff!important;box-shadow:0 3px 8px rgba(185,71,96,.25)!important}
      @media(min-width:700px){.bottomNav{max-width:560px;left:50%!important;right:auto!important;transform:translateX(-50%)}}
      #guli-category-admin{position:fixed;inset:0;z-index:100000;background:rgba(28,15,20,.58);display:none;align-items:flex-end;justify-content:center;padding:12px;backdrop-filter:blur(8px)}
      #guli-category-admin.open{display:flex}
      .guli-cat-panel{width:min(760px,100%);max-height:88vh;overflow:auto;background:#fffafa;border-radius:28px;padding:18px;box-shadow:0 25px 90px rgba(0,0,0,.25)}
      .guli-cat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.guli-cat-head h2{margin:0;font-size:20px}.guli-cat-head p{margin:4px 0 0;color:#8b7b80;font-size:11px}.guli-cat-close{width:38px;height:38px;border-radius:50%;background:#f4e5e8;color:#a7475e;font-size:22px}
      .guli-cat-row{display:grid;grid-template-columns:92px 1fr auto;gap:12px;align-items:center;background:#fff;border:1px solid #efdee2;border-radius:18px;padding:9px;margin:9px 0}.guli-cat-row img{width:92px;height:104px;object-fit:cover;border-radius:13px;background:#f5e8eb}.guli-cat-row b{display:block;font-size:13px}.guli-cat-row small{display:block;color:#927d84;font-size:10px;margin-top:3px}.guli-cat-row button{padding:10px 13px;border-radius:12px;background:#d75d77;color:#fff;font-size:11px;font-weight:800}.guli-cat-upload{display:none}
    `;
    document.head.appendChild(style);
  }

  function renderCategories() {
    const scroll = document.querySelector('.categoryScroll');
    if (!scroll) return;
    injectStyles();
    scroll.classList.add('guli-category-scroll');
    const buttons = Array.from(scroll.querySelectorAll('.categoryCard')).slice(0,5);
    if (buttons.length < 5) return;
    buttons.forEach((button, index) => {
      const slug = CATEGORY_ORDER[index];
      const data = categoryData(slug);
      button.classList.add('guli-category-card');
      button.dataset.categorySlug = slug;
      if (button.dataset.guliEnhanced === '1') return;
      button.dataset.guliEnhanced = '1';
      button.innerHTML = `<img class="guli-cat-image" src="${data.image}" alt="${data.name}" loading="lazy"><span class="guli-cat-shade"></span><b class="guli-cat-label">${data.name}</b>`;
      button.addEventListener('click', () => {
        const catalogButton = Array.from(document.querySelectorAll('.bottomNav button')).find(b => b.textContent?.includes('Katalog'));
        if (catalogButton) catalogButton.click();
        setTimeout(() => {
          const tabs = Array.from(document.querySelectorAll('.categoryTabs .tab'));
          const aliases = oldCategoryAliases[slug] || [];
          const target = tabs.find(t => aliases.some(a => normalize(t.textContent).includes(normalize(a)))) || tabs.find(t => normalize(t.textContent) === normalize(data.name));
          target?.dispatchEvent(new MouseEvent('click', { bubbles:true }));
        }, 60);
      });
      const img = button.querySelector('img');
      img?.addEventListener('error', () => { img.src = FALLBACKS[slug]; }, { once:true });
    });
  }

  function makeAdminButton() {
    if (document.getElementById('guli-category-admin-trigger')) return;
    const button = document.createElement('button');
    button.id = 'guli-category-admin-trigger';
    button.textContent = '🖼️ Kategoriya rasmlari';
    button.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99990;padding:12px 15px;border:0;border-radius:999px;background:#b94760;color:#fff;font:800 12px system-ui;box-shadow:0 12px 30px rgba(185,71,96,.25);cursor:pointer';
    button.onclick = openAdmin;
    document.body.appendChild(button);
  }

  async function openAdmin() {
    if (!document.getElementById('guli-category-admin')) {
      const overlay = document.createElement('div');
      overlay.id = 'guli-category-admin';
      overlay.innerHTML = `<div class="guli-cat-panel"><div class="guli-cat-head"><div><h2>Kategoriya rasmlari</h2><p>Har bir kategoriya uchun rasmni shu yerdan almashtiring.</p></div><button class="guli-cat-close">×</button></div><div class="guli-cat-list"></div></div>`;
      overlay.querySelector('.guli-cat-close').onclick = () => overlay.classList.remove('open');
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
      document.body.appendChild(overlay);
    }
    const overlay = document.getElementById('guli-category-admin');
    const list = overlay.querySelector('.guli-cat-list');
    overlay.classList.add('open');
    list.innerHTML = '<div style="padding:30px;text-align:center;color:#8b7b80">Yuklanmoqda…</div>';
    try {
      const token = sessionStorage.getItem('guli_admin_token') || '';
      const c = await fetch(`${API}/api/admin/categories`, { headers:{ Authorization:`Bearer ${token}` }}).then(r=>r.json());
      const cats = Array.isArray(c?.data) ? c.data : [];
      list.innerHTML = '';
      cats.forEach(cat => {
        const row = document.createElement('div'); row.className='guli-cat-row';
        const img = document.createElement('img'); img.src=cat.image_url || FALLBACKS[cat.slug]; img.alt=cat.name;
        const info=document.createElement('div'); info.innerHTML=`<b>${cat.name}</b><small>Rasmni tanlang va avtomatik saqlang.</small>`;
        const actions=document.createElement('div');
        const choose=document.createElement('button'); choose.textContent='Rasm tanlash';
        const input=document.createElement('input'); input.type='file'; input.accept='image/*'; input.className='guli-cat-upload';
        choose.onclick=()=>input.click();
        input.onchange=async()=>{
          const file=input.files?.[0]; if(!file)return;
          choose.disabled=true; choose.textContent='Yuklanmoqda…';
          try{
            const bitmap=await createImageBitmap(file); const max=1600; const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
            const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
            const ctx=canvas.getContext('2d'); if(!ctx)throw Error('Rasm tayyorlanmadi'); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
            const data=canvas.toDataURL('image/webp',.82).split(',')[1];
            const up=await fetch(`${API}/api/admin/upload-image`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({data,mimeType:'image/webp',extension:'webp'})}).then(r=>r.json());
            if(!up?.success||!up?.data?.url)throw Error(up?.message||'Rasm yuklanmadi');
            const saved=await fetch(`${API}/api/admin/categories/${encodeURIComponent(cat.slug)}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({name:cat.name,image_url:up.data.url})}).then(r=>r.json());
            if(!saved?.success)throw Error(saved?.message||'Kategoriya saqlanmadi');
            cat.image_url=saved.data.image_url; img.src=cat.image_url; choose.textContent='Saqlandi ✓'; setTimeout(()=>choose.textContent='Rasm tanlash',1500);
          }catch(err){choose.textContent=err?.message||'Xatolik';setTimeout(()=>choose.textContent='Rasm tanlash',1800)}finally{choose.disabled=false}
        };
        actions.append(choose,input); row.append(img,info,actions); list.appendChild(row);
      });
    } catch { list.innerHTML='<div style="padding:30px;text-align:center;color:#b7475f">Kategoriya sozlamalarini yuklab bo‘lmadi.</div>'; }
  }

  function boot() {
    injectStyles();
    if (location.pathname.replace(/\/$/,'') === '/admin') {
      setTimeout(makeAdminButton, 800);
      return;
    }
    loadStoreData().then(() => { renderCategories(); setTimeout(renderCategories, 500); });
    const observer = new MutationObserver(() => { renderCategories(); });
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('focus', () => { loadStoreData().then(renderCategories); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
