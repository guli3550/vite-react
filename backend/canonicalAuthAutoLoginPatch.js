(() => {
  const crypto = require('crypto');
  const { install } = require('./routeRegistry.js');
  const AUTH_KEY = process.env.SUPABASE_SECRET_KEY || 'guli-auth';
  const hash = value => crypto.createHmac('sha256', AUTH_KEY).update(String(value)).digest('hex');
  const normalizePhone = value => { let v=String(value||'').trim().replace(/[^\d+]/g,''); if(v.startsWith('00')) v='+'+v.slice(2); if(!v.startsWith('+')) v='+'+v; return v; };
  const validPhone = value => /^\+[1-9]\d{7,14}$/.test(value);
  const pending = global.__GULI_AUTO_AUTH_OTP__ || (global.__GULI_AUTO_AUTH_OTP__ = new Map());

  const webhookLayer = (app._router?.stack || []).find(layer => layer.route?.path === '/api/telegram/webhook' && layer.route?.methods?.post);
  if (webhookLayer?.route?.stack?.length) {
    const index = webhookLayer.route.stack.length - 1;
    const original = webhookLayer.route.stack[index].handle;
    webhookLayer.route.stack[index].handle = async (req,res,next) => {
      try {
        const message=req.body?.message, contact=message?.contact, fromId=Number(message?.from?.id||message?.chat?.id||0), chatId=Number(message?.chat?.id||0);
        if(contact?.phone_number && fromId && Number(contact.user_id)===fromId) {
          const phone=normalizePhone(contact.phone_number);
          if(validPhone(phone)) {
            const { createClient } = require('@supabase/supabase-js');
            const supabase=createClient(process.env.SUPABASE_URL,AUTH_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
            const {data:s}=await supabase.from('auth_sessions').select('session_id,expires_at,is_verified,exchange_ticket_used').eq('telegram_id',fromId).eq('is_verified',false).eq('exchange_ticket_used',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
            if(s){
              const otp=crypto.randomInt(100000,1000000).toString();
              await supabase.from('auth_sessions').update({phone_number:phone,otp_hash:hash(otp),otp_attempts:0}).eq('session_id',s.session_id).eq('is_verified',false).eq('exchange_ticket_used',false);
              pending.set(s.session_id,{otp,expires:Date.now()+180000});
              await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:'✅ Telefon raqamingiz tasdiqlandi. Brauzer avtomatik ravishda tizimga kiritmoqda.',reply_markup:{remove_keyboard:true}})});
              return res.sendStatus(200);
            }
          }
        }
      } catch (error) { console.warn('[GULI auto auth]',error.message); }
      return original(req,res,next);
    };
  }

  install('post','/api/v1/auth/exchange',async(req,res)=>{
    const id=String(req.body?.session_id||'');
    const item=pending.get(id);
    if(!item || item.expires<Date.now()) { pending.delete(id); return res.status(401).json({success:false,message:'Auto login sessiyasi tayyor emas.'}); }
    pending.delete(id);
    const base=`http://127.0.0.1:${process.env.PORT||3000}`;
    try {
      const r=await fetch(`${base}/api/v1/auth/verify-otp`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:id,otp:item.otp})});
      const data=await r.json();
      return res.status(r.status).json(data);
    } catch(error) { return res.status(503).json({success:false,message:'Auth serverga ulanish imkoni bo‘lmadi.'}); }
  });
})();
