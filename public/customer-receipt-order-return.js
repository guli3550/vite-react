// After a successful receipt upload, return the customer to Buyurtmalarim.
// This is a small DOM bridge for the existing React flow; it does not create or store data.
(function(){'use strict';if(window.__GULI_RECEIPT_ORDER_RETURN__)return;window.__GULI_RECEIPT_ORDER_RETURN__=true;
var previous=window.fetch.bind(window);
function clickText(text){var nodes=[...document.querySelectorAll('button,[role="button"],a,div')];var hit=nodes.find(function(el){var t=String(el.textContent||'').replace(/\s+/g,' ').trim();return t===text||t.indexOf(text)>-1&&t.length<80});if(hit){hit.click();return true}return false}
function goOrders(){var profile=clickText('👤');if(!profile)profile=clickText('Profil');if(!profile)profile=clickText('Buyurtmalarim');setTimeout(function(){clickText('Buyurtmalarim')},450)}
window.fetch=async function(input,init){var url=typeof input==='string'?input:(input&&input.url)||'';var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();var isReceipt=/\/api\/(orders|customer\/orders)\/[^/]+\/(receipt|payment-receipt)(?:[/?]|$)/i.test(url)&&method==='POST';var res=await previous(input,init);if(isReceipt&&res.ok){try{var j=await res.clone().json();if(j?.success)setTimeout(goOrders,350)}catch{}}return res};})();
