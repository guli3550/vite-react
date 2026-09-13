(() => {
  'use strict';
  const API='/api', ACCESS='guli_access_token', REFRESH='guli_refresh_token';
  const getAccess=()=>localStorage.getItem(ACCESS)||'';
  const setSession=d=>{if(d?.access_token)localStorage.setItem(ACCESS,d.access_token);if(d?.refresh_token)localStorage.setItem(REFRESH,d.refresh_token);localStorage.removeItem('guli_guest_token');};
  const clearSession=()=>{localStorage.removeItem(ACCESS);localStorage.removeItem(REFRESH);localStorage.removeItem('guli_guest_token');};
  const hash=new URLSearchParams(location.hash.replace(/^#/,'')||'');if(hash.get('access_token')){setSession({access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token')||''});history.replaceState(null,'',location.pathname+location.search);}
  async function api(path,options={}){const h=new Headers(options.headers||{});h.set('Accept','application/json');if(options.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const t=getAccess();if(t)h.set('Authorization',`Bearer ${t}`);return fetch(`${API}${path}`,{...options,headers:h,cache:'no-store'});}
  function overlay(){
    if (typeof window.openGuliCustomerAuthModal === 'function') {
      window.openGuliCustomerAuthModal();
      return null;
    }
    let x=document.querySelector('[data-guli-auth-modal]');if(x)return x;
    x=document.createElement('div');x.dataset.guliAuthModal='1';
    x.innerHTML=`<div data-auth-box><button data-auth-close>×</button><h2>GULI hisobingiz</h2><p data-auth-note>Buyurtmalarni saqlash va barcha qurilmalarda ko‘rish uchun kiring.</p><button data-google>🔵 Google orqali kirish</button><div>yoki email orqali</div><input data-name placeholder="Ism familiya"><input data-email type="email" placeholder="Email"><input data-pass type="password" placeholder="Parol (kamida 8 belgi)"><div data-actions><button data-signin>Kirish</button><button data-signup>Ro‘yxatdan o‘tish</button></div></div>`;
    document.body.appendChild(x);
    x.querySelector('[data-auth-close]').onclick=()=>x.remove();
    x.addEventListener('click',e=>{if(e.target===x)x.remove()});
    x.querySelector('[data-google]').onclick=()=>{location.href=`${API}/auth/google`};
    x.querySelector('[data-signin]').onclick=()=>submitAuth('/auth/signin',false,x);
    x.querySelector('[data-signup]').onclick=()=>submitAuth('/auth/signup',true,x);
    return x;
  }
  async function submitAuth(path,signup,x){const email=x.querySelector('[data-email]').value.trim(),password=x.querySelector('[data-pass]').value,full_name=x.querySelector('[data-name]').value.trim();try{const r=await fetch(`${API}${path}`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({email,password,full_name})});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Auth xatosi');if(j.data?.access_token){setSession(j.data);x.remove();location.reload();return;}x.querySelector('[data-auth-note]').textContent=j.message||'Emailingizni tasdiqlang, so‘ng kiring.';}catch(e){x.querySelector('[data-auth-note]').textContent=e.message||'Kirishda xatolik';}}
  window.GuliAuth={open:overlay,getAccess,clear:()=>{clearSession();location.reload();},api};
  const originalFetch=window.fetch.bind(window);
  const customAuthFetch=async(input,init={})=>{const url=typeof input==='string'?input:input?.url||'';const tg=Boolean(window.Telegram?.WebApp?.initData);let target=url;if(/\/api\/guest-session(?:\?|$)/.test(target)){if(tg||getAccess())return new Response(JSON.stringify({success:true,data:{token:''}}),{status:200,headers:{'Content-Type':'application/json'}});return new Response(JSON.stringify({success:false,message:'Mehmon rejimi o‘chirildi. Avval Google/Email orqali kiring.'}),{status:401,headers:{'Content-Type':'application/json'}})}if(/\/api\/guest\/orders(?:\/|\?|$)/.test(target))target=target.replace('/api/guest/orders','/api/customer/orders');if(/\/api\/orders\/[^/]+\/receipt(?:\?|$)/.test(target))target=target.replace('/api/orders/','/api/customer/orders/');if(/^https?:\/\/[^/]*onrender\.com\/api\/orders(?:\/|\?|$)/.test(target)&&!tg&&getAccess())target=target.replace('/api/orders','/api/customer/orders');const h=new Headers(init?.headers||((typeof input!=='string'&&input?.headers)||{}));const t=getAccess();if(t)h.set('Authorization',`Bearer ${t}`);if(target!==url){h.delete('X-Guli-Guest-Token');if(!tg)h.delete('X-Telegram-Init-Data');return originalFetch(target,{...init,headers:h});}if(t)return originalFetch(input,{...init,headers:h});return originalFetch(input,init);};
  try{Object.defineProperty(window,'fetch',{value:customAuthFetch,writable:true,configurable:true});}catch(_){try{window.fetch=customAuthFetch;}catch(_){try{globalThis.fetch=customAuthFetch;}catch(_){}}}
  function requireAuth(e){if(!document.querySelector('.checkoutPage')||getAccess()||window.Telegram?.WebApp?.initData)return;const b=e.target?.closest?.('button');if(!b||!/(buyurtma|tasdiq|rasmiylasht|yakunlash|to.?lash|checkout|order)/i.test(b.textContent||''))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();overlay();}
  document.addEventListener('click',requireAuth,true);
  function injectProfile(){
    // ModernProfileView handles profile UI directly in React.
    const legacyCard = document.querySelector('[data-guli-auth-card]');
    if (legacyCard) legacyCard.remove();
  }
  async function editProfile(card){let p={};try{const r=await api('/customer/profile');const j=await r.json();p=j.data||{};}catch{}card.innerHTML=`<b>Profilni tahrirlash</b><input data-pname value="${String(p.full_name||'').replace(/"/g,'&quot;')}" placeholder="Ism familiya"><input data-pphone value="${String(p.phone||'').replace(/"/g,'&quot;')}" placeholder="Telefon raqam"><button data-save-profile>Saqlash</button>`;card.querySelector('[data-save-profile]').onclick=async()=>{const r=await api('/customer/profile',{method:'PUT',body:JSON.stringify({full_name:card.querySelector('[data-pname]').value,phone:card.querySelector('[data-pphone]').value})});const j=await r.json();card.innerHTML=j.success?'<b>✓ Profil saqlandi</b>':'<b>Profilni saqlashda xatolik</b>';setTimeout(injectProfile,800);};}
  const style=document.createElement('style');style.textContent='[data-guli-auth-modal]{position:fixed;inset:0;z-index:100000;background:rgba(20,12,15,.55);display:grid;place-items:center;padding:16px}[data-auth-box]{width:min(440px,100%);background:#fff;border-radius:24px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:10px}[data-auth-box] input{padding:12px;border:1px solid #ddd;border-radius:12px}[data-auth-box] button{padding:11px;border:0;border-radius:12px;font-weight:800}[data-actions]{display:grid;grid-template-columns:1fr 1fr;gap:8px}';document.head.appendChild(style);new MutationObserver(injectProfile).observe(document.documentElement,{childList:true,subtree:true});setTimeout(injectProfile,800);
})();
