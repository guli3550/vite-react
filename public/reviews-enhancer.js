(() => {
  const API = "https://guli-lingerie-api.onrender.com";
  const tg = () => window.Telegram?.WebApp;
  const initData = () => tg()?.initData || "";
  const money = n => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
  const esc = value => String(value ?? "").replace(/[&<>\"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[ch]));
  const stars = rating => `<span style="letter-spacing:2px;color:#e5a43a">${"★".repeat(Math.max(0, Math.min(5, Math.round(Number(rating) || 0))))}<span style="color:#e5e1e2">${"★".repeat(5-Math.max(0, Math.min(5, Math.round(Number(rating) || 0))))}</span></span>`;

  const request = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    const token = initData();
    if (token) headers["X-Telegram-Init-Data"] = token;
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) throw new Error(data.message || "So‘rov bajarilmadi");
    return data;
  };

  const style = `
    .guli-reviews{margin:18px 12px 8px;background:#fff;border:1px solid #f0e1e4;border-radius:24px;padding:18px;box-shadow:0 8px 24px rgba(75,35,45,.045)}
    .guli-reviews *{box-sizing:border-box}.guli-review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.guli-review-kicker{font-size:9px;letter-spacing:2px;color:#a97883;font-weight:800}.guli-review-title{margin:5px 0 3px;font-size:22px;color:#21191c}.guli-review-sub{font-size:10px;color:#8d7b80;line-height:1.45}.guli-review-summary{display:grid;grid-template-columns:92px 1fr;gap:16px;align-items:center;margin:16px 0;padding:14px;border-radius:18px;background:#fff8f9;border:1px solid #f2e3e6}.guli-score{text-align:center}.guli-score strong{display:block;font-size:31px;color:#bd526a;line-height:1}.guli-score div{margin:7px 0 3px;font-size:11px}.guli-score small{font-size:9px;color:#8d7b80}.guli-bars{display:flex;flex-direction:column;gap:5px}.guli-bar{display:grid;grid-template-columns:18px 1fr 22px;gap:7px;align-items:center;font-size:9px;color:#8d7b80}.guli-track{height:6px;border-radius:9px;background:#eee6e8;overflow:hidden}.guli-track i{display:block;height:100%;border-radius:9px;background:#e2a0af}.guli-review-action{width:100%;padding:12px 14px;border:1px solid #dfacb8;background:#fff;color:#b74760;border-radius:14px;font-weight:850;font-size:11px}.guli-review-action.primary{background:#c9526b;color:#fff;box-shadow:0 8px 18px rgba(201,82,107,.16)}.guli-review-note{margin-top:9px;padding:10px 12px;border-radius:12px;background:#f8f4f5;color:#75656a;font-size:9px;line-height:1.5}.guli-review-list{display:flex;gap:10px;overflow-x:auto;padding:3px 1px 6px;scrollbar-width:none}.guli-review-list::-webkit-scrollbar{display:none}.guli-review-card{flex:0 0 250px;min-height:180px;background:#fff;border:1px solid #eee3e5;border-radius:18px;padding:13px}.guli-review-user{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.guli-review-user b{font-size:11px;color:#2b2326;display:block;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.guli-review-date{font-size:8px;color:#a09296;margin-top:3px}.guli-verified{display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 7px;border-radius:99px;background:#eaf8f0;color:#268457;font-size:8px;font-weight:800}.guli-review-text{font-size:11px;color:#51464a;line-height:1.5;margin:10px 0 8px;min-height:34px}.guli-review-photos{display:flex;gap:6px;overflow:hidden}.guli-review-photos img{width:55px;height:55px;object-fit:cover;border-radius:9px;border:1px solid #eee2e5}.guli-review-empty{padding:14px 2px;color:#8b7b80;font-size:10px}.guli-review-modal{position:fixed;inset:0;background:rgba(31,20,24,.42);z-index:10000;display:flex;align-items:flex-end;justify-content:center;padding:0}.guli-review-sheet{width:min(560px,100%);max-height:92vh;overflow:auto;background:#fffafa;border-radius:26px 26px 0 0;padding:18px 16px 28px;box-shadow:0 -10px 40px rgba(20,10,15,.18)}.guli-review-sheet h3{margin:0 0 4px;font-size:20px}.guli-review-sheet p{margin:0 0 14px;font-size:10px;color:#8b7b80}.guli-review-stars{display:flex;gap:5px;margin:12px 0 15px}.guli-review-stars button{width:40px;height:40px;border-radius:12px;background:#fff;border:1px solid #eadde0;font-size:22px;color:#d9d0d3}.guli-review-stars button.on{background:#fff1d7;border-color:#e8b75f;color:#e5a43a}.guli-review-sheet textarea{width:100%;min-height:110px;resize:vertical;border:1px solid #eadde0;border-radius:15px;padding:12px;outline:none;background:#fff;font:inherit;font-size:12px}.guli-photo-label{display:flex;align-items:center;justify-content:space-between;margin:11px 0 7px;font-size:10px;font-weight:750;color:#69595f}.guli-photo-label small{font-weight:500;color:#9a898e}.guli-review-sheet input[type=file]{width:100%;font-size:10px}.guli-photo-preview{display:flex;gap:7px;margin:8px 0}.guli-photo-preview img{width:58px;height:58px;border-radius:10px;object-fit:cover}.guli-review-modal-actions{display:flex;gap:8px;margin-top:14px}.guli-review-modal-actions button{flex:1;padding:13px;border-radius:14px;font-weight:800}.guli-review-cancel{background:#f3eef0;color:#66565c}.guli-review-send{background:#c9526b;color:#fff}.guli-review-send:disabled{opacity:.55}.guli-review-toast{position:fixed;left:14px;right:14px;bottom:95px;z-index:11000;background:#21191c;color:#fff;padding:12px 14px;border-radius:13px;text-align:center;font-size:11px;box-shadow:0 8px 24px rgba(0,0,0,.18)}
    @media(min-width:700px){.guli-reviews{margin-left:auto;margin-right:auto;max-width:900px}.guli-review-card{flex-basis:290px}.guli-review-sheet{border-radius:26px;margin-bottom:18px}}
  `;
  if (!document.getElementById("guli-reviews-style")) { const s=document.createElement("style"); s.id="guli-reviews-style"; s.textContent=style; document.head.appendChild(s); }

  function showToast(message) { const old=document.querySelector(".guli-review-toast"); old?.remove(); const el=document.createElement("div"); el.className="guli-review-toast"; el.textContent=message; document.body.appendChild(el); setTimeout(()=>el.remove(),2600); }

  function compressImage(file) {
    return new Promise(resolve => {
      const reader=new FileReader(); reader.onload=()=>{const img=new Image(); img.onload=()=>{const scale=Math.min(1,900/Math.max(img.width,img.height)); const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(img.width*scale)); canvas.height=Math.max(1,Math.round(img.height*scale)); const ctx=canvas.getContext("2d"); ctx.drawImage(img,0,0,canvas.width,canvas.height); resolve(canvas.toDataURL("image/jpeg",.72));}; img.src=String(reader.result||"");}; reader.readAsDataURL(file);
    });
  }

  function openReviewModal(code, existing) {
    const modal=document.createElement("div"); modal.className="guli-review-modal";
    modal.innerHTML=`<div class="guli-review-sheet"><h3>Mahsulotni baholang</h3><p>Sharhingiz boshqa xaridorlarga tanlov qilishda yordam beradi.</p><div class="guli-review-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}">★</button>`).join("")}</div><textarea maxlength="1200" placeholder="Mahsulot sifati, o‘lchami, qulayligi haqida yozing...">${esc(existing?.comment||"")}</textarea><label class="guli-photo-label"><span>📷 Rasm qo‘shish</span><small>3 tagacha</small></label><input type="file" accept="image/*" multiple><div class="guli-photo-preview"></div><div class="guli-review-modal-actions"><button type="button" class="guli-review-cancel">Bekor qilish</button><button type="button" class="guli-review-send" disabled>E’lon qilish</button></div></div>`;
    document.body.appendChild(modal);
    let rating=Number(existing?.rating)||0; const starButtons=[...modal.querySelectorAll("[data-star]")]; const send=modal.querySelector(".guli-review-send"); const text=modal.querySelector("textarea"); const input=modal.querySelector("input[type=file]"); const preview=modal.querySelector(".guli-photo-preview"); let photos=[];
    const paint=()=>{starButtons.forEach(b=>b.classList.toggle("on",Number(b.dataset.star)<=rating));send.disabled=rating<1||text.value.trim().length<3};
    starButtons.forEach(b=>b.addEventListener("click",()=>{rating=Number(b.dataset.star);paint()})); text.addEventListener("input",paint);
    input.addEventListener("change",async()=>{photos=[];preview.innerHTML="";for(const file of [...input.files].slice(0,3)){try{const data=await compressImage(file);photos.push(data);const im=document.createElement("img");im.src=data;preview.appendChild(im);}catch{}}});
    modal.querySelector(".guli-review-cancel").addEventListener("click",()=>modal.remove());
    send.addEventListener("click",async()=>{send.disabled=true;send.textContent="Yuborilmoqda…";try{const result=await request("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({product_code:code,rating,comment:text.value.trim(),photos})});modal.remove();showToast(result.message||"Sharh e’lon qilindi ✓");window.dispatchEvent(new CustomEvent("guli:reviews-updated"));}catch(error){showToast(error.message);send.disabled=false;send.textContent="E’lon qilish";}});
    modal.addEventListener("click",e=>{if(e.target===modal)modal.remove()}); paint();
  }

  async function enhance(root) {
    if (!root || root.dataset.reviewsReady) return;
    const code=(root.querySelector(".productCodeLabel")?.textContent||"").replace(/\D/g,"");
    const title=root.querySelector(".detailContent h1")?.textContent?.trim()||"";
    if (!/^\d{6}$/.test(code) && !title) return;
    root.dataset.reviewsReady="loading";
    const anchor=root.querySelector(".recommendSection") || root.lastElementChild;
    const section=document.createElement("section"); section.className="guli-reviews"; section.innerHTML=`<div class="guli-review-head"><div><div class="guli-review-kicker">HAQIQI MIJOZLAR FIKRI</div><h2 class="guli-review-title">Baholar va sharhlar</h2><div class="guli-review-sub">Faqat mahsulotni yetkazib olgan mijozlar baho va sharh qoldira oladi.</div></div></div><div class="guli-review-summary"><div class="guli-score"><strong>—</strong><div>☆☆☆☆☆</div><small>sharhlar yuklanmoqda</small></div><div class="guli-bars"></div></div><button class="guli-review-action primary" type="button">Baho berish</button><div class="guli-review-note">✓ <b>Shaffof tizim:</b> sharh muallifining telefoni va Telegram IDsi hech qachon ommaga ko‘rsatilmaydi. “Tasdiqlangan xarid” belgisi yetkazilgan buyurtma orqali tekshiriladi.</div><div style="margin:16px 0 8px;font-size:13px;font-weight:800">Mijozlar sharhlari</div><div class="guli-review-list"></div>`;
    if(anchor) anchor.insertAdjacentElement("beforebegin",section); else root.appendChild(section);
    try {
      const result=await request(`/api/reviews?product_code=${encodeURIComponent(code)}`); const d=result.data||{};
      const score=section.querySelector(".guli-score"); score.innerHTML=`<strong>${Number(d.total_average||0).toFixed(1)}</strong><div>${stars(d.total_average)}</div><small>${Number(d.total_count||0)} ta sharh</small>`;
      const bars=section.querySelector(".guli-bars"); const dist=Array.isArray(d.distribution)?d.distribution:[]; const max=Math.max(1,...dist.map(x=>Number(x.count)||0)); bars.innerHTML=dist.map(x=>`<div class="guli-bar"><span>${x.star}★</span><span class="guli-track"><i style="width:${Math.round((Number(x.count)||0)/max*100)}%"></i></span><span>${x.count||0}</span></div>`).join("");
      const list=section.querySelector(".guli-review-list"); const reviews=Array.isArray(d.reviews)?d.reviews:[];
      list.innerHTML=reviews.length?reviews.map(r=>{const date=new Date(r.created_at);const dateText=Number.isNaN(date.getTime())?"":date.toLocaleDateString("uz-UZ");const photos=Array.isArray(r.photos)?r.photos:[];return `<article class="guli-review-card"><div class="guli-review-user"><div><b>${esc(r.display_name||"GULI mijozi")}</b><div class="guli-review-date">${esc(dateText)}</div></div><div>${stars(r.rating)}</div></div>${r.verified_purchase?`<span class="guli-verified">✓ Tasdiqlangan xarid</span>`:""}<div class="guli-review-text">${esc(r.comment)}</div>${photos.length?`<div class="guli-review-photos">${photos.slice(0,3).map(p=>`<img src="${esc(p)}" alt="Mijoz rasmi" loading="lazy">`).join("")}</div>`:""}</article>`}).join(""):"<div class=\"guli-review-empty\">Hozircha alohida mijoz sharhlari yo‘q. Birinchi haqiqiy sharhni siz qoldirishingiz mumkin.</div>";
      const action=section.querySelector(".guli-review-action");
      if(!initData()){action.textContent="Telegram orqali baho berish";action.addEventListener("click",()=>showToast("Baho berish uchun Mini App'ni Telegram ichida oching."));}
      else {const eligibility=await request(`/api/reviews/can-review?product_code=${encodeURIComponent(code)}`).catch(()=>({data:{eligible:false,reason:"Baho berish imkonini tekshirib bo‘lmadi."}}));const ed=eligibility.data||{};if(ed.eligible&&!ed.existing){action.textContent="★ Baho berish va sharh qoldirish";action.addEventListener("click",()=>openReviewModal(code,null));}else if(ed.existing){action.textContent="✓ Siz bu buyurtma uchun baho bergansiz";action.classList.remove("primary");action.addEventListener("click",()=>openReviewModal(code,ed.existing));}else{action.textContent="Baho berish — yetkazilgandan keyin";action.classList.remove("primary");action.addEventListener("click",()=>showToast(ed.reason||"Faqat yetkazilgan buyurtmadan keyin baho berish mumkin."));}}
    } catch(error) {
      section.querySelector(".guli-review-summary").innerHTML=`<div class="guli-review-empty" style="grid-column:1/-1">Sharhlar hozircha mavjud emas.</div>`;
      section.querySelector(".guli-review-list").innerHTML="";
      const action=section.querySelector(".guli-review-action");action.textContent="Baho berish";action.addEventListener("click",()=>showToast("Sharhlar tizimi hozir sozlanmoqda."));
    }
    root.dataset.reviewsReady="1";
  }

  const scan=()=>{const root=document.querySelector(".productDetail");if(root&&!root.dataset.reviewsReady)enhance(root)};
  const observer=new MutationObserver(scan); observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(scan,700); setTimeout(scan,1800);
  window.addEventListener("guli:reviews-updated",()=>{const root=document.querySelector(".productDetail");if(root){root.dataset.reviewsReady="";root.querySelector(".guli-reviews")?.remove();enhance(root)}});
})();
