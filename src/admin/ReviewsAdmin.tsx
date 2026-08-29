import { useCallback, useEffect, useMemo, useState } from "react";
import "./ReviewsAdmin.css";

type Review = {
  id: number;
  product_id: string | number;
  product_code: string;
  product_name?: string | null;
  product_title?: string | null;
  product_image?: string | null;
  product_images?: string[];
  product_category?: string | null;
  product_price?: number | null;
  product_old_price?: number | null;
  product_stock?: number | null;
  product_active?: boolean | null;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  customer_username?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  rating: number;
  comment: string;
  photos?: string[];
  verified_purchase: boolean;
  order_number: string;
  order_status?: string | null;
  order_total?: number | null;
  order_subtotal?: number | null;
  order_delivery?: number | null;
  order_discount?: number | null;
  order_phone?: string | null;
  order_address?: any;
  order_created_at?: string | null;
  status: "approved" | "hidden";
  created_at: string;
};

const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const money = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
const reviewDate = (v: string | null | undefined) => { const d = new Date(String(v || "")); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" }); };
const customerName = (r: Review) => r.customer_first_name || r.first_name || r.customer_username || r.username || "GULI mijozi";
const customerUsername = (r: Review) => r.customer_username || r.username || "";
const orderStatusClass = (status: string | null | undefined) => status === "Yetkazildi" ? "delivered" : status === "Bekor qilindi" ? "cancelled" : "pending";

export default function ReviewsAdmin({ token }: { token: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "approved" | "hidden">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ urls: string[]; index: number } | null>(null);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const json = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("Admin sessiyasi tugagan");
    if (!response.ok || json?.success === false) throw new Error(json?.message || `Server xatosi (${response.status})`);
    return json;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const json = await request("/api/admin/reviews"); setReviews(Array.isArray(json.data) ? json.data : []); }
    catch (e) { setError(e instanceof Error ? e.message : "Sharhlarni yuklashda xatolik"); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [token, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      const haystack = `${r.product_code} ${r.product_name || ""} ${r.product_title || ""} ${r.order_number} ${r.order_status || ""} ${customerName(r)} ${customerUsername(r)} ${r.customer_last_name || ""} ${r.customer_phone || ""} ${r.order_phone || ""} ${r.telegram_id} ${r.comment}`.toLowerCase();
      return (status === "all" || r.status === status) && (!q || haystack.includes(q));
    });
  }, [reviews, query, status]);

  const setReviewStatus = async (review: Review, next: "approved" | "hidden") => {
    try {
      const json = await request(`/api/admin/reviews/${review.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setReviews((items) => items.map((item) => item.id === review.id ? { ...item, ...(json.data || {}), status: next } : item));
    } catch (e) { setError(e instanceof Error ? e.message : "Sharh holatini o‘zgartirishda xatolik"); }
  };

  const remove = async (review: Review) => {
    if (!window.confirm(`Sharh #${review.id} o‘chirilsinmi?`)) return;
    try { await request(`/api/admin/reviews/${review.id}`, { method: "DELETE" }); setReviews((items) => items.filter((item) => item.id !== review.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Sharhni o‘chirishda xatolik"); }
  };

  const stats = { total: reviews.length, approved: reviews.filter((r) => r.status === "approved").length, hidden: reviews.filter((r) => r.status === "hidden").length, verified: reviews.filter((r) => r.verified_purchase).length, average: reviews.length ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / reviews.length : 0 };

  return <section className="reviewsAdmin">
    <div className="reviewsStats">
      <div><span>Jami sharh</span><b>{stats.total.toLocaleString("uz-UZ")}</b></div>
      <div><span>Ochiq</span><b>{stats.approved.toLocaleString("uz-UZ")}</b></div>
      <div><span>Yashirilgan</span><b>{stats.hidden.toLocaleString("uz-UZ")}</b></div>
      <div><span>Tasdiqlangan xarid</span><b>{stats.verified.toLocaleString("uz-UZ")}</b></div>
      <div><span>O‘rtacha baho</span><b>{stats.average.toFixed(1)} ★</b></div>
    </div>
    <div className="reviewsPanel">
      <div className="reviewsToolbar">
        <div className="reviewsSearch"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="6 xonali kod, order №, mijoz yoki sharh..."/></div>
        <div className="reviewsFilters">{(["all", "approved", "hidden"] as const).map((value) => <button key={value} className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{value === "all" ? "Barchasi" : value === "approved" ? "Ko‘rinadi" : "Yashirilgan"}</button>)}<button onClick={() => void load()} disabled={loading}>↻</button></div>
      </div>
      {error && <div className="reviewsError">{error}</div>}
      {loading ? <div className="reviewsEmpty">Sharhlar yuklanmoqda…</div> : filtered.length === 0 ? <div className="reviewsEmpty"><strong>Sharh topilmadi</strong><span>Qidiruv yoki filter shartini o‘zgartiring.</span></div> : <div className="reviewsGrid">{filtered.map((review) => {
        const urls = Array.isArray(review.photos) ? review.photos.filter(Boolean) : [];
        const productImage = review.product_image || (Array.isArray(review.product_images) ? review.product_images[0] : "");
        const fullCustomerName = [review.customer_first_name || review.first_name, review.customer_last_name].filter(Boolean).join(" ") || customerName(review);
        const orderTotal = review.order_total == null ? null : money(review.order_total);
        return <article className={`reviewAdminCard ${review.status === "hidden" ? "isHidden" : ""}`} key={review.id}>
          <div className="reviewProductHero">
            {productImage ? <img src={productImage} alt={review.product_name || "Mahsulot"} loading="lazy"/> : <div className="reviewProductPlaceholder">◈</div>}
            <div><span>MAHSULOT</span><b>{review.product_name || review.product_title || "Noma’lum mahsulot"}</b><small>{review.product_code || "—"}{review.product_category ? ` · ${review.product_category}` : ""}</small></div>
          </div>
          <div className="reviewAdminTop"><div><b>{fullCustomerName}</b><small>{customerUsername(review) ? `@${customerUsername(review)} · ` : ""}Telegram ID {review.telegram_id}{review.customer_phone ? ` · ${review.customer_phone}` : ""}</small></div><span className="reviewStars">{"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}{"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(review.rating))))}</span></div>
          <div className="reviewMeta"><span>KOD <b>{review.product_code || "—"}</b></span><span>BUYURTMA <b>{review.order_number || "—"}</b></span><span className={`reviewOrderStatus ${orderStatusClass(review.order_status)}`}>{review.order_status || "Order ma’lumoti topilmadi"}</span><span>{review.verified_purchase ? "✓ Tasdiqlangan xarid" : "Xarid tasdiqlanmagan"}</span></div>
          <div className="reviewContextGrid">
            <div><small>Buyurtma summasi</small><b>{orderTotal || "—"}</b></div>
            <div><small>Buyurtma telefoni</small><b>{review.order_phone || review.customer_phone || "—"}</b></div>
            <div><small>Buyurtma sanasi</small><b>{review.order_created_at ? reviewDate(review.order_created_at) : "—"}</b></div>
            <div><small>Mahsulot holati</small><b>{review.product_active === false ? "Yashirilgan" : "Faol"}{review.product_stock != null ? ` · ${review.product_stock} dona` : ""}</b></div>
          </div>
          {review.order_address && <div className="reviewOrderAddress"><small>BUYURTMA MANZILI</small><div>{typeof review.order_address === "string" ? review.order_address : [review.order_address?.region, review.order_address?.district, review.order_address?.street, review.order_address?.house, review.order_address?.apartment].filter(Boolean).join(", ") || "Manzil saqlangan"}</div></div>}
          <p>{review.comment}</p>
          {urls.length > 0 && <div className="reviewPhotoRow">{urls.slice(0, 3).map((url, index) => <button key={`${url}-${index}`} onClick={() => setPhoto({ urls, index })}><img src={url} alt="Mijoz sharh rasmi" loading="lazy"/></button>)}</div>}
          <div className="reviewAdminBottom"><span>{reviewDate(review.created_at)}</span><span className={`reviewStatus ${review.status}`}>{review.status === "approved" ? "Ko‘rinadi" : "Yashirilgan"}</span><div>{review.status === "approved" ? <button onClick={() => void setReviewStatus(review, "hidden")}>Yashirish</button> : <button className="primaryAction" onClick={() => void setReviewStatus(review, "approved")}>Ko‘rsatish</button>}<button className="deleteAction" onClick={() => void remove(review)}>O‘chirish</button></div></div>
        </article>;
      })}</div>}
    </div>
    {photo && <div className="reviewLightbox" onClick={() => setPhoto(null)}><button className="reviewLightboxClose" onClick={() => setPhoto(null)}>×</button><button className="reviewLightboxNav prev" onClick={(e) => { e.stopPropagation(); setPhoto({ ...photo, index: (photo.index - 1 + photo.urls.length) % photo.urls.length }); }}>‹</button><img src={photo.urls[photo.index]} alt="Sharh rasmi" onClick={(e) => e.stopPropagation()}/><button className="reviewLightboxNav next" onClick={(e) => { e.stopPropagation(); setPhoto({ ...photo, index: (photo.index + 1) % photo.urls.length }); }}>›</button><span className="reviewLightboxCount">{photo.index + 1} / {photo.urls.length}</span></div>}
  </section>;
}
