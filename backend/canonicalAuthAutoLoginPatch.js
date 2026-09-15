(() => {
  const crypto=require('crypto');
  const {createClient}=require('@supabase/supabase-js');
  const {install}=require('./routeRegistry.js');
  const KEY=process.env.SUPABASE_SECRET_KEY||'guli-auth';
  const hash=v=>crypto.createHmac('sha256',KEY).update(String(v)).digest('hex');
  const normalizePhone=v=>{let x=String(v||'').trim().replace(/[^\d+]/g,'');if(x.startsWith('00'))x='+'+x.slice(2);if(!x.startsWith('+'))x='+'+x;return x};
  const validPhone=v=>/^\+[1-9]\d{7,14}$/.test(v);
  const pending=global.__GULI_AUTO_AUTH_OTP__||(global.__GULI_AUTO_AUTH_OTP__=new Map());
  const supabase=createClient(process.env.SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});

  install('post','/api/telegram/webhook',async(req,res,next)=>{
    try{
      const expected=String(process.env.TELEGRAM_WEBHOOK_SECRET||'').trim();
      if(expected && req.headers['x-telegram-bot-api-secret-token']!==expected) return res.sendStatus(401);
      const m=req.body?.message,c=m?.contact,from=Number(m?.from?.id||m?.chat?.id||0),chat=Number(m?.chat?.id||0);
      if(c?.phone_number&&from&&Number(c.user_id)===from){
        const phone=normalizePhone(c.phone_number);
        if(validPhone(phone)){
          const {data:s}=await supabase.from('auth_sessions').select('session_id').eq('telegram_id',from).eq('is_verified',false).eq('exchange_ticket_used',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
          if(s){
            const otp=crypto.randomInt(100000,1000000).toString();
            const {error}=await supabase.from('auth_sessions').update({phone_number:phone,otp_hash:hash(otp),otp_attempts:0}).eq('session_id',s.session_id).eq('is_verified',false).eq('exchange_ticket_used',false);
            if(error) throw error;
            pending.set(s.session_id,{otp,expires:Date.now()+180000});
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat,text:'✅ Telefon raqamingiz tasdiqlandi. Brauzer avtomatik ravishda tizimga kiritmoqda.',reply_markup:{remove_keyboard:true}})});
            return res.sendStatus(200);
          }
        }
      }
    }catch(e){console.warn('[GULI auto auth]',e.message)}
    return next();
  });

  install('post','/api/v1/auth/exchange',async(req,res)=>{
    const id=String(req.body?.session_id||''),item=pending.get(id);
    if(!item||item.expires<Date.now()){pending.delete(id);return res.status(401).json({success:false,message:'Auto login sessiyasi tayyor emas.'})}
    pending.delete(id);
    try{
      const base=`http://127.0.0.1:${process.env.PORT||3000}`;
      const r=await fetch(`${base}/api/v1/auth/verify-otp`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:id,otp:item.otp})});
      return res.status(r.status).json(await r.json());
    }catch(e){return res.status(503).json({success:false,message:'Auth serverga ulanish imkoni bo‘lmadi.'})}
  });
})();
