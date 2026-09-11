// Anonymous browser checkout is disabled. Customer checkout must use Telegram WebApp
// identity or a Supabase Auth Google/email session. Legacy endpoints return 410 and
// cannot mint or accept browser guest identities.
const express = require('express');
let installed = false;
if (!installed) {
  installed = true;
  for (const method of ['post','get']) {
    const original = express.application[method];
    express.application[method] = function guestModeGuard(path, ...handlers) {
      if (path === '/api/guest-session' || path === '/api/guest/orders' || path === '/api/guest/orders/:orderNumber/receipt') {
        return original.call(this, path, (_req,res) => res.status(410).json({ success:false, message:'Mehmon rejimi o‘chirildi. Google/Email yoki Telegram orqali autentifikatsiya qiling.' }));
      }
      return original.call(this, path, ...handlers);
    };
  }
}
