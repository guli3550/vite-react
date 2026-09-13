// Unified customer order identity/reload bridge.
(() => {
'use strict';
if (window.__GULI_CUSTOMER_ORDERS_UNIFIED_FIX2__) return;
window.__GULI_CUSTOMER_ORDERS_UNIFIED_FIX2__=true;
const nativeFetch=window.fetch.bind(window);
const isOrder=(u)=>/\/api\/(customer\/orders|orders|auth\/orders)(?:[/?]|$)/i.test(String(u||''));
const token=()=>String(localStorage.getItem('guli_access_token')||'').trim();
window.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:input?.url||'';
 if(!isOrder(url)) return nativeFetch(input,init);
 const h=new Headers(init?.headers||{}), tg=window.Telegram?.WebApp;
 if(tg?.initData){h.set('X-Telegram-Init-Data',tg.initData);h.delete('Authorization');}
 else {const t=token();if(t)h.set('Authorization','Bearer '+t);}
 const r=await nativeFetch(input,{...(init||{}),headers:h,cache:'no-store'});
 if(!r.ok)return r;
 try{
  const j=await r.clone().json();
  if(j?.success&&Array.isArray(j.data)){
   j.data=j.data.map(o=>({...o,id:String(o.order_number||o.id||''),order_number:String(o.order_number||o.id||'')}));
  }
  return new Response(JSON.stringify(j),{status:r.status,statusText:r.statusText,headers:r.headers});
 }catch{return r;}
};
})();
