import React, { useCallback, useEffect, useState } from "react";
import "./ProductReviewsSection.css";
import { getSupabase } from "../lib/supabaseClient";

export interface ReviewItem {
  id: number | string; product_id?: number | string; product_code?: string; product_name?: string;
  photo_url?: string | null; display_name?: string; rating: number; comment: string; photos?: string[];
  verified_purchase?: boolean; status: "approved" | "hidden"; is_pinned?: boolean; created_at: string;
}
interface ProductReviewsSectionProps {
  productCode?: string; productName?: string; productId?: number | string; productRating?: number; productReviewsCount?: number;
  onRatingUpdate?: (newRating: number, newCount: number) => void;
  telegramUser?: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string };
  onShowToast?: (msg: string) => void;
}
export function getStoredReviews(): ReviewItem[] { return []; }
export function saveStoredReviews(): void { /* DB/API is the only source of truth. */ }
const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
function safeName(first?: string, last?: string) { const n = [first,last].map(v=>String(v||"").trim()).filter(Boolean).join(" "); return n || "Anonim mijoz"; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join("").toUpperCase() || "M"; }
function stars(value: number) { const n=Math.max(0,Math.min(5,Math.round(value))); return `${"★".repeat(n)}${"☆".repeat(5-n)}`; }

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({ productCode="", productName="", productId, onRatingUpdate, telegramUser, onShowToast }) => {
  const [reviews,setReviews]=useState<ReviewItem[]>([]); const [average,setAverage]=useState(0); const [count,setCount]=useState(0);
  const [distribution,setDistribution]=useState<Array<{star:number;count:number}>>([]); const [rating,setRating]=useState(5);
  const [comment,setComment]=useState(""); const [photos,setPhotos]=useState<string[]>([]); const [isSubmitting,setIsSubmitting]=useState(false);
  const [selected,setSelected]=useState<ReviewItem|null>(null); const [lightbox,setLightbox]=useState<string|null>(null);
  const [userAvatarUrl,setUserAvatarUrl]=useState<string|null>(()=>telegramUser?.photo_url||null); const currentName=safeName(telegramUser?.first_name,telegramUser?.last_name);

  useEffect(()=>{ if(telegramUser?.photo_url){setUserAvatarUrl(telegramUser.photo_url);return;} try{const raw=JSON.parse(localStorage.getItem("guli_auth_user")||"null");setUserAvatarUrl(raw?.telegram_photo_url||raw?.photo_url||raw?.avatar||null);}catch{setUserAvatarUrl(null);} },[telegramUser?.photo_url]);
  const loadReviews = useCallback(async () => {
    const param = productCode || (productId ? String(productId) : "");
    if (!param) {
      setReviews([]); setAverage(0); setCount(0); setDistribution([]);
      onRatingUpdate?.(0, 0);
      return;
    }
    try {
      const endpoints = [
        `${API}/api/reviews?product_code=${encodeURIComponent(param)}`,
        `/api/reviews?product_code=${encodeURIComponent(param)}`,
      ];
      let json: any = null;
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (data?.success) {
              json = data;
              break;
            }
          }
        } catch {
          // continue to next endpoint
        }
      }

      // If backend API could not be reached, fallback gracefully to direct Supabase query
      if (!json?.success || !Array.isArray(json?.data?.reviews)) {
        const client = getSupabase();
        if (client) {
          try {
            let q = client.from("product_reviews").select("*");
            if (productId && productCode) {
              q = q.or(`product_id.eq.${productId},product_code.eq.${productCode}`);
            } else if (productId) {
              q = q.eq("product_id", productId);
            } else {
              q = q.eq("product_code", param);
            }
            const { data, error } = await q.order("created_at", { ascending: false }).limit(100);
            if (!error && Array.isArray(data)) {
              const list: ReviewItem[] = data.map((r: any) => ({
                id: r.id,
                product_id: r.product_id,
                product_code: r.product_code || productCode,
                product_name: productName,
                photo_url: r.photo_url || null,
                display_name: r.display_name || r.first_name || (r.username ? `@${r.username}` : "Anonim mijoz"),
                rating: Number(r.rating) || 5,
                comment: String(r.comment || ""),
                photos: Array.isArray(r.photos) ? r.photos : [],
                verified_purchase: Boolean(r.verified_purchase),
                status: "approved",
                is_pinned: Boolean(r.is_pinned),
                created_at: r.created_at || new Date().toISOString()
              }));
              const c = list.length;
              const sum = list.reduce((n, r) => n + Number(r.rating || 0), 0);
              const avg = c ? Math.round(sum / c * 10) / 10 : 0;
              const dist = [5, 4, 3, 2, 1].map(star => ({ star, count: list.filter(r => r.rating === star).length }));
              setReviews(list); setAverage(avg); setCount(c); setDistribution(dist);
              onRatingUpdate?.(avg, c);
              return;
            }
          } catch {
            // direct query fallback note
          }
        }
        setReviews([]); setAverage(0); setCount(0); setDistribution([]);
        onRatingUpdate?.(0, 0);
        return;
      }

      const next: ReviewItem[] = (json.data.reviews || []).map((r: any) => ({
        id: r.id,
        product_id: r.product_id,
        product_code: r.product_code || productCode,
        product_name: productName,
        photo_url: r.photo_url || null,
        display_name: r.display_name || "Anonim mijoz",
        rating: Number(r.rating) || 0,
        comment: String(r.comment || ""),
        photos: Array.isArray(r.photos) ? r.photos : [],
        verified_purchase: Boolean(r.verified_purchase),
        status: "approved",
        is_pinned: Boolean(r.is_pinned),
        created_at: r.created_at
      }));
      const avg = Number(json.data.total_average) || 0;
      const c = Number(json.data.total_count) || 0;
      setReviews(next);
      setAverage(avg);
      setCount(c);
      setDistribution(Array.isArray(json.data.distribution) ? json.data.distribution : []);
      onRatingUpdate?.(avg, c);
    } catch {
      setReviews([]); setAverage(0); setCount(0); setDistribution([]);
      onRatingUpdate?.(0, 0);
    }
  }, [productCode, productId, productName, onRatingUpdate]);
  useEffect(()=>{void loadReviews();},[loadReviews]);
  useEffect(()=>{if(!productId)return;const client=getSupabase();if(!client)return;const channel=client.channel(`product-review-events-${String(productId)}`).on("postgres_changes",{event:"*",schema:"public",table:"review_events",filter:`product_id=eq.${String(productId)}`},()=>{void loadReviews();}).subscribe((status:string)=>{if(status==="CHANNEL_ERROR")console.warn("Review realtime channel error");});return()=>{void client.removeChannel(channel);};},[productId,loadReviews]);

  const handlePhotoUpload=async(e:React.ChangeEvent<HTMLInputElement>)=>{const files=e.target.files;if(!files?.length)return;const next:string[]=[];for(const file of Array.from(files).slice(0,3-photos.length)){if(!file.type.startsWith("image/"))continue;const data=await new Promise<string>(resolve=>{const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const max=800,scale=Math.min(1,max/Math.max(img.width,img.height));const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;canvas.getContext("2d")?.drawImage(img,0,0,w,h);resolve(canvas.toDataURL("image/jpeg",0.75));};img.src=String(ev.target?.result||"");};reader.readAsDataURL(file);});next.push(data);}setPhotos(prev=>[...prev,...next].slice(0,3));e.target.value="";};
  const handleSubmitReview=async(e:React.FormEvent)=>{e.preventDefault();if(!comment.trim())return onShowToast?.("Iltimos, sharh matnini kiriting");setIsSubmitting(true);try{const initData=window.Telegram?.WebApp?.initData||"";const res=await fetch(`${API}/api/reviews`,{method:"POST",headers:{"Content-Type":"application/json","X-Telegram-Init-Data":initData},body:JSON.stringify({product_code:productCode,rating,comment:comment.trim(),photos})});const json=await res.json().catch(()=>({}));if(!res.ok||!json?.success)throw new Error(json?.message||"Sharhni yuborib bo‘lmadi");setComment("");setPhotos([]);await loadReviews();onShowToast?.("Rahmat! Sharhingiz e'lon qilindi ⭐");}catch(error:any){onShowToast?.(error?.message||"Sharh yuborishda xatolik");}finally{setIsSubmitting(false);}};

  return <section className="productReviewsContainer" id="product-reviews-section">
    <div className="reviewsHeaderBlock"><div className="reviewsHeaderLeft"><div className="reviewsTitleGroup"><span className="reviewsTitleIcon">💬</span><h3 className="reviewsTitle">Baholar va sharhlar</h3></div><div className="reviewsHeaderMeta"><span className="reviewsHeaderStars">{stars(average)}</span><strong className="reviewsHeaderScore">{average.toFixed(1)}</strong><span className="reviewsHeaderCount">({count} ta sharh)</span></div></div></div>
    {count>0&&<div className="reviewsDistribution" aria-label="Baholar taqsimoti">{distribution.map(item=><div key={item.star} className="reviewDistributionRow"><span>{item.star} ★</span><div className="reviewDistributionTrack"><span style={{width:`${Math.round(item.count/count*100)}%`}}/></div><b>{item.count}</b></div>)}</div>}
    <div className="reviewsList">{reviews.length===0?<div className="emptyReviewsState"><div className="emptyReviewIcon">💬</div><h4>Hozircha sharhlar yo‘q</h4><p>Bu yerda faqat haqiqiy mijozlarning tasdiqlangan sharhlari ko‘rsatiladi.</p></div>:reviews.map(rev=>{const name=rev.display_name||"Anonim mijoz";return <article key={rev.id} className={`reviewItemCard ${rev.is_pinned?"isPinnedReview":""}`} onClick={()=>setSelected(rev)}>{rev.is_pinned&&<div className="pinnedReviewTag"><span>⭐ TOP SHARH</span></div>}<div className="reviewAuthorRow"><div className="authorAvatarWrap">{rev.photo_url?<img src={rev.photo_url} alt={name} className="authorAvatarImg"/>:<div className="authorAvatarFallbackIcon">{initials(name)}</div>}</div><div className="authorMetaBox"><div className="authorTopLine"><b className="authorNameText">{name}</b>{rev.verified_purchase&&<span className="verifiedPurchasePill">✓ Xarid qilgan</span>}</div><div className="authorSubLine"><span className="reviewRatingStars">{stars(rev.rating)}</span><span className="reviewDateText">· {new Date(rev.created_at).toLocaleDateString("uz-UZ",{day:"numeric",month:"short",year:"numeric"})}</span></div></div></div><div className="reviewStreamContent"><p className="reviewCommentBody">{rev.comment}</p>{!!rev.photos?.length&&<div className="reviewPhotosRow">{rev.photos.map((url,i)=><img key={i} src={url} alt="Mijoz yuklagan rasm" className="reviewPhotoThumb" loading="lazy" onClick={e=>{e.stopPropagation();setLightbox(url);}}/>)}</div>}</div></article>;})}</div>
    <div className="inlineReviewBoxContainer"><form onSubmit={handleSubmitReview} className="inlineReviewFormBar">{!!photos.length&&<div className="inlinePhotosPreviewRow">{photos.map((p,i)=><div key={i} className="inlinePhotoThumbWrap"><img src={p} alt="Yuklangan"/><button type="button" className="inlineRemovePhotoBtn" onClick={()=>setPhotos(prev=>prev.filter((_,idx)=>idx!==i))}>✕</button></div>)}</div>}<div className="inlineInputRow flexRow"><div className="inlineUserAvatarBox" title="Sizning profil rasmingiz">{userAvatarUrl?<img src={userAvatarUrl} alt="Profil" className="inlineAvatarImg"/>:<div className="authorAvatarFallbackIcon">{initials(currentName)}</div>}</div><input type="text" className="inlineCommentInput" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Mahsulot haqidagi fikringiz..." required/><div className="inlineStarsPicker" title="Baho berish">{[1,2,3,4,5].map(s=><button key={s} type="button" className={`inlineStarBtn ${s<=rating?"active":""}`} onClick={()=>setRating(s)}>★</button>)}</div><input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="fileInputHidden" id="inline-gallery-photo-upload"/><label htmlFor="inline-gallery-photo-upload" className="inlineAttachGalleryBtn" title="Qurilmadan rasm tanlash">📎</label><button type="submit" className="inlineSubmitBtn" disabled={isSubmitting} title="Sharh yuborish">{isSubmitting?"...":"➤"}</button></div></form></div>
    {selected&&<div className="modalBackdrop modalBackdropCenter" onClick={()=>setSelected(null)}><div className="modalCard reviewDetailModalCard" onClick={e=>e.stopPropagation()}><div className="modalHeader reviewDetailModalHeader"><div className="reviewDetailUserHeader"><div className="detailAvatarBox">{selected.photo_url?<img src={selected.photo_url} alt={selected.display_name||"Mijoz"} className="detailAvatarImg"/>:<div className="authorAvatarFallbackIcon">{initials(selected.display_name||"Anonim mijoz")}</div>}</div><div><h3 className="detailUserName">{selected.display_name||"Anonim mijoz"}</h3><div className="detailUserSubMeta">{selected.verified_purchase&&<span className="verifiedPurchasePill">✓ Tasdiqlangan haridor</span>}<span className="detailDateText">{new Date(selected.created_at).toLocaleDateString("uz-UZ",{day:"numeric",month:"long",year:"numeric"})}</span></div></div></div><button className="closeModalBtn" onClick={()=>setSelected(null)}>✕</button></div><div className="reviewDetailBody"><div className="detailRatingRow"><span className="detailStarsGlyph">{stars(selected.rating)}</span><span className="detailScoreBadge">{selected.rating} / 5</span></div><div className="detailCommentCard"><p className="detailCommentText">{selected.comment}</p></div>{!!selected.photos?.length&&<div className="detailPhotosGallery"><h4>📷 Biriktirilgan suratlar ({selected.photos.length}):</h4><div className="detailPhotosGrid">{selected.photos.map((url,i)=><img key={i} src={url} alt="Sharh surati" className="detailPhotoGridItem" onClick={()=>setLightbox(url)}/>)}</div></div>}<div className="detailModalFooter"><button type="button" className="primaryButton closeDetailBtn" onClick={()=>setSelected(null)}>Yopish</button></div></div></div></div>}
    {lightbox&&<div className="modalBackdrop lightboxBackdrop" onClick={()=>setLightbox(null)}><div className="lightboxContent" onClick={e=>e.stopPropagation()}><button className="lightboxCloseBtn" onClick={()=>setLightbox(null)}>✕</button><img src={lightbox} alt="Katta rasm" className="lightboxMainImg"/></div></div>}
  </section>;
};
