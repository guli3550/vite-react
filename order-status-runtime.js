// Live customer order status UI for Telegram Mini App.
(() => {
  const API = (location.hostname.includes('vercel.app') ? 'https://guli-lingerie-api.onrender.com' : '').replace(/\/$/, '');
  const tg = () => window.Telegram?.WebApp;
  const statusOrder = ['Qabul qilindi', 'Tayyorlanmoqda', 'Yo‘lda', 'Yetkazildi'];
  const normalize = (v) => String(v || '').replace(/[’‘]/g, "'").trim().toLowerCase();
  const headers = () => {
    const h = { 'Content-Type': 'application/json' };
    if (tg()?.initData) h['X-Telegram-Init-Data'] = tg().initData;
    else { const guest = localStorage.getItem('guli_guest_token'); if (guest) h['X-Guli-Guest-Token'] = guest; }
    return h;
  };
  const style = document.createElement('style');
  style.textContent = `
    .guli-live-order-status{margin:14px 0 0;padding:14px 15px;border:1px solid #eadde1;border-radius:18px;background:linear-gradient(135deg,#fff8f9,#fff);box-shadow:0 5px 18px rgba(75,35,45,.05)}
    .guli-live-order-status .guli-status-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
    .guli-live-order-status .guli-status-title{font-size:13px;font-weight:850;color:#5d4a50}
    .guli-live-order-status .guli-status-pill{font-size:11px;font-weight:850;color:#a64c64;background:#f8e4e9;border-radius:999px;padding:6px 9px;white-space:nowrap}
    .guli-live-order-status .guli-status-track{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .guli-live-order-status .guli-status-step{font-size:9px;line-height:1.2;color:#a39499;text-align:center}
    .guli-live-order-status .guli-status-dot{width:20px;height:20px;border-radius:50%;margin:0 auto 5px;display:grid;place-items:center;border:1px solid #eadde1;background:#fff;font-size:10px}
    .guli-live-order-status .guli-status-step.active{color:#a64c64;font-weight:800}.guli-live-order-status .guli-status-step.active .guli-status-dot{background:#f5dce2;border-color:#d77d93;color:#9d405b}.guli-live-order-status .guli-status-step.current .guli-status-dot{box-shadow:0 0 0 4px rgba(185,90,112,.11)}
    .guli-live-payment{margin-top:8px;font-size:10px;color:#78686e}.guli-receipt-card{margin-top:12px;padding:12px;border:1px solid #eadde1;border-radius:15px;background:#fff}.guli-receipt-card img{display:block;width:100%;max-height:320px;object-fit:contain;border-radius:10px;background:#f8fafc}.guli-receipt-link{display:inline-flex;margin-top:8px;padding:8px 12px;border-radius:10px;background:#f8e4e9;color:#9d405b;text-decoration:none;font-size:11px;font-weight:800}.guli-legacy-status{display:none!important}
  `;
  document.head.appendChild(style);
  const statusMarkup = (status, paymentStatus) => {
    const current=normalize(status),index=statusOrder.findIndex(s=>normalize(s)===current),cancelled=current.includes('bekor');
    const steps=statusOrder.map((label,i)=>{const active=!cancelled&&index>=i,currentStep=!cancelled&&normalize(label)===current;return `<div class="guli-status-step ${active?'active':''} ${currentStep?'current':''}"><div class="guli-status-dot">${active?'✓':i+1}</div>${label}</div>`}).join('');
    const payment=paymentStatus==='verified'?'💳 To‘lov tasdiqlandi':paymentStatus==='receipt_uploaded'?'💳 Chek admin tekshiruvda':paymentStatus==='rejected'?'💳 Chek qayta yuborilishi kerak':'';
    return `<div class="guli-live-order-status"><div class="guli-status-head"><span class="guli-status-title">Buyurtma holati</span><span class="guli-status-pill">${cancelled?'Bekor qilindi':status}</span></div><div class="guli-status-track">${steps}</div>${payment?`<div class="guli-live-payment">${payment}</div>`:''}</div>`;
  };
  const findCard = (orderNumber) => { const nodes=[...document.querySelectorAll('body *')].filter(el=>el.children.length>0&&String(el.textContent||'').includes(orderNumber));let best=null;for(const node of nodes){const text=String(node.textContent||'');if(text.length<120||text.length>1800)continue;if(!best||text.length<String(best.textContent||'').length)best=node}return best; };
  const renderReceipt = (card,state) => {
    card.querySelector('.guli-receipt-card')?.remove();
    if(normalize(state?.payment_status)!=='verified'||!state?.receipt_available||!state?.receipt_url)return;
    const box=document.createElement('div');box.className='guli-receipt-card';const url=String(state.receipt_url);const isPdf=/\.pdf(?:\?|$)/i.test(url);
    const title=document.createElement('div');title.textContent='🧾 To‘lov cheki';title.style.cssText='font-size:12px;font-weight:850;color:#5d4a50;margin-bottom:8px';box.appendChild(title);
    if(isPdf){const pdf=document.createElement('div');pdf.textContent='📄 PDF chek tasdiqlangan';pdf.style.cssText='padding:18px;text-align:center;background:#f8fafc;border-radius:10px;font-size:12px';box.appendChild(pdf)}else{const img=document.createElement('img');img.src=url;img.alt='To‘lov cheki';img.loading='lazy';box.appendChild(img)}
    const link=document.createElement('a');link.className='guli-receipt-link';link.href=url;link.target='_blank';link.rel='noreferrer';link.textContent='👁 Chekni ko‘rish';box.appendChild(link);card.appendChild(box);
  };
  const renderOrder = (order) => {if(!order?.order_number)return;const card=findCard(String(order.order_number));if(!card)return;card.querySelector('.guli-live-order-status')?.remove();const old=[...card.querySelectorAll('*')].find(el=>{const t=String(el.textContent||'').replace(/\s+/g,'').toLowerCase();return /^1qabulqilingan2tayyorlanmoqda3yo'lda4yetkazildi/.test(t)});if(old)old.classList.add('guli-legacy-status');card.insertAdjacentHTML('beforeend',statusMarkup(order.status||'Qabul qilindi',order.payment_status));};
  const syncReceipt = async (orderNumber,card) => {if(!orderNumber||!card)return;try{const r=await fetch(`${API}/api/orders/${encodeURIComponent(orderNumber)}/payment-state`,{headers:headers(),cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.success||!j.data)return;renderReceipt(card,j.data)}catch{}};
  const sync = async () => {try{const r=await fetch(`${API}/api/orders`,{headers:headers(),cache:'no-store'});const j=await r.json();if(!r.ok||!j.success||!Array.isArray(j.data))return;localStorage.setItem('guli_orders_last_sync',new Date().toISOString());j.data.forEach(order=>{renderOrder(order);void syncReceipt(String(order.order_number),findCard(String(order.order_number)))})}catch{}};
  const scan=()=>{try{const raw=localStorage.getItem('orders');const orders=raw?JSON.parse(raw):[];if(Array.isArray(orders))orders.forEach(renderOrder)}catch{}};
  new MutationObserver(()=>scan()).observe(document.body,{childList:true,subtree:true});setTimeout(scan,700);setTimeout(sync,1400);setInterval(sync,15000);window.addEventListener('focus',sync);
})();
