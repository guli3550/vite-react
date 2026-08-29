import { FormEvent, useEffect, useMemo, useState } from "react";
import ProductModalV2 from "./ProductModalV2";
import ReviewsAdmin from "./ReviewsAdmin";
import AdminChatTab from "../components/AdminChatTab";
import { SocialLinksAdminPanel } from "./SocialLinksAdminPanel";
import "./AdminPro.css";
import "./ReviewsNav.css";

type Product={id?:number;product_code?:string;name:string;category:string;description:string;price:number;old_price?:number|null;image:string;images:string[];sizes:string[];colors:string[];rating:number;reviews:number;stock:number;featured:boolean;active?:boolean;sort_order?:number};
type Order={id:string|number;order_number?:string;telegram_id?:number;username?:string;first_name?:string;phone?:string;total:number;subtotal:number;delivery:number;discount:number;payment:string;status:string;receipt_url?:string;address?:any;items:any[];created_at:string};
type User={telegram_id:number;username?:string;first_name?:string;last_name?:string;telegram_phone?:string;updated_at?:string};
type Promo={id?:number;code:string;discount_type:"percent"|"fixed";discount_value:number;min_order_amount:number;usage_limit:number|null;used_count:number;active:boolean};
const API=(import.meta.env.VITE_API_URL||"https://guli-lingerie-api.onrender.com").replace(/\/$/,"");
const STATUSES=["⏳ Buyurtma kutilmoqda","⏳ To'lovni tasdiqlash kutilmoqda","Qabul qilindi","Tayyorlanmoqda","Yo‘lda","Yetkazildi","Bekor qilindi"];
const emptyProduct:Product={product_code:"",name:"",category:"Penyuar",description:"",price:0,old_price:null,image:"",images:[],sizes:[],colors:[],rating:0,reviews:0,stock:0,featured:false,active:true,sort_order:0};
const emptyPromo:Promo={code:"",discount_type:"percent",discount_value:10,min_order_amount:0,usage_limit:null,used_count:0,active:true};
const money=(n:number)=>`${Math.round(Number(n)||0).toLocaleString("uz-UZ")} so'm`;
const date=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("uz-UZ",{dateStyle:"medium",timeStyle:"short"})};
const csv=(rows:any[])=>rows.map(r=>r.map((x:any)=>`"${String(x??"").replace(/"/g,'""')}"`).join(",")).join("\n");
function download(name:string,text:string){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+text],{type:"text/csv;charset=utf-8"}));a.download=name;a.click();URL.revokeObjectURL(a.href)}
const productCodes=(o:Order)=>(o.items||[]).map((it:any)=>it?.product?.product_code||it?.product_code||"").filter(Boolean);

export default function AdminPro(){
 const [token,setToken]=useState(()=>sessionStorage.getItem("guli_admin_token")||"");const [login,setLogin]=useState("");const [password,setPassword]=useState("");const [loginError,setLoginError]=useState("");const [busy,setBusy]=useState(false);const [tab,setTab]=useState("dashboard");const [dashboard,setDashboard]=useState<any>(null);const [products,setProducts]=useState<Product[]>([]);const [orders,setOrders]=useState<Order[]>([]);const [users,setUsers]=useState<User[]>([]);const [promos,setPromos]=useState<Promo[]>([]);const [contributions,setContributions]=useState<any[]>([]);const [query,setQuery]=useState("");const [statusFilter,setStatusFilter]=useState("all");const [selectedOrder,setSelectedOrder]=useState<Order|null>(null);const [selectedUser,setSelectedUser]=useState<User|null>(null);const [product,setProduct]=useState<Product>(emptyProduct);const [promo,setPromo]=useState<Promo>(emptyPromo);const [productOpen,setProductOpen]=useState(false);const [promoOpen,setPromoOpen]=useState(false);const [toast,setToast]=useState("");
 const notify=(m:string)=>{setToast(m);window.setTimeout(()=>setToast(""),3200)};const logout=()=>{sessionStorage.removeItem("guli_admin_token");setToken("")};
 const request=async(path:string,options:RequestInit={})=>{const r=await fetch(`${API}${path}`,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...(options.headers||{})}});let j:any=null;try{j=await r.json()}catch{}if(r.status===401){logout();throw Error("Admin sessiyasi tugagan")};if(!r.ok||j?.success===false)throw Error(j?.message||j?.detail||`Server xatosi (${r.status})`);return j};
 const load=async()=>{if(!token)return;setBusy(true);const errors:string[]=[];try{const results=await Promise.allSettled([request("/api/admin/dashboard"),request("/api/admin/products?limit=500"),request("/api/admin/orders?limit=500"),request("/api/admin/users?limit=500"),request("/api/admin/promos?limit=500"),request("/api/admin/contributions?limit=500")]);const [d,p,o,u,pr,cb]=results;if(d.status==="fulfilled")setDashboard(d.value.data);else errors.push(`Dashboard: ${d.reason instanceof Error?d.reason.message:"xatolik"}`);if(p.status==="fulfilled")setProducts(p.value.data||[]);else errors.push(`Mahsulotlar: ${p.reason instanceof Error?p.reason.message:"xatolik"}`);if(o.status==="fulfilled")setOrders(o.value.data||[]);else errors.push(`Buyurtmalar: ${o.reason instanceof Error?o.reason.message:"xatolik"}`);if(u.status==="fulfilled")setUsers(u.value.data||[]);else errors.push(`Mijozlar: ${u.reason instanceof Error?u.reason.message:"xatolik"}`);if(pr.status==="fulfilled")setPromos(pr.value.data||[]);else errors.push(`Promo kodlar: ${pr.reason instanceof Error?pr.reason.message:"xatolik"}`);if(cb.status==="fulfilled")setContributions(cb.value.data||[]);else errors.push(`Saxovat: ${cb.reason instanceof Error?cb.reason.message:"xatolik"}`);if(errors.length)notify(errors.join(" • "));else notify("Ma’lumotlar yangilandi ✓")}catch(e){notify(e instanceof Error?e.message:"Yuklashda xatolik")}finally{setBusy(false)}};
 useEffect(()=>{if(!token)return;load();const timer=window.setInterval(()=>load(),15000);return()=>window.clearInterval(timer)},[token]);
 const doLogin=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setLoginError("");try{const r=await fetch(`${API}/api/admin/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:login,password})});const j=await r.json();if(!r.ok||!j.success)throw Error(j.message||"Kirish rad etildi");sessionStorage.setItem("guli_admin_token",j.token);setToken(j.token)}catch(e){setLoginError(e instanceof Error?e.message:"Kirishda xatolik")}finally{setBusy(false)}};
 const productsFiltered=useMemo(()=>{const q=query.trim().toLowerCase();return !q?products:products.filter(p=>`${p.product_code||""} ${p.name} ${p.category} ${p.id||""}`.toLowerCase().includes(q))},[products,query]);
 const ordersFiltered=useMemo(()=>{const q=query.trim().toLowerCase();return orders.filter(o=>(statusFilter==="all"||o.status===statusFilter)&&(!q||`${productCodes(o).join(" ")} ${o.order_number||o.id} ${o.first_name||""} ${o.username||""} ${o.phone||""}`.toLowerCase().includes(q)))},[orders,statusFilter,query]);
 const usersFiltered=useMemo(()=>users.filter(u=>`${u.telegram_id} ${u.username||""} ${u.first_name||""} ${u.last_name||""} ${u.telegram_phone||""}`.toLowerCase().includes(query.toLowerCase())),[users,query]);
 const uploadImage=async(file:File)=>{if(!file.type.startsWith("image/"))throw Error("Faqat rasm fayli tanlang");setBusy(true);try{const bitmap=await createImageBitmap(file);const max=1600;const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext("2d");if(!ctx)throw Error("Rasm tayyorlashda xatolik");ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const dataUrl=canvas.toDataURL("image/webp",0.82);const data=dataUrl.split(",")[1];const r=await request("/api/admin/upload-image",{method:"POST",body:JSON.stringify({data,mimeType:"image/webp",extension:"webp"})});notify("Rasm yuklandi ✓");return r.data.url as string}catch(e){notify(e instanceof Error?e.message:"Rasmni yuklashda xatolik");throw e}finally{setBusy(false)}};
 const saveProduct=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const payload={...product,price:Number(product.price),old_price:product.old_price?Number(product.old_price):null,stock:Number(product.stock),rating:Number(product.rating),reviews:Number(product.reviews),sort_order:Number(product.sort_order||0)||(!product.id?Math.max(0,...products.map(p=>Number(p.sort_order)||0))+1:0)};const r=product.id?await request(`/api/admin/products/${product.id}`,{method:"PUT",body:JSON.stringify(payload)}):await request("/api/admin/products",{method:"POST",body:JSON.stringify(payload)});setProducts(x=>product.id?x.map(p=>p.id===product.id?r.data:p):[r.data,...x]);setProductOpen(false);notify(`Mahsulot saqlandi${r.data?.product_code?` · ${r.data.product_code}`:""} ✓`)}catch(e){notify(e instanceof Error?e.message:"Saqlashda xatolik")}finally{setBusy(false)}};
 const savePromo=async(e:FormEvent)=>{e.preventDefault();setBusy(true);try{const code=promo.code.trim().toUpperCase();const discount=Number(promo.discount_value);const min=Number(promo.min_order_amount||0);const limit=promo.usage_limit==null||promo.usage_limit===null?null:Number(promo.usage_limit);if(!/^[A-Z0-9_-]{3,40}$/.test(code))throw Error("Promo kodi 3–40 belgidan iborat bo‘lsin (masalan: GULI10)");if(!Number.isFinite(discount)||discount<=0||discount>100)throw Error("Chegirma foizi 1 dan 100 gacha bo‘lishi kerak");if(!Number.isFinite(min)||min<0)throw Error("Minimal buyurtma noto‘g‘ri");if(limit!==null&&(!Number.isInteger(limit)||limit<1))throw Error("Limit kamida 1 bo‘lishi kerak yoki bo‘sh qoldiring");const payload={...promo,code,discount_type:"percent",discount_value:discount,min_order_amount:min,usage_limit:limit};const r=promo.id?await request(`/api/admin/promos/${promo.id}`,{method:"PUT",body:JSON.stringify(payload)}):await request("/api/admin/promos",{method:"POST",body:JSON.stringify(payload)});setPromos(x=>promo.id?x.map(p=>p.id===promo.id?r.data:p):[r.data,...x]);setPromoOpen(false);notify("Promo kod muvaffaqiyatli saqlandi ✓")}catch(e){notify(e instanceof Error?e.message:"Promo kod yaratishda xatolik")}finally{setBusy(false)}};
 const updateStatus=async(o:Order,status:string)=>{try{const r=await request(`/api/admin/orders/${o.id}`,{method:"PUT",body:JSON.stringify({status})});setOrders(x=>x.map(v=>v.id===o.id?r.data:v));setSelectedOrder(r.data);notify("Status yangilandi ✓")}catch(e){notify(e instanceof Error?e.message:"Status xatosi")}};
 const updatePaymentStatus=async(o:Order,payment_status:string)=>{try{const r=await request(`/api/admin/orders/${o.id}/payment`,{method:"PUT",body:JSON.stringify({payment_status})});setOrders(x=>x.map(v=>v.id===o.id?r.data:v));setSelectedOrder(r.data);notify(payment_status==='verified'?"To‘lov tasdiqlandi ✓":"To‘lov rad etildi ✕")}catch(e){notify(e instanceof Error?e.message:"To‘lovni yangilashda xatolik")}};
 const hideProduct=async(p:Product)=>{try{const r=await request(`/api/admin/products/${p.id}`,{method:"DELETE"});setProducts(x=>x.map(v=>v.id===p.id?r.data:v));notify("Mahsulot yashirildi")}catch(e){notify(e instanceof Error?e.message:"Xatolik")}};
 if(!token)return <div className="proLogin"><div className="loginAura"/><form className="proLoginCard" onSubmit={doLogin}><div className="proLogo"><img src="/guli_logo.jpg" alt="Guli Premium" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }} /></div><span className="proEyebrow">GULI PREMIUM</span><h1>Control Center</h1><p>Do‘konni bitta professional paneldan boshqaring.</p><label>Login<input value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username" required/></label><label>Parol<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>{loginError&&<div className="proError">{loginError}</div>}<button className="proPrimary" disabled={busy}>{busy?"Tekshirilmoqda…":"Kirish →"}</button><small>Admin tokeni faqat sessionStorage’da saqlanadi.</small></form></div>;
 const nav=[ ["dashboard","⌂","Boshqaruv"],["products","◈","Mahsulotlar"],["orders","▣","Buyurtmalar"],["customers","♙","Mijozlar"],["reviews","★","Sharhlar"],["promos","%","Promo"],["social","🌐","Ijtimoiy tarmoqlar"],["banner","🖼️","Reklama Banneri"],["chat","💬","Onlayn Chat"],["contributions","🤗","Saxovat"] ];
 const revenue=Number(dashboard?.todayRevenue||0);const title=nav.find(n=>n[0]===tab)?.[2]||"Boshqaruv";
 return <div className="proShell"><aside className="proSide"><div className="proBrand"><span style={{ overflow: "hidden", display: "inline-block", borderRadius: "50%" }}><img src="/guli_logo.jpg" alt="Guli Premium" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></span><div><b>GULI</b><small>PREMIUM ADMIN</small></div></div><div className="sideNav">{nav.map(n=><button key={n[0]} className={tab===n[0]?"active":""} onClick={()=>{setTab(n[0]);setQuery("")}}><i>{n[1]}</i>{n[2]}</button>)}</div><div className="sideBottom"><span className="online"><b/> Online</span><button onClick={logout}>↪ Chiqish</button></div></aside>
 <main className="proMain"><header className="proTop"><div><span className="proEyebrow">GULI PREMIUM CONTROL</span><h1>{title}</h1></div><div className="topActions"><span className="dateNow">Bugun</span><button onClick={load} disabled={busy}>↻ Yangilash</button></div></header>
 {tab!=="dashboard"&&tab!=="reviews"&&<div className="proToolbar"><div className="proSearch">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tab==="products"?"Mahsulot nomi, kategoriya yoki 6 xonali kod...":tab==="orders"?"6 xonali mahsulot kodi, order №, mijoz...":tab==="promos"?"Promo kodi bo‘yicha qidirish...":"Qidirish..."}/></div>{tab==="products"&&<button className="proPrimary" onClick={()=>{setProduct({...emptyProduct});setProductOpen(true)}}>+ Mahsulot</button>}{tab==="promos"&&<button className="proPrimary" onClick={()=>{setPromo({...emptyPromo});setPromoOpen(true)}}>+ Promo kod</button>}</div>}
 {tab==="dashboard"&&<section className="dash"><div className="metricGrid"><Metric label="Bugungi savdo" value={money(revenue)} icon="₿" tone="rose"/><Metric label="Buyurtmalar" value={dashboard?.ordersCount||0} icon="▣"/><Metric label="Mijozlar" value={dashboard?.usersCount||0} icon="♙"/><Metric label="Faol mahsulotlar" value={dashboard?.productsCount||0} icon="◈"/></div><div className="dashGrid"><section className="proPanel"><PanelHead eyebrow="OPERATSION" title="Buyurtma holatlari" action={()=>setTab("orders")}/><div className="statusBoard">{STATUSES.slice(0,4).map(s=><div key={s}><b>{dashboard?.statusCounts?.[s]||0}</b><span>{s}</span><em style={{width:`${Math.min(100,Number(dashboard?.statusCounts?.[s]||0)*10)}%`}}/></div>)}</div></section><section className="proPanel"><PanelHead eyebrow="OMBOR" title="Kam qolganlar" action={()=>setTab("products")}/>{(dashboard?.lowStock||[]).length?<div className="lowList">{dashboard.lowStock.slice(0,6).map((p:Product)=><div key={p.id}><span>{p.name}</span><b>{p.stock} dona</b></div>)}</div>:<div className="proEmpty">✓ Ombor barqaror</div>}</section></div><section className="proPanel"><div className="panelHead"><div><span className="proEyebrow">LIVE</span><h2>So‘nggi buyurtmalar</h2></div><button onClick={()=>setTab("orders")}>Barchasi →</button></div><OrderTable rows={(dashboard?.recentOrders||[]).slice(0,8)} onOpen={o=>setSelectedOrder(o)}/></section></section>}
 {tab==="products"&&<section className="proPanel tablePanel"><div className="panelHead"><div><span className="proEyebrow">CATALOG</span><h2>{productsFiltered.length} ta mahsulot</h2></div><button onClick={()=>download("guli-products.csv",csv([["Kod","ID","Nom","Kategoriya","Narx","Ombor","Holat"],...productsFiltered.map(p=>[p.product_code||"",p.id,p.name,p.category,p.price,p.stock,p.active===false?"Yashirin":"Faol"]) ]))}>↓ CSV</button></div><div className="tableScroll"><table><thead><tr><th>Kod</th><th>Mahsulot</th><th>Kategoriya</th><th>Narx</th><th>Ombor</th><th>Holat</th><th/></tr></thead><tbody>{productsFiltered.map(p=><tr key={p.id}><td><b className="promoCode">{p.product_code||"—"}</b></td><td><div className="entityCell"><img src={p.image||"https://placehold.co/72x72/f6e8eb/b95a70?text=G"}/><div><b>{p.name}</b><small>Kod {p.product_code||"KOD YO‘Q"}</small><small>ID {p.id}</small></div></div></td><td>{p.category}</td><td><b>{money(p.price)}</b>{p.old_price&&<del>{money(p.old_price)}</del>}</td><td><span className={p.stock<5?"stock dangerStock":"stock"}>{p.stock}</span></td><td><span className={`pill ${p.active===false?"mutedPill":""}`}>{p.active===false?"Yashirin":p.featured?"Tanlangan":"Faol"}</span></td><td><div className="actions"><button onClick={()=>{setProduct({...p,images:p.images||[],sizes:p.sizes||[],colors:p.colors||[]});setProductOpen(true)}}>Tahrirlash</button>{p.active!==false&&<button className="dangerBtn" onClick={()=>hideProduct(p)}>Yashirish</button>}</div></td></tr>)}</tbody></table></div></section>}
  {tab==="orders"&&<section className="proPanel tablePanel"><div className="filterRow">{["all",...STATUSES].map(s=><button key={s} className={statusFilter===s?"active":""} onClick={()=>setStatusFilter(s)}>{s==="all"?"Barchasi":s}</button>)}</div><div className="panelHead"><div><span className="proEyebrow">ORDERS</span><h2>{ordersFiltered.length} ta buyurtma</h2><small>6 xonali mahsulot kodi bo‘yicha ham qidirish faol</small></div><button onClick={()=>download("guli-orders.csv",csv([["Mahsulot kodi","Buyurtma","Mijoz","Telefon","Jami","To‘lov","Status","Sana"],...ordersFiltered.map(o=>[productCodes(o).join(" "),o.order_number||o.id,o.first_name||o.username||"",o.phone||"",o.total,o.payment,o.status,o.created_at])]))}>↓ CSV</button></div><div className="tableScroll"><table><thead><tr><th>Kod</th><th>№</th><th>Mijoz</th><th>Mahsulot</th><th>Jami</th><th>To‘lov</th><th>Status</th><th>Sana</th></tr></thead><tbody>{ordersFiltered.map(o=><tr key={o.id} onClick={()=>setSelectedOrder(o)} className="clickable"><td><b className="promoCode">{productCodes(o).join(", ")||"—"}</b></td><td><b>{o.order_number||o.id}</b></td><td><b>{o.first_name||"Mijoz"}</b><small>{o.username?`@${o.username}`:o.phone||""}</small></td><td>{o.items?.[0]?.product?.name||"Buyurtma"}{o.items?.length>1?` +${o.items.length-1}`:""}</td><td><b>{money(o.total)}</b></td><td>{o.payment==="card"||o.payment==="card_manual"?"Karta":"Naqd"}</td><td><span className="pill">{o.status}</span></td><td>{date(o.created_at)}</td></tr>)}</tbody></table></div></section>}
 {tab==="customers"&&<section className="proPanel tablePanel"><div className="panelHead"><div><span className="proEyebrow">CRM</span><h2>{usersFiltered.length} ta mijoz</h2></div><button onClick={()=>download("guli-customers.csv",csv([["Telegram ID","Ism","Username","Telefon","Yangilangan"],...usersFiltered.map(u=>[u.telegram_id,[u.first_name,u.last_name].filter(Boolean).join(" "),u.username?`@${u.username}`:"",u.telegram_phone||"",u.updated_at||""]) ]))}>↓ CSV</button></div><div className="tableScroll"><table><thead><tr><th>Mijoz</th><th>Telegram ID</th><th>Username</th><th>Telefon</th><th>Yangilangan</th></tr></thead><tbody>{usersFiltered.map(u=><tr key={u.telegram_id} className="clickable" onClick={()=>setSelectedUser(u)}><td><div className="avatarMini">{(u.first_name||"G").slice(0,1).toUpperCase()}</div><b>{[u.first_name,u.last_name].filter(Boolean).join(" ")||"Noma’lum"}</b></td><td>{u.telegram_id}</td><td>{u.username?`@${u.username}`:"—"}</td><td>{u.telegram_phone||"—"}</td><td>{u.updated_at?date(u.updated_at):"—"}</td></tr>)}</tbody></table></div></section>}
 {tab==="reviews"&&<ReviewsAdmin token={token}/>} 
 {tab==="promos"&&<section className="proPanel tablePanel"><div className="panelHead"><div><span className="proEyebrow">MARKETING</span><h2>{promos.length} ta promo</h2></div></div><div className="tableScroll"><table><thead><tr><th>Kod</th><th>Chegirma</th><th>Min.</th><th>Foydalanish</th><th>Holat</th><th/></tr></thead><tbody>{promos.filter(p=>p.code.toLowerCase().includes(query.toLowerCase())).map(p=><tr key={p.id}><td><b className="promoCode">{p.code}</b></td><td>{p.discount_type==="percent"?`${p.discount_value}%`:money(p.discount_value)}</td><td>{money(p.min_order_amount)}</td><td>{p.used_count}{p.usage_limit?` / ${p.usage_limit}`:" / ∞"}</td><td><span className={`pill ${p.active?"":"mutedPill"}`}>{p.active?"Faol":"O‘chiq"}</span></td><td><button onClick={()=>{setPromo({...p});setPromoOpen(true)}}>Tahrirlash</button></td></tr>)}</tbody></table></div></section>}
 {tab==="social"&&<SocialLinksAdminPanel notify={notify}/>}
 {tab==="banner"&&<BannerAdminPanel token={token} notify={notify} uploadImage={uploadImage}/>}
 {tab==="chat"&&<AdminChatTab token={token}/>}
 {tab==="contributions"&&<ContributionsAdminPanel contributions={contributions} busy={busy} load={load}/>}
 </main><nav className="proMobileNav">{nav.map(n=><button key={n[0]} className={tab===n[0]?"active":""} onClick={()=>{setTab(n[0]);setQuery("")}}><span>{n[1]}</span>{n[2]}</button>)}</nav>
 {selectedOrder&&<OrderDrawer order={selectedOrder} onClose={()=>setSelectedOrder(null)} onStatus={updateStatus} onPayment={updatePaymentStatus}/>} {selectedUser&&<UserDrawer user={selectedUser} orders={orders} onClose={()=>setSelectedUser(null)} onOrder={setSelectedOrder}/>} {productOpen&&<ProductModalV2 value={product} busy={busy} onClose={()=>setProductOpen(false)} onChange={setProduct} onSave={saveProduct} onUpload={uploadImage}/>} {promoOpen&&<PromoModal value={promo} busy={busy} onClose={()=>setPromoOpen(false)} onChange={setPromo} onSave={savePromo}/>} {toast&&<div className="proToast">{toast}</div>}{busy&&<div className="proBusy"/>}</div>
}
function Metric({label,value,icon,tone=""}:{label:string;value:any;icon:string;tone?:string}){return <div className={`metric ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>}
function PanelHead({eyebrow,title,action}:{eyebrow:string;title:string;action?:()=>void}){return <div className="panelHead"><div><span className="proEyebrow">{eyebrow}</span><h2>{title}</h2></div>{action&&<button onClick={action}>Ko‘rish →</button>}</div>}
function OrderTable({rows,onOpen}:{rows:any[];onOpen:(o:any)=>void}){return <div className="tableScroll"><table><thead><tr><th>Buyurtma</th><th>Mijoz</th><th>Summa</th><th>Status</th><th>Sana</th></tr></thead><tbody>{rows.map(o=><tr key={o.id} className="clickable" onClick={()=>onOpen(o)}><td><b>{o.order_number||o.id}</b></td><td>{o.first_name||o.username||"Mijoz"}</td><td><b>{money(o.total)}</b></td><td><span className="pill">{o.status}</span></td><td>{date(o.created_at)}</td></tr>)}</tbody></table></div>}
function OrderDrawer({order,onClose,onStatus,onPayment}:{order:Order;onClose:()=>void;onStatus:(o:Order,s:string)=>void;onPayment:(o:Order,ps:string)=>void}){const addr=order.address||{};const codes=productCodes(order);return <div className="drawerShade" onMouseDown={onClose}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawerHead"><div><span className="proEyebrow">BUYURTMA</span><h2>№ {order.order_number||order.id}</h2><small>{date(order.created_at)}</small></div><button onClick={onClose}>×</button></div><div className="drawerBody"><section className="detailHero"><span className="orderIcon">▣</span><div><b>{order.first_name||"Mijoz"}</b><small>{order.username?`@${order.username}`:"Telegram mijozi"}</small></div></section><div className="detailGrid"><div><small>Mahsulot kodi</small><b>{codes.join(", ")||"—"}</b></div><div><small>Telefon</small><b>{order.phone||"—"}</b></div><div><small>To‘lov</small><b>{order.payment||"Karta"}</b></div><div><small>Mahsulotlar</small><b>{money(order.subtotal)}</b></div><div><small>Yetkazib berish</small><b>{order.delivery?money(order.delivery):"Bepul"}</b></div><div><small>Jami</small><b>{money(order.total)}</b></div></div><div className="detailSection"><h3>Status</h3><select value={order.status} onChange={e=>onStatus(order,e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select><div className="timeline">{STATUSES.slice(0,5).map((s,i)=>{const current=STATUSES.indexOf(order.status);return <div className={i<=current?"done":""} key={s}><span>{i<current?"✓":i+1}</span><b>{s}</b></div>})}</div></div>{order.receipt_url&&<div className="detailSection"><h3>🧾 To‘lov cheki (kvitansiya)</h3><div style={{marginTop:"8px"}}><img src={order.receipt_url} alt="To‘lov cheki" style={{maxWidth:"100%",maxHeight:"280px",borderRadius:"12px",border:"1px solid var(--border)",cursor:"pointer",objectFit:"contain"}} onClick={()=>window.open(order.receipt_url,"_blank")}/><br/><div className="receiptActions" style={{marginTop:"10px",display:"flex",gap:"8px"}}><button className="proPrimary" style={{flex:1,padding:"10px"}} onClick={()=>onPayment(order,"verified")}>✓ Tasdiqlash</button><button className="dangerBtn" style={{flex:1,padding:"10px"}} onClick={()=>onPayment(order,"rejected")}>✕ Rad etish</button></div><a href={order.receipt_url} target="_blank" rel="noreferrer" style={{display:"inline-block",marginTop:"12px",color:"#b95a70",fontSize:"13px",fontWeight:600}}>🔎 Chekni to‘liq hajmda ochish</a></div></div>}<div className="detailSection"><h3>Mahsulotlar</h3>
{(order.items||[]).map((it:any,i:number)=><div className="lineItem" key={i}>{it.product?.image&&<img src={it.product.image} alt=""/>}<div><b>{it.product?.name||"Mahsulot"}</b><small>{it.product?.product_code?`Kod: ${it.product.product_code} · `:""}{it.size||"—"} · {it.color||"—"} · {it.quantity||1} dona</small></div><strong>{money(Number(it.product?.price||0)*Number(it.quantity||1))}</strong></div>)}</div><div className="detailSection"><h3>Yetkazib berish manzili</h3><p className="addressText">📍 {[addr.region,addr.district,addr.street,addr.house,addr.apartment].filter(Boolean).join(", ")||"Manzil ko‘rsatilmagan"}</p>{addr.landmark&&<small>Mo‘ljal: {addr.landmark}</small>}</div></div></aside></div>}
function UserDrawer({user,orders,onClose,onOrder}:{user:User;orders:Order[];onClose:()=>void;onOrder:(o:Order)=>void}){const mine=orders.filter(o=>o.telegram_id===user.telegram_id||(user.username&&o.username===user.username));const spend=mine.reduce((s,o)=>s+Number(o.total||0),0);return <div className="drawerShade" onMouseDown={onClose}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}><div className="drawerHead"><div><span className="proEyebrow">CRM MIJOZ</span><h2>{[user.first_name,user.last_name].filter(Boolean).join(" ")||"Noma’lum"}</h2><small>{user.username?`@${user.username}`:"Telegram foydalanuvchisi"}</small></div><button onClick={onClose}>×</button></div><div className="drawerBody"><section className="detailHero"><div className="avatarLarge">{(user.first_name||"G").slice(0,1)}</div><div><b>{user.telegram_phone||"Telefon saqlanmagan"}</b><small>ID: {user.telegram_id}</small></div></section><div className="detailGrid"><div><small>Buyurtmalar</small><b>{mine.length}</b></div><div><small>Jami xarid</small><b>{money(spend)}</b></div></div><div className="detailSection"><h3>Buyurtmalar tarixi</h3>{mine.length?mine.map(o=><button className="customerOrder" key={o.id} onClick={()=>onOrder(o)}><span>{productCodes(o)[0]||"—"} · {o.order_number||o.id}</span><b>{money(o.total)}</b><small>{o.receipt_url?"🧾 ":""}{o.status}</small></button>):<p>Bu mijozda buyurtmalar topilmadi.</p>}</div></div></aside></div>}
function PromoModal({value,busy,onClose,onChange,onSave}:{value:Promo;busy:boolean;onClose:()=>void;onChange:(v:Promo)=>void;onSave:(e:FormEvent)=>void}){const set=(k:keyof Promo,v:any)=>onChange({...value,[k]:v});const replaceZeroOnFocus=(e:React.FocusEvent<HTMLInputElement>)=>{if(e.currentTarget.value==="0")e.currentTarget.select()};return <Modal title={value.id?"Promo tahrirlash":"Yangi promo"} eyebrow="MARKETING" onClose={onClose}><form onSubmit={onSave}><div className="formGrid"><label>Kod<input value={value.code} onChange={e=>set("code",e.target.value.toUpperCase().replace(/\s/g,""))} placeholder="Masalan: GULI10" maxLength={40} pattern="[A-Za-z0-9_-]{3,40}" required/><small>Faqat harf, raqam, _ va - ishlating.</small></label><label>Chegirma (%)<input type="number" min="1" max="100" step="1" value={value.discount_value} onFocus={replaceZeroOnFocus} onChange={e=>set("discount_value",e.target.value===""?0:Number(e.target.value))}/><small>Mijoz savatidan shu foiz chegiriladi.</small></label><label>Minimal buyurtma (ixtiyoriy)<input type="number" min="0" step="1" inputMode="numeric" value={value.min_order_amount} onFocus={replaceZeroOnFocus} onChange={e=>set("min_order_amount",e.target.value===""?0:Number(e.target.value))}/><small>0 bo‘lsa minimal summa talabi yo‘q.</small></label><label>Foydalanish limiti (ixtiyoriy)<input type="number" min="1" step="1" value={value.usage_limit??""} onChange={e=>set("usage_limit",e.target.value===""?null:Number(e.target.value))} placeholder="∞"/><small>Bo‘sh qoldirilsa cheksiz.</small></label><label>Holat<select value={value.active?"active":"off"} onChange={e=>set("active",e.target.value==="active")}><option value="active">Faol</option><option value="off">O‘chiq</option></select></label></div><div className="modalActions"><button type="button" onClick={onClose}>Bekor qilish</button><button className="proPrimary" disabled={busy}>{busy?"Saqlanmoqda…":"Saqlash"}</button></div></form></Modal>}
function Modal({title,eyebrow,onClose,children}:{title:string;eyebrow:string;onClose:()=>void;children:any}){return <div className="modalShade" onMouseDown={onClose}><div className="proModal" onMouseDown={e=>e.stopPropagation()}><div className="modalHead"><div><span className="proEyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={onClose}>×</button></div>{children}</div></div>}

function ContributionsAdminPanel({ contributions, busy, load }: { contributions: any[]; busy: boolean; load: () => void }) {
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  return (
    <section className="proPanel tablePanel">
      <div className="panelHead">
        <div>
          <span className="proEyebrow">CONTRIBUTIONS</span>
          <h2>{contributions.length} ta saxovat cheki</h2>
          <small>Adminni qo'llab-quvvatlash uchun yuborilgan cheklar va mijozlar ro'yxati</small>
        </div>
        <button onClick={load} disabled={busy}>↻ Yangilash</button>
      </div>

      <div className="tableScroll">
        {contributions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
            <span style={{ fontSize: "40px" }}>🤗</span>
            <p style={{ marginTop: "10px", fontSize: "14px" }}>Hozircha qo'llab-quvvatlash cheklari kelib tushmagan.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Mijoz</th>
                <th>Telegram ID</th>
                <th>Username</th>
                <th>Yuborilgan vaqti</th>
                <th>To‘lov cheki</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, i) => (
                <tr key={c.id || i}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div className="avatarMini" style={{ background: "linear-gradient(135deg, #fce0ad, #dfac6c)", color: "#1e1e24" }}>
                        {(c.first_name || "M").slice(0, 1).toUpperCase()}
                      </div>
                      <b>{c.first_name || "Mijoz"}</b>
                    </div>
                  </td>
                  <td><code className="promoCode" style={{ fontSize: "12px" }}>{c.telegram_id}</code></td>
                  <td>{c.username ? <a href={`https://t.me/${c.username}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", fontWeight: "600" }}>@{c.username}</a> : "—"}</td>
                  <td>{new Date(c.created_at).toLocaleString("uz-UZ")}</td>
                  <td>
                    {c.receipt_photo ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <img 
                          src={c.receipt_photo} 
                          alt="Receipt" 
                          style={{ width: "45px", height: "45px", borderRadius: "8px", objectFit: "cover", cursor: "pointer", border: "1px solid var(--border-color)" }} 
                          onClick={() => setFullscreenPhoto(c.receipt_photo)}
                        />
                        <button 
                          type="button"
                          className="proPrimary" 
                          onClick={() => setFullscreenPhoto(c.receipt_photo)}
                          style={{ padding: "4px 8px", fontSize: "11px", height: "auto", borderRadius: "6px" }}
                        >
                          Ochish
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Chek rasmisiz</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {fullscreenPhoto && (
        <div 
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 99999,
            backgroundColor: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setFullscreenPhoto(null)}
        >
          <button 
            type="button"
            style={{ position: "absolute", right: "20px", top: "20px", background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: "50%", width: "44px", height: "44px", fontSize: "24px", cursor: "pointer" }}
            onClick={() => setFullscreenPhoto(null)}
          >
            ✕
          </button>
          <img 
            src={fullscreenPhoto} 
            alt="Fullscreen Receipt" 
            style={{ maxWidth: "90%", maxHeight: "80%", borderRadius: "14px", boxShadow: "0 25px 50px rgba(0,0,0,0.5)", objectFit: "contain" }} 
            onClick={(e) => e.stopPropagation()}
          />
          <p style={{ color: "#fff", marginTop: "15px", fontSize: "14px", fontWeight: "600" }}>Chekni yopish uchun istalgan joyga bosing</p>
        </div>
      )}
    </section>
  );
}

function BannerAdminPanel({ token, notify, uploadImage }: { token: string; notify: (m: string) => void; uploadImage: (file: File) => Promise<string> }) {
  const [bannerUrl, setBannerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchBanner = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/settings/banner`);
      if (res.ok) {
        const text = await res.text();
        let j: any = null;
        try {
          j = JSON.parse(text);
        } catch {
          // Not valid JSON
        }
        if (j && j.success && j.url) {
          setBannerUrl(j.url);
        }
      }
    } catch (err) {
      console.error("Failed to fetch banner:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanner();
  }, []);

  const handleSave = async () => {
    if (!bannerUrl.trim()) {
      notify("Rasm URL manzili bo‘sh bo‘lishi mumkin emas");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/settings/banner`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ image_url: bannerUrl.trim() })
      });
      const j = await res.json();
      if (res.ok && j.success) {
        notify("Asosiy ekran banneri muvaffaqiyatli saqlandi! ✓");
      } else {
        throw new Error(j.message || "Xatolik yuz berdi");
      }
    } catch (err: any) {
      notify(err.message || "Banner rasm URLini saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage(file);
      if (url) {
        setBannerUrl(url);
        notify("Rasm yuklandi va URL maydoniga o'rnatildi! ✓");
      }
    } catch (err: any) {
      notify(err.message || "Rasmni yuklashda xatolik");
    }
  };

  return (
    <section className="proPanel" style={{ padding: "24px" }}>
      <div className="panelHead" style={{ marginBottom: "20px" }}>
        <div>
          <span className="proEyebrow">SOZLAMALAR</span>
          <h2>Asosiy ekran reklama banneri</h2>
          <small>Mijozlar ilovaga kirganda bosh ekranda ko'radigan katta reklama bannerini boshqarish</small>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Yuklanmoqda...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", color: "var(--text-main)" }}>
              Hozirgi banner ko'rinishi (Preview)
            </label>
            {bannerUrl ? (
              <div style={{
                position: "relative",
                width: "100%",
                maxWidth: "600px",
                height: "220px",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
                border: "1px solid var(--border-color)",
                backgroundImage: `linear-gradient(90deg, rgba(31, 15, 21, 0.76), rgba(31, 15, 21, 0.12)), url(${bannerUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
                display: "flex",
                alignItems: "center",
                padding: "24px"
              }}>
                <div style={{ color: "#fff" }}>
                  <span style={{ fontSize: "10px", letterSpacing: "2px", color: "#f8cbd5", textTransform: "uppercase" }}>YANGI TO‘PLAM</span>
                  <h1 style={{ fontSize: "24px", margin: "6px 0 4px", fontWeight: "800" }}>GULI Premium</h1>
                  <p style={{ fontSize: "12px", color: "#f8e7ea", margin: 0 }}>Eng nafis modellar va qulay narxlar</p>
                </div>
              </div>
            ) : (
              <div style={{ padding: "20px", background: "var(--bg-card-sub)", border: "1px dashed var(--border-color)", borderRadius: "12px", color: "var(--text-muted)", fontSize: "13px" }}>
                Rasm manzili o'rnatilmagan
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", color: "var(--text-main)" }}>
                Rasm faylini yuklash
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                style={{ 
                  padding: "10px", 
                  border: "1px solid var(--border-color)", 
                  borderRadius: "10px", 
                  background: "var(--bg-card)",
                  width: "100%",
                  maxWidth: "400px",
                  cursor: "pointer"
                }} 
              />
              <small style={{ display: "block", marginTop: "4px", color: "var(--text-muted)" }}>
                Kompyuter yoki telefondagi rasmni serverga yuklab olish (tavsiya etiladi: keng formatli rasm)
              </small>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", color: "var(--text-main)" }}>
                Yoki To'g'ridan-to'g'ri rasm manzili (URL)
              </label>
              <input 
                type="url" 
                value={bannerUrl} 
                onChange={e => setBannerUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                style={{ 
                  padding: "12px 16px", 
                  border: "1px solid var(--border-color)", 
                  borderRadius: "10px", 
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  width: "100%",
                  maxWidth: "600px",
                  fontSize: "14px"
                }} 
              />
              <small style={{ display: "block", marginTop: "4px", color: "var(--text-muted)" }}>
                Internetdagi istalgan rasm havolasini qo'yishingiz mumkin (masalan, Unsplash, Pinterest va h.k.)
              </small>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="proPrimary"
              style={{ padding: "12px 24px", fontSize: "14px", height: "auto" }}
            >
              {saving ? "Saqlanmoqda..." : "Bannerni saqlash ✓"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
