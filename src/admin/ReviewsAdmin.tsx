import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "../lib/apiOrigin";
import "./ReviewsAdmin.css";
import { DEFAULT_PRODUCTS } from "../utils/defaultProducts";

export type AdminReview = {
  id: number | string;
  product_id?: string | number;
  product_code?: string;
  product_name?: string | null;
  product_image?: string | null;
  product_category?: string | null;
  product_price?: number | null;
  telegram_id?: number;
  username?: string | null;
  photo_url?: string | null;
  display_name?: string | null;
  customer_phone?: string | null;
  rating: number;
  comment: string;
  photos?: string[];
  verified_purchase?: boolean;
  order_number?: string;
  status: "approved" | "hidden";
  is_pinned?: boolean;
  created_at: string;
};

const API = getApiBaseUrl();
const money = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;
const dateText = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "Yaqinda" : d.toLocaleString("uz-UZ", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
const nameOf = (r: AdminReview) => {
  const n = String(r.display_name || "").trim();
  return n && !/^(undefined|null|user|guli mijozi)$/i.test(n) ? n : "Anonim mijoz";
};

export default function ReviewsAdmin({ token }: { token: string }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [products, setProducts] = useState<any[]>(DEFAULT_PRODUCTS);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "approved" | "hidden" | "pinned">("all");
  const [rating, setRating] = useState("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2500); };

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) throw new Error(json?.message || `Server xatosi (${res.status})`);
    return json;
  }, [token]);

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/products`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json?.data) && json.data.length) setProducts(json.data);
    } catch { /* review moderation must still work without product enrichment */ }
  }, []);

  const loadReviews = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const json = await request("/api/admin/reviews");
      const rows: AdminReview[] = Array.isArray(json?.data) ? json.data.map((r: any) => {
        const p = products.find((x) => String(x.id) === String(r.product_id) || x.product_code === r.product_code);
        return {
          ...r,
          product_code: r.product_code || p?.product_code,
          product_name: r.product_name || p?.name || "Mahsulot",
          product_category: r.product_category || p?.category || "",
          product_image: r.product_image || p?.image || (Array.isArray(p?.images) ? p.images[0] : null),
          product_price: r.product_price ?? p?.price ?? null,
          display_name: r.display_name || null,
          photo_url: r.photo_url || null,
          rating: Number(r.rating) || 0,
          status: r.status === "hidden" ? "hidden" : "approved",
          is_pinned: Boolean(r.is_pinned),
          photos: Array.isArray(r.photos) ? r.photos : [],
        };
      }) : [];
      rows.sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setReviews(rows);
    } catch (e: any) {
      setReviews([]); setError(e?.message || "Sharhlarni yuklashda xatolik");
    } finally { setLoading(false); }
  }, [products, request]);

  useEffect(() => { void loadProducts(); }, [loadProducts]);
  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((r) => {
      if (status === "approved" && r.status !== "approved") return false;
      if (status === "hidden" && r.status !== "hidden") return false;
      if (status === "pinned" && !r.is_pinned) return false;
      if (rating !== "all" && Number(r.rating) !== Number(rating)) return false;
      if (productFilter !== "all" && String(r.product_code) !== productFilter) return false;
      if (!q) return true;
      return `${r.product_code || ""} ${r.product_name || ""} ${r.product_category || ""} ${nameOf(r)} ${r.username || ""} ${r.comment}`.toLowerCase().includes(q);
    });
  }, [reviews, query, status, rating, productFilter]);

  const stats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter(r => r.status === "approved").length;
    const hidden = reviews.filter(r => r.status === "hidden").length;
    const pinned = reviews.filter(r => r.is_pinned).length;
    const average = total ? reviews.reduce((s, r) => s + Number(r.rating || 0), 0) / total : 0;
    return { total, approved, hidden, pinned, average };
  }, [reviews]);

  const mutate = async (review: AdminReview, patch: { status?: "approved" | "hidden"; is_pinned?: boolean }) => {
    try {
      const json = await request(`/api/admin/reviews/${review.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      const server = json?.data || {};
      setReviews(prev => prev.map(r => r.id === review.id ? { ...r, ...patch, ...server } : r));
      notify("Sharh ma'lumotlar bazasida yangilandi ✓");
    } catch (e: any) { notify(e?.message || "O‘zgarishni saqlab bo‘lmadi"); }
  };

  const handleDelete = async (review: AdminReview) => {
    if (!window.confirm(`Haqiqatan ham #${review.id} sharhni o‘chirmoqchimisiz?`)) return;
    try {
      await request(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      setReviews(prev => prev.filter(r => r.id !== review.id));
      notify("Sharh o‘chirildi ✓");
    } catch (e: any) { notify(e?.message || "Sharhni o‘chirib bo‘lmadi"); }
  };

  return <section className="reviewsAdminSuite">
    {toast && <div className="reviewsToast">{toast}</div>}
    <div className="reviewsStatsGrid">
      <div className="statBox"><div className="statIcon">💬</div><div><span>Jami sharhlar</span><b>{stats.total}</b></div></div>
      <div className="statBox activeStat"><div className="statIcon">👁️</div><div><span>Ko‘rinadigan</span><b>{stats.approved}</b></div></div>
      <div className="statBox hiddenStat"><div className="statIcon">🔒</div><div><span>Yashirilgan</span><b>{stats.hidden}</b></div></div>
      <div className="statBox pinnedStat"><div className="statIcon">⭐</div><div><span>TOP</span><b>{stats.pinned}</b></div></div>
      <div className="statBox ratingStat"><div className="statIcon">★</div><div><span>O‘rtacha reyting</span><b>{stats.average.toFixed(1)} ★</b></div></div>
    </div>

    <div className="reviewsMainPanel">
      <div className="reviewsToolbarRow">
        <div className="reviewsSearchBox"><span className="searchIcon">⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tovar, mijoz yoki sharh bo‘yicha qidirish..." /></div>
        <button type="button" className="refreshBtn" onClick={() => void loadReviews()} disabled={loading}>↻ Yangilash</button>
      </div>
      <div className="reviewsFiltersRow">
        <div className="filterButtonGroup">{(["all","approved","hidden","pinned"] as const).map(s => <button key={s} type="button" className={status === s ? "active" : ""} onClick={() => setStatus(s)}>{s === "all" ? "Barcha" : s === "approved" ? "👁️ Ochiq" : s === "hidden" ? "🔒 Yashirilgan" : "⭐ TOP"}</button>)}</div>
        <div className="filterSelectWrapper"><label>Tovar:</label><select value={productFilter} onChange={e => setProductFilter(e.target.value)}><option value="all">Barcha tovarlar</option>{products.map(p => <option key={p.product_code || p.id} value={p.product_code || p.id}>{p.name} ({p.product_code})</option>)}</select></div>
        <div className="filterSelectWrapper"><label>Baho:</label><select value={rating} onChange={e => setRating(e.target.value)}><option value="all">Barcha baholar</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} ★</option>)}</select></div>
      </div>
      {error && <div className="reviewsErrorBox">{error}</div>}
      {loading ? <div className="reviewsEmptyBox"><h4>Sharhlar yuklanmoqda...</h4></div> : filtered.length === 0 ? <div className="reviewsEmptyBox"><div className="emptyIcon">💬</div><h4>Haqiqiy sharhlar topilmadi</h4><p>Bu panel faqat public.product_reviews ma'lumotlar bazasidan foydalanadi.</p></div> : <div className="reviewsGridCards">
        {filtered.map(rev => {
          const name = nameOf(rev); const safePhoto = rev.photo_url || "";
          return <article key={rev.id} className={`reviewCard ${rev.status === "hidden" ? "reviewCardHidden" : ""} ${rev.is_pinned ? "reviewCardPinned" : ""}`}>
            <div className="cardBadgeRow">{rev.is_pinned && <span className="pinnedBadge">⭐ TOP SHARH</span>}{rev.status === "hidden" && <span className="hiddenBadge">🔒 YASHIRILGAN</span>}{rev.verified_purchase && <span className="verifiedBadge">✓ Tasdiqlangan xarid</span>}</div>
            <div className="productHeroBlock" onClick={() => setProductFilter(rev.product_code || "all")}>
              <div className="productHeroImgWrap">{rev.product_image ? <img src={rev.product_image} alt={rev.product_name || "Mahsulot"} loading="lazy" /> : <div className="prodPlaceholder">◈</div>}</div>
              <div className="productHeroDetails"><div className="categoryAndCode"><span className="categoryBadge">{rev.product_category || ""}</span><span className="codeBadge">KOD: {rev.product_code || "—"}</span></div><b className="productTitleText">{rev.product_name || "Mahsulot"}</b>{rev.product_price != null && <span className="priceTag">{money(rev.product_price)}</span>}</div>
            </div>
            <div className="customerProfileBlock"><div className="customerAvatarWrap">{safePhoto ? <img src={safePhoto} alt={name} className="customerAvatarImg" /> : <div className="customerAvatarInitial">{name.charAt(0)}</div>}</div><div className="customerMetaDetails"><div className="nameAndRating"><strong className="customerNameText">{name}</strong><span className="starsGlyphs">{"★".repeat(Math.max(0, Math.min(5, Math.round(rev.rating))))}{"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(rev.rating))))}</span></div><div className="customerTelegramRow">{rev.username && <span className="tgUsername">@{String(rev.username).replace(/^@/, "")}</span>}<span className="dateTag">🗓️ {dateText(rev.created_at)}</span></div></div></div>
            <div className="reviewCommentBlock"><p className="commentText">{rev.comment}</p>{rev.photos?.length ? <div className="reviewAttachedPhotos"><small className="photosLabel">Rasmlar ({rev.photos.length})</small><div className="photosThumbGrid">{rev.photos.map((url, i) => <button key={`${url}-${i}`} type="button" className="photoThumbBtn" onClick={() => setLightbox(url)}><img src={url} alt="Mijoz rasmi" loading="lazy" /></button>)}</div></div> : null}</div>
            <div className="reviewCardActions"><button type="button" className="actionBtn pinBtn" onClick={() => void mutate(rev, { is_pinned: !rev.is_pinned })}>{rev.is_pinned ? "⭐ Topdan olish" : "⭐ Top qilish"}</button><button type="button" className="actionBtn hideBtn" onClick={() => void mutate(rev, { status: rev.status === "approved" ? "hidden" : "approved" })}>{rev.status === "hidden" ? "👁️ Ko‘rsatish" : "🔒 Yashirish"}</button><button type="button" className="actionBtn deleteBtn" onClick={() => void handleDelete(rev)}>🗑️</button></div>
          </article>;
        })}
      </div>}
    </div>
    {lightbox && <div className="reviewLightboxBackdrop" onClick={() => setLightbox(null)}><button type="button" className="lightboxClose" onClick={() => setLightbox(null)}>×</button><img src={lightbox} alt="Sharh rasmi" className="lightboxImg" onClick={e => e.stopPropagation()} /></div>}
  </section>;
}
