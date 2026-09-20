// Canonical customer identity bridge: one customers row can represent a Supabase auth user and Telegram identity.
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { install } = require('./routeRegistry.js');
const { notifyCustomerReceiptUploaded } = require('./customerNotificationService.js');
const URL_ = String(process.env.SUPABASE_URL || '').trim();
const KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const BOT = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const db = URL_ && KEY ? createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const fail = (res, c, m) => res.status(c).json({ success: false, message: m });
const eq = (a,b) => { const x=Buffer.from(String(a||'')), y=Buffer.from(String(b||'')); return x.length===y.length && crypto.timingSafeEqual(x,y); };
function tg(raw){
  if(!BOT||!raw) return null; try{
    const p=new URLSearchParams(String(raw)), h=p.get('hash'), ad=Number(p.get('auth_date'));
    if(!h||!Number.isFinite(ad)||Math.abs(Math.floor(Date.now()/1000)-ad)>86400) return null;
    const a=[]; p.forEach((v,k)=>{if(k!=='hash')a.push(`${k}=${v}`)}); a.sort();
    const s=crypto.createHmac('sha256','WebAppData').update(BOT).digest();
    const c=crypto.createHmac('sha256',s).update(a.join('\n')).digest('hex'); if(!eq(h,c)) return null;
    const u=JSON.parse(p.get('user')||'null'); return u?.id ? { telegram_id:Number(u.id), user:u } : null;
  }catch{return null}
}
async function au(req){
  if(!db) return null; const h=String(req.headers.authorization||''); if(!h.startsWith('Bearer ')) return null;
  try{const {data,error}=await db.auth.getUser(h.slice(7)); return error||!data?.user ? null : {auth_user_id:data.user.id,user:data.user};}catch{return null}
}
async function who(req){ return tg(req.headers['x-telegram-init-data']||'') || await au(req); }
async function sync(req,res){
  const u=await who(req); if(!u) return fail(res,401,'Mijoz autentifikatsiyasi talab qilinadi.'); if(!db) return fail(res,503,'Supabase sozlanmagan.');
  try{
    if(u.telegram_id){
      const t=u.user||{};
      const {data,error}=await db.from('customers').upsert({telegram_id:u.telegram_id,email:null,full_name:[t.first_name,t.last_name].filter(Boolean).join(' ')||null,phone:req.body?.phone||null,auth_provider:'telegram',avatar_url:t.photo_url||null,updated_at:new Date().toISOString()},{onConflict:'telegram_id'}).select().single();
      if(error) throw error; return res.json({success:true,data});
    }
    const email=String(u.user.email||'').trim().toLowerCase()||null;
    const phone=String(req.body?.phone||u.user.phone||'').trim()||null;
    let row=null;
    const byAuth=await db.from('customers').select('*').eq('auth_user_id',u.auth_user_id).maybeSingle(); if(byAuth.error) throw byAuth.error; row=byAuth.data;
    if(!row && phone){ const byPhone=await db.from('customers').select('*').eq('phone',phone).not('telegram_id','is',null).maybeSingle(); if(byPhone.error) throw byPhone.error; row=byPhone.data; }
    const payload={auth_user_id:u.auth_user_id,email,phone,full_name:String(req.body?.full_name||u.user.user_metadata?.full_name||u.user.user_metadata?.name||'').trim()||null,auth_provider:u.user.app_metadata?.provider||'email',avatar_url:String(req.body?.avatar_url||u.user.user_metadata?.avatar_url||'').trim()||null,updated_at:new Date().toISOString()};
    if(row){ const {data,error}=await db.from('customers').update(payload).eq('id',row.id).select().single(); if(error) throw error; return res.json({success:true,data}); }
    const {data,error}=await db.from('customers').insert(payload).select().single(); if(error) throw error; return res.json({success:true,data});
  }catch(e){console.error('[Customer identity sync]',e);return fail(res,500,'Mijoz profilini birlashtirishda xatolik.')}
}
async function profile(req,res){
  const u=await who(req); if(!u||!db) return fail(res,401,'Mijoz autentifikatsiyasi talab qilinadi.');
  try{ let q=db.from('customers').select('*'); q=u.telegram_id?q.eq('telegram_id',u.telegram_id):q.eq('auth_user_id',u.auth_user_id); const {data,error}=await q.maybeSingle(); if(error) throw error; if(data) return res.json({success:true,data});
    return res.json({success:true,data:{id:u.telegram_id?`telegram:${u.telegram_id}`:u.auth_user_id,provider:u.telegram_id?'telegram':(u.user.app_metadata?.provider||'email'),email:u.user.email||null,full_name:[u.user.user_metadata?.full_name,u.user.user_metadata?.name].find(Boolean)||[u.user.first_name,u.user.last_name].filter(Boolean).join(' '),phone:u.user.phone||null,avatar_url:u.user.user_metadata?.avatar_url||u.user.photo_url||null}});
  }catch(e){return fail(res,500,'Profilni yuklashda xatolik.')}
}
async function update(req,res){
  const u=await au(req); if(!u||!db) return fail(res,401,'Email/Google sessiyasi talab qilinadi.');
  try{
    const body={full_name:String(req.body?.full_name||'').trim()||null,phone:String(req.body?.phone||'').trim()||null,avatar_url:String(req.body?.avatar_url||'').trim()||null,updated_at:new Date().toISOString()};
    const meta={...u.user.user_metadata}; if(body.full_name) meta.full_name=body.full_name; if(body.phone) meta.phone=body.phone; if(body.avatar_url) meta.avatar_url=body.avatar_url;
    const {error:ae}=await db.auth.admin.updateUserById(u.auth_user_id,{user_metadata:meta}); if(ae) throw ae;
    const {data:existing}=await db.from('customers').select('id').eq('auth_user_id',u.auth_user_id).maybeSingle();
    const r=existing?await db.from('customers').update({...body,auth_user_id:u.auth_user_id,email:u.user.email||null,auth_provider:u.user.app_metadata?.provider||'email'}).eq('id',existing.id).select().single():await db.from('customers').insert({...body,auth_user_id:u.auth_user_id,email:u.user.email||null,auth_provider:u.user.app_metadata?.provider||'email'}).select().single();
    if(r.error) throw r.error; return res.json({success:true,data:r.data});
  }catch(e){console.error('[Customer profile update]',e);return fail(res,500,'Profilni saqlashda xatolik.')}
}
async function orders(req,res){
  const u=await who(req);
  const phoneQuery = String(req.query.phone || req.headers['x-customer-phone'] || '').replace(/\D/g, '');
  const tgQuery = String(req.query.telegram_id || req.headers['x-telegram-id'] || '').trim();
  const orderNumsQuery = String(req.query.order_numbers || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  if(!db) return fail(res,503,'Supabase sozlanmagan.');
  try{
    let q=db.from('orders').select('id,order_number,first_name,last_name,customer_name,phone,items,subtotal,delivery,discount,total,address,payment,payment_status,payment_receipt_path,status,created_at,updated_at').order('created_at',{ascending:false}).limit(100);
    const orConditions = [];
    if (u?.telegram_id) {
      orConditions.push(`telegram_id.eq.${u.telegram_id}`);
    } else if (u?.auth_user_id) {
      // Browser JWT and Telegram-created orders are the same customer.
      // Resolve the linked Telegram bigint from public.users, then include
      // BOTH identities so browser history contains Telegram-created orders.
      orConditions.push(`auth_user_id.eq.${u.auth_user_id}`);
      try {
        const { data: linkedUser } = await db
          .from('users')
          .select('telegram_id')
          .eq('id', u.auth_user_id)
          .maybeSingle();
        if (linkedUser?.telegram_id != null) {
          orConditions.push(`telegram_id.eq.${Number(linkedUser.telegram_id)}`);
        }
      } catch {}
    }

    if (tgQuery && /^\d+$/.test(tgQuery)) {
      orConditions.push(`telegram_id.eq.${tgQuery}`);
    }
    if (phoneQuery && phoneQuery.length >= 7) {
      const last7 = phoneQuery.slice(-7);
      const last9 = phoneQuery.slice(-9);
      orConditions.push(`phone.ilike.%${last7}%`);
      if (last9 !== last7) {
        orConditions.push(`phone.ilike.%${last9}%`);
      }
    }
    if (orderNumsQuery.length) {
      for (const num of orderNumsQuery.slice(0, 30)) {
        orConditions.push(`order_number.eq.${num}`);
      }
    }

    if (orConditions.length) {
      q = q.or(orConditions.join(','));
    } else {
      return res.json({success:true,data:[]});
    }

    const {data,error}=await q;
    if(error) throw error;

    // Telegram Mini App and browser must receive the same canonical receipt URL.
    // The bucket is private, so expose only short-lived signed URLs — never the
    // raw Storage path.
    const formatted = await Promise.all((data || []).map(async (row) => {
      let receipt_url = '';
      if (row.payment_receipt_path) {
        try {
          const { data: signed } = await db.storage
            .from('payment-receipts')
            .createSignedUrl(String(row.payment_receipt_path).replace(/^\/+/, ''), 86400);
          receipt_url = signed?.signedUrl || '';
        } catch {}
      }
      return { ...row, receipt_url: receipt_url || undefined };
    }));

    res.setHeader('Cache-Control','private,no-store');
    return res.json({success:true,data:formatted});
  }catch(e){console.error('[Unified orders fetch error]', e); return fail(res,500,'Buyurtmalarni yuklashda xatolik.')}
}
async function receipt(req,res){
  const u=await who(req); if(!u||!db) return fail(res,401,'Mijoz sessiyasi topilmadi.');
  try{
    let q=db.from('orders').select('id,order_number,total,telegram_id,auth_user_id,payment,payment_status,payment_receipt_path').eq('order_number',String(req.params.orderNumber||'').trim());
    q=u.telegram_id?q.eq('telegram_id',u.telegram_id):q.eq('auth_user_id',u.auth_user_id); const {data:o,error}=await q.maybeSingle(); if(error) throw error;
    if(!o) return fail(res,404,'Buyurtma topilmadi'); if(o.payment!=='card_manual') return fail(res,400,'Bu buyurtma karta to‘lovi uchun emas'); if(o.payment_receipt_path) return fail(res,409,'Chek allaqachon yuklangan.');
    const raw=String(req.body?.data||''),mime=String(req.body?.mimeType||''); if(!raw) return fail(res,400,'Chek topilmadi'); const b=Buffer.from(raw,'base64'); if(!b.length||b.length>6*1024*1024)return fail(res,400,'Chek hajmi 6 MB dan oshmasligi kerak');
    const h=b.subarray(0,12),ok=(mime==='image/jpeg'&&h[0]===255&&h[1]===216&&h[2]===255)||(mime==='image/png'&&h.toString('hex',0,8)==='89504e470d0a1a0a')||(mime==='image/webp'&&h.toString('ascii',0,4)==='RIFF'&&h.toString('ascii',8,12)==='WEBP')||(mime==='application/pdf'&&h.toString('ascii',0,5)==='%PDF-'); if(!ok)return fail(res,400,'Chek formati noto‘g‘ri');
    const ext=mime==='application/pdf'?'pdf':mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'; const path=`receipts/${o.id}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`; const up=await db.storage.from('payment-receipts').upload(path,b,{contentType:mime,upsert:false}); if(up.error)throw up;
    const owner=u.telegram_id?{telegram_id:u.telegram_id}:{auth_user_id:u.auth_user_id}; const r=await db.from('orders').update({payment_receipt_path:path,payment_status:'receipt_uploaded',payment_receipt_uploaded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',o.id).match(owner).select('id,order_number,total,payment_status,payment_receipt_path').single(); if(r.error){await db.storage.from('payment-receipts').remove([path]);throw r.error;}
    let receipt_url = '';
    try {
      const { data: signed } = await db.storage.from('payment-receipts').createSignedUrl(path, 86400);
      receipt_url = signed?.signedUrl || '';
    } catch {}
    try {
      await notifyCustomerReceiptUploaded({
        ...o,
        ...r.data,
        telegram_id: o.telegram_id || u.telegram_id,
        payment_receipt_path: path,
        payment_receipt_uploaded_at: r.data?.payment_receipt_uploaded_at || new Date().toISOString(),
      });
    } catch (notifyError) {
      console.warn('[Customer Telegram receipt media]', notifyError?.message || notifyError);
    }
    return res.json({success:true,message:'Chek muvaffaqiyatli saqlandi. Admin tekshiradi.',data:{...r.data,receipt_url:receipt_url||undefined}});
  }catch(e){console.error('[Unified receipt]',e);return fail(res,500,'Chekni yuborishda xatolik.')}
}
install('post','/api/customer/sync',sync);
install('get','/api/customer/profile',profile);
install('put','/api/customer/profile',update);
install('get','/api/orders',orders);
install('post','/api/orders/:orderNumber/receipt',receipt);
console.log('[GULI Identity] Browser + Telegram customer bridge loaded.');
