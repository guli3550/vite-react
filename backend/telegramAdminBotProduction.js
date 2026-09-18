// GULI production admin bot: one order = one Telegram media-group notification; every image is separate, with actions on the album.
const crypto=require('crypto');const {createClient}=require('@supabase/supabase-js');const {runGeminiConversation}=require('./adminAiChatRuntime');
const ADMIN_BOT=String(process.env.TELEGRAM_ADMIN_BOT_TOKEN||'').trim(),CUSTOMER_BOT=String(process.env.TELEGRAM_BOT_TOKEN||'').trim(),URL=String(process.env.SUPABASE_URL||'').trim(),KEY=String(process.env.SUPABASE_SECRET_KEY||'').trim();
const db=URL&&KEY?createClient(URL,KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const state=globalThis.__GULI_ADMIN_PROD_BOT__||{running:false,offset:0,sigs:new Map(),startedAt:new Date().toISOString(),aiHistory:new Map(),aiRate:new Map(),aiActive:new Set(),aiModel:new Map()};globalThis.__GULI_ADMIN_PROD_BOT__=state;
async function tg(method,body,token=ADMIN_BOT){if(!token)throw Error('Telegram bot token sozlanmagan');const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>null);if(!r.ok||!j?.ok)throw Error(j?.description||`Telegram ${r.status}`);return j.result}
async function admins(){const s=new Set(String(process.env.TELEGRAM_ADMIN_CHAT_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));if(db){const r=await db.from('telegram_admin_bot_chats').select('chat_id').eq('active',true);for(const x of r.data||[])s.add(String(x.chat_id))}return[...s]}
const money=v=>`${Math.round(Number(v||0)).toLocaleString('uz-UZ')} so‘m`;
function caption(o,title='🛒 YANGI BUYURTMA'){const items=Array.isArray(o.items)?o.items:[],lines=items.slice(0,15).map((x,i)=>{const p=x?.product||x?.product_data||x?.productDetails||x||{};return`${i+1}. ${p.name||p.title||x.name||'Mahsulot'}${p.product_code||x.product_code?` #${p.product_code||x.product_code}`:''} × ${Number(x.quantity||x.qty||1)} dona`});const ps=String(o.payment_status||'pending').toLowerCase();const pay=ps==='verified'?'✅ To‘lov tasdiqlangan':ps==='rejected'?'❌ Chek rad etilgan':ps==='receipt_uploaded'?'🧾 Chek yuklangan — tekshirish kutilmoqda':'⏳ To‘lov kutilmoqda';return[`<b>${title}</b>`,`🛒 <b>№:</b> <code>${o.order_number||o.id}</code>`,`👤 <b>Mijoz:</b> ${o.customer_name||[o.first_name,o.last_name].filter(Boolean).join(' ')||o.username||'Mijoz'}`,`📞 <b>Telefon:</b> ${o.phone||'—'}`,`💰 <b>Jami:</b> ${money(o.total)}`,`💳 <b>To‘lov:</b> ${o.payment||'—'}`,`🔎 <b>To‘lov holati:</b> ${pay}`,`📦 <b>Status:</b> ${o.status||'⏳ Buyurtma kutilmoqda'}`,'',`👗 <b>Mahsulotlar (${items.length} ta):</b>`,lines.join('\n')||'—','',`🧾 <b>Cheklar:</b> ${Array.isArray(o.payment_receipt_history)?o.payment_receipt_history.length:(o.payment_receipt_path?1:0)} ta`].join('\n').slice(0,1024)}
function keyboard(o){const ps=String(o.payment_status||'pending').toLowerCase();return o?.id&&['pending','receipt_uploaded'].includes(ps)?{inline_keyboard:[[{text:'✅ To‘lovni tasdiqlash',callback_data:`guli_pay:verified:${o.id}`},{text:'❌ Chekni rad etish',callback_data:`guli_pay:rejected:${o.id}`}]]}:{inline_keyboard:[]}}
function productImages(o){const out=[];for(const x of Array.isArray(o.items)?o.items:[]){const p=x?.product||x?.product_data||x?.productDetails||{};for(const u of [x.image,x.image_url,x.photo,p.image,p.image_url,...(Array.isArray(p.images)?p.images:[])])if(typeof u==='string'&&/^https?:\/\//i.test(u)&&!out.includes(u)){out.push(u);break}}return out}
async function signed(path){if(!db||!path)return'';try{return(await db.storage.from('payment-receipts').createSignedUrl(String(path).replace(/^\/+/,''),86400)).data?.signedUrl||''}catch{return''}}
async function receiptImages(o){const h=Array.isArray(o.payment_receipt_history)?o.payment_receipt_history:[],paths=h.map(x=>x?.path).filter(Boolean);if(o.payment_receipt_path&&!paths.includes(o.payment_receipt_path))paths.push(o.payment_receipt_path);const out=[];for(const p of paths){const u=await signed(p);if(u)out.push(u)}return out}
async function mediaUrls(o){return[...productImages(o),...(await receiptImages(o))].filter((u,i,a)=>u&&a.indexOf(u)===i).slice(0,10)}
async function existing(o,chat){if(!db)return null;const r=await db.from('telegram_admin_bot_order_messages').select('message_id,message_ids').eq('order_id',String(o.id)).eq('chat_id',Number(chat)).maybeSingle();if(!r.data)return null;return{mid:Number(r.data.message_id||0)||null,ids:Array.isArray(r.data.message_ids)?r.data.message_ids.map(Number).filter(Boolean):[]}}
async function save(o,chat,ids){const list=(Array.isArray(ids)?ids:[]).map(Number).filter(Boolean);const mid=list[0]||null;if(db&&mid)await db.from('telegram_admin_bot_order_messages').upsert({order_id:String(o.id),chat_id:Number(chat),message_id:mid,message_ids:list,updated_at:new Date().toISOString()},{onConflict:'order_id,chat_id'})}
async function sendAlbum(chat,o,title){const urls=await mediaUrls(o);if(!urls.length)return null;const cap=caption(o,title);try{if(urls.length===1){const sent=await tg('sendPhoto',{chat_id:Number(chat),photo:urls[0],caption:cap,parse_mode:'HTML',reply_markup:keyboard(o)});const ids=[Number(sent?.message_id||0)].filter(Boolean);if(ids.length)await save(o,chat,ids);return ids[0]||null}const items=urls.map((u,i)=>({type:'photo',media:u,...(i===0?{caption:cap,parse_mode:'HTML'}:{})}));const sent=await tg('sendMediaGroup',{chat_id:Number(chat),media:items,reply_markup:keyboard(o)});const ids=(sent||[]).map(x=>Number(x?.message_id||0)).filter(Boolean);if(ids.length)await save(o,chat,ids);return ids[0]||null}catch(e){console.warn('[GULI album]',e.message);return null}}
async function replaceAlbum(chat,o,title){const old=await existing(o,chat);if(old?.ids?.length){await tg('deleteMessages',{chat_id:Number(chat),message_ids:old.ids}).catch(async()=>{for(const id of old.ids)await tg('deleteMessage',{chat_id:Number(chat),message_id:id}).catch(()=>{})})}else if(old?.mid){await tg('deleteMessage',{chat_id:Number(chat),message_id:old.mid}).catch(()=>{})}return sendAlbum(chat,o,title)}
async function updateControl(chat,o,title){const old=await existing(o,chat);const ps=String(o.payment_status||'').toLowerCase();if(ps==='receipt_uploaded'&&!old?.ids?.length)return sendAlbum(chat,o,title);if(!old?.mid)return sendAlbum(chat,o,title);try{await tg('editMessageCaption',{chat_id:Number(chat),message_id:old.mid,caption:caption(o,title),parse_mode:'HTML',reply_markup:keyboard(o)});return old.mid}catch{try{await tg('editMessageReplyMarkup',{chat_id:Number(chat),message_id:old.mid,reply_markup:keyboard(o)});return old.mid}catch{return sendAlbum(chat,o,title)}}}
function customerBody(o){const items=Array.isArray(o.items)?o.items:[],lines=items.slice(0,15).map(x=>{const p=x?.product||x?.product_data||x||{};return`• ${p.name||p.title||x.name||'Mahsulot'} × ${Number(x.quantity||x.qty||1)} dona`}),ps=String(o.payment_status||'pending').toLowerCase(),pay=ps==='verified'?'✅ To‘lov tasdiqlandi':ps==='rejected'?'❌ Chek rad etildi':ps==='receipt_uploaded'?'🧾 Chek qabul qilindi — tekshirilmoqda':'⏳ To‘lov kutilmoqda';return[`🛍 <b>GULI Lingerie — BUYURTMA</b>`,`№ <b>${o.order_number||o.id}</b>`,``,`📦 <b>Buyurtma statusi:</b> <b>${o.status||'⏳ Buyurtma kutilmoqda'}</b>`,`💳 <b>To‘lov:</b> ${pay}`,'',`👗 <b>Mahsulotlar (${items.length} ta):</b>`,lines.join('\n')||'—','',`💰 <b>Jami:</b> ${money(o.total)}`].join('\n').slice(0,3900)}
async function ensureCustomerStatusMessage(o){if(!CUSTOMER_BOT||!db||!o?.telegram_id||o?.telegram_status_message_id)return Number(o?.telegram_status_message_id||0)||null;try{const sent=await tg('sendMessage',{chat_id:Number(o.telegram_id),text:customerBody(o),parse_mode:'HTML',disable_web_page_preview:true},CUSTOMER_BOT);const mid=Number(sent?.message_id||0)||null;if(mid){const r=await db.from('orders').update({telegram_status_message_id:mid}).eq('id',o.id).select('telegram_status_message_id').maybeSingle();return Number(r.data?.telegram_status_message_id||mid)||mid}}catch(e){console.warn('[GULI customer status create]',e.message)}return null}
async function updateCustomer(o){if(!CUSTOMER_BOT||!o?.telegram_id)return;let mid=Number(o.telegram_status_message_id||0)||null;if(!mid)mid=await ensureCustomerStatusMessage(o);if(!mid)return;try{await tg('editMessageText',{chat_id:Number(o.telegram_id),message_id:mid,text:customerBody(o),parse_mode:'HTML',disable_web_page_preview:true},CUSTOMER_BOT)}catch(e){if(!/message is not modified/i.test(e.message||''))console.warn('[GULI customer status edit]',e.message)}}
async function getOrder(id){if(!db)return null;let r=await db.from('orders').select('*').eq('id',id).maybeSingle();if(!r.data&&/GULI-/i.test(String(id)))r=await db.from('orders').select('*').eq('order_number',id).maybeSingle();return r.data||null}
async function callback(c){const chat=Number(c?.message?.chat?.id||0),from=Number(c?.from?.id||0),d=String(c?.data||'');if(!chat||chat!==from)return;const ids=await admins();if(!ids.includes(String(chat))){await tg('answerCallbackQuery',{callback_query_id:c.id,text:'⛔ Ruxsat yo‘q',show_alert:true}).catch(()=>{});return}
  if(d.startsWith('guli_ai_model:')){
    const model=d.slice('guli_ai_model:'.length);
    if(!AI_MODELS[model]){await tg('answerCallbackQuery',{callback_query_id:c.id,text:'Noma’lum AI modeli',show_alert:true}).catch(()=>{});return}
    state.aiModel.set(String(chat),model);
    state.aiActive.add(String(chat));
    await tg('answerCallbackQuery',{callback_query_id:c.id,text:'✅ '+AI_MODELS[model]});
    await tg('editMessageText',{chat_id:chat,message_id:Number(c?.message?.message_id||0),text:'🤖 GULI AI modeli tanlandi: '+AI_MODELS[model]+'\n\nEndi oddiy xabar yuborishingiz mumkin. Yakunlash: /StopAi',reply_markup:{inline_keyboard:[]}}).catch(()=>{});
    return;
  }
  if(!d.startsWith('guli_pay:'))return;
  const[,decision,id]=d.split(':');if(!['verified','rejected'].includes(decision)||!id)return;const o=await getOrder(id);if(!o)return;const ps=String(o.payment_status||'pending');if(!['pending','receipt_uploaded'].includes(ps)){await tg('answerCallbackQuery',{callback_query_id:c.id,text:'Bu to‘lov bo‘yicha qaror allaqachon qabul qilingan'}).catch(()=>{});return}const patch={payment_status:decision,status:decision==='verified'?'Qabul qilindi':'Bekor qilindi',updated_at:new Date().toISOString()};patch[decision==='verified'?'payment_verified_at':'payment_rejected_at']=new Date().toISOString();const r=await db.from('orders').update(patch).eq('id',o.id).select('*').single();if(r.error)throw r.error;await updateControl(chat,r.data,decision==='verified'?'💳 TO‘LOV TASDIQLANDI':'💳 TO‘LOV RAD ETILDI');await updateCustomer(r.data);await tg('answerCallbackQuery',{callback_query_id:c.id,text:decision==='verified'?'✅ To‘lov tasdiqlandi':'❌ To‘lov rad etildi'}).catch(()=>{})}
function aiRedact(text){let s=String(text||'');for(const v of [process.env.GEMINI_API_KEY,process.env.ADMIN_SECRET,process.env.ADMIN_PASSWORD,process.env.TELEGRAM_ADMIN_BOT_TOKEN,process.env.TELEGRAM_BOT_TOKEN,process.env.SUPABASE_SECRET_KEY]){if(v&&String(v).length>=6)s=s.split(String(v)).join('[REDACTED]')}return s}
function aiChunks(text,max=3900){const s=String(text||'').trim();if(!s)return['Javob bo‘sh qaytdi.'];const out=[];for(let i=0;i<s.length;i+=max)out.push(s.slice(i,i+max));return out}
function aiRateAllowed(chat){const now=Date.now(),key=String(chat),e=state.aiRate.get(key)||{count:0,reset:now+60000};if(now>e.reset){e.count=0;e.reset=now+60000}e.count++;state.aiRate.set(key,e);return e.count<=12}
const AI_MODELS={
  'gemini-3.8-flash':'Gemini 3.8 Flash',
  'gemini-3.1-flash-lite':'Gemini 3.1 Flash Lite',
  'gemini-3.5-flash':'Gemini 3.5 Flash'
};
const DEFAULT_AI_MODEL='gemini-3.1-flash-lite';
function aiModelName(chat){return AI_MODELS[state.aiModel.get(String(chat))] ? state.aiModel.get(String(chat)) : DEFAULT_AI_MODEL}
async function sendAiModelMenu(chat){
  const selected=aiModelName(chat);
  await tg('sendMessage',{chat_id:chat,text:'🤖 GULI AI — modelni tanlang:',reply_markup:{inline_keyboard:[
    [{text:(selected==='gemini-3.8-flash'?'✅ ':'')+'Gemini 3.8 Flash',callback_data:'guli_ai_model:gemini-3.8-flash'}],
    [{text:(selected==='gemini-3.1-flash-lite'?'✅ ':'')+'Gemini 3.1 Flash Lite',callback_data:'guli_ai_model:gemini-3.1-flash-lite'}],
    [{text:(selected==='gemini-3.5-flash'?'✅ ':'')+'Gemini 3.5 Flash',callback_data:'guli_ai_model:gemini-3.5-flash'}]
  ]}});
}
async function handleAdminAiMessage(m,ids){
  const chat=Number(m?.chat?.id||0),text=String(m?.text||'').trim();
  if(!chat||!text||!ids.includes(String(chat)))return false;
  const key=String(chat);
  if(/^\/stopai(?:@\w+)?(?:\s+.*)?$/i.test(text)){
    state.aiActive.delete(key);
    await tg('sendMessage',{chat_id:chat,text:'🛑 GULI AI suhbat yakunlandi. Qayta boshlash uchun /ai yuboring.'});
    return true;
  }
  if(/^\/ai_model(?:@\w+)?(?:\s+.*)?$/i.test(text)){await sendAiModelMenu(chat);return true}
  if(/^\/ai_clear(?:@\w+)?(?:\s+.*)?$/i.test(text)){
    state.aiHistory.delete(key);
    await tg('sendMessage',{chat_id:chat,text:'🧠 GULI AI suhbat konteksti tozalandi.'});
    return true;
  }
  const match=text.match(/^\/ai(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if(match){
    state.aiActive.add(key);
    const prompt=String(match[1]||'').trim();
    if(!prompt){
      await tg('sendMessage',{chat_id:chat,text:'🤖 GULI AI suhbat boshlandi. Endi oddiy xabar yuborishingiz mumkin. Yakunlash: /StopAi'});
      return true;
    }
    if(!aiRateAllowed(chat)){await tg('sendMessage',{chat_id:chat,text:'⏳ GULI AI uchun vaqtinchalik limitga yetdingiz. Birozdan keyin qayta urinib ko‘ring.'});return true}
    return await runAdminAiPrompt(chat,prompt);
  }
  if(!state.aiActive.has(key))return false;
  if(!aiRateAllowed(chat)){await tg('sendMessage',{chat_id:chat,text:'⏳ GULI AI uchun vaqtinchalik limitga yetdingiz. Birozdan keyin qayta urinib ko‘ring.'});return true}
  return await runAdminAiPrompt(chat,text);
}
async function runAdminAiPrompt(chat,prompt){
  await tg('sendChatAction',{chat_id:chat,action:'typing'}).catch(()=>{});
  const key=String(chat),history=Array.isArray(state.aiHistory.get(key))?state.aiHistory.get(key):[];
  try{
    const started=Date.now();
    const modelName=aiModelName(chat);
    const answer=await runGeminiConversation({modelName,userPrompt:prompt,history});
    const clean=aiRedact(answer);
    state.aiHistory.set(key,[...history,{sender:'user',text:prompt},{sender:'model',text:clean}].slice(-14));
    for(const [i,chunk] of aiChunks(clean).entries())await tg('sendMessage',{chat_id:chat,text:(i===0?'🤖 GULI AI • '+AI_MODELS[modelName]+'\n\n':'')+chunk});
    console.log('[GULI admin AI] chat=%s ms=%s',chat,Date.now()-started);
  }catch(e){
    console.error('[GULI admin AI]',e?.message||e);
    await tg('sendMessage',{chat_id:chat,text:'⚠️ GULI AI hozircha javob bera olmadi. Limit yoki vaqtinchalik Gemini uzilishi bo‘lishi mumkin.'});
  }
  return true;
}
async function poll(){if(state.running||!ADMIN_BOT||!db)return;state.running=true;try{const ids=await admins();for(const u of await tg('getUpdates',{offset:state.offset,timeout:0,allowed_updates:['message','callback_query']})||[]){state.offset=Math.max(state.offset,Number(u.update_id||0)+1);if(u.callback_query)await callback(u.callback_query).catch(e=>console.error('[GULI admin callback]',e));if(u.message)await handleAdminAiMessage(u.message,ids).catch(e=>console.error('[GULI admin AI message]',e))}}finally{state.running=false}}
async function claimEvent(eventKey, eventType, orderId, maxRetries = 5) {
  if (!db) return { claimed: false, reason: 'no_db' };

  // 1. Primary: Production Atomic Locking via PostgreSQL RPC (FOR UPDATE SKIP LOCKED)
  try {
    const { data, error } = await db.rpc('claim_telegram_admin_event', {
      p_event_key: eventKey,
      p_event_type: eventType,
      p_order_id: String(orderId),
      p_max_retries: maxRetries
    });
    if (!error && data && typeof data.claimed === 'boolean') {
      return data;
    }
    if (error) {
      console.warn('[P1-C RPC WARNING] claim_telegram_admin_event RPC call failed:', error.message);
    }
  } catch (rpcErr) {
    console.warn('[P1-C RPC EXCEPTION]', rpcErr.message);
  }

  // 2. Production Enforcement: If strict RPC required, fail-closed
  if (process.env.STRICT_RPC_REQUIRED === 'true') {
    console.error('[P1-C PRODUCTION ALERT] claim_telegram_admin_event RPC is missing and STRICT_RPC_REQUIRED=true. Event aborted to prevent duplicates.');
    return { claimed: false, reason: 'rpc_missing_fail_closed' };
  }

  // 3. Fallback: Optimistic Concurrency Control via Unique Constraint & Conditional Update
  // NOTE: This fallback is NOT a distributed ACID lock with FOR UPDATE SKIP LOCKED.
  // The PostgreSQL RPC migration is a MANDATORY production requirement for true concurrency safety.
  try {
    const now = new Date();

    // Atomic Insert Attempt (PostgreSQL guarantees only 1 concurrent worker can insert with unique event_key)
    const { error: insertError } = await db.from('telegram_admin_bot_events').insert({
      event_key: eventKey,
      event_type: eventType,
      order_id: String(orderId),
      status: 'processing',
      retry_count: 0,
      next_attempt_at: now.toISOString(),
      updated_at: now.toISOString()
    });

    if (!insertError) {
      return { claimed: true, retry_count: 0 };
    }

    // If duplicate key, event already exists
    if (!/duplicate|unique/i.test(insertError.message || '')) {
      return { claimed: false, reason: 'insert_failed' };
    }

    // Row exists: inspect status and attempt atomic conditional claim
    const { data: existing } = await db
      .from('telegram_admin_bot_events')
      .select('id, status, retry_count, next_attempt_at, updated_at')
      .eq('event_key', eventKey)
      .maybeSingle();

    if (!existing) return { claimed: false, reason: 'not_found' };
    if (existing.status === 'sent') return { claimed: false, reason: 'already_sent' };
    if (existing.status === 'processing' && existing.updated_at && (now.getTime() - new Date(existing.updated_at).getTime() < 120000)) {
      return { claimed: false, reason: 'currently_processing' };
    }
    if (Number(existing.retry_count || 0) >= maxRetries) {
      return { claimed: false, reason: 'max_retries_exceeded' };
    }
    if (existing.next_attempt_at && new Date(existing.next_attempt_at) > now) {
      return { claimed: false, reason: 'backoff_waiting' };
    }

    // Conditional update: only update if status hasn't changed concurrently
    const { data: updated, error: updateError } = await db
      .from('telegram_admin_bot_events')
      .update({ status: 'processing', updated_at: now.toISOString() })
      .eq('id', existing.id)
      .eq('status', existing.status)
      .select('id');

    if (updateError || !updated || updated.length === 0) {
      return { claimed: false, reason: 'concurrent_claim_conflict' };
    }

    return { claimed: true, retry_count: Number(existing.retry_count || 0) };
  } catch (err) {
    console.warn('[GULI admin bot claim error]', err.message);
    return { claimed: false, reason: 'exception' };
  }
}

async function markEventSent(eventKey) {
  if (!db) return;
  try {
    await db
      .from('telegram_admin_bot_events')
      .update({ status: 'sent', error: null, updated_at: new Date().toISOString() })
      .eq('event_key', eventKey);
  } catch {}
}

async function markEventFailed(eventKey, error, retryCount) {
  if (!db) return;
  try {
    const nextRetry = (Number(retryCount) || 0) + 1;
    const delaySec = Math.min(300, Math.pow(2, nextRetry) * 10);
    const nextAttempt = new Date(Date.now() + delaySec * 1000).toISOString();
    await db
      .from('telegram_admin_bot_events')
      .update({
        status: 'failed',
        retry_count: nextRetry,
        error: String(error?.message || error || 'Delivery failed').slice(0, 500),
        next_attempt_at: nextAttempt,
        updated_at: new Date().toISOString()
      })
      .eq('event_key', eventKey);
  } catch {}
}

async function sync(){
  if(!db||!ADMIN_BOT)return;
  const ids=await admins();
  if(!ids.length)return;
  const r=await db.from('orders').select('*').order('created_at',{ascending:false}).limit(100);
  if(r.error)throw r.error;
  for(const o of r.data||[]){
    const sig=crypto.createHash('sha256').update(JSON.stringify({status:o.status,payment_status:o.payment_status,items:o.items,payment_receipt_history:o.payment_receipt_history,payment_receipt_path:o.payment_receipt_path,total:o.total})).digest('hex');
    const eventKey=`${o.id}-${sig}`;
    const claim = await claimEvent(eventKey, 'order_update', o.id, 5);
    if (!claim.claimed) continue;
    try {
      const{data:prev}=await db.from('telegram_admin_bot_events').select('id').eq('order_id',o.id).neq('event_key',eventKey).limit(1);
      const isUpdate=prev&&prev.length>0;
      let allSucceeded = true;
      if(!isUpdate){
        if(new Date(o.created_at||0)>=new Date(state.startedAt)){
          for(const chat of ids){
            const sentMid = await sendAlbum(chat,o,'🛒 YANGI BUYURTMA').catch(()=>null);
            if (!sentMid) allSucceeded = false;
          }
          await ensureCustomerStatusMessage(o).catch(()=>{});
        }
      }else{
        const ps=String(o.payment_status||'').toLowerCase();
        const title=ps==='verified'?'💳 TO‘LOV TASDIQLANDI':ps==='rejected'?'💳 TO‘LOV RAD ETILDI':ps==='receipt_uploaded'?'🧾 CHEK YUKLANDI — BUYURTMA YANGILANDI':'📦 BUYURTMA YANGILANDI';
        for(const chat of ids){
          let sentMid = null;
          if(ps==='receipt_uploaded') sentMid = await replaceAlbum(chat,o,title).catch(()=>null);
          else sentMid = await updateControl(chat,o,title).catch(()=>null);
          if (!sentMid) allSucceeded = false;
        }
        await updateCustomer(o).catch(()=>{});
      }
      if (allSucceeded) {
        await markEventSent(eventKey);
      } else {
        await markEventFailed(eventKey, new Error('Delivery failed for some admin chats'), claim.retry_count);
      }
    } catch (e) {
      console.warn('[GULI admin event error]', e.message);
      await markEventFailed(eventKey, e, claim.retry_count);
    }
  }
}
if(!globalThis.__GULI_ADMIN_PROD_BOT_STARTED__){globalThis.__GULI_ADMIN_PROD_BOT_STARTED__=true;(async()=>{try{await tg('setMyCommands',{commands:[{command:'ai',description:'GULI AI suhbatini boshlash'},{command:'ai_model',description:'GULI AI modelini tanlash'},{command:'stopai',description:'GULI AI suhbatini yakunlash'},{command:'ai_clear',description:'AI suhbat kontekstini tozalash'}]})}catch(e){console.warn('[GULI admin AI] command setup failed:',e.message)}while(true){try{await poll();await sync()}catch(e){console.error('[GULI admin bot]',e)}await new Promise(r=>setTimeout(r,5000))}})()}
