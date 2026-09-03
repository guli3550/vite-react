const express = require('express');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// The receipt is sent as base64 JSON. A 6 MB file becomes >8 MB on the wire;
// index.js previously parsed only 4 MB, so the order could be created while
// the follow-up receipt request was rejected before reaching the upload route.
const originalJson = express.json;
express.json = function patchedJson(options = {}) {
  return originalJson({ ...options, limit: '12mb' });
};

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = String(process.env.SUPABASE_SECRET_KEY || '').trim();
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '').trim();
const BUCKET = 'payment-receipts';
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession:false, autoRefreshToken:false } }) : null;

function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function requireAdmin(req){try{const h=String(req.headers.authorization||'');if(!h.startsWith('Bearer '))return false;const [body,sig]=h.slice(7).split('.');if(!body||!sig||!ADMIN_SECRET)return false;const expected=crypto.createHmac('sha256',ADMIN_SECRET).update(body).digest('base64url');if(!safeEqual(sig,expected))return false;const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));return p.role==='admin'&&Number(p.exp)>Date.now()}catch{return false}}
function clean(v){return String(v||'').replace(/^\/+/, '')}

const originalListen = express.application.listen;
express.application.listen = function patchedListen(...args){
  const app = this;
  if (!app.__guliReceiptPersistencePatchInstalled) {
    app.__guliReceiptPersistencePatchInstalled = true;
    app.delete('/api/admin/orders/:id/payment-receipt', async (req,res)=>{
      if(!requireAdmin(req)) return res.status(401).json({success:false,message:'Admin sessiyasi yaroqsiz yoki tugagan'});
      if(!supabase) return res.status(503).json({success:false,message:'Supabase sozlanmagan'});
      try{
        const {data:order,error}=await supabase.from('orders').select('id,payment_status,payment_receipt_path').eq('id',req.params.id).maybeSingle();
        if(error) throw error;
        if(!order) return res.status(404).json({success:false,message:'Buyurtma topilmadi'});
        if(!order.payment_receipt_path) return res.status(404).json({success:false,message:'Chek topilmadi'});
        const path=clean(order.payment_receipt_path);
        const {error:removeError}=await supabase.storage.from(BUCKET).remove([path]);
        if(removeError) throw removeError;
        const patch={payment_receipt_path:null,payment_receipt_uploaded_at:null,updated_at:new Date().toISOString()};
        if(String(order.payment_status||'')!=='verified') patch.payment_status='pending';
        const {error:updateError}=await supabase.from('orders').update(patch).eq('id',order.id);
        if(updateError) throw updateError;
        return res.json({success:true,message:'Chek o‘chirildi',data:{id:order.id,payment_status:String(order.payment_status||'')==='verified'?'verified':'pending'}});
      }catch(e){console.error('[Receipt delete]',e);return res.status(500).json({success:false,message:'Chekni o‘chirishda xatolik'})}
    });
  }
  return originalListen.apply(this,args);
};
