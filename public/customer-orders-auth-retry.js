// Production auth hydration bridge for customer orders.
// Supabase remains the source of truth; this only retries a request when the
// browser/Telegram session becomes available a moment after the first render.
(function(){'use strict';if(window.__GULI_CUSTOMER_ORDER_AUTH_RETRY__)return;window.__GULI_CUSTOMER_ORDER_AUTH_RETRY__=true;
function token(){try{var direct=String(localStorage.getItem('guli_access_token')||'').trim();if(direct)return direct;var raw=localStorage.getItem('guli_supabase_auth_token');var j=raw?JSON.parse(raw):null;return String(j?.access_token||j?.currentSession?.access_token||j?.session?.access_token||'').trim()}catch{return''}}
function isOrder(url){return /\/api\/(customer\/orders|orders)(?:[/?]|$)/i.test(String(url||''))}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
var previous=window.fetch.bind(window);
window.fetch=async function(input,init){var url=typeof input==='string'?input:(input&&input.url)||'';if(!isOrder(url))return previous(input,init);var options=init?Object.assign({},init):{};var h=new Headers(options.headers||(input&&input.headers)||{});var tg=window.Telegram&&window.Telegram.WebApp;if(tg&&tg.initData)h.set('X-Telegram-Init-Data',tg.initData);else{var t=token();if(t)h.set('Authorization','Bearer '+t)}options.headers=h;options.cache='no-store';var res=await previous(input,options);if(res.status!==401)return res;
for(var i=0;i<4;i++){await wait(300);var retryHeaders=new Headers(options.headers||{});var liveTg=window.Telegram&&window.Telegram.WebApp;if(liveTg&&liveTg.initData)retryHeaders.set('X-Telegram-Init-Data',liveTg.initData);else{var live=token();if(live)retryHeaders.set('Authorization','Bearer '+live)}options.headers=retryHeaders;res=await previous(input,options);if(res.status!==401)break}
return res};})();
