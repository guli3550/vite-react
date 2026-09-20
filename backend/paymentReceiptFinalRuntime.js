const express=require('express');const crypto=require('crypto');const {createClient}=require('@supabase/supabase-js');
const { verifyAccessToken } = require('./guliCustomAuth.js');
const { notifyCustomerReceiptUploaded } = require('./customerNotificationService.js');
const originalJson=express.json;express.json=function(options={}){return originalJson({...options,limit:'12mb'})};
const URL_=process.env.SUPABASE_URL||'',KEY=process.env.SUPABASE_SECRET_KEY||'',BOT=process.env.TELEGRAM_BOT_TOKEN||'',SECRET=process.env.ADMIN_SECRET||'';const supabase=URL_&&KEY?createClient(URL_,KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;const BUCKET='payment-receipts';const MAX=6*1024*1024;
const eq=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)};
function tg(raw){if(!BOT||!raw)return null;try{const p=new URLSearchParams(raw),h=p.get('hash'),ad=Number(p.get('auth_date'));if(!h||!Number.isFinite(ad)||Math.abs(Math.floor(Date.now()/1000)-ad)>86400)return null;const a=[];p.forEach((v,k)=>{if(k!=='hash')a.push(`${k}=${v}`)});a.sort();const s=crypto.createHmac('sha256','WebAppData').update(BOT).digest(),c=crypto.createHmac('sha256',s).update(a.join('\n')).digest('hex');if(!eq(h,c))return null;const u=JSON.parse(p.get('user')||'null');return u?.id?{id:Number(u.id)}:null}catch{return null}}
function guest(raw){try{if(!SECRET)return null;const [b,s]=String(raw||'').split('.');if(!b||!s)return null;const e=crypto.createHmac('sha256',SECRET).update(b).digest('base64url');if(!eq(s,e))return null;const d=JSON.parse(Buffer.from(b,'base64url').toString('utf8')),id=Number(d.guestId);return Number.isSafeInteger(id)&&id<0&&Number(d.exp)>=Date.now()?{id}:null}catch{return null}}
function customer(req){
  const v = String(req.headers.authorization||'');
  if (v.startsWith('Bearer ')) {
    try {
      const claims = verifyAccessToken(v.slice(7).trim());
      if (claims?.sub) return { auth_user_id: claims.sub, id: claims.telegram_id };
    } catch {}
  }
  return tg(req.headers['x-telegram-init-data']||'')||guest(req.headers['x-guli-guest-token']||'')
}
function admin(req){try{if(!SECRET)return false;const h=String(req.headers.authorization||'');if(!h.startsWith('Bearer '))return false;const [b,s]=h.slice(7).split('.');if(!b||!s)return false;const e=crypto.createHmac('sha256',SECRET).update(b).digest('base64url');if(!eq(s,e))return false;const d=JSON.parse(Buffer.from(b,'base64url').toString('utf8'));return d.role==='admin'&&Number(d.exp)>Date.now()}catch{return false}}
const { install } = require('./routeRegistry.js');
function installPost(path,handler){ install('post', path, handler); }
function installDelete(path,handler){ install('delete', path, handler); }
async function ensureBucket(){if(!supabase)throw new Error('Supabase sozlanmagan');const b=await supabase.storage.getBucket(BUCKET);if(!b.error)return;const c=await supabase.storage.createBucket(BUCKET,{public:false,allowedMimeTypes:['image/jpeg','image/png','image/webp','application/pdf'],fileSizeLimit:`${MAX}B`});if(c.error&&!/already exists|duplicate/i.test(c.error.message||''))throw c.error}
function decode(data,mime){const raw=String(data||'');if(!raw||raw.length>9000000||raw.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw new Error('Chek fayli noto‘g‘ri kodlangan');const b=Buffer.from(raw,'base64');if(!b.length||b.length>MAX)throw new Error('Chek hajmi 6 MB dan oshmasligi kerak');const h=b.subarray(0,12);const ok=(mime==='image/jpeg'&&h[0]===255&&h[1]===216&&h[2]===255)||(mime==='image/png'&&h.toString('hex',0,8)==='89504e470d0a1a0a')||(mime==='image/webp'&&h.toString('ascii',0,4)==='RIFF'&&h.toString('ascii',8,12)==='WEBP')||(mime==='application/pdf'&&h.toString('ascii',0,5)==='%PDF-');if(!ok)throw new Error('Chek fayli e’lon qilingan formatga mos emas');return b}
const ext=m=>m==='application/pdf'?'pdf':m==='image/png'?'png':m==='image/webp'?'webp':'jpg';
async function remove(path){if(!path)return;const r=await supabase.storage.from(BUCKET).remove([String(path).replace(/^\/+/, '')]);if(r.error)throw r.error}

installPost('/api/orders/:orderNumber/receipt', handleReceiptUpload);
installPost('/api/customer/orders/:orderNumber/receipt', handleReceiptUpload);
installPost('/api/orders/:id/receipt', handleReceiptUpload); // Fallback for ID instead of orderNumber

async function handleReceiptUpload(req, res) {
  const u = customer(req);
  if (!u) return res.status(401).json({ success: false, message: 'Mijoz sessiyasi topilmadi.' });
  let path = '';
  try {
    if (!supabase) throw new Error('Supabase sozlanmagan');

    const identifier = String(req.params.orderNumber || req.params.id || '').trim();
    if (!identifier) return res.status(400).json({ success: false, message: 'Buyurtma raqami topilmadi.' });

    // Fetch order first to check ownership and return 403 if it belongs to someone else
    let { data: order, error: oe } = await supabase.from('orders')
      .select('id,order_number,total,telegram_id,auth_user_id,payment,payment_status,payment_receipt_path')
      .eq('order_number', identifier).maybeSingle();

    if (oe) throw oe;

    if (!order) {
      // Try by ID fallback ONLY when the identifier is a UUID.
      // Never send a numeric order number to orders.id (UUID), otherwise
      // PostgreSQL/PostgREST can raise: "operator does not exist: uuid = bigint".
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (UUID_RE.test(identifier)) {
        const byId = await supabase.from('orders')
          .select('id,order_number,total,telegram_id,auth_user_id,payment,payment_status,payment_receipt_path')
          .eq('id', identifier).maybeSingle();
        if (byId.error) throw byId.error;
        order = byId.data;
      }
    }

    if (!order) return res.status(404).json({ success: false, message: 'Buyurtma topilmadi' });

    // Check ownership
    let userTelegramId = u.id;
    if (u.auth_user_id && !userTelegramId) {
      // Browser JWTs contain the canonical users UUID in sub. Never query
      // public.users.id with a Telegram bigint or guess an integer identity.
      // Resolve the linked Telegram ID through the canonical customer bridge,
      // whose auth_user_id column is UUID-compatible.
      try {
        const { data: canonicalUser, error: canonicalUserError } = await supabase
          .from('users')
          .select('telegram_id')
          .eq('id', String(u.auth_user_id))
          .maybeSingle();
        if (!canonicalUserError && canonicalUser?.telegram_id != null) {
          userTelegramId = canonicalUser.telegram_id;
        } else {
          const { data: customerLink, error: customerLinkError } = await supabase
            .from('customers')
            .select('telegram_id')
            .eq('auth_user_id', String(u.auth_user_id))
            .maybeSingle();
          if (!customerLinkError && customerLink?.telegram_id != null) {
            userTelegramId = customerLink.telegram_id;
          }
        }
      } catch {}
    }

    const isOwner = u.auth_user_id
      ? (order.auth_user_id && String(order.auth_user_id) === String(u.auth_user_id)) || (userTelegramId && order.telegram_id != null && Number(order.telegram_id) === Number(userTelegramId))
      : (order.telegram_id != null && Number(order.telegram_id) === Number(u.id));

    if (!isOwner) return res.status(403).json({ success: false, message: 'Siz bu buyurtmaga chek yuklay olmaysiz' });

    const payMethod = String(order.payment || '').toLowerCase();
    const isCard = ['card_manual', 'card', 'karta', 'karta (uzcard / humo)'].includes(payMethod) ||
                   payMethod.includes('card') || payMethod.includes('karta') || payMethod.includes('uzcard') || payMethod.includes('humo');
    if (!isCard) return res.status(400).json({ success: false, message: 'Bu buyurtma karta to‘lovi uchun yaratilmagan' });
    if (String(order.payment_status || '') === 'verified') return res.status(409).json({ success: false, message: 'To‘lov allaqachon tasdiqlangan' });
    if (order.payment_receipt_path) return res.status(409).json({ success: false, message: 'Chek allaqachon yuklangan. Yangi chek uchun avval admin mavjud chekni o‘chirishi kerak.' });

    let rawData = req.body?.data || req.body?.receipt_url || '';
    let mimeType = String(req.body?.mimeType || 'image/jpeg');
    if (typeof rawData === 'string' && rawData.startsWith('data:')) {
      const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
      if (match) { mimeType = match[1]; rawData = match[2]; }
    }

    if (!rawData || typeof rawData !== 'string') return res.status(400).json({ success: false, message: 'Chek rasmi topilmadi' });
    if (!/^image\/(jpeg|png|webp)$/.test(String(mimeType || '')) && mimeType !== 'application/pdf') return res.status(400).json({ success: false, message: 'Chek faqat JPG, PNG, WEBP yoki PDF bo‘lishi mumkin' });

    const buffer = decode(rawData, mimeType);
    await ensureBucket();

    path = `receipts/${order.id}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext(mimeType)}`;

    const { error: up } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, cacheControl: '31536000', upsert: false });
    if (up) throw up;

    const patchData = { payment_receipt_path: path, payment_status: 'receipt_uploaded', payment_receipt_uploaded_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data: updated, error: ue } = await supabase.from('orders').update(patchData).eq('id', order.id).select('id,order_number,total,payment_status,payment_receipt_uploaded_at,payment_receipt_path').single();

    if (ue) {
      await remove(path).catch(() => {});
      path = '';
      throw ue;
    }

    let signedReceiptUrl = '';
    try {
      const { data: sData } = await supabase.storage.from(BUCKET).createSignedUrl(path, 86400);
      signedReceiptUrl = sData?.signedUrl || '';
    } catch {}

    try {
      await notifyCustomerReceiptUploaded({
        ...order,
        ...updated,
        telegram_id: order.telegram_id,
        payment_receipt_path: path,
        payment_receipt_uploaded_at: updated.payment_receipt_uploaded_at,
      });
    } catch (notifyError) {
      console.warn('[Customer Telegram receipt media]', notifyError?.message || notifyError);
    }

    return res.json({ success: true, message: 'Chek muvaffaqiyatli saqlandi. Admin tekshiradi.', data: { ...updated, receipt_url: signedReceiptUrl } });
  } catch (e) {
    if (path) await remove(path).catch(() => {});
    console.error('[Receipt upload authoritative]', e);
    const bad = /Chek fayli|Chek hajmi|Chek rasmi/i.test(e.message || '');
    return res.status(bad ? 400 : 500).json({ success: false, message: bad ? e.message : 'Chekni yuborishda xatolik' });
  }
}

installDelete('/api/admin/orders/:id/payment-receipt',async(req,res)=>{if(!admin(req))return res.status(401).json({success:false,message:'Admin sessiyasi yaroqsiz yoki tugagan'});if(!supabase)return res.status(503).json({success:false,message:'Supabase sozlanmagan'});try{const{data:order,error}=await supabase.from('orders').select('id,payment_status,payment_receipt_path').eq('id',req.params.id).maybeSingle();if(error)throw error;if(!order)return res.status(404).json({success:false,message:'Buyurtma topilmadi'});if(!order.payment_receipt_path)return res.status(404).json({success:false,message:'Chek topilmadi'});await remove(order.payment_receipt_path);const wasVerified=String(order.payment_status||'')==='verified';const patch={payment_receipt_path:null,payment_receipt_uploaded_at:null,updated_at:new Date().toISOString()};if(wasVerified){patch.payment_status='rejected';patch.payment_verified_at=null}else patch.payment_status='pending';const{error:ue}=await supabase.from('orders').update(patch).eq('id',order.id);if(ue)throw ue;return res.json({success:true,message:wasVerified?'Chek o‘chirildi; to‘lov dalili yo‘qligi sabab status rad etilgan.':'Chek o‘chirildi',data:{id:order.id,payment_status:patch.payment_status}})}catch(e){console.error('[Receipt delete]',e);return res.status(500).json({success:false,message:'Chekni o‘chirishda xatolik'})}});
