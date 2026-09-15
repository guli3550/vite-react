// Auto-complete canonical browser authentication after Telegram contact verification.
(() => {
  const crypto = require('crypto');
  const { createClient } = require('@supabase/supabase-js');
  const { install } = require('./routeRegistry.js');
  const URL = process.env.SUPABASE_URL || '';
  const KEY = process.env.SUPABASE_SECRET_KEY || '';
  const supabase = URL && KEY ? createClient(URL, KEY, { auth:{ persistSession:false, autoRefreshToken:false } }) : null;
  const hash = (v) => crypto.createHmac('sha256', KEY || 'guli-auth').update(String(v)).digest('hex');
  const normalizePhone = (v) => { let x=String(v||'').trim().replace(/[^\d+]/g,''); if(x.startsWith('00')) x='+'+x.slice(2); if(!x.startsWith('+')) x='+'+x; return x; };
  const validPhone = (v) => /^\+[1-9]\d{7,14}$/.test(v);
  const ok = (res,data) => res.json({success:true,data});
  const fail = (res,c,m) => res.status(c).json({success:false,message:m});

  install('post','/api/v1/auth/exchange', async (req,res) => {
    if(!supabase) return fail(res,503,'Auth xizmati sozlanmagan.');
    const sessionId=String(req.body?.session_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(sessionId)) return fail(res,400,'Noto\'g\'ri auth session.');
    const {data:s,error:se}=await supabase.from('auth_sessions').select('*').eq('session_id',sessionId).maybeSingle();
    if(se||!s) return fail(res,404,'Auth session topilmadi.');
    if(new Date(s.expires_at).getTime()<Date.now()) return fail(res,410,'Auth session muddati tugagan.');
    if(!s.is_verified || !s.exchange_ticket_hash || s.exchange_ticket_used) return fail(res,401,'Telegram tasdig\'i hali tugallanmagan yoki sessiya allaqachon ishlatilgan.');
    const ticket=crypto.randomBytes(48).toString('base64url');
    const ticketHash=hash(ticket);
    const {error:up}=await supabase.from('auth_sessions').update({exchange_ticket_used:true}).eq('session_id',sessionId).eq('exchange_ticket_used',false).eq('is_verified',true);
    if(up) return fail(res,500,'Auth exchange bajarilmadi.');
    const {data:ticketRow}=await supabase.from('auth_sessions').select('exchange_ticket_hash').eq('session_id',sessionId).maybeSingle();
    // The ticket is created by the verified Telegram handler and stored as a hash.
    // Exchange accepts the one-time ticket through the dedicated ticket endpoint below.
    return fail(res,401,'Exchange ticket talab qilinadi.');
  });

  install('post','/api/v1/auth/exchange-ticket', async (req,res) => {
    if(!supabase) return fail(res,503,'Auth xizmati sozlanmagan.');
    const sessionId=String(req.body?.session_id||'');
    const ticket=String(req.body?.ticket||'');
    if(!/^[0-9a-f-]{36}$/i.test(sessionId)||!ticket) return fail(res,400,'Session va ticket talab qilinadi.');
    const {data:s}=await supabase.from('auth_sessions').select('*').eq('session_id',sessionId).maybeSingle();
    if(!s||new Date(s.expires_at).getTime()<Date.now()||!s.is_verified||s.exchange_ticket_used) return fail(res,401,'Auth ticket yaroqsiz.');
    if(!s.exchange_ticket_hash||!crypto.timingSafeEqual(Buffer.from(s.exchange_ticket_hash),Buffer.from(hash(ticket)))) return fail(res,401,'Auth ticket yaroqsiz.');
    const phone=normalizePhone(s.phone_number), telegramId=Number(s.telegram_id);
    if(!validPhone(phone)||!Number.isSafeInteger(telegramId)) return fail(res,400,'Identity ma\'lumotlari yetarli emas.');
    let userId;
    const {data:canonical}=await supabase.from('users').select('id,phone_number,telegram_id').eq('phone_number',phone).maybeSingle();
    if(canonical){ if(canonical.telegram_id&&Number(canonical.telegram_id)!==telegramId) return fail(res,409,'Bu telefon boshqa Telegram account bilan bog\'langan.'); userId=canonical.id; }
    if(!userId){ const {data:byTg}=await supabase.from('users').select('id,phone_number,telegram_id').eq('telegram_id',telegramId).maybeSingle(); if(byTg&&byTg.phone_number!==phone) return fail(res,409,'Telegram account boshqa telefon bilan bog\'langan.'); if(byTg) userId=byTg.id; }
    const password=crypto.randomBytes(48).toString('base64url');
    if(!userId){ const {data:created,error}=await supabase.auth.admin.createUser({phone,phone_confirm:true,password,user_metadata:{auth_source:'telegram',telegram_id:telegramId}}); if(error||!created?.user) return fail(res,500,'GULI Auth account yaratilmadi.'); userId=created.user.id; }
    else { const {error}=await supabase.auth.admin.updateUserById(userId,{phone,phone_confirm:true,password}); if(error) return fail(res,500,'GULI Auth account yangilanmadi.'); }
    const {data:signed,error:signErr}=await supabase.auth.signInWithPassword({phone,password});
    if(signErr||!signed?.session) return fail(res,500,'Auth session chiqarilmadi.');
    await supabase.from('users').upsert({id:userId,phone_number:phone,telegram_id:telegramId,updated_at:new Date().toISOString()},{onConflict:'id'});
    await supabase.from('profiles').upsert({id:userId,phone,updated_at:new Date().toISOString()},{onConflict:'id'});
    await supabase.from('user_identities').upsert({user_id:userId,provider:'telegram',provider_subject:String(telegramId),provider_phone:phone,updated_at:new Date().toISOString()},{onConflict:'provider,provider_subject'});
    await supabase.from('user_identities').upsert({user_id:userId,provider:'phone',provider_subject:phone,provider_phone:phone,updated_at:new Date().toISOString()},{onConflict:'provider,provider_subject'});
    await supabase.from('auth_sessions').update({exchange_ticket_used:true,otp_used:true,verified_at:new Date().toISOString()}).eq('session_id',sessionId).eq('exchange_ticket_used',false);
    return ok(res,{user:{id:userId,phone_number:phone,telegram_id:telegramId},access_token:signed.session.access_token,refresh_token:signed.session.refresh_token,expires_at:signed.session.expires_at});
  });

  const webhookLayer=(app._router?.stack||[]).find(layer=>layer.route?.path==='/api/telegram/webhook'&&layer.route?.methods?.post);
  if(!webhookLayer?.route?.stack?.length) return;
  const idx=webhookLayer.route.stack.length-1;
  const original=webhookLayer.route.stack[idx].handle;
  webhookLayer.route.stack[idx].handle=async(req,res,next)=>{
    try{
      const message=req.body?.message, contact=message?.contact, fromId=Number(message?.from?.id||message?.chat?.id||0), chatId=Number(message?.chat?.id||0);
      if(contact?.phone_number&&fromId&&contact.user_id&&Number(contact.user_id)===fromId&&supabase){
        const phone=normalizePhone(contact.phone_number);
        if(validPhone(phone)){
          const {data:s}=await supabase.from('auth_sessions').select('session_id,telegram_id,expires_at,is_verified,exchange_ticket_used').eq('telegram_id',fromId).eq('is_verified',false).eq('exchange_ticket_used',false).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle();
          if(s){
            const ticket=crypto.randomBytes(48).toString('base64url');
            await supabase.from('auth_sessions').update({phone_number:phone,is_verified:true,otp_used:true,otp_attempts:0,exchange_ticket_hash:hash(ticket),verified_at:new Date().toISOString()}).eq('session_id',s.session_id).eq('is_verified',false).eq('exchange_ticket_used',false);
            await supabase.from('telegram_users').upsert({telegram_id:fromId,username:message?.from?.username||null,first_name:message?.from?.first_name||null,last_name:message?.from?.last_name||null,telegram_phone:phone,updated_at:new Date().toISOString()},{onConflict:'telegram_id'});
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text:'✅ Telefon raqamingiz tasdiqlandi. Brauzer oynasi avtomatik ravishda tizimga kiritmoqda.',reply_markup:{remove_keyboard:true}})});
            // Browser cannot safely receive the ticket from Telegram, so expose a short-lived one-time ticket
            // only through the status response by temporarily storing it in a separate field is not possible here.
            // Instead hash+raw ticket are paired through an ephemeral process-local map.
            global.__GULI_AUTH_TICKETS=global.__GULI_AUTH_TICKETS||new Map();
            global.__GULI_AUTH_TICKETS.set(s.session_id,{ticket,expires:Date.now()+60000});
            return res.sendStatus(200);
          }
        }
      }
    }catch(e){ console.warn('[GULI auto auth] webhook wrapper:',e.message); }
    return original(req,res,next);
  };
})();
