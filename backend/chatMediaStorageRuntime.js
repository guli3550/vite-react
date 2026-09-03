// Private chat media storage bridge.
// Stores customer/admin chat attachments in Supabase Storage instead of browser localStorage/base64.
const express = require("express");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || "").trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim();
const BOT_TOKEN = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
const BUCKET = "chat-media";
const MAX_BYTES = 8 * 1024 * 1024;
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null;

const originalJson = express.json;
express.json = function chatMediaJson(options = {}) { return originalJson.call(this, { ...options, limit: "12mb" }); };
function safeEqual(a, b) { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function admin(req) {
  if (!ADMIN_SECRET) return false; const h = String(req.headers.authorization || ""); if (!h.startsWith("Bearer ")) return false;
  try { const [body, sig] = h.slice(7).split("."); const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url"); const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); return safeEqual(sig, expected) && p.role === "admin" && Number(p.exp) > Date.now(); } catch { return false; }
}
function telegramUser(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try { const p = new URLSearchParams(initData); const hash = p.get("hash"); const authDate = Number(p.get("auth_date")); if (!hash || !Number.isFinite(authDate) || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null; const pairs = []; p.forEach((v,k)=>{if(k!=="hash")pairs.push(`${k}=${v}`)}); pairs.sort(); const secret=crypto.createHmac("sha256","WebAppData").update(BOT_TOKEN).digest(); const calc=crypto.createHmac("sha256",secret).update(pairs.join("\n")).digest("hex"); if(!safeEqual(calc,hash))return null; const u=JSON.parse(p.get("user")||"null"); return u?.id?Number(u.id):null; } catch { return null; }
}
function chatTokenValid(req, id) {
  const n = Number(id); if (!ADMIN_SECRET) return false;
  const linked = String(req.headers["x-guli-linked-token"] || "");
  const lp = linked.split(".");
  if (lp.length === 4 && lp[0] === "linked" && Number(lp[1]) === n && Number(lp[2]) > Date.now()) {
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(`linked.${lp[1]}.${lp[2]}`).digest("base64url");
    if (safeEqual(lp[3], expected)) return true;
  }
  const guest = String(req.headers["x-guli-guest-token"] || "");
  const gp = guest.split(".");
  if (gp.length === 3 && Number(gp[0]) === n && Number(gp[1]) > Date.now()) {
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(`${gp[0]}.${gp[1]}`).digest("base64url");
    if (safeEqual(gp[2], expected)) return true;
  }
  if (gp.length === 2) {
    try { const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(gp[0]).digest("base64url"); const p=JSON.parse(Buffer.from(gp[0],"base64url").toString("utf8")); if(safeEqual(gp[1],expected)&&Number(p.guestId)===n&&Number(p.exp)>Date.now())return true; } catch {}
  }
  return false;
}
function authorized(req, id) { if (admin(req)) return true; const n=Number(id); const tg=telegramUser(String(req.headers["x-telegram-init-data"]||"")); return (tg && tg===n) || chatTokenValid(req,n); }
function decodeData(raw) { const s=String(raw||"").replace(/^data:[^;]+;base64,/i,""); if(!s||s.length>11500000||s.length%4===1||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw new Error("Fayl noto‘g‘ri kodlangan"); const b=Buffer.from(s,"base64"); if(!b.length||b.length>MAX_BYTES)throw new Error("Fayl hajmi 8 MB dan oshmasligi kerak"); return b; }
function extFor(mime,name){const n=String(name||"").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g,"");if(n&&n.length<=8)return n;const map={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif","application/pdf":"pdf","text/plain":"txt","application/zip":"zip"};return map[mime]||"bin";}
function validMime(mime){return /^image\/(jpeg|png|webp|gif)$/.test(mime)||["application/pdf","text/plain","application/zip","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(mime);}
function validMagic(buffer,mime){const h=buffer.subarray(0,12);if(mime==="image/jpeg")return h[0]===0xff&&h[1]===0xd8&&h[2]===0xff;if(mime==="image/png")return h.toString("hex",0,8)==="89504e470d0a1a0a";if(mime==="image/webp")return h.toString("ascii",0,4)==="RIFF"&&h.toString("ascii",8,12)==="WEBP";if(mime==="image/gif")return h.toString("ascii",0,6)==="GIF87a"||h.toString("ascii",0,6)==="GIF89a";if(mime==="application/pdf")return h.toString("ascii",0,5)==="%PDF-";return true;}
async function ensureBucket(){if(!supabase)throw new Error("Supabase sozlanmagan");const current=await supabase.storage.getBucket(BUCKET);if(!current.error)return;const created=await supabase.storage.createBucket(BUCKET,{public:false,fileSizeLimit:MAX_BYTES,allowedMimeTypes:["image/jpeg","image/png","image/webp","image/gif","application/pdf","text/plain","application/zip","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/msword","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]});if(created.error&&!/already exists|duplicate/i.test(created.error.message||""))throw created.error;}
function signPath(path){const exp=Date.now()+TOKEN_TTL;const body=Buffer.from(JSON.stringify({path,exp})).toString("base64url");const sig=crypto.createHmac("sha256",ADMIN_SECRET||BOT_TOKEN).update(body).digest("base64url");return `${body}.${sig}`;}
function verifyPath(token){if(!token||(!ADMIN_SECRET&&!BOT_TOKEN))return null;try{const [body,sig]=String(token).split(".");const expected=crypto.createHmac("sha256",ADMIN_SECRET||BOT_TOKEN).update(body).digest("base64url");if(!safeEqual(sig,expected))return null;const p=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));if(!p.path||Number(p.exp)<=Date.now())return null;return p.path;}catch{return null;}}

const originalPost=express.application.post;
express.application.post=function chatMediaPost(routePath,...handlers){if(routePath==="/api/chat/media-upload"){return originalPost.call(this,routePath,async(req,res)=>{try{const id=Number(req.body?.telegram_id);if(!Number.isSafeInteger(id)||!authorized(req,id))return res.status(401).json({success:false,message:"Chat sessiyasi tasdiqlanmadi"});const mimeType=String(req.body?.mimeType||req.body?.mime_type||"").toLowerCase();if(!validMime(mimeType))return res.status(400).json({success:false,message:"Bu fayl turi qo‘llab-quvvatlanmaydi"});const buffer=decodeData(req.body?.data);if(!validMagic(buffer,mimeType))return res.status(400).json({success:false,message:"Fayl formati noto‘g‘ri"});await ensureBucket();const safeName=String(req.body?.fileName||"file").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-80);const path=`messages/${id}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extFor(mimeType,safeName)}`;const uploaded=await supabase.storage.from(BUCKET).upload(path,buffer,{contentType:mimeType,cacheControl:"31536000",upsert:false});if(uploaded.error)throw uploaded.error;const token=signPath(path);return res.json({success:true,data:{mediaUrl:`/api/chat/media-file/${token}`,mediaPath:path,fileName:safeName,type:String(req.body?.type||"file"),mimeType}});}catch(e){console.error("Chat media upload error:",e);return res.status(500).json({success:false,message:e?.message||"Faylni saqlashda xatolik"});}});}return originalPost.call(this,routePath,...handlers);};

const originalGet=express.application.get;
express.application.get=function chatMediaGet(routePath,...handlers){if(routePath==="/api/chat/media-file/:token"){return originalGet.call(this,routePath,async(req,res)=>{try{const path=verifyPath(req.params.token);if(!path)return res.status(404).json({success:false,message:"Fayl havolasi eskirgan yoki yaroqsiz"});await ensureBucket();const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,3600);if(error||!data?.signedUrl)return res.status(404).json({success:false,message:"Fayl Storage'da topilmadi"});res.setHeader("Cache-Control","private, max-age=300");return res.redirect(302,data.signedUrl);}catch(e){console.error("Chat media proxy error:",e);return res.status(500).json({success:false,message:"Faylni ochishda xatolik"});}});}return originalGet.call(this,routePath,...handlers);};
