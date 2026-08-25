import { ChangeEvent, FormEvent, useState } from "react";
import "./AdminPro.css";
import "./ProductModalV2.css";

type Product={id?:number;product_code?:string;name:string;category:string;description:string;price:number;old_price?:number|null;image:string;images:string[];sizes:string[];colors:string[];rating:number;reviews:number;stock:number;featured:boolean;active?:boolean;sort_order?:number};

const categories=["Byustgalter","Trusik","Komplektlar","Uy kiyimlari","Sexy lingerie","Boshqalar"];
const sizes=["XS","S","M","L","XL","XXL","3XL","75B","75C","80B","80C","85B","85C","90B","90C","Universal"];
const colors=[["Qora","#111111"],["Oq","#ffffff"],["Qizil","#d91e36"],["Bordo","#800020"],["Pushti","#f4a6b8"],["Och pushti","#ffd6e0"],["Bej","#e8c9a8"],["Krem","#f5ead2"],["Jigarrang","#7a4b2a"],["To‘q ko‘k","#17365d"],["Ko‘k","#3b82c4"],["Yashil","#2f7d4a"],["Zaytun","#71823b"],["Sariq","#f1c40f"],["To‘q sariq","#e67e22"],["Binafsha","#7e57c2"],["Kulrang","#808080"]] as const;

const formatPrice=(value:number|null|undefined)=>{if(value===null||value===undefined||value===0)return "";return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g,".")};
const parsePrice=(value:string)=>{const digits=value.replace(/\D/g,"");return digits?Number(digits):0};

export default function ProductModalV2({value,busy,onClose,onChange,onSave,onUpload}:{value:Product;busy:boolean;onClose:()=>void;onChange:(v:Product)=>void;onSave:(e:FormEvent)=>void;onUpload:(file:File)=>Promise<string>}){
 const set=(k:keyof Product,v:any)=>onChange({...value,[k]:v}); const [uploading,setUploading]=useState(false); const [extraUploading,setExtraUploading]=useState(false);
 const parseColor=(v:string)=>{const [name,hex]=String(v||"").split("|");return {name:name||v,hex:hex||"#ddd"}}; const selectedColors=(value.colors||[]).map(parseColor); const hasColor=(hex:string)=>selectedColors.some(c=>c.hex.toLowerCase()===hex.toLowerCase());
 const toggleColor=(name:string,hex:string)=>{const next=hasColor(hex)?(value.colors||[]).filter(v=>parseColor(v).hex.toLowerCase()!==hex.toLowerCase()):[...(value.colors||[]),`${name}|${hex}`];set("colors",next)};
 const toggleSize=(size:string)=>{const current=value.sizes||[];set("sizes",current.includes(size)?current.filter(v=>v!==size):[...current,size])};
 const chooseMain=async(e:ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];e.target.value="";if(!file)return;setUploading(true);try{set("image",await onUpload(file))}finally{setUploading(false)}};
 const chooseExtras=async(e:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(e.target.files||[]);e.target.value="";if(!files.length)return;setExtraUploading(true);try{const urls:string[]=[];for(const file of files)urls.push(await onUpload(file));set("images",[...(value.images||[]),...urls])}finally{setExtraUploading(false)}};
 const removeExtra=(i:number)=>set("images",(value.images||[]).filter((_,n)=>n!==i));
 return <div className="modalOverlay"><div className="modalCard productModalV2"><div className="modalHead"><div><span className="proEyebrow">CATALOG</span><h2>{value.id?"Mahsulotni tahrirlash":"Yangi mahsulot"}</h2></div><button type="button" onClick={onClose}>×</button></div>
  <form onSubmit={onSave}>
   <section className="imageUploadSection"><div className="imageUploadTitle"><div><span className="proEyebrow">MEDIA</span><h3>Mahsulot rasmlari</h3></div><span className="imageHint">URL kerak emas</span></div>
    <div className="mainImagePicker">{value.image?<div className="mainImagePreview"><img src={value.image} alt="Asosiy rasm"/><button type="button" onClick={()=>set("image","")}>×</button></div>:<div className="mainImageEmpty"><span>📷</span><b>{uploading?"Yuklanmoqda…":"Asosiy rasm"}</b><small>Telefon galereyasidan tanlang</small></div>}<label className="uploadButton"><input type="file" accept="image/*" onChange={chooseMain} disabled={uploading||busy}/>{value.image?"↻ Rasmni almashtirish":"＋ Rasm tanlash"}</label></div>
    <div className="extraImageHead"><b>Qo‘shimcha rasmlar</b><label className="miniUpload"><input type="file" accept="image/*" multiple onChange={chooseExtras} disabled={extraUploading||busy}/>{extraUploading?"Yuklanmoqda…":"＋ Bir nechta rasm"}</label></div>{(value.images||[]).length>0&&<div className="extraImages">{(value.images||[]).map((url,i)=><div className="extraImage" key={`${url}-${i}`}><img src={url} alt=""/><button type="button" onClick={()=>removeExtra(i)}>×</button></div>)}</div>}
   </section>
   <div className="formGrid"><label>Mahsulot kodi<input value={value.product_code||""} placeholder="Saqlaganda avtomatik 6 xonali kod" readOnly/></label><label>Kategoriya<select value={value.category} onChange={e=>set("category",e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
   <label>Nom<input value={value.name} onChange={e=>set("name",e.target.value)} required/></label>
   <div className="formGrid"><label>Narx<input type="text" inputMode="numeric" minLength={1} value={formatPrice(value.price)} onFocus={e=>e.currentTarget.select()} onChange={e=>set("price",parsePrice(e.target.value))} placeholder="150.000" required/></label><label>Eski narx<input type="text" inputMode="numeric" value={formatPrice(value.old_price)} onFocus={e=>e.currentTarget.select()} onChange={e=>set("old_price",parsePrice(e.target.value)||null)} placeholder="200.000"/></label><label>Ombor (dona)<input type="number" inputMode="numeric" min="0" value={value.stock===0?"":String(value.stock)} onFocus={e=>{if(value.stock===0)e.currentTarget.select()}} onChange={e=>set("stock",e.target.value===""?0:Number(e.target.value))}/></label><label>Tartib<input type="number" inputMode="numeric" min="1" value={value.sort_order||""} onChange={e=>set("sort_order",e.target.value?Number(e.target.value):0)}/><small className="fieldHint">1 = eng yuqorida. Yangi mahsulot avtomatik keyingi raqamni oladi.</small></label></div>
   <label>O‘lchamlar<div className="choiceChips">{sizes.map(size=><button type="button" key={size} className={(value.sizes||[]).includes(size)?"choiceChip selected":"choiceChip"} onClick={()=>toggleSize(size)}>{size}</button>)}</div></label>
   <label>Ranglar<div className="colorPalette">{colors.map(([name,hex])=><button type="button" key={hex} className={hasColor(hex)?"colorSwatch selected":"colorSwatch"} onClick={()=>toggleColor(name,hex)} title={name}><span style={{background:hex}}/>{name}</button>)}</div><div className="selectedColorList">{selectedColors.map(c=><span key={c.hex}><i style={{background:c.hex}}/>{c.name}<b>{c.hex}</b></span>)}</div></label>
   <label>Tavsif<textarea rows={5} value={value.description} onChange={e=>set("description",e.target.value)}/></label>
   <div className="checkRow"><label><input type="checkbox" checked={value.featured} onChange={e=>set("featured",e.target.checked)}/> Tanlangan</label><label><input type="checkbox" checked={value.active!==false} onChange={e=>set("active",e.target.checked)}/> Katalogda faol</label></div>
   <div className="modalActions"><button type="button" onClick={onClose}>Bekor qilish</button><button className="proPrimary" disabled={busy||uploading||extraUploading}>{busy?"Saqlanmoqda…":"Saqlash"}</button></div>
  </form>
 </div></div>
}
