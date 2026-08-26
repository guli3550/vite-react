(() => {
  const API = 'https://guli-gateway.parizodabaxtiyorov.workers.dev';
  const ORDER = ['pinyuar','pijama','byustgalter','mayka','tursik'];
  const NAMES = {pinyuar:'Pinyuar',pijama:'Pijama',byustgalter:'Byusgalter',mayka:'Mayka',tursik:'Tursik'};
  const STICKERS = ['🏠','🔎','💗','🛍️','👤'];
  const FALLBACKS = {
    pinyuar:'https://images.unsplash.com/photo-1618244972963-dbee1a7edc95?auto=format&fit=crop&w=900&q=82',
    pijama:'https://images.unsplash.com/photo-1608234807905-4466023792f5?auto=format&fit=crop&w=900&q=82',
    byustgalter:'https://images.unsplash.com/photo-1596755389378-c31d21fd1273?auto=format&fit=crop&w=900&q=82',
    mayka:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=82',
    tursik:'https://images.unsplash.com/photo-1566206091558-7f218b696731?auto=format&fit=crop&w=900&q=82'
  };
  let cats=[];
  let busy=false;

  const normalize = s => String(s||'').toLowerCase().replace(/[’'`]/g,'').replace(/[^a-z0-9]+/g,' ');
  const aliases = {
    pinyuar:['pinyuar','uy kiyimlari'],
    pijama:['pijama','komplektlar'],
    byustgalter:['byusgalter','byustgalter'],
    mayka:['mayka'],
    tursik:['tursik','trusik']
  };

  function css(){
    if(document.getElementById('guli-visual-polish-css'))return;
    const s=document.createElement('style'); s.id='guli-visual-polish-css';
    s.textContent=`
      .guli-category-card{display:flex!important;flex-direction:column!important;align-items:stretch!important;overflow:hidden!important}
      .guli-category-card .guli-cat-image{display:block!important;position:static!important;width:100%!important;height:auto!important;aspect-ratio:.82!important;object-fit:cover!important;flex:none!important}
      .guli-category-card .guli-cat-label{display:block!important;position:static!important;width:100%!important;box-sizing:border-box!important;padding:9px 3px 11px!important;background:#fff8fa!important;color:#9f4057!important;text-align:center!important;font-size:11px!important;font-weight:850!important;line-height:1.08!important;text-shadow:none!important}
      .guli-category-card .guli-cat-shade{display:none!important}
      .bottomNav button .guli-sticker{display:block!important;font-size:24px!important;line-height:1!important;filter:drop-shadow(0 3px 2px rgba(70,35,45,.16))!important;margin-bottom:2px!important}
      .bottomNav button>svg{display:none!important}
      .bottomNav button{gap:0!important}
      @media(max-width:480px){.guli-category-card .guli-cat-label{font-size:10px!important;padding:8px 2px 10px!important}.bottomNav button .guli-sticker{font-size:23px!important}}
    `;
    document.head.appendChild(s);
  }

  async function refresh(){
    if(busy)return; busy=true;
    try{
      const r=await fetch(`${API}/api/categories?ts=${Date.now()}`,{cache:'no-store'});
      const j=await r.json(); cats=Array.isArray(j?.data)?j.data:[];
      renderCats();
    }catch{} finally{busy=false;}
  }

  function renderCats(){
    const wrap=document.querySelector('.categoryScroll'); if(!wrap)return;
    const cards=[...wrap.querySelectorAll('.categoryCard')].slice(0,5); if(cards.length<5)return;
    cards.forEach((card,i)=>{
      const slug=ORDER[i]; const found=cats.find(c=>c.slug===slug); const name=found?.name||NAMES[slug]; const src=found?.image_url||FALLBACKS[slug];
      card.classList.add('guli-category-card');
      let img=card.querySelector('.guli-cat-image');
      if(!img){card.innerHTML=`<img class="guli-cat-image" alt=""><b class="guli-cat-label"></b>`; img=card.querySelector('.guli-cat-image');}
      img.src=src; img.alt=name;
      img.onerror=()=>{img.src=FALLBACKS[slug]};
      const label=card.querySelector('.guli-cat-label'); if(label)label.textContent=name;
    });
  }

  function nav(){
    const wrap=document.querySelector('.bottomNav'); if(!wrap)return;
    [...wrap.querySelectorAll('button')].slice(0,5).forEach((b,i)=>{
      let sticker=b.querySelector('.guli-sticker');
      if(!sticker){sticker=document.createElement('span'); sticker.className='guli-sticker'; b.prepend(sticker);}
      sticker.textContent=STICKERS[i];
    });
  }

  function boot(){
    css(); refresh(); nav();
    const observer=new MutationObserver(()=>{renderCats();nav()});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('focus',refresh);
    window.addEventListener('pageshow',refresh);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
    window.addEventListener('popstate',()=>setTimeout(refresh,80));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
