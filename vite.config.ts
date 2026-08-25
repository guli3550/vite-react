import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function adminFixes() {
  return {
    name: 'guli-admin-fixes',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (!id.endsWith('/src/admin/AdminPro.tsx')) return null
      let out = code

      out = out.replace(
        'const load=async()=>{if(!token)return;setBusy(true);',
        'const load=async(silent=false)=>{if(!token)return;if(!silent)setBusy(true);',
      )
      out = out.replace(
        'else notify("Ma’lumotlar yangilandi ✓")',
        'else if(!silent) notify("Ma’lumotlar yangilandi ✓")',
      )
      out = out.replace(
        'catch(e){notify(e instanceof Error?e.message:"Yuklashda xatolik")}finally{setBusy(false)}',
        'catch(e){if(!silent) notify(e instanceof Error?e.message:"Yuklashda xatolik")}finally{if(!silent)setBusy(false)}',
      )
      out = out.replace(
        'useEffect(()=>{if(!token)return;load();const timer=window.setInterval(()=>load(),15000);return()=>window.clearInterval(timer)},[token]);',
        'useEffect(()=>{if(!token)return;load(false);const timer=window.setInterval(()=>load(true),10000);return()=>window.clearInterval(timer)},[token]);',
      )

      const saveStart = out.indexOf(' const savePromo=async(')
      const saveEnd = out.indexOf(' const updateStatus=', saveStart)
      if (saveStart >= 0 && saveEnd > saveStart) {
        const replacement = ' const savePromo=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const code=promo.code.trim().toUpperCase();const discount=Number(promo.discount_value);const min=Number(promo.min_order_amount||0);const limit=promo.usage_limit==null||promo.usage_limit===null?null:Number(promo.usage_limit);const type=promo.discount_type===\'fixed\'?\'fixed\':\'percent\';if(!/^[A-Z0-9_-]{3,40}$/.test(code))throw Error("Promo kodi 3–40 belgidan iborat bo‘lsin (masalan: GULI10)");if(!Number.isFinite(discount)||discount<=0)throw Error("Chegirma 0 dan katta bo‘lishi kerak");if(type===\'percent\'&&discount>100)throw Error("Foizli chegirma 100% dan oshmasin");if(!Number.isFinite(min)||min<0)throw Error("Minimal buyurtma noto‘g‘ri");if(limit!==null&&(!Number.isInteger(limit)||limit<1))throw Error("Limit kamida 1 bo‘lishi kerak yoki bo‘sh qoldiring");const payload={...promo,code,discount_type:type,discount_value:discount,min_order_amount:min,usage_limit:limit};const r=promo.id?await request(`/api/admin/promos/${promo.id}`,{method:"PUT",body:JSON.stringify(payload)}):await request("/api/admin/promos",{method:"POST",body:JSON.stringify(payload)});setPromos(x=>promo.id?x.map(p=>p.id===promo.id?r.data:p):[r.data,...x]);setPromoOpen(false);notify("Promo kod muvaffaqiyatli saqlandi ✓")}catch(e){notify(e instanceof Error?e.message:"Promo kod yaratishda xatolik")}finally{setBusy(false)}};\n'
        out = out.slice(0, saveStart) + replacement + out.slice(saveEnd)
      }

      const modalStart = out.indexOf('function PromoModal(')
      const modalEnd = out.indexOf('function Modal(', modalStart)
      if (modalStart >= 0 && modalEnd > modalStart) {
        const replacement = 'function PromoModal({value,busy,onClose,onChange,onSave}:{value:Promo;busy:boolean;onClose:()=>void;onChange:(v:Promo)=>void;onSave:(e:FormEvent)=>void}){const set=(k:keyof Promo,v:any)=>onChange({...value,[k]:v});const replaceZeroOnFocus=(e:React.FocusEvent<HTMLInputElement>)=>{if(e.currentTarget.value==="0")e.currentTarget.select()};return <Modal title={value.id?"Promo tahrirlash":"Yangi promo"} eyebrow="MARKETING" onClose={onClose}><form onSubmit={onSave}><div className="formGrid"><label>Kod<input value={value.code} onChange={e=>set("code",e.target.value.toUpperCase().replace(/\\s/g,""))} placeholder="Masalan: GULI10" maxLength={40} pattern="[A-Za-z0-9_-]{3,40}" required/><small>Faqat harf, raqam, _ va - ishlating.</small></label><label>Chegirma turi<select value={value.discount_type} onChange={e=>set("discount_type",e.target.value==="fixed"?"fixed":"percent")}><option value="percent">Foiz (%)</option><option value="fixed">So‘m miqdori</option></select><small>Foizli yoki aynan belgilangan so‘m chegirmasi.</small></label><label>{value.discount_type==="fixed"?"Chegirma (so‘m)":"Chegirma (%)"}<input type="number" min="1" max={value.discount_type==="percent"?100:undefined} step="1" value={value.discount_value||""} inputMode="numeric" onFocus={replaceZeroOnFocus} onChange={e=>set("discount_value",e.target.value===""?0:Number(e.target.value))} placeholder={value.discount_type==="fixed"?"Masalan: 10000":"Masalan: 10"}/><small>{value.discount_type==="fixed"?"Mijoz savatidan aynan shu so‘m miqdori chegiriladi.":"Mijoz savatidan shu foiz chegiriladi."}</small></label><label>Minimal buyurtma (ixtiyoriy)<input type="number" min="0" step="1" inputMode="numeric" value={value.min_order_amount} onFocus={replaceZeroOnFocus} onChange={e=>set("min_order_amount",e.target.value===""?0:Number(e.target.value))}/><small>0 bo‘lsa minimal summa talabi yo‘q.</small></label><label>Foydalanish limiti (ixtiyoriy)<input type="number" min="1" step="1" value={value.usage_limit??""} onChange={e=>set("usage_limit",e.target.value===""?null:Number(e.target.value))} placeholder="∞"/><small>Bo‘sh qoldirilsa cheksiz.</small></label><label>Holat<select value={value.active?"active":"off"} onChange={e=>set("active",e.target.value==="active")}><option value="active">Faol</option><option value="off">O‘chiq</option></select></label></div><div className="modalActions"><button type="button" onClick={onClose}>Bekor qilish</button><button className="proPrimary" disabled={busy}>{busy?"Saqlanmoqda…":"Saqlash"}</button></div></form></Modal>}\n'
        out = out.slice(0, modalStart) + replacement + out.slice(modalEnd)
      }

      return { code: out, map: null }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [adminFixes(), react()],
})
