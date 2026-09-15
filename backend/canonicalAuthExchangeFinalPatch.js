(() => {
  const crypto=require('crypto');
  const {createClient}=require('@supabase/supabase-js');
  const {install}=require('./routeRegistry.js');
  const URL=process.env.SUPABASE_URL||'',KEY=process.env.SUPABASE_SECRET_KEY||'';
  const supabase=URL&&KEY?createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
  const normalizePhone=v=>{let x=String(v||'').trim().replace(/[^\d+]/g,'');if(x.startsWith('00'))x='+'+x.slice(2);if(!x.startsWith('+'))x='+'+x;return x};
  const validPhone=v=>/^\+[1-9]\d{7,14}$/.test(v);
  const ok=(res,data)=>res.json({success:true,data}),fail=(res,c,m)=>res.status(c).json({success:false,message:m});
  install('post','/api/v1/auth/exchange',async(req,res)=>{
    if(!supabase)return fail(res,503,'Auth xizmati sozlanmagan.');
    const id=String(req.body?.session_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(id))return fail(res,400,'Noto\'g\'ri auth session.');
    const {data:s}=await supabase.from('auth_sessions').select('*').eq('session_id',id).maybeSingle();
    if(!s||new Date(s.expires_at).getTime()<Date.now())return fail(res,410,'Auth session muddati tugagan.');
    if(!s.is_verified||s.exchange_ticket_used)return fail(res,401,'Telegram tasdig\'i kutilmoqda yoki sessiya allaqachon ishlatilgan.');
    const phone=normalizePhone(s.phone_number),tg=Number(s.telegram_id);
    if(!validPhone(phone)||!Number.isSafeInteger(tg))return fail(res,400,'Tasdiqlangan identity ma\'lumotlari yetarli emas.');
    let userId;
    const {data:c}=await supabase.from('users').select('id,phone_number,telegram_id').eq('phone_number',phone).maybeSingle();
    if(c){if(c.telegram_id&&Number(c.telegram_id)!==tg)return fail(res,409,'Bu telefon boshqa Telegram account bilan bog\'langan.');userId=c.id;}
    if(!userId){const {data:b}=await supabase.from('users').select('id,phone_number,telegram_id').eq('telegram_id',tg).maybeSingle();if(b&&b.phone_number!==phone)return fail(res,409,'Telegram account boshqa telefon bilan bog\'langan.');if(b)userId=b.id;}
    const password=crypto.randomBytes(48).toString('base64url');
    if(!userId){const {data:created,error}=await supabase.auth.admin.createUser({phone,phone_confirm:true,password,user_metadata:{auth_source:'telegram',telegram_id:tg}});if(error||!created?.user)return fail(res,500,'GULI Auth account yaratilmadi.');userId=created.user.id;}
    else {const {error}=await supabase.auth.admin.updateUserById(userId,{phone,phone_confirm:true,password});if(error)return fail(res,500,'GULI Auth account yangilanmadi.');}
    const {data:signed,error:signErr}=await supabase.auth.signInWithPassword({phone,password});
    if(signErr||!signed?.session)return fail(res,500,'Auth session chiqarilmadi.');
    await supabase.from('users').upsert({id:userId,phone_number:phone,telegram_id:tg,updated_at:new Date().toISOString()},{onConflict:'id'});
    await supabase.from('profiles').upsert({id:userId,phone,updated_at:new Date().toISOString()},{onConflict:'id'});
    await supabase.from('user_identities').upsert({user_id:userId,provider:'telegram',provider_subject:String(tg),provider_phone:phone,updated_at:new Date().toISOString()},{onConflict:'provider,provider_subject'});
    await supabase.from('user_identities').upsert({user_id:userId,provider:'phone',provider_subject:phone,provider_phone:phone,updated_at:new Date().toISOString()},{onConflict:'provider,provider_subject'});
    const {data:claimed}=await supabase.from('auth_sessions').update({exchange_ticket_used:true,otp_used:true,verified_at:new Date().toISOString()}).eq('session_id',id).eq('exchange_ticket_used',false).select('session_id').maybeSingle();
    if(!claimed)return fail(res,409,'Auth sessiyasi allaqachon ishlatilgan.');
    return ok(res,{user:{id:userId,phone_number:phone,telegram_id:tg},access_token:signed.session.access_token,refresh_token:signed.session.refresh_token,expires_at:signed.session.expires_at});
  });
})();
