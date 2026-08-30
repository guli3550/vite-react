(() => {
  const API = "https://guli-lingerie-api.onrender.com";
  const tg = () => window.Telegram?.WebApp;
  const initData = () => tg()?.initData || "";
  const money = n => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[ch]));
  const stars = rating => { const n=Math.max(0,Math.min(5,Math.round(Number(rating)||0))); return `<span style="letter-spacing:2px;color:#e5a43a">${"★".repeat(n)}<span style="color:#e5e1e2">${"★".repeat(5-n)}</span></span>`; };

  // Production resilience: Render can sleep. Retry catalog requests and keep the last good catalog locally.
  const nativeFetch = window.fetch.bind(window);
  const productCacheKey = "guli_products_cache_v2";
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const isProductsRequest = input => {
    const raw = typeof input === "string" ? input : input?.url || "";
    return /\/api\/products(?:\?|$)/.test(String(raw));
  };
  const customFetch = async (input, init) => {
    if (!isProductsRequest(input)) return nativeFetch(input, init);
    let lastError;
    for (let attempt=0; attempt<3; attempt++) {
      try {
        const response = await nativeFetch(input, init);
        if (response.ok) {
          const copy = response.clone();
          copy.json().then(data => {
            if (data?.success && Array.isArray(data.data) && data.data.length) localStorage.setItem(productCacheKey, JSON.stringify({savedAt:Date.now(),data:data.data}));
          }).catch(()=>{});
          return response;
        }
        lastError = new Error(`Catalog HTTP ${response.status}`);
      } catch (e) { lastError=e; }
      await sleep(500 * (attempt+1));
    }
    try {
      const cached = JSON.parse(localStorage.getItem(productCacheKey)||"null");
      if (Array.isArray(cached?.data) && cached.data.length) {
        return new Response(JSON.stringify({success:true,data:cached.data,source:"local-cache"}), {status:200,headers:{"Content-Type":"application/json"}});
      }
    } catch {}
    throw lastError || new Error("Mahsulotlar serveridan javob olinmadi");
  };

  try {
    Object.defineProperty(window, 'fetch', { value: customFetch, writable: true, configurable: true });
  } catch {
    try {
      window.fetch = customFetch;
    } catch {}
  }

  const style = `
    :root{--guli:#c9526b;--guli-dark:#a94059;--guli-soft:#f8e3e8;--guli-ink:#21191c}
    html{scroll-behavior:smooth}body{overflow-x:hidden}.appShell{min-height:100vh;overflow-x:hidden}
    .productImage{position:relative;aspect-ratio:.82;background:#f3e7e9;overflow:hidden;cursor:pointer;border-radius:0}
    .productImage>img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease;background:#f7edef}
    .productCard:hover .productImage>img{transform:scale(1.025)}
    .heart{position:absolute;top:9px;right:9px;width:37px;height:37px;border-radius:50%;background:rgba(255,255,255,.95);color:#bd526a;font-size:21px;z-index:4;box-shadow:0 5px 15px rgba(50,20,30,.10);border:1px solid rgba(235,220,224,.8)}
    .discount{position:absolute;left:9px;top:9px;background:var(--guli);color:#fff;padding:6px 9px;border-radius:999px;font-size:10px;font-weight:850;z-index:3;box-shadow:0 5px 12px rgba(201,82,107,.18)}
    .productBody{padding:12px 12px 14px;background:#fff}.productBody>span{font-size:9px;text-transform:uppercase;letter-spacing:1.1px;color:#a78088}.productBody h3{font-size:14px;margin:6px 0 7px;line-height:1.28;min-height:36px}.productBody small{display:block;color:#89777d;font-size:9px;margin-bottom:6px}.priceLine{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}.priceLine b{font-size:14px;color:#2a2023}.priceLine del{font-size:9px;color:#9d9094}.productCard{overflow:hidden}
    .detailImageWrap{touch-action:pan-y}.productCodeLabel{display:inline-block;margin-top:1px;color:#8b747a;font-size:10px;letter-spacing:.2px}
    .guli-gallery-shell{isolation:isolate}.guli-mini-gallery::-webkit-scrollbar{display:none}.guli-mini-gallery{scrollbar-width:none}
    .guli-share{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:11px 14px;border:1px solid #eadde0;background:#fff;color:#a74760;border-radius:14px;font-size:11px;font-weight:800;margin-top:9px}
    .guli-reviews{margin:18px 12px 8px;background:#fff;border:1px solid #f0e1e4;border-radius:24px;padding:18px;box-shadow:0 8px 24px rgba(75,35,45,.045)}
    .guli-reviews *{box-sizing:border-box}.guli-review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.guli-review-kicker{font-size:9px;letter-spacing:2px;color:#a97883;font-weight:800}.guli-review-title{margin:5px 0 3px;font-size:22px;color:#21191c}.guli-review-sub{font-size:10px;color:#8d7b80;line-height:1.45}.guli-review-summary{display:grid;grid-template-columns:92px 1fr;gap:16px;align-items:center;margin:16px 0;padding:14px;border-radius:18px;background:#fff8f9;border:1px solid #f2e3e6}.guli-score{text-align:center}.guli-score strong{display:block;font-size:31px;color:#bd526a;line-height:1}.guli-score div{margin:7px 0 3px;font-size:11px}.guli-score small{font-size:9px;color:#8d7b80}.guli-bars{display:flex;flex-direction:column;gap:5px}.guli-bar{display:grid;grid-template-columns:18px 1fr 22px;gap:7px;align-items:center;font-size:9px;color:#8d7b80}.guli-track{height:6px;border-radius:9px;background:#eee6e8;overflow:hidden}.guli-track i{display:block;height:100%;border-radius:9px;background:#e2a0af}.guli-review-action{width:100%;padding:12px 14px;border:1px solid #dfacb8;background:#fff;color:#b74760;border-radius:14px;font-weight:850;font-size:11px}.guli-review-action.primary{background:#c9526b;color:#fff;box-shadow:0 8px 18px rgba(201,82,107,.16)}.guli-review-note{margin-top:9px;padding:10px 12px;border-radius:12px;background:#f8f4f5;color:#75656a;font-size:9px;line-height:1.5}.guli-review-list{display:flex;gap:10px;overflow-x:auto;padding:3px 1px 6px;scrollbar-width:none}.guli-review-list::-webkit-scrollbar{display:none}.guli-review-card{flex:0 0 250px;min-height:180px;background:#fff;border:1px solid #eee3e5;border-radius:18px;padding:13px}.guli-review-user{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.guli-review-user b{font-size:11px;color:#2b2326;display:block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guli-review-date{font-size:8px;color:#a09296;margin-top:3px}.guli-verified{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 7px;border-radius:99px;background:#eaf8f0;color:#268457;font-size:8px;font-weight:800}.guli-review-text{font-size:11px;color:#51464a;line-height:1.5;margin:10px 0 8px;min-height:34px}.guli-review-photos{display:flex;gap:6px;overflow:hidden}.guli-review-photos img{width:55px;height:55px;object-fit:cover;border-radius:9px;border:1px solid #eee2e5}.guli-review-empty{padding:14px 2px;color:#8b7b80;font-size:10px}.guli-review-modal{position:fixed;inset:0;background:rgba(31,20,24,.42);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:0}.guli-review-sheet{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fffafa;border-radius:26px 26px 0 0;padding:18px 16px 28px;box-shadow:0 -10px 40px rgba(20,10,15,.18)}.guli-review-sheet h3{margin:0 0 4px;font-size:20px}.guli-review-sheet p{margin:0 0 14px;font-size:10px;color:#8b7b80}.guli-review-stars{display:flex;gap:5px;margin:12px 0 15px}.guli-review-stars button{width:40px;height:40px;border-radius:12px;background:#fff;border:1px solid #eadde0;font-size:22px;color:#d9d0d3}.guli-review-stars button.on{background:#fff1d7;border-color:#e8b75f;color:#e5a43a}.guli-review-sheet textarea{width:100%;min-height:110px;resize:vertical;border:1px solid #eadde0;border-radius:15px;padding:12px;outline:none;background:#fff;font:inherit;font-size:12px}.guli-photo-label{display:flex;align-items:center;justify-content:space-between;margin:11px 0 7px;font-size:10px;font-weight:750;color:#69595f}.guli-photo-label small{font-weight:500;color:#9a898e}.guli-review-sheet input[type=file]{width:100%;font-size:10px}.guli-photo-preview{display:flex;gap:7px;margin:8px 0}.guli-photo-preview img{width:58px;height:58px;border-radius:10px;object-fit:cover}.guli-review-modal-actions{display:flex;gap:8px;margin-top:14px}.guli-review-modal-actions button{flex:1;padding:13px;border-radius:14px;font-weight:800}.guli-review-cancel{background:#f3eef0;color:#66565c}.guli-review-send{background:#c9526b;color:#fff}.guli-review-send:disabled{opacity:.55}.guli-review-toast{position:fixed;left:14px;right:14px;bottom:95px;z-index:11000;background:#21191c;color:#fff;padding:12px 14px;border-radius:13px;text-align:center;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
    .guli-catalog-retry{margin:12px auto 0;display:block;width:min(290px,100%);padding:12px 16px;border:1px solid #dfacb8;border-radius:14px;background:#fff;color:#b74760;font-weight:800;font-size:11px}
    .guli-top-button{position:fixed;right:14px;bottom:92px;width:42px;height:42px;border-radius:50%;border:1px solid #ecdde1;background:rgba(255,255,255,.95);color:#b74760;box-shadow:0 8px 20px rgba(50,20,30,.12);z-index:55;font-size:18px;opacity:0;pointer-events:none;transition:.2s}.guli-top-button.show{opacity:1;pointer-events:auto}
    .bottomNav{padding-bottom:max(8px,env(safe-area-inset-bottom));height:calc(72px + env(safe-area-inset-bottom))}.topbar{padding-top:max(10px,env(safe-area-inset-top))}
    @media(min-width:700px){.guli-reviews{margin-left:auto;margin-right:auto;max-width:900px}.guli-review-card{flex-basis:290px}.guli-review-sheet{border-radius:26px;margin-bottom:18px}.productGrid{grid-template-columns:repeat(3,minmax(0,1fr))}.page,.section{max-width:1100px;margin-left:auto;margin-right:auto}}
    @media(max-width:380px){.productGrid{gap:9px}.productBody{padding:10px}.productBody h3{font-size:12px}.priceLine b{font-size:12px}.productImage{aspect-ratio:.78}.guli-review-summary{grid-template-columns:78px 1fr;gap:10px;padding:11px}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important}}
  `;
  if (!document.getElementById("guli-market-style")) { const s=document.createElement("style"); s.id="guli-market-style"; s.textContent=style; document.head.appendChild(s); }

  const request = async (path, options={}) => {
    const headers={...(options.headers||{})}; const token=initData(); if(token) headers["X-Telegram-Init-Data"]=token;
    const response=await nativeFetch(`${API}${path}`,{...options,headers}); const data=await response.json().catch(()=>({}));
    if(!response.ok||data.success===false) throw new Error(data.message||"So‘rov bajarilmadi"); return data;
  };
  const toast = message => { document.querySelector(".guli-review-toast")?.remove(); const el=document.createElement("div"); el.className="guli-review-toast"; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),2600); };

  function compressImage(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const img=new Image();img.onerror=reject;img.onload=()=>{const scale=Math.min(1,900/Math.max(img.width,img.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));c.getContext("2d").drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL("image/jpeg",.72));};img.src=String(reader.result||"");};reader.readAsDataURL(file);});}

  function openReviewModal(code, existing){
    const modal=document.createElement("div");modal.className="guli-review-modal";modal.innerHTML=`<div class="guli-review-sheet"><h3>Mahsulotni baholang</h3><p>Sharhingiz boshqa xaridorlarga tanlov qilishda yordam beradi.</p><div class="guli-review-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}">★</button>`).join("")}</div><textarea maxlength="1200" placeholder="Mahsulot sifati, o‘lchami, qulayligi haqida yozing...">${esc(existing?.comment||"")}</textarea><label class="guli-photo-label"><span>📷 Rasm qo‘shish</span><small>3 tagacha</small></label><input type="file" accept="image/*" multiple><div class="guli-photo-preview"></div><div class="guli-review-modal-actions"><button type="button" class="guli-review-cancel">Bekor qilish</button><button type="button" class="guli-review-send" disabled>E’lon qilish</button></div></div>`;
    document.body.appendChild(modal);let rating=Number(existing?.rating)||0;const starsEls=[...modal.querySelectorAll("[data-star]")];const send=modal.querySelector(".guli-review-send");const text=modal.querySelector("textarea");const input=modal.querySelector("input[type=file]");const preview=modal.querySelector(".guli-photo-preview");let photos=[];
    const paint=()=>{starsEls.forEach(b=>b.classList.toggle("on",Number(b.dataset.star)<=rating));send.disabled=rating<1||text.value.trim().length<3};starsEls.forEach(b=>b.addEventListener("click",()=>{rating=Number(b.dataset.star);paint()}));text.addEventListener("input",paint);
    input.addEventListener("change",async()=>{photos=[];preview.innerHTML="";for(const file of [...input.files].slice(0,3)){try{const data=await compressImage(file);photos.push(data);const im=document.createElement("img");im.src=data;preview.appendChild(im);}catch{}}});
    modal.querySelector(".guli-review-cancel").addEventListener("click",()=>modal.remove());modal.addEventListener("click",e=>{if(e.target===modal)modal.remove()});
    send.addEventListener("click",async()=>{send.disabled=true;send.textContent="Yuborilmoqda…";try{const result=await request("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product_code:code,rating,comment:text.value.trim(),photos})});modal.remove();toast(result.message||"Sharh e’lon qilindi ✓");window.dispatchEvent(new CustomEvent("guli:reviews-updated"));}catch(error){toast(error.message);send.disabled=false;send.textContent="E’lon qilish";}});paint();
  }

  async function enhanceReviews(root){
    if(!root||root.dataset.reviewsReady)return;const code=(root.querySelector(".productCodeLabel")?.textContent||"").replace(/\D/g,"");const title=root.querySelector(".detailContent h1")?.textContent?.trim()||"";if(!/^\d{6}$/.test(code)&&!title)return;root.dataset.reviewsReady="loading";
    const anchor=root.querySelector(".recommendSection")||root.lastElementChild;const section=document.createElement("section");section.className="guli-reviews";section.innerHTML=`<div class="guli-review-head"><div><div class="guli-review-kicker">HAQIQI MIJOZLAR FIKRI</div><h2 class="guli-review-title">Baholar va sharhlar</h2><div class="guli-review-sub">Faqat mahsulotni yetkazib olgan mijozlar baho va sharh qoldira oladi.</div></div></div><div class="guli-review-summary"><div class="guli-score"><strong>—</strong><div>☆☆☆☆☆</div><small>yuklanmoqda</small></div><div class="guli-bars"></div></div><button class="guli-review-action primary" type="button">Baho berish</button><div class="guli-review-note">✓ <b>Shaffof tizim:</b> telefon va Telegram IDsi ommaga ko‘rsatilmaydi. “Tasdiqlangan xarid” belgisi yetkazilgan buyurtma orqali tekshiriladi.</div><div style="margin:16px 0 8px;font-size:13px;font-weight:800">Mijozlar sharhlari</div><div class="guli-review-list"></div>`;
    if(anchor)anchor.insertAdjacentElement("beforebegin",section);else root.appendChild(section);
    try{
      const result=await request(`/api/reviews?product_code=${encodeURIComponent(code)}`);const d=result.data||{};const score=section.querySelector(".guli-score");score.innerHTML=`<strong>${Number(d.total_average||0).toFixed(1)}</strong><div>${stars(d.total_average)}</div><small>${Number(d.total_count||0)} ta sharh</small>`;const bars=section.querySelector(".guli-bars");const dist=Array.isArray(d.distribution)?d.distribution:[];const max=Math.max(1,...dist.map(x=>Number(x.count)||0));bars.innerHTML=dist.map(x=>`<div class="guli-bar"><span>${x.star}★</span><span class="guli-track"><i style="width:${Math.round((Number(x.count)||0)/max*100)}%"></i></span><span>${x.count||0}</span></div>`).join("");
      const list=section.querySelector(".guli-review-list");const reviews=Array.isArray(d.reviews)?d.reviews:[];list.innerHTML=reviews.length?reviews.map(r=>{const date=new Date(r.created_at);const dateText=Number.isNaN(date.getTime())?"":date.toLocaleDateString("uz-UZ");const photos=Array.isArray(r.photos)?r.photos:[];return `<article class="guli-review-card"><div class="guli-review-user"><div><b>${esc(r.display_name||"GULI mijozi")}</b><div class="guli-review-date">${esc(dateText)}</div></div><div>${stars(r.rating)}</div></div>${r.verified_purchase?`<span class="guli-verified">✓ Tasdiqlangan xarid</span>`:""}<div class="guli-review-text">${esc(r.comment)}</div>${photos.length?`<div class="guli-review-photos">${photos.slice(0,3).map(p=>`<img src="${esc(p)}" alt="Mijoz rasmi" loading="lazy">`).join("")}</div>`:""}</article>`}).join(""):"<div class=\"guli-review-empty\">Hozircha alohida mijoz sharhlari yo‘q.</div>";
      const action=section.querySelector(".guli-review-action");if(!initData()){action.textContent="Telegram orqali baho berish";action.addEventListener("click",()=>toast("Baho berish uchun Mini App'ni Telegram ichida oching."));}else{const eligibility=await request(`/api/reviews/can-review?product_code=${encodeURIComponent(code)}`).catch(()=>({data:{eligible:false,reason:"Baho berish imkonini tekshirib bo‘lmadi."}}));const ed=eligibility.data||{};if(ed.eligible&&!ed.existing){action.textContent="★ Baho berish va sharh qoldirish";action.addEventListener("click",()=>openReviewModal(code,null));}else if(ed.existing){action.textContent="✓ Siz bu buyurtma uchun baho bergansiz";action.classList.remove("primary");action.addEventListener("click",()=>openReviewModal(code,ed.existing));}else{action.textContent="Baho berish — yetkazilgandan keyin";action.classList.remove("primary");action.addEventListener("click",()=>toast(ed.reason||"Faqat yetkazilgan buyurtmadan keyin baho berish mumkin."));}}
    }catch{section.querySelector(".guli-review-summary").innerHTML=`<div class="guli-review-empty" style="grid-column:1/-1">Sharhlar hozircha mavjud emas.</div>`;section.querySelector(".guli-review-list").innerHTML="";const action=section.querySelector(".guli-review-action");action.textContent="Baho berish";action.addEventListener("click",()=>toast("Sharhlar hozircha yuklanmadi."));}
    root.dataset.reviewsReady="1";
  }

  function addShareButton(root){if(root.dataset.shareReady)return;const content=root.querySelector(".detailContent");if(!content)return;const title=content.querySelector("h1")?.textContent?.trim()||"GULI Premium";const button=document.createElement("button");button.type="button";button.className="guli-share";button.textContent="↗ Mahsulotni ulashish";button.addEventListener("click",async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title,text:`${title} — GULI Premium`,url});else{await navigator.clipboard.writeText(url);toast("Mahsulot havolasi nusxalandi ✓");}}catch{}});const primary=content.querySelector(".primaryButton");if(primary)primary.insertAdjacentElement("afterend",button);else content.appendChild(button);root.dataset.shareReady="1";}

  function scan(){const root=document.querySelector(".productDetail");if(root){enhanceReviews(root);addShareButton(root);}const error=[...document.querySelectorAll(".empty")].find(e=>/Yuklashda xatolik|Catalog vaqtincha|Mahsulotlarni yuklashda xatolik/i.test(e.textContent||""));if(error&&!error.querySelector(".guli-catalog-retry")){const b=document.createElement("button");b.className="guli-catalog-retry";b.textContent="↻ Qayta urinish";b.onclick=()=>{sessionStorage.setItem("guli_catalog_retry","1");location.reload()};error.appendChild(b);if(!sessionStorage.getItem("guli_catalog_retry"))setTimeout(()=>location.reload(),1200);}else if(!error)sessionStorage.removeItem("guli_catalog_retry");}
  const observer=new MutationObserver(scan);observer.observe(document.body,{childList:true,subtree:true});setTimeout(scan,250);setTimeout(scan,900);setTimeout(scan,1800);

  const top=document.createElement("button");top.type="button";top.className="guli-top-button";top.textContent="↑";top.setAttribute("aria-label","Yuqoriga");top.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});document.body.appendChild(top);window.addEventListener("scroll",()=>top.classList.toggle("show",window.scrollY>600),{passive:true});
})();