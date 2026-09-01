// Standalone manual Humo/Uzcard payment runtime.
// Loaded before index.js, so it must not depend on index.js module-local variables.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
const CARD_NUMBER = String(process.env.CARD_PAYMENT_NUMBER || "").replace(/\D/g, "");
const CARD_HOLDER = String(process.env.CARD_PAYMENT_NAME || "").trim();
const BUCKET = "payment-receipts";
const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;
const GUEST_TTL = 30 * 24 * 60 * 60 * 1000;

function safeEqual(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function verifyInitData(initData){
  if(!BOT_TOKEN||!initData)return null;
  try{
    const p=new URLSearchParams(initData),hash=p.get("hash"),authDate=Number(p.get("auth_date"));
    if(!hash||!Number.isFinite(authDate)||Math.abs(Math.floor(Date.now()/1000)-authDate)>86400)return null;
    const pairs=[];p.forEach((v,k)=>{if(k!=="hash")pairs.push(`${k}=${v}`)});pairs.sort();
    const secret=crypto.createHmac("sha256","WebAppData").update(BOT_TOKEN).digest();
    const calculated=crypto.createHmac("sha256",secret).update(pairs.join("\n")).digest("hex");
    if(!safeEqual(calculated,hash))return null;
    const user=JSON.parse(p.get("user")||"null");
    return user?.id?{id:Number(user.id),username:user.username||null,first_name:user.first_name||null,last_name:user.last_name||null}:null;
  }catch{return null}
}
function signGuest(id,exp){const body=Buffer.from(JSON.stringify({guestId:Number(id),exp:Number(exp)})).toString("base64url");const sig=crypto.createHmac("sha256",ADMIN_SECRET).update(body).digest("base64url");return `${body}.${sig}`}
function verifyGuest(token){try{if(!ADMIN_SECRET)return null;const [body,sig]=String(token||"").split(".");if(!body||!sig)return null;const expected=crypto.createHmac("sha256",ADMIN_SECRET).update(body).digest("base64url");if(!safeEqual(sig,expected))return null;const d=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));const id=Number(d.guestId);if(!Number.isSafeInteger(id)||id>=0||Number(d.exp)<Date.now())return null;return{id,username:null,first_name:null,last_name:null}}catch{return null}}
function customer(req){return verifyInitData(req.headers["x-telegram-init-data"]||"")||verifyGuest(req.headers["x-guli-guest-token"]||"")}
function admin(req){try{if(!ADMIN_SECRET)return false;const h=String(req.headers.authorization||"");if(!h.startsWith("Bearer "))return false;const [body,sig]=h.slice(7).split(".");if(!body||!sig)return false;const expected=crypto.createHmac("sha256",ADMIN_SECRET).update(body).digest("base64url");if(!safeEqual(sig,expected))return false;const d=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));return d.role==="admin"&&Number(d.exp)>Date.now()}catch{return false}}
function install(method,path,handler){const original=express.application[method];express.application[method]=function(routePath,...handlers){if(routePath===path)return original.call(this,routePath,handler,...handlers);return original.call(this,routePath,...handlers)}}
async function bucket(){if(!supabase)throw new Error("Supabase sozlanmagan");const x=await supabase.storage.getBucket(BUCKET);if(!x.error)return;const y=await supabase.storage.createBucket(BUCKET,{public:false,allowedMimeTypes:["image/jpeg","image/png","image/webp","application/pdf"],fileSizeLimit:`${MAX_RECEIPT_BYTES}B`});if(y.error&&!/already exists|duplicate/i.test(y.error.message||""))throw y.error}
function fail(res,code,message){return res.status(code).json({success:false,message})}
function decodeReceipt(data,mimeType){
  const raw=String(data||"");
  if(!raw||raw.length>8500000||raw.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw new Error("Chek fayli noto‘g‘ri kodlangan");
  const buffer=Buffer.from(raw,"base64");
  if(!buffer.length||buffer.length>MAX_RECEIPT_BYTES)throw new Error("Chek hajmi 6 MB dan oshmasligi kerak");
  const h=buffer.subarray(0,12);
  const valid=(mimeType==="image/jpeg"&&h[0]===0xff&&h[1]===0xd8&&h[2]===0xff)||(mimeType==="image/png"&&h.toString("hex",0,8)==="89504e470d0a1a0a")||(mimeType==="image/webp"&&h.toString("ascii",0,4)==="RIFF"&&h.toString("ascii",8,12)==="WEBP")||(mimeType==="application/pdf"&&h.toString("ascii",0,5)==="%PDF-");
  if(!valid)throw new Error("Chek fayli e’lon qilingan formatga mos emas");
  return buffer;
}
function receiptExt(mimeType){return mimeType==="application/pdf"?"pdf":mimeType==="image/png"?"png":mimeType==="image/webp"?"webp":"jpg"}
const PAYMENT_STATES={pending:new Set(["pending","receipt_uploaded","rejected"]),receipt_uploaded:new Set(["receipt_uploaded","verified","rejected"]),verified:new Set(["verified","rejected"]),rejected:new Set(["rejected","receipt_uploaded","verified"])};
function allowedPaymentTransition(from,to){return (PAYMENT_STATES[from]||PAYMENT_STATES.pending).has(to)}

install("post","/api/guest-session",async(req,res)=>{
  if(!ADMIN_SECRET)return fail(res,503,"Brauzer sessiyasi backend secret bilan sozlanmagan.");
  const n=BigInt(`0x${crypto.randomBytes(7).toString("hex")}`),id=-Number((n%900000000000n)+100000000000n),exp=Date.now()+GUEST_TTL;
  return res.json({success:true,data:{token:signGuest(id,exp),expires_at:new Date(exp).toISOString()}})
});
install("get","/api/payment/card-info",async(req,res)=>{
  if(!customer(req))return fail(res,401,"Mijoz sessiyasi topilmadi. Telegram Mini App yoki brauzer sessiyasini yangilang.");
  if(!/^\d{16}$/.test(CARD_NUMBER)||!CARD_HOLDER)return fail(res,503,"Karta to‘lovi rekvizitlari backend environment'da sozlanmagan.");
  const initials=CARD_HOLDER.split(/\s+/).filter(Boolean).map(x=>x.slice(0,2).toUpperCase()).join(" ");
  return res.json({success:true,data:{card_number:CARD_NUMBER,holder_initials:initials}})
});
install("post","/api/guest/orders",async(req,res)=>{
  const user=customer(req);if(!user)return fail(res,401,"Mijoz sessiyasi topilmadi. Telegram Mini App yoki brauzer sessiyasini yangilang.");
  if(user.id>0)return fail(res,400,"Telegram sessiyasi uchun asosiy checkout ishlatiladi.");
  try{
    if(!supabase)throw new Error("Supabase sozlanmagan");const {phone,items,address,promo_code}=req.body||{};
    if(!String(phone||"").trim())return fail(res,400,"Telefon raqami kiritilmagan");if(!Array.isArray(items)||!items.length||items.length>100)return fail(res,400,"Buyurtma mahsulotlari noto‘g‘ri");
    const order={order_number:null,username:null,first_name:null,phone:String(phone).trim(),items,address:address||null,payment:"card_manual",status:"⏳ Buyurtma kutilmoqda",promo_code:promo_code?String(promo_code).trim().toUpperCase():""};
    const {data,error}=await supabase.rpc("create_secure_order",{p_order:order,p_telegram_id:user.id});if(error)throw error;
    return res.status(201).json({success:true,message:"Buyurtma muvaffaqiyatli saqlandi",data})
  }catch(e){console.error("Guest secure checkout error:",e);return res.status(/telefon|mahsulot|omborda|promo|minimal buyurtma|sotuvda|miqdori/i.test(e.message||"")?400:500).json({success:false,message:e.message||"Buyurtmani saqlashda xatolik"})}
});
install("post","/api/orders/:orderNumber/receipt",async(req,res)=>{
  const user=customer(req);if(!user)return fail(res,401,"Mijoz sessiyasi topilmadi. Telegram Mini App yoki brauzer sessiyasini yangilang.");
  try{
    if(!supabase)throw new Error("Supabase sozlanmagan");const orderNumber=String(req.params.orderNumber||"").trim();
    const {data:order,error}=await supabase.from("orders").select("id,order_number,total,telegram_id,payment,payment_status").eq("order_number",orderNumber).eq("telegram_id",user.id).maybeSingle();if(error)throw error;if(!order)return fail(res,404,"Buyurtma topilmadi");if(String(order.payment||"")!=="card_manual")return fail(res,400,"Bu buyurtma karta orqali to‘lov uchun yaratilmagan");
    const {data,mimeType}=req.body||{};if(!data||typeof data!=="string")return fail(res,400,"Chek rasmi topilmadi");if(!/^image\/(jpeg|png|webp)$/.test(String(mimeType||""))&&mimeType!=="application/pdf")return fail(res,400,"Chek faqat JPG, PNG, WEBP yoki PDF bo‘lishi mumkin");
    const buffer=decodeReceipt(data,mimeType);await bucket();const path=`receipts/${order.id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${receiptExt(mimeType)}`;
    const {error:up}=await supabase.storage.from(BUCKET).upload(path,buffer,{contentType:mimeType,cacheControl:"31536000",upsert:false});if(up)throw up;
    const {data:updated,error:ue}=await supabase.from("orders").update({payment_receipt_path:path,payment_status:"receipt_uploaded",payment_receipt_uploaded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",order.id).eq("telegram_id",user.id).select("id,order_number,total,payment_status,payment_receipt_path").single();if(ue)throw ue;
    return res.json({success:true,message:"Chek muvaffaqiyatli yuborildi. Admin tekshiradi.",data:updated})
  }catch(e){console.error("Receipt upload error:",e);const schema=/payment_receipt_path|payment_status|payment_receipt_uploaded_at/i.test(e.message||"");const bad=/Chek fayli|Chek hajmi/i.test(e.message||"");return res.status(schema?503:bad?400:500).json({success:false,message:schema?"To‘lov chek ustunlari bazada hali tayyor emas. SQL migration'ni bir marta ishga tushiring.":bad?e.message:"Chekni yuborishda xatolik"})}
});
install("get","/api/admin/orders/:id/payment-receipt",async(req,res)=>{
  if(!admin(req))return fail(res,401,"Admin sessiyasi yaroqsiz yoki tugagan");
  try{
    if(!supabase)throw new Error("Supabase sozlanmagan");const {data:order,error}=await supabase.from("orders").select("id,order_number,total,payment,payment_status,payment_receipt_path,payment_receipt_uploaded_at,payment_verified_at").eq("id",req.params.id).maybeSingle();if(error)throw error;if(!order)return fail(res,404,"Buyurtma topilmadi");if(!order.payment_receipt_path)return fail(res,404,"Bu buyurtmaga chek yuborilmagan");
    await bucket();const path=String(order.payment_receipt_path).replace(/^\/+/,"");const {data:list,error:listError}=await supabase.storage.from(BUCKET).list(path.split("/").slice(0,-1).join("/"),{search:path.split("/").pop(),limit:5});if(listError)throw listError;const fileName=path.split("/").pop();if(!(list||[]).some(x=>x.name===fileName))return fail(res,404,"Chek server Storage'da topilmadi. Buyurtma holati avtomatik ravishda tasdiqlanmaydi.");
    const {data:signed,error:se}=await supabase.storage.from(BUCKET).createSignedUrl(path,900);if(se)throw se;res.setHeader("Cache-Control","private, no-store");return res.json({success:true,data:{...order,receipt_url:signed.signedUrl}})
  }catch(e){console.error("Admin receipt view error:",e);return res.status(500).json({success:false,message:"Chekni ochishda xatolik"})}
});
install("put","/api/admin/orders/:id/payment",async(req,res)=>{
  if(!admin(req))return fail(res,401,"Admin sessiyasi yaroqsiz yoki tugagan");
  try{
    if(!supabase)throw new Error("Supabase sozlanmagan");const s=["pending","receipt_uploaded","verified","rejected"].includes(String(req.body?.payment_status))?String(req.body.payment_status):null;if(!s)return fail(res,400,"To‘lov holati noto‘g‘ri");
    const {data:current,error:ce}=await supabase.from("orders").select("id,payment,payment_status,payment_receipt_path").eq("id",req.params.id).maybeSingle();if(ce)throw ce;if(!current)return fail(res,404,"Buyurtma topilmadi");
    if(s!==String(current.payment_status||"pending")&&!allowedPaymentTransition(String(current.payment_status||"pending"),s))return fail(res,409,`Noto‘g‘ri payment state transition: ${current.payment_status||"pending"} → ${s}`);
    if(s==="verified"&&!String(current.payment_receipt_path||"").trim())return fail(res,409,"Chek mavjud bo‘lmasdan to‘lovni tasdiqlab bo‘lmaydi");
    const patch={payment_status:s,payment_verified_at:s==="verified"?new Date().toISOString():null,updated_at:new Date().toISOString()};const {data,error}=await supabase.from("orders").update(patch).eq("id",current.id).select("*").single();if(error)throw error;return res.json({success:true,data})
  }catch(e){console.error("Admin payment status error:",e);const schema=/payment_status|payment_verified_at/i.test(e.message||"");return res.status(schema?503:500).json({success:false,message:schema?"To‘lov ustunlari bazada hali tayyor emas. SQL migration'ni ishga tushiring.":"To‘lov holatini yangilashda xatolik"})}
});
