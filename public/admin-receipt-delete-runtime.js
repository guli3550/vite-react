(() => {
  'use strict';
  const API=()=> (window.__GULI_API_URL||'https://guli-lingerie-api.onrender.com').replace(/\/$/,'');
  const token=()=>sessionStorage.getItem('guli_admin_token')||'';
  const scan=()=>{
    const table=[...document.querySelectorAll('table')].find(t=>/Kartadan to‘lovlar va Cheklar|CARD PAYMENTS & RECEIPTS/i.test(t.parentElement?.textContent||''));
    if(!table)return;
    [...table.querySelectorAll('tbody tr')].forEach(row=>{
      if(row.dataset.guliReceiptDelete==='1')return;
      const cells=[...row.children];if(cells.length<9)return;
      const receipt=row.querySelector('td:first-child img');if(!receipt)return;
      const buttons=row.children[8]?.querySelectorAll('button');if(!buttons?.length)return;
      const orderText=String(row.children[2]?.textContent||'').trim();
      const tx=[...buttons].find(b=>/Chek yuklash/i.test(b.textContent||''));if(!tx)return;
      const id=String(row.querySelector('.promoCode')?.textContent||'').replace(/^TX-/,'').trim();
      const dbId=row.dataset.orderDbId||'';
      if(!dbId)return;
      const del=document.createElement('button');del.type='button';del.className='dangerBtn miniBtn';del.textContent='🗑 Chekni o‘chirish';
      del.addEventListener('click',async()=>{
        if(!confirm(`${orderText||id} uchun chekni o‘chirishni tasdiqlaysizmi?`))return;
        del.disabled=true;del.textContent='⏳ O‘chirilmoqda…';
        try{const r=await fetch(`${API()}/api/admin/orders/${encodeURIComponent(dbId)}/payment-receipt`,{method:'DELETE',headers:{Authorization:`Bearer ${token()}`}});const j=await r.json().catch(()=>({}));if(!r.ok||!j.success)throw new Error(j.message||'Chekni o‘chirishda xatolik');row.dataset.guliReceiptDelete='1';const refresh=[...document.querySelectorAll('button')].find(b=>/Yangilash/i.test(b.textContent||''));if(refresh)refresh.click();}catch(e){alert(e instanceof Error?e.message:'Chekni o‘chirishda xatolik');del.disabled=false;del.textContent='🗑 Chekni o‘chirish'}
      });
      tx.insertAdjacentElement('afterend',del);row.dataset.guliReceiptDelete='1';
    });
  };
  const observer=new MutationObserver(scan);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(scan,1200);setInterval(scan,5000);
})();
