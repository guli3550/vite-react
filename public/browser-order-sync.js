(() => {
  'use strict';
  const API='/api';
  const ACCESS='guli_access_token';
  const SNAPSHOT='guli_server_orders_snapshot_v4';
  const FP='guli_server_orders_status_fingerprint_v4';
  const NOTE='guli_last_order_status_notification_v4';
  const RESTORE='guli_restore_page_after_order_status_v2';
  let running=false;

  const token=()=>{
    const direct=localStorage.getItem(ACCESS)||'';
    if(direct)return direct;
    try{
      const raw=localStorage.getItem('guli_supabase_auth_token')||'';
      const j=raw?JSON.parse(raw):null;
      return j?.access_token||j?.currentSession?.access_token||j?.session?.access_token||j?.data?.session?.access_token||'';
    }catch{return ''}
  };

  const headers=()=>{
    const h={Accept:'application/json'};
    const tg=window.Telegram?.WebApp;
    if(tg?.initData)h['X-Telegram-Init-Data']=tg.initData;
    else{
      const t=token();
      if(t)h.Authorization=`Bearer ${t}`;
    }
    return h;
  };

  const hasSession=()=>Boolean(window.Telegram?.WebApp?.initData||token());
  const normalize=r=>({
    ...r,
    id:String(r.order_number||r.id||''),
    order_number:String(r.order_number||r.id||''),
    status:r.status||'⏳ Buyurtma kutilmoqda',
    payment_status:r.payment_status||'pending',
    updatedAt:r.updated_at||r.updatedAt,
    statusUpdatedAt:r.status_updated_at||r.updated_at||r.updatedAt
  });
  const statusFp=o=>(o||[]).map(x=>[x.id,x.status,x.payment_status].join('|')).join('||');

  const toast=text=>{
    let e=document.querySelector('[data-guli-order-sync-toast]');
    if(!e){
      e=document.createElement('div');
      e.dataset.guliOrderSyncToast='1';
      e.style.cssText='position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:100001;background:#261e20;color:#fff;padding:13px 16px;border-radius:16px;font:700 13px/1.35 system-ui;max-width:calc(100vw - 30px);text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.25)';
      document.body.appendChild(e);
    }
    e.textContent=text;
    clearTimeout(e._timer);
    e._timer=setTimeout(()=>e.remove(),2600);
  };

  function rememberPage(){
    try{
      if(document.querySelector('.ordersPageContainer'))sessionStorage.setItem(RESTORE,'orders');
      else if(document.querySelector('.modernProfilePage'))sessionStorage.setItem(RESTORE,'profile');
      else sessionStorage.removeItem(RESTORE);
    }catch{}
  }

  function restorePage(){
    let page='';
    try{page=sessionStorage.getItem(RESTORE)||'';sessionStorage.removeItem(RESTORE);}catch{}
    if(!page)return;
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const nodes=[...document.querySelectorAll('button,[role="button"],a')];
      const target=page==='orders'
        ?nodes.find(el=>/Buyurtmalarim/i.test(String(el.textContent||'')))
        :nodes.find(el=>/^\s*👤\s*$/.test(String(el.textContent||'')))||nodes.find(el=>/Profil|Shaxsiy/i.test(String(el.textContent||'')));
      if(target){target.click();clearInterval(timer);}
      else if(tries>=15)clearInterval(timer);
    },300);
  }

  async function sync(){
    if(running||!hasSession())return;
    running=true;
    try{
      // Always use the canonical endpoint directly. It accepts both Telegram
      // initData and Supabase Bearer sessions and is shared across clients.
      const r=await fetch(`${API}/orders`,{headers:headers(),cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return;
      const j=await r.json().catch(()=>null);
      if(!j?.success||!Array.isArray(j.data))return;
      const current=j.data.map(normalize).filter(x=>x.id);

      let previous=[];
      try{previous=JSON.parse(localStorage.getItem(SNAPSHOT)||'[]');if(!Array.isArray(previous))previous=[];}catch{}
      const oldFp=localStorage.getItem(FP)||'';
      const newFp=statusFp(current);
      const changes=[];
      if(oldFp&&newFp!==oldFp){
        const map=new Map(previous.map(x=>[x.id,x]));
        for(const next of current){
          const old=map.get(next.id);
          if(old&&(old.status!==next.status||old.payment_status!==next.payment_status))changes.push({old,next});
        }
      }

      localStorage.setItem('orders',JSON.stringify(current));
      localStorage.setItem('guli_orders',JSON.stringify(current));
      localStorage.setItem(SNAPSHOT,JSON.stringify(current));
      localStorage.setItem(FP,newFp);

      if(changes.length){
        const change=changes[0];
        rememberPage();
        try{localStorage.setItem(NOTE,JSON.stringify({id:change.next.id,from:change.old.status,to:change.next.status,at:new Date().toISOString()}));}catch{}
        toast(`📦 ${change.next.id}: buyurtma holati o‘zgardi — ${change.next.status}`);
        setTimeout(()=>location.reload(),700);
      }
    }catch{}
    finally{running=false;}
  }

  setTimeout(()=>{sync();restorePage();},500);
  setInterval(sync,5000);
})();