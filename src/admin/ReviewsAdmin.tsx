import { useEffect, useMemo, useState } from "react";
import "./ReviewsAdmin.css";

type Review = {
  id: number;
  product_id: string | number;
  product_code: string;
  telegram_id: number;
  username?: string | null;
  first_name?: string | null;
  rating: number;
  comment: string;
  photos?: string[];
  verified_purchase: boolean;
  order_number: string;
  status: "approved" | "hidden";
  created_at: string;
};

const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const moneyCount = (n: number) => Math.round(n).toLocaleString("uz-UZ");
const reviewDate = (v: string) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("uz-UZ", { dateStyle: "medium", timeStyle: "short" }); };

export default function ReviewsAdmin({ token }: { token: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "approved" | "hidden">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<{ urls: string[]; index: number } | null>(null);

  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.success === false) throw new Error(json?.message || `Server xatosi (${response.status})`);
    return json;
  };

  const load = async () => {
    setLoading(true); setError("");
    try { const json = await request("/api/admin/reviews"); setReviews(Array.isArray(json.data) ? json.data : []); }
    catch (e) { setError(e instanceof Error ? e.message : "Sharhlarni yuklashda xatolik"); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => (status === "all" || r.status === status) && (!q || `${r.product_code} ${r.order_number} ${r.first_name || ""} ${r.username || ""} ${r.telegram_id} ${r.comment}`.toLowerCase().includes(q)));
  }, [reviews, query, status]);

  const setReviewStatus = async (review: Review, next: "approved" | "hidden") => {
    try {
      await request(`/api/admin/reviews/${review.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setReviews((items) => items.map((item) => item.id === review.id ? { ...item, status: next } : item));
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
      <div><span>Jami sharh</span><b>{moneyCount(stats.total)}</b></div>
      <div><span>Ochiq</span><b>{moneyCount(stats.approved)}</b></div>
      <div><span>Yashirilgan</span><b>{moneyCount(stats.hidden)}</b></div>
      <div><span>Tasdiqlangan xarid</span><b>{moneyCount(stats.verified)}</b></div>
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
        return <article className={`reviewAdminCard ${review.status === "hidden" ? "isHidden" : ""}`} key={review.id}>
          <div className="reviewAdminTop"><div><b>{review.first_name || review.username || "GULI mijozi"}</b><small>{review.username ? `@${review.username} · ` : ""}ID {review.telegram_id}</small></div><span className="reviewStars">{"★".repeat(Math.max(0, Math.min(5, Math.round(review.rating))))}{"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(review.rating))))}</span></div>
          <div className="reviewMeta"><span>KOD <b>{review.product_code || "—"}</b></span><span>BUYURTMA <b>{review.order_number || "—"}</b></span><span>{review.verified_purchase ? "✓ Tasdiqlangan xarid" : "Xarid tasdiqlanmagan"}</span></div>
          <p>{review.comment}</p>
          {urls.length > 0 && <div className="reviewPhotoRow">{urls.slice(0, 3).map((url, index) => <button key={`${url}-${index}`} onClick={() => setPhoto({ urls, index })}><img src={url} alt="Mijoz sharh rasmi" loading="lazy"/></button>)}</div>}
          <div className="reviewAdminBottom"><span>{reviewDate(review.created_at)}</span><span className={`reviewStatus ${review.status}`}>{review.status === "approved" ? "Ko‘rinadi" : "Yashirilgan"}</span><div>{review.status === "approved" ? <button onClick={() => void setReviewStatus(review, "hidden")}>Yashirish</button> : <button className="primaryAction" onClick={() => void setReviewStatus(review, "approved")}>Ko‘rsatish</button>}<button className="deleteAction" onClick={() => void remove(review)}>O‘chirish</button></div></div>
        </article>;
      })}</div>}
    </div>
    {photo && <div className="reviewLightbox" onClick={() => setPhoto(null)}><button className="reviewLightboxClose" onClick={() => setPhoto(null)}>×</button><button className="reviewLightboxNav prev" onClick={(e) => { e.stopPropagation(); setPhoto({ ...photo, index: (photo.index - 1 + photo.urls.length) % photo.urls.length }); }}>‹</button><img src={photo.urls[photo.index]} alt="Sharh rasmi" onClick={(e) => e.stopPropagation()}/><button className="reviewLightboxNav next" onClick={(e) => { e.stopPropagation(); setPhoto({ ...photo, index: (photo.index + 1) % photo.urls.length }); }}>›</button><span className="reviewLightboxCount">{photo.index + 1} / {photo.urls.length}</span></div>}
  </section>;
}
