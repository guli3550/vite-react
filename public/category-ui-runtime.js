(() => {
  const API = (window.__GULI_API__ || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  const CATEGORY_ORDER = ['pinyuar','pijama','byustgalter','mayka','tursik'];
  const CATEGORY_NAMES = { pinyuar:'Pinyuar', pijama:'Pijama', byustgalter:'Byusgalter', mayka:'Mayka', tursik:'Tursik' };
  const FALLBACKS = { pinyuar:'https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?auto=format&fit=crop&w=900&q=82', pijama:'https://images.unsplash.com/photo-1608234807905-4466023792f5?auto=format&fit=crop&w=900&q=82', byustgalter:'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=82', mayka:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=82', tursik:'https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=900&q=82' };
  const aliases = { pinyuar:['uy kiyimlari','pinyuar'], pijama:['komplektlar','pijama'], byustgalter:['byustgalter','byusgalter'], mayka:['mayka'], tursik:['trusik','tursik'] };
  let categories=[]; let products=[];
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ');
  const imgOf=p=>p?.image||(Array.isArray(p?.images)?p.images[0]:'')||'';
  async function loadStoreData(){
    try{
      const [c,p]=await Promise.all([
        fetch(`${API}/api/categories?ts=${Date.now()}`,{cache:'no-store'}).then(r=>r.json()),
        fetch(`${API}/api/products?limit=100&ts=${Date.now()}`,{cache:'no-store'}).then(r=>r.json())
      ]);
      categories=Array.isArray(c?.data)?c.data:[]; products=Array.isArray(p?.data)?p.data:[];
    }catch(e){console.warn('GULI category refresh failed',e)}
  }
  const dataFor=slug=>{
    const saved=categories.find(c=>c.slug===slug);
    const matches=products.filter(p=>(aliases[slug]||[slug]).some(a=>norm(`${p?.category||''} ${p?.name||''}`).includes(norm(a))));
    matches.sort((a,b)=>(Number(b.featured)-Number(a.featured))||(Number(a.sort_order||999999)-Number(b.sort_order||999999)));
    return {name:saved?.name||CATEGORY_NAMES[slug],image:saved?.image_url||imgOf(matches[0])||FALLBACKS[slug]};
  };
  function styles(){
    if(document.getElementById('guli-category-ui-styles'))return;
    const s=document.createElement('style'); s.id='guli-category-ui-styles';
    s.textContent=`
      .guli-category-scroll{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px!important;overflow:visible!important}
      .guli-category-card{min-width:0!important;padding:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;position:relative!important;border-radius:20px!important;background:#fff!important;border:1px solid #f0dfe3!important;box-shadow:0 9px 22px rgba(86,45,56,.06)!important}
      .guli-category-card .guli-cat-image{display:block!important;position:relative!important;width:100%!important;aspect-ratio:.82!important;height:auto!important;object-fit:cover!important;background:#f5e8eb!important;order:1!important}
      .guli-category-card .guli-cat-label{display:block!important;position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;order:2!important;padding:9px 4px 10px!important;color:#9f4057!important;background:#fff8fa!important;font-size:10.5px!important;font-weight:800!important;line-height:1.1!important;text-align:center!important;text-shadow:none!important;z-index:2!important}
      .guli-category-card .guli-cat-shade{display:none!important}
      .bottomNav button{position:relative!important}
      .guli-sticker-icon{font-size:23px!important;line-height:1!important;display:block!important;filter:drop-shadow(0 4px 4px rgba(60,30,40,.16))!important;transform:translateY(-1px)!important}
      .guli-sticker-label{display:block!important;margin-top:3px!important;font-size:8px!important;font-weight:800!important;letter-spacing:.1px!important}
      @media(max-width:480px){.guli-category-scroll{gap:7px!important}.guli-category-card{border-radius:18px!important}.guli-category-card .guli-cat-label{font-size:9.5px!important;padding:8px 2px 9px!important}}
      @media(min-width:700px){.bottomNav{max-width:560px!important;left:50%!important;right:auto!important;transform:translateX(-50%)!important}}
    `; document.head.appendChild(s);
  }
  function renderCategories(){
    const wrap=document.querySelector('.categoryScroll'); if(!wrap)return; styles(); wrap.classList.add('guli-category-scroll');
    const cards=[...wrap.querySelectorAll('.categoryCard')].slice(0,5); if(cards.length<5)return;
    cards.forEach((card,i)=>{
      const slug=CATEGORY_ORDER[i], d=dataFor(slug), current=card.querySelector('.guli-cat-image');
      card.classList.add('guli-category-card'); card.dataset.categorySlug=slug; card.dataset.guliEnhanced='1';
      if(!current){ card.innerHTML=`<img class="guli-cat-image" src="${d.image}" alt="${d.name}" loading="lazy"><span class="guli-cat-shade"></span><b class="guli-cat-label">${d.name}</b>`; }
      else { if(current.src!==d.image) current.src=d.image; const label=card.querySelector('.guli-cat-label'); if(label&&label.textContent!==d.name)label.textContent=d.name; }
      const img=card.querySelector('.guli-cat-image'); if(img)img.onerror=()=>{if(img.src!==FALLBACKS[slug])img.src=FALLBACKS[slug]};
      if(!card.dataset.guliClickBound){ card.dataset.guliClickBound='1'; card.addEventListener('click',()=>{ const cat=[...document.querySelectorAll('.bottomNav button')].find(b=>b.textContent?.includes('Katalog')); cat?.click(); setTimeout(()=>{const tabs=[...document.querySelectorAll('.categoryTabs .tab')]; const target=tabs.find(t=>(aliases[slug]||[]).some(a=>norm(t.textContent).includes(norm(a))))||tabs.find(t=>norm(t.textContent)===norm(d.name)); target?.click()},80); }); }
    });
  }
  const nav={Asosiy:'🏠',Katalog:'🔎',Sevimli:'💗',Savat:'🛍️',Profil:'👤'};
  function renderNavigation(){
    const buttons=[...document.querySelectorAll('.bottomNav button')]; if(!buttons.length)return; styles();
    buttons.forEach(b=>{const label=['Asosiy','Katalog','Sevimli','Savat','Profil'].find(n=>String(b.textContent||'').includes(n)); if(!label)return; const sticker=nav[label]; if(b.dataset.guliSticker==='1'){const small=b.querySelector('.guli-sticker-label');if(small&&small.textContent!==label)small.textContent=label;return;} b.dataset.guliSticker='1'; b.innerHTML=`<span class="guli-sticker-icon" aria-hidden="true">${sticker}</span><small class="guli-sticker-label">${label}</small>`; });
  }
  function boot(){
    styles();
    if(location.pathname.replace(/\/$/,'')==='/admin')return;
    const refresh=()=>loadStoreData().then(()=>{renderCategories();renderNavigation()});
    refresh();
    const observer=new MutationObserver(()=>{renderCategories();renderNavigation()}); observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('focus',refresh); window.addEventListener('pageshow',refresh); window.addEventListener('popstate',refresh); document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
