// After a successful receipt upload, reliably reopen the server-backed Buyurtmalarim view.
(function(){
  'use strict';
  if(window.__GULI_RECEIPT_ORDER_RETURN__) return;
  window.__GULI_RECEIPT_ORDER_RETURN__=true;
  var previous=window.fetch.bind(window);
  var FLAG='guli_open_orders_after_receipt_v2';
  function clickText(text){
    var nodes=[...document.querySelectorAll('button,[role="button"],a,div')];
    var hit=nodes.find(function(el){var t=String(el.textContent||'').replace(/\s+/g,' ').trim();return t===text||t.indexOf(text)>-1&&t.length<90});
    if(hit){hit.click();return true}return false;
  }
  function openOrders(){
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(clickText('👤')||clickText('Profil')||clickText('Shaxsiy')){
        setTimeout(function(){clickText('Buyurtmalarim')||clickText('Buyurtmalarim tarixi')},500);
        clearInterval(timer);
      } else if(tries>=12){
        clickText('Buyurtmalarim');
        clearInterval(timer);
      }
    },300);
  }
  window.fetch=async function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||'';
    var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
    var isReceipt=/\/api\/(orders|customer\/orders)\/[^/]+\/(receipt|payment-receipt)(?:[/?]|$)/i.test(url)&&method==='POST';
    var res=await previous(input,init);
    if(isReceipt&&res.ok){
      try{var j=await res.clone().json();if(j?.success){sessionStorage.setItem(FLAG,'1');setTimeout(function(){location.reload()},250)}}catch{}
    }
    return res;
  };
  if(sessionStorage.getItem(FLAG)==='1'){
    sessionStorage.removeItem(FLAG);
    setTimeout(openOrders,1200);
  }
})();
