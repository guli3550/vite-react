(() => {
  const crypto=require('crypto');
  const {createClient}=require('@supabase/supabase-js');
  const {install}=require('./routeRegistry.js');
  const KEY=process.env.SUPABASE_SECRET_KEY||'guli-auth';
  const hash=v=>crypto.createHmac('sha256',KEY).update(String(v)).digest('hex');
  const normalizePhone=v=>{let x=String(v||'').trim().replace(/[^\d+]/g,'');if(x.startsWith('00'))x='+'+x.slice(2);if(!x.startsWith('+'))x='+'+x;return x};
  const validPhone=v=>/^\+[1-9]\d{7,14}$/.test(v);
  const supabase=createClient(process.env.SUPABASE_URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}});

  install('post','/api/telegram/webhook',async(req,res,next)=>{
    try{
      const m=req.body?.message,c=m?.contact,from=Number(m?.from?.id||m?.chat?.id||0),chat=Number(m?.chat?.id||0);
      if(c?.phone_number&&from&&Number(c.user_id)===from){
        const phone=normalizePhone(c.phone_number);
        if(validPhone(phone)){
          const {data:s}=await supabase.from('auth_sessions').select('session_id').eq('telegram_id',from).eq('is_verified',false).eq('exchange_ticket_used',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
          if(s){
            const otp=crypto.randomInt(100000,1000000).toString();
            const {error}=await supabase.from('auth_sessions').update({phone_number:phone,otp_hash:hash(otp),otp_attempts:0}).eq('session_id',s.session_id).eq('is_verified',false).eq('exchange_ticket_used',false);
            if(error) throw error;
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chat,text:'✅ Telefon raqamingiz tasdiqlandi. Brauzer avtomatik ravishda tizimga kiritmoqda.',reply_markup:{remove_keyboard:true}})});
            return res.sendStatus(200);
          }
        }
      }
    }catch(e){console.warn('[GULI auto auth]',e.message)}
    return next();
  });

  install('post','/api/v1/auth/exchange',async(req,res)=>{
    const id=String(req.body?.session_id||''),ticket=String(req.body?.exchange_ticket||'');
    if(!/^[0-9a-f-]{36}$/i.test(id)||!ticket)return res.status(400).json({success:false,message:'Auth exchange ma’lumotlari yetarli emas.'});
    try{
      const {data:s,error}=await supabase.from('auth_sessions').select('session_id,exchange_ticket_hash,exchange_ticket_used,otp_hash,otp_used,expires_at').eq('session_id',id).maybeSingle();
      if(error||!s)return res.status(404).json({success:false,message:'Auth session topilmadi.'});
      if(new Date(s.expires_at).getTime()<Date.now())return res.status(410).json({success:false,message:'Auth session muddati tugagan.'});
      if(s.exchange_ticket_used||s.otp_used)return res.status(401).json({success:false,message:'Auth exchange allaqachon ishlatilgan.'});
      if(!s.otp_hash)return res.status(425).json({success:false,message:'Telegram tasdig‘i hali kelmagan.'});
      const expected=Buffer.from(String(s.exchange_ticket_hash||''));
      const actual=Buffer.from(hash(ticket));
      if(!expected.length||expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))return res.status(401).json({success:false,message:'Exchange ticket yaroqsiz.'});
      const base=`http://127.0.0.1:${process.env.PORT||3000}`;
      const r=await fetch(`${base}/api/v1/auth/verify-otp`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:id,exchange_ticket:ticket})});
      return res.status(r.status).json(await r.json());
    }catch(e){return res.status(503).json({success:false,message:'Auth serverga ulanish imkoni bo‘lmadi.'})}
  });
})();
