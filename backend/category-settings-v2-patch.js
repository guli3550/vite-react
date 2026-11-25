const crypto = require("crypto");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

function getSupabase() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "");
  const key = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "").trim().replace(/^['"]|['"]$/g, "");
  if (!url || !key) throw new Error("Supabase is not configured");
  if (!globalThis.__GULI_CATEGORY_SUPABASE__) {
    globalThis.__GULI_CATEGORY_SUPABASE__ = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return globalThis.__GULI_CATEGORY_SUPABASE__;
}

const CATEGORIES = [
  { slug: "pinyuar", name: "Pinyuar", sort_order: 1 },
  { slug: "pijama", name: "Pijama", sort_order: 2 },
  { slug: "byustgalter", name: "Byusgalter", sort_order: 3 },
  { slug: "mayka", name: "Mayka", sort_order: 4 },
  { slug: "tursik", name: "Tursik", sort_order: 5 },
];

function safeEqual(a,b) {
  const x=Buffer.from(String(a)), y=Buffer.from(String(b));
  return x.length===y.length && crypto.timingSafeEqual(x,y);
}
function verifyAdminToken(token) {
  try {
    const secret=String(process.env.ADMIN_SECRET||"");
    if(!secret||!token) return false;
    const [body,sig]=String(token).split(".");
    if(!body||!sig) return false;
    const expected=crypto.createHmac("sha256",secret).update(body).digest("base64url");
    if(!safeEqual(sig,expected)) return false;
    const p=JSON.parse(Buffer.from(body,"base64url").toString("utf8"));
    return p.role==="admin" && Number(p.exp)>Date.now();
  } catch { return false; }
}
function requireAdmin(req,res,next) {
  const h=String(req.headers.authorization||"");
  const token=h.startsWith("Bearer ")?h.slice(7):"";
  if(!verifyAdminToken(token)) return res.status(401).json({success:false,message:"Admin sessiyasi yaroqsiz yoki tugagan"});
  next();
}
function storageUrl(bucket,path) {
  const base=String(process.env.SUPABASE_URL||"").replace(/\/$/,"");
  const clean=String(path||"").replace(/^\/+/, "").replace(new RegExp("^"+bucket+"/"), "");
  return base+"/storage/v1/object/public/"+bucket+"/"+clean;
}

async function readCategories() {
  const db=getSupabase();
  const {data:settings,error:se}=await db.from("category_settings").select("slug,name,image_url,sort_order,active,updated_at").eq("active",true).order("sort_order",{ascending:true});
  if(se && !/does not exist|relation .* not found|schema cache/i.test(se.message||"")) throw se;
  const {data:legacy,error:le}=await db.from("categories").select("id,slug,name,sort_order,is_active,updated_at,category_images(storage_path,version,created_at)").eq("is_active",true).order("sort_order",{ascending:true});
  if(le) throw le;
  const map=new Map((settings||[]).map(x=>[x.slug,x]));
  return (legacy||CATEGORIES).map(item=>{
    const setting=map.get(item.slug);
    const images=Array.isArray(item.category_images)?[...item.category_images].sort((a,b)=>Number(b.version||0)-Number(a.version||0)):[];
    const latest=images[0];
    return {
      slug:item.slug,
      name:typeof item.name==="string"?item.name:(setting?.name||CATEGORIES.find(c=>c.slug===item.slug)?.name||item.slug),
      image_url:latest?.storage_path?storageUrl("category-media",latest.storage_path)+"?v="+encodeURIComponent(latest.version||latest.created_at||Date.now()):String(setting?.image_url||""),
      sort_order:Number(item.sort_order??setting?.sort_order??0),
      active:item.is_active!==false&&setting?.active!==false,
      updated_at:item.updated_at||setting?.updated_at||null
    };
  }).filter(x=>x.active).sort((a,b)=>a.sort_order-b.sort_order).slice(0,5);
}

function installRoutes(app) {
  if(app.__guliCategorySettingsV2Installed) return;
  app.__guliCategorySettingsV2Installed=true;
  const db=()=>getSupabase();

  app.get("/api/categories", async (_req,res)=>{
    try { res.setHeader("Cache-Control","no-store, max-age=0"); res.json({success:true,data:await readCategories()}); }
    catch(error){ console.error("Categories API error:",error); res.status(500).json({success:false,message:"Kategoriyalarni yuklashda xatolik"}); }
  });

  app.get("/api/admin/categories", requireAdmin, async (_req,res)=>{
    try {
      const {data,error}=await db().from("categories").select("id,slug,name,sort_order,is_active,updated_at,category_images(storage_path,version,created_at)").order("sort_order",{ascending:true});
      if(error) throw error;
      const rows=(data||[]).map(item=>{
        const latest=[...(item.category_images||[])].sort((a,b)=>Number(b.version||0)-Number(a.version||0))[0];
        return {...item,image_url:latest?.storage_path?storageUrl("category-media",latest.storage_path)+"?v="+encodeURIComponent(latest.version||latest.created_at||Date.now()):""};
      });
      res.setHeader("Cache-Control","no-store, max-age=0"); res.json({success:true,data:rows});
    } catch(error){ console.error("Admin categories API error:",error); res.status(500).json({success:false,message:"Kategoriyalarni yuklashda xatolik"}); }
  });

  app.put("/api/admin/categories/:slug", requireAdmin, async (req,res)=>{
    try {
      const slug=String(req.params.slug||"").trim().toLowerCase();
      const current=CATEGORIES.find(x=>x.slug===slug);
      if(!current) return res.status(404).json({success:false,message:"Kategoriya topilmadi"});
      const name=String(req.body?.name||current.name).trim().slice(0,60);
      const imageUrl=String(req.body?.image_url||"").trim();
      if(!imageUrl||!/^https?:\/\//i.test(imageUrl)) return res.status(400).json({success:false,message:"Kategoriya rasmi uchun to‘g‘ri URL kerak"});
      const {data,error}=await db().from("category_settings").upsert({slug,name,image_url:imageUrl,sort_order:current.sort_order,active:true,updated_at:new Date().toISOString()},{onConflict:"slug"}).select("slug,name,image_url,sort_order,active,updated_at").single();
      if(error) throw error; res.json({success:true,data});
    } catch(error){ console.error("Admin category update error:",error); res.status(500).json({success:false,message:error.message||"Kategoriya saqlanmadi"}); }
  });

  app.get("/api/settings/banner", async (_req,res)=>{
    try {
      const {data,error}=await db().from("category_settings").select("image_url").eq("slug","promo_banner").maybeSingle();
      if(error) throw error; res.setHeader("Cache-Control","no-store, max-age=0"); res.json({success:true,url:data?.image_url||null});
    } catch(error){ console.error("Get banner error:",error); res.status(500).json({success:false,message:"Banner rasmini yuklashda xatolik"}); }
  });

  // Short-lived server cache keeps the banner manifest off the DB hot path.
  // Banner image URLs are immutable (timestamped uploads), so the browser can safely
  // cache the manifest briefly and refresh it in the background.
  let publicBannerCache = { expiresAt: 0, data: null };

  app.get("/api/banners", async (_req,res)=>{
    try {
      const now = Date.now();
      if (publicBannerCache.data && publicBannerCache.expiresAt > now) {
        res.setHeader("Cache-Control","public, max-age=30, stale-while-revalidate=300");
        return res.json({success:true,data:publicBannerCache.data});
      }

      const {data,error}=await db().from("category_settings").select("slug,name,image_url,sort_order,active,updated_at").like("slug","banner_%").order("sort_order",{ascending:true});
      if(error) throw error;
      const banners=(data||[]).map((item,idx)=>{
        let meta={}; try{meta=JSON.parse(item.name||"{}")}catch{meta={title:item.name}};
        return {id:item.slug.replace(/^banner_/,"")||`banner-${idx+1}`,imageUrl:item.image_url,title:meta.title||"Maxsus Taklif",subtitle:meta.subtitle||"",badgeText:meta.badgeText||"TOP SOTILGAN",ctaText:meta.ctaText||"Xarid qilish",actionType:meta.actionType||"catalog",actionTarget:meta.actionTarget||"",active:item.active!==false,createdAt:item.updated_at};
      });
      publicBannerCache = { expiresAt: now + 30_000, data: banners };
      res.setHeader("Cache-Control","public, max-age=30, stale-while-revalidate=300");
      res.json({success:true,data:banners});
    } catch(error){ console.error("Get banners error:",error); res.status(500).json({success:false,message:"Bannerlarni yuklashda xatolik",data:[]}); }
  });

  app.put("/api/admin/banners", requireAdmin, async (req,res)=>{
    try {
      const banners=Array.isArray(req.body?.banners)?req.body.banners:[];
      for(let i=0;i<banners.length;i++){
        const b=banners[i], slug=`banner_${b.id||i+1}`, actionTarget=String(b.actionTarget||"").trim();
        if(actionTarget&&!/^https?:\/\//i.test(actionTarget)) return res.status(400).json({success:false,message:"Banner yo‘naltirish URL manzili http:// yoki https:// bilan boshlanishi kerak"});
        const name=JSON.stringify({title:b.title||"",subtitle:b.subtitle||"",badgeText:b.badgeText||"",ctaText:b.ctaText||"",actionType:b.actionType||"catalog",actionTarget});
        const {error}=await db().from("category_settings").upsert({slug,name,image_url:b.imageUrl||"",sort_order:i+1,active:b.active!==false,updated_at:new Date().toISOString()},{onConflict:"slug"});
        if(error) throw error;
      }
      res.json({success:true,message:"Bannerlar muvaffaqiyatli saqlandi"});
    } catch(error){ console.error("Save banners error:",error); res.status(500).json({success:false,message:"Bannerlarni saqlashda xatolik"}); }
  });

  app.put("/api/admin/settings/banner", requireAdmin, async (req,res)=>{
    try {
      const imageUrl=String(req.body?.image_url||"").trim();
      if(!imageUrl||!/^https?:\/\//i.test(imageUrl)) return res.status(400).json({success:false,message:"To‘g‘ri rasm URL manzili kerak"});
      const {data,error}=await db().from("category_settings").upsert({slug:"promo_banner",name:"Promo Banner",image_url:imageUrl,sort_order:999,active:true,updated_at:new Date().toISOString()},{onConflict:"slug"}).select("image_url").single();
      if(error) throw error; res.json({success:true,url:data?.image_url});
    } catch(error){ console.error("Update banner error:",error); res.status(500).json({success:false,message:"Banner rasmini yangilashda xatolik"}); }
  });
}

if(!globalThis.__GULI_CATEGORY_SETTINGS_V2_HOOKED__) {
  globalThis.__GULI_CATEGORY_SETTINGS_V2_HOOKED__=true;
  const originalListen=express.application.listen;
  express.application.listen=function(...args){
    installRoutes(this);
    return originalListen.apply(this,args);
  };
}

module.exports={CATEGORIES,installRoutes};