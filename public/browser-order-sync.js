(() => {
  'use strict';
  const API='/api';
  const ACCESS='guli_access_token';
  const SNAPSHOT='guli_server_orders_snapshot_v2';
  const FP='guli_server_orders_fingerprint_v2';
  const NOTE='guli_last_order_status_notification_v2';
  let running=false;

  const token=()=>{
    const direct=localStorage.getItem(ACCESS)||'';
    if(direct)return direct;
    try{
      const raw=localStorage.getItem('guli_supabase_auth_token');
      const j=raw?JSON.parse(raw):null;
      return j?.access_token||j?.currentSession?.access_token||'';
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
    id:String(r.order_number||r.id||''),
    order_number:r.order_number,
    first_name:r.first_name,
    last_name:r.last_name,
    customer_name:r.customer_name,
    phone:r.phone||'',
    items:Array.isArray(r.items)?r.items:[],
    subtotal:Number(r.subtotal||0),
    delivery:Number(r.delivery||0),
    discount:Number(r.discount||0),
    total:Number(r.total||0),
    address:r.address,
    payment:r.payment||'',
    payment_status:r.payment_status||'pending',
    payment_receipt_path:r.payment_receipt_path,
    status:r.status||'⏳ Buyurtma kutilmoqda',
    createdAt:r.created_at||r.createdAt||new Date().toISOString(),
    updatedAt:r.updated_at||r.updatedAt,
    statusUpdatedAt:r.status_updated_at||r.updated_at
  });

  const fp=o=>(o||[]).map(x=>[x.id,x.status,x.payment_status,x.updatedAt,x.statusUpdatedAt].join('|')).join('||');

  const toast=text=>{
    let e=document.querySelector('[data-guli-order-sync-toast]');
    if(!e){
      e=document.createElement('div');
      e.dataset.guliOrderSyncToast='1';
      e.style.cssText='position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:100001;background:#261e20;color:#fff;padding:13px 16px;border-radius:16px;font:700 13px/1.35 system-ui;max-width:calc(100vw - 30px);text-align:center;box-shadow:0 12px 35px rgba(0,0,0,.25)';
      document.body.appendChild(e)
    }
    e.textContent=text;
    clearTimeout(e._timer);
    e._timer=setTimeout(()=>e.remove(),2600)
  };

  async function sync(){
    if(running||!hasSession())return;
    running=true;
    try{
      const r=await fetch(`${API}/customer/orders`,{headers:headers(),cache:'no-store',credentials:'same-origin'});
      if(!r.ok)return;
      const j=await r.json().catch(()=>null);
      if(!j?.success||!Array.isArray(j.data))return;

      const current=j.data.map(normalize).filter(x=>x.id);
      let previous=[];
      try{
        previous=JSON.parse(localStorage.getItem(SNAPSHOT)||'[]');
        if(!Array.isArray(previous))previous=[];
      }catch{}

      const oldFp=localStorage.getItem(FP)||'';
      const newFp=fp(current);
      const changedStatus=[];
      if(oldFp&&newFp!==oldFp){
        const map=new Map(previous.map(x=>[x.id,x]));
        for(const next of current){
          const old=map.get(next.id);
          if(old&&old.status!==next.status)changedStatus.push({old,next});
        }
      }

      // Keep the local cache in sync, but NEVER reload the page. App.tsx already
      // polls the canonical order endpoint and will update its React state.
      localStorage.setItem('orders',JSON.stringify(current));
      localStorage.setItem('guli_orders',JSON.stringify(current));
      localStorage.setItem(SNAPSHOT,JSON.stringify(current));
      localStorage.setItem(FP,newFp);

      if(changedStatus.length){
        const change=changedStatus[0];
        toast(`📦 ${change.next.id}: buyurtma holati o‘zgardi — ${change.next.status}`);
        localStorage.setItem(NOTE,JSON.stringify({
          id:change.next.id,
          from:change.old.status,
          to:change.next.status,
          at:new Date().toISOString()
        }));
        window.dispatchEvent(new CustomEvent('guli_orders_updated',{detail:current}));
      }
    }catch{}
    finally{running=false}
  }

  setTimeout(sync,500);
  setInterval(sync,5000);
})();
