(() => {
  'use strict';
  if (window.__GULI_CUSTOMER_ORDERS_LIVE_V3__) return;
  window.__GULI_CUSTOMER_ORDERS_LIVE_V3__ = true;

  const API = String(window.__GULI_API_URL || 'https://guli-lingerie-api.onrender.com').replace(/\/$/, '');
  const nativeFetch = window.fetch.bind(window);
  const STEPS = [
    ['Buyurtma kutilmoqda','📝'],
    ['Qabul qilindi','✓'],
    ['Tayyorlanmoqda','⚙'],
    ['Yo‘lda','🚚'],
    ['Yetkazildi','✓']
  ];

  function getToken() {
    const direct = String(window.__GULI_SUPABASE_ACCESS_TOKEN || localStorage.getItem('guli_access_token') || '').trim();
    if (direct) return direct;
    const keys = ['guli_supabase_auth_token'];
    try { for (let i=0;i<localStorage.length;i++) { const k=localStorage.key(i)||''; if (/supabase.*auth|auth.*supabase/i.test(k)) keys.push(k); } } catch {}
    for (const key of keys) {
      try {
        const j = JSON.parse(localStorage.getItem(key)||'null');
        const t = j?.access_token || j?.currentSession?.access_token || j?.session?.access_token || j?.data?.session?.access_token;
        if (t) return String(t).trim();
      } catch {}
    }
    return '';
  }
  function getPhone() {
    const a=[localStorage.getItem('guli_phone'),localStorage.getItem('guli_customer_phone'),localStorage.getItem('guli_last_order_phone')];
    try { const u=JSON.parse(localStorage.getItem('guli_auth_user')||'null'); a.push(u?.phone,u?.user_metadata?.phone); } catch {}
    for (const v of a) { const p=String(v||'').replace(/\D/g,''); if(p.length>=7)return p; }
    return '';
  }
  function headers(){
    const h={Accept:'application/json'};
    const tg=String(window.Telegram?.WebApp?.initData||'').trim();
    if(tg)h['X-Telegram-Init-Data']=tg; else { const t=getToken(); if(t)h.Authorization=`Bearer ${t}`; }
    const p=getPhone(); if(p)h['X-Customer-Phone']=p;
    return h;
  }
  function apiUrl(){
    const u=new URL(`${API}/api/orders`); const p=getPhone();
    const tg=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'').trim();
    if(p)u.searchParams.set('phone',p); if(tg)u.searchParams.set('telegram_id',tg); return u.toString();
  }
  function norm(r){const id=String(r?.order_number||r?.id||'').trim();return {...r,id,order_number:id,status:String(r?.status||'⏳ Buyurtma kutilmoqda')};}
  function index(status){
    const s=String(status||'').toLowerCase().replace(/[‘’]/g,"'");
    if(s.includes('bekor'))return -1; if(s.includes('yetkazildi'))return 4;
    if(s.includes('yo')&&s.includes('lda'))return 3; if(s.includes('tayyorlan'))return 2;
    if(s.includes('qabul qil'))return 1; return 0;
  }
  function findId(el){const m=String(el?.textContent||'').match(/GULI-\d{4,}/i);return m?m[0].toUpperCase():'';}
  function rootFor(el){
    let n=el;
    for(let i=0;i<10&&n;i++,n=n.parentElement){
      if(findId(n) && (n.querySelector?.('.orderBottom') || n.querySelector?.('.orderStatus') || n.querySelector?.('.statusTimeline'))) return n;
    }
    return null;
  }
  function ensure(root,order){
    let box=root.querySelector('[data-guli-order-stepper-v3]');
    if(!box){box=document.createElement('div');box.dataset.guliOrderStepperV3='1';const b=root.querySelector('.orderBottom');if(b?.parentNode)b.parentNode.insertBefore(box,b);else root.appendChild(box);}
    const idx=index(order.status);
    box.innerHTML=`<div class="guliOrderStepperV3" role="list" aria-label="Buyurtma holati">${STEPS.map((s,i)=>{
      const state=idx<0?'future':i<idx?'done':i===idx?'current':'future';
      const line=i<4?`<i class="guliOrderStepLineV3 ${idx>=0&&i<idx?'done':''}"></i>`:'';
      return `<div class="guliOrderStepV3 ${state}" role="listitem"><span>${state==='done'?'✓':s[1]}</span><b>${s[0]}</b></div>${line}`;
    }).join('')}</div>`+(idx<0?'<div class="guliOrderCancelledV3">✕ Buyurtma bekor qilindi</div>':'');
  }
  function patch(root,order){
    const st=String(order.status||'⏳ Buyurtma kutilmoqda');
    root.querySelectorAll('.orderStatus').forEach(el=>{
      const oldTime=el.querySelector('.recentStatusTime'); const time=oldTime?oldTime.outerHTML:'';
      el.textContent=`● ${st}`; if(time)el.insertAdjacentHTML('beforeend',time);
      el.classList.add('guliLiveStatusV3'); el.dataset.liveStatus=st;
    });
    const idx=index(st);
    root.querySelectorAll('.statusTimeline').forEach(t=>{
      [...t.children].filter(x=>x.nodeType===1).forEach((n,i)=>{n.classList.remove('done','current','future');n.classList.add(idx<0?'future':i<idx?'done':i===idx?'current':'future');});
    });
    ensure(root,order);
  }
  function render(data){
    const map=new Map(data.map(norm).filter(x=>x.id).map(x=>[x.id,x]));
    const roots=new Set();
    document.querySelectorAll('.ordersPageContainer .orderMain,.ordersPageContainer .statusTimeline,.ordersPageContainer .orderBottom').forEach(el=>{const r=rootFor(el);if(r)roots.add(r);});
    roots.forEach(r=>{const o=map.get(findId(r));if(o)patch(r,o);});
  }
  async function sync(){
    if(!window.Telegram?.WebApp?.initData&&!getToken()&&!getPhone())return;
    try{const r=await nativeFetch(apiUrl(),{headers:headers(),cache:'no-store'});if(!r.ok)return;const j=await r.json();if(!j?.success||!Array.isArray(j.data))return;const d=j.data.map(norm);localStorage.setItem('orders',JSON.stringify(d));localStorage.setItem('guli_orders',JSON.stringify(d));render(d);}catch{}
  }
  setTimeout(sync,500); setInterval(sync,2500);
  const observer=new MutationObserver(()=>{ if(observer._t)return; observer._t=setTimeout(()=>{observer._t=0;sync();},300); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();