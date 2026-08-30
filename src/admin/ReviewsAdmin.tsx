import { useCallback, useEffect, useMemo, useState } from "react";
import "./ReviewsAdmin.css";
import { getStoredReviews, saveStoredReviews, type ReviewItem } from "../components/ProductReviewsSection";
import { DEFAULT_PRODUCTS } from "../utils/defaultProducts";

export type AdminReview = {
  id: number | string;
  product_id?: string | number;
  product_code?: string;
  product_name?: string | null;
  product_title?: string | null;
  product_image?: string | null;
  product_images?: string[];
  product_category?: string | null;
  product_price?: number | null;
  product_old_price?: number | null;
  product_stock?: number | null;
  product_active?: boolean | null;
  telegram_id?: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
  customer_username?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  customer_phone?: string | null;
  rating: number;
  comment: string;
  photos?: string[];
  verified_purchase?: boolean;
  order_number?: string;
  order_status?: string | null;
  order_total?: number | null;
  order_subtotal?: number | null;
  order_delivery?: number | null;
  order_discount?: number | null;
  order_phone?: string | null;
  order_address?: any;
  order_created_at?: string | null;
  status: "approved" | "hidden";
  is_pinned?: boolean;
  created_at: string;
};

const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const money = (n: number | null | undefined) => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;

const reviewDate = (v: string | null | undefined) => {
  const d = new Date(String(v || ""));
  if (Number.isNaN(d.getTime())) return "Yaqinda";
  return d.toLocaleString("uz-UZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const customerName = (r: AdminReview) =>
  [r.customer_first_name || r.first_name, r.customer_last_name || r.last_name].filter(Boolean).join(" ") ||
  r.customer_username ||
  r.username ||
  "GULI mijozi";

const customerUsername = (r: AdminReview) => r.customer_username || r.username || "";

export default function ReviewsAdmin({ token }: { token: string }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [productsList, setProductsList] = useState<any[]>(DEFAULT_PRODUCTS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "hidden" | "pinned">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [selectedProductFilter, setSelectedProductFilter] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  
  // Modals & Lightbox
  const [photoLightbox, setPhotoLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [editingReview, setEditingReview] = useState<AdminReview | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New review form state
  const [newForm, setNewForm] = useState({
    product_code: DEFAULT_PRODUCTS[0]?.product_code || "GL-4081",
    product_name: DEFAULT_PRODUCTS[0]?.name || "Velvet Elegance Push-Up To‘plami",
    first_name: "",
    last_name: "",
    username: "",
    telegram_id: Math.floor(100000 + Math.random() * 900000),
    photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    rating: 5,
    comment: "",
    photo_input: "",
    verified_purchase: true,
    is_pinned: false,
    status: "approved" as "approved" | "hidden",
  });

  const notify = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      const json = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error("Admin sessiyasi tugagan");
      if (!response.ok || json?.success === false)
        throw new Error(json?.message || `Server xatosi (${response.status})`);
      return json;
    },
    [token]
  );

  // Load products to enrich product details
  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/products`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setProductsList(json.data);
          return;
        }
      }
    } catch {}
    setProductsList(DEFAULT_PRODUCTS);
  }, []);

  // Match review with product info
  const enrichReview = useCallback(
    (item: any): AdminReview => {
      const matched = productsList.find(
        (p) =>
          (item.product_code && (p.product_code === item.product_code || String(p.id) === String(item.product_code))) ||
          (item.product_id && String(p.id) === String(item.product_id)) ||
          (item.product_name && p.name.toLowerCase() === item.product_name.toLowerCase())
      );

      const productImage =
        item.product_image ||
        matched?.image ||
        (Array.isArray(matched?.images) && matched.images[0]) ||
        (Array.isArray(item.product_images) && item.product_images[0]) ||
        "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=900&q=80";

      const productCategory = item.product_category || matched?.category || "Byustgalter";
      const productCode = item.product_code || matched?.product_code || "GL-1001";
      const productName = item.product_name || item.product_title || matched?.name || "GULI Lingerie";
      const productPrice = item.product_price ?? matched?.price ?? 290000;

      return {
        ...item,
        product_code: productCode,
        product_name: productName,
        product_category: productCategory,
        product_image: productImage,
        product_price: productPrice,
        verified_purchase: item.verified_purchase ?? true,
        rating: Number(item.rating) || 5,
        status: item.status === "hidden" ? "hidden" : "approved",
        is_pinned: Boolean(item.is_pinned),
        created_at: item.created_at || new Date().toISOString(),
      };
    },
    [productsList]
  );

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError("");
    let combined: AdminReview[] = [];

    // Load from local storage
    const stored = getStoredReviews();
    combined = stored.map(enrichReview);

    try {
      const json = await request("/api/admin/reviews");
      if (Array.isArray(json.data)) {
        const apiEnriched = json.data.map(enrichReview);
        const apiIds = new Set(apiEnriched.map((r: AdminReview) => String(r.id)));
        const uniqueStored = combined.filter((r) => !apiIds.has(String(r.id)));
        combined = [...apiEnriched, ...uniqueStored];
      }
    } catch {
      // Keep combined from local storage
    } finally {
      // Sort: Pinned first, then newest
      combined.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setReviews(combined);
      setLoading(false);
    }
  }, [enrichReview, request]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (productsList.length > 0) {
      void loadReviews();
    }
  }, [productsList, loadReviews]);

  // Unique categories list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    productsList.forEach((p) => p.category && cats.add(p.category));
    reviews.forEach((r) => r.product_category && cats.add(r.product_category));
    return Array.from(cats);
  }, [productsList, reviews]);

  // Product reviews summary mapping
  const productReviewsMap = useMemo(() => {
    const map = new Map<string, { count: number; avgRating: number; name: string; image: string; category: string }>();
    
    productsList.forEach((p) => {
      const key = p.product_code || String(p.id);
      map.set(key, {
        count: 0,
        avgRating: 0,
        name: p.name,
        image: p.image || (Array.isArray(p.images) ? p.images[0] : ""),
        category: p.category || "Toifa",
      });
    });

    reviews.forEach((r) => {
      const key = r.product_code || "other";
      const existing = map.get(key) || {
        count: 0,
        avgRating: 0,
        name: r.product_name || "Mahsulot",
        image: r.product_image || "",
        category: r.product_category || "Toifa",
      };
      existing.count += 1;
      existing.avgRating += r.rating;
      map.set(key, existing);
    });

    map.forEach((val) => {
      if (val.count > 0) {
        val.avgRating = Number((val.avgRating / val.count).toFixed(1));
      }
    });

    return map;
  }, [productsList, reviews]);

  // Selected product object
  const selectedProductObj = useMemo(() => {
    if (!selectedProductFilter) return null;
    return (
      productsList.find((p) => p.product_code === selectedProductFilter || String(p.id) === selectedProductFilter) ||
      reviews.find((r) => r.product_code === selectedProductFilter)
    );
  }, [selectedProductFilter, productsList, reviews]);

  // Filtered reviews
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return reviews.filter((r) => {
      // 1. Search Query
      const haystack = `${r.product_code || ""} ${r.product_name || ""} ${r.product_category || ""} ${customerName(r)} ${customerUsername(r)} ${r.telegram_id || ""} ${r.customer_phone || ""} ${r.comment}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;

      // 2. Status Filter
      if (statusFilter === "approved" && r.status !== "approved") return false;
      if (statusFilter === "hidden" && r.status !== "hidden") return false;
      if (statusFilter === "pinned" && !r.is_pinned) return false;

      // 3. Category Filter
      if (categoryFilter !== "all" && r.product_category !== categoryFilter) return false;

      // 4. Rating Filter
      if (ratingFilter !== "all" && Math.round(r.rating) !== Number(ratingFilter)) return false;

      // 5. Selected Product Filter (Tavar ustiga bosilganda faqat shu tovar sharhlari)
      if (selectedProductFilter && r.product_code !== selectedProductFilter) return false;

      return true;
    });
  }, [reviews, query, statusFilter, categoryFilter, ratingFilter, selectedProductFilter]);

  // Actions
  const handleToggleStatus = async (review: AdminReview) => {
    const nextStatus: "approved" | "hidden" = review.status === "approved" ? "hidden" : "approved";
    try {
      await request(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch {}

    const updated: AdminReview[] = reviews.map((item) => (item.id === review.id ? { ...item, status: nextStatus } : item));
    setReviews(updated);
    saveStoredReviews(updated as ReviewItem[]);
    notify(nextStatus === "hidden" ? "Sharh yashirildi (saytda ko‘rinmaydi) 🔒" : "Sharh ochiq qilindi (saytda ko‘rinadi) ✓");
  };

  const handleTogglePin = async (review: AdminReview) => {
    const nextPinned = !review.is_pinned;
    try {
      await request(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_pinned: nextPinned }),
      });
    } catch {}

    const updated = reviews.map((item) => (item.id === review.id ? { ...item, is_pinned: nextPinned } : item));
    // Sort pinned to top
    updated.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    setReviews(updated);
    saveStoredReviews(updated as ReviewItem[]);
    notify(nextPinned ? "⭐ Sharh TOP qilindi (birinchilardan ko‘rinadi)!" : "Sharh TOP holatidan chiqarildi.");
  };

  const handleDelete = async (review: AdminReview) => {
    if (!window.confirm(`Haqiqatan ham #${review.id} sharhni o‘chirmoqchimisiz?`)) return;
    try {
      await request(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
    } catch {}

    const updated = reviews.filter((item) => item.id !== review.id);
    setReviews(updated);
    saveStoredReviews(updated as ReviewItem[]);
    notify("Sharh muvaffaqiyatli o‘chirildi 🗑️");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReview) return;

    try {
      await request(`/api/admin/reviews/${editingReview.id}`, {
        method: "PUT",
        body: JSON.stringify(editingReview),
      });
    } catch {}

    const updated = reviews.map((item) => (item.id === editingReview.id ? editingReview : item));
    setReviews(updated);
    saveStoredReviews(updated as ReviewItem[]);
    setEditingReview(null);
    notify("Sharh tahrirlandi va saqlandi ✓");
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.comment.trim()) {
      notify("Iltimos, sharh matnini kiriting!");
      return;
    }

    const matchedProd = productsList.find((p) => p.product_code === newForm.product_code);
    const photosArr = newForm.photo_input.trim() ? [newForm.photo_input.trim()] : [];

    const newRev: AdminReview = {
      id: `rev-admin-${Date.now()}`,
      product_code: newForm.product_code,
      product_name: matchedProd?.name || newForm.product_name,
      product_category: matchedProd?.category || "Byustgalter",
      product_image: matchedProd?.image || "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=900&q=80",
      product_price: matchedProd?.price || 290000,
      first_name: newForm.first_name || "Mijoz",
      last_name: newForm.last_name || "",
      username: newForm.username.replace(/^@/, ""),
      telegram_id: Number(newForm.telegram_id) || Math.floor(100000 + Math.random() * 900000),
      photo_url: newForm.photo_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      rating: Number(newForm.rating) || 5,
      comment: newForm.comment.trim(),
      photos: photosArr,
      verified_purchase: newForm.verified_purchase,
      status: newForm.status,
      is_pinned: newForm.is_pinned,
      created_at: new Date().toISOString(),
    };

    try {
      await request("/api/admin/reviews", {
        method: "POST",
        body: JSON.stringify(newRev),
      });
    } catch {}

    const updated = [newRev, ...reviews];
    if (newRev.is_pinned) {
      updated.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    }

    setReviews(updated);
    saveStoredReviews(updated as ReviewItem[]);
    setIsAddingNew(false);
    setNewForm({
      product_code: DEFAULT_PRODUCTS[0]?.product_code || "GL-4081",
      product_name: DEFAULT_PRODUCTS[0]?.name || "Velvet Elegance Push-Up To‘plami",
      first_name: "",
      last_name: "",
      username: "",
      telegram_id: Math.floor(100000 + Math.random() * 900000),
      photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "",
      photo_input: "",
      verified_purchase: true,
      is_pinned: false,
      status: "approved",
    });
    notify("Yangi sharh muvaffaqiyatli qo‘shildi ⭐");
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === "approved").length;
    const hidden = reviews.filter((r) => r.status === "hidden").length;
    const pinned = reviews.filter((r) => r.is_pinned).length;
    const avg = total ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / total : 5.0;
    const fiveStars = reviews.filter((r) => Math.round(r.rating) === 5).length;
    const satisfaction = total ? Math.round((fiveStars / total) * 100) : 100;

    return { total, approved, hidden, pinned, average: avg.toFixed(1), satisfaction };
  }, [reviews]);

  return (
    <section className="reviewsAdminSuite">
      {/* Toast alert */}
      {toastMessage && <div className="reviewsToast">{toastMessage}</div>}

      {/* Top Overview Metric Cards */}
      <div className="reviewsStatsGrid">
        <div className="statBox">
          <div className="statIcon">💬</div>
          <div>
            <span>Jami sharhlar</span>
            <b>{stats.total.toLocaleString("uz-UZ")}</b>
          </div>
        </div>

        <div className="statBox activeStat">
          <div className="statIcon">👁️</div>
          <div>
            <span>Ko‘rinadigan (Ochiq)</span>
            <b>{stats.approved.toLocaleString("uz-UZ")}</b>
          </div>
        </div>

        <div className="statBox hiddenStat">
          <div className="statIcon">🔒</div>
          <div>
            <span>Yashirilgan</span>
            <b>{stats.hidden.toLocaleString("uz-UZ")}</b>
          </div>
        </div>

        <div className="statBox pinnedStat">
          <div className="statIcon">⭐</div>
          <div>
            <span>TOP (Birinchi) sharhlar</span>
            <b>{stats.pinned.toLocaleString("uz-UZ")}</b>
          </div>
        </div>

        <div className="statBox ratingStat">
          <div className="statIcon">★</div>
          <div>
            <span>O‘rtacha reyting</span>
            <b>{stats.average} ★ <small>({stats.satisfaction}% mamnun)</small></b>
          </div>
        </div>
      </div>

      {/* Selected Product Banner (Tavar bo'yicha cheklanganda) */}
      {selectedProductFilter && (
        <div className="selectedProductBanner">
          <div className="selectedProductBannerLeft">
            <img
              src={
                selectedProductObj?.image ||
                (Array.isArray(selectedProductObj?.images) ? selectedProductObj.images[0] : "") ||
                selectedProductObj?.product_image ||
                "https://images.unsplash.com/photo-1596483785989-619f5637fa97?auto=format&fit=crop&w=900&q=80"
              }
              alt="Tanlangan mahsulot"
              className="selectedProductThumb"
            />
            <div>
              <span className="selectedProductEyebrow">TANLANGAN TOVAR SHARHLARI</span>
              <h3>{selectedProductObj?.name || selectedProductObj?.product_name || "Tanlangan mahsulot"}</h3>
              <div className="selectedProductMeta">
                <span className="codePill">KOD: {selectedProductFilter}</span>
                {selectedProductObj?.category && <span className="catPill">{selectedProductObj.category}</span>}
                {selectedProductObj?.price && <span className="pricePill">{money(selectedProductObj.price)}</span>}
                <span className="countPill">Ushbu tovarga {filtered.length} ta sharh mavjud</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="clearProductFilterBtn"
            onClick={() => setSelectedProductFilter(null)}
          >
            ✕ Barcha tovarlar sharhlariga qaytish
          </button>
        </div>
      )}

      {/* Horizontal Quick Product Carousel / Filters */}
      <div className="productsQuickBar">
        <div className="quickBarHeader">
          <span>🛍️ TOVARLAR BO‘YICHA TEZKOR SARALASH:</span>
          <small>Tovarni bosing va unga yozilgan barcha sharhlarni ko‘ring</small>
        </div>
        <div className="quickProductsScroll">
          <button
            type="button"
            className={`quickProductChip ${selectedProductFilter === null ? "active" : ""}`}
            onClick={() => setSelectedProductFilter(null)}
          >
            <div className="chipAllIcon">★</div>
            <div className="chipInfo">
              <b>Barcha tovarlar</b>
              <small>{reviews.length} ta sharh</small>
            </div>
          </button>

          {productsList.map((prod) => {
            const pCode = prod.product_code || String(prod.id);
            const info = productReviewsMap.get(pCode) || { count: 0, avgRating: 5.0 };
            const isActive = selectedProductFilter === pCode;

            return (
              <button
                key={pCode}
                type="button"
                className={`quickProductChip ${isActive ? "active" : ""}`}
                onClick={() => setSelectedProductFilter(isActive ? null : pCode)}
                title={`${prod.name} (${info.count} ta sharh)`}
              >
                <img
                  src={prod.image || (Array.isArray(prod.images) ? prod.images[0] : "")}
                  alt={prod.name}
                  className="chipImg"
                />
                <div className="chipInfo">
                  <b>{prod.name}</b>
                  <small>
                    {prod.category} · {info.count} sharh {info.count > 0 ? `(${info.avgRating}★)` : ""}
                  </small>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel */}
      <div className="reviewsMainPanel">
        {/* Controls Toolbar */}
        <div className="reviewsToolbarRow">
          {/* Search Box */}
          <div className="reviewsSearchBox">
            <span className="searchIcon">⌕</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qidiruv: tovar nomi, kodi, toifa, mijoz ismi, @username yoki sharh matni..."
            />
            {query && (
              <button type="button" className="clearSearch" onClick={() => setQuery("")}>
                ×
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="reviewsActionButtons">
            <button
              type="button"
              className="addNewReviewBtn"
              onClick={() => setIsAddingNew(true)}
            >
              + Yangi sharh qo‘shish
            </button>
            <button
              type="button"
              className="refreshBtn"
              onClick={() => void loadReviews()}
              disabled={loading}
              title="Yangilash"
            >
              ↻ Yangilash
            </button>
          </div>
        </div>

        {/* Filter Pills Bar */}
        <div className="reviewsFiltersRow">
          {/* Status Tabs */}
          <div className="filterButtonGroup">
            {(["all", "approved", "hidden", "pinned"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={statusFilter === s ? "active" : ""}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" && "Barcha sharhlar"}
                {s === "approved" && "👁️ Ko‘rinadigan"}
                {s === "hidden" && "🔒 Yashirilgan"}
                {s === "pinned" && "⭐ Top sharhlar"}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="filterSelectWrapper">
            <label>Toifa:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Barcha kategoriyalar</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Dropdown */}
          <div className="filterSelectWrapper">
            <label>Baho:</label>
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
            >
              <option value="all">Barcha baholar</option>
              <option value="5">★★★★★ (5 yulduz)</option>
              <option value="4">★★★★☆ (4 yulduz)</option>
              <option value="3">★★★☆☆ (3 yulduz)</option>
              <option value="2">★★☆☆☆ (2 yulduz)</option>
              <option value="1">★☆☆☆☆ (1 yulduz)</option>
            </select>
          </div>
        </div>

        {/* Error notification */}
        {error && <div className="reviewsErrorBox">{error}</div>}

        {/* Reviews List */}
        {loading ? (
          <div className="reviewsEmptyBox">
            <div className="spinner">⏳</div>
            <h4>Sharhlar yuklanmoqda...</h4>
            <p>Iltimos kuting</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="reviewsEmptyBox">
            <div className="emptyIcon">💬</div>
            <h4>Hech qanday sharh topilmadi</h4>
            <p>Qidiruv so‘zi yoki filtrlarni o‘zgartirib ko‘ring.</p>
            {selectedProductFilter && (
              <button
                type="button"
                className="resetFilterBtn"
                onClick={() => {
                  setSelectedProductFilter(null);
                  setQuery("");
                  setStatusFilter("all");
                  setCategoryFilter("all");
                  setRatingFilter("all");
                }}
              >
                Filtrlarni tozalash
              </button>
            )}
          </div>
        ) : (
          <div className="reviewsGridCards">
            {filtered.map((rev) => {
              const fullName = customerName(rev);
              const username = customerUsername(rev);
              const initial = fullName.charAt(0).toUpperCase() || "G";
              const photoList = Array.isArray(rev.photos) ? rev.photos.filter(Boolean) : [];

              return (
                <article
                  key={rev.id}
                  className={`reviewCard ${rev.status === "hidden" ? "reviewCardHidden" : ""} ${
                    rev.is_pinned ? "reviewCardPinned" : ""
                  }`}
                >
                  {/* Pinned / Hidden Banner Badge */}
                  <div className="cardBadgeRow">
                    {rev.is_pinned && <span className="pinnedBadge">⭐ TOP SHARH</span>}
                    {rev.status === "hidden" && <span className="hiddenBadge">🔒 YASHIRILGAN (SAYTDA KO‘RINMAYDI)</span>}
                    {rev.verified_purchase !== false && (
                      <span className="verifiedBadge">✓ Tasdiqlangan xarid</span>
                    )}
                  </div>

                  {/* 1. PRODUCT INFORMATION BLOCK (TAVAR RASMI, NOMI, KATEGORIYASI) */}
                  <div
                    className="productHeroBlock"
                    onClick={() => setSelectedProductFilter(rev.product_code || null)}
                    title="Ushbu tovardagi barcha sharhlarni ko‘rish uchun bosing"
                  >
                    <div className="productHeroImgWrap">
                      {rev.product_image ? (
                        <img
                          src={rev.product_image}
                          alt={rev.product_name || "Mahsulot"}
                          loading="lazy"
                        />
                      ) : (
                        <div className="prodPlaceholder">◈</div>
                      )}
                    </div>
                    <div className="productHeroDetails">
                      <div className="categoryAndCode">
                        <span className="categoryBadge">{rev.product_category || "Byustgalter"}</span>
                        <span className="codeBadge">KOD: {rev.product_code || "—"}</span>
                      </div>
                      <b className="productTitleText">{rev.product_name || "GULI Lingerie"}</b>
                      <div className="productPriceAction">
                        <span className="priceTag">{money(rev.product_price)}</span>
                        <span className="filterPrompt">🔍 Faqat shu tovar sharhlari</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. CUSTOMER PROFILE BLOCK (SHARH YOZGAN PROFIL MA'LUMOTI) */}
                  <div className="customerProfileBlock">
                    <div className="customerAvatarWrap">
                      {rev.photo_url ? (
                        <img
                          src={rev.photo_url}
                          alt={fullName}
                          className="customerAvatarImg"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="customerAvatarInitial">{initial}</div>
                      )}
                    </div>

                    <div className="customerMetaDetails">
                      <div className="nameAndRating">
                        <strong className="customerNameText">{fullName}</strong>
                        <div className="ratingStarsBox" title={`Baho: ${rev.rating} yulduz`}>
                          <span className="starsGlyphs">
                            {"★".repeat(Math.max(0, Math.min(5, Math.round(rev.rating))))}
                            {"☆".repeat(5 - Math.max(0, Math.min(5, Math.round(rev.rating))))}
                          </span>
                          <span className="ratingNumber">{Number(rev.rating).toFixed(1)}</span>
                        </div>
                      </div>

                      <div className="customerTelegramRow">
                        {username ? (
                          <span className="tgUsername">@{username}</span>
                        ) : null}
                        {rev.telegram_id ? (
                          <span className="tgId">ID: {rev.telegram_id}</span>
                        ) : null}
                        {rev.customer_phone ? (
                          <span className="phoneTag">📞 {rev.customer_phone}</span>
                        ) : null}
                        <span className="dateTag">🗓️ {reviewDate(rev.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. REVIEW COMMENT & ATTACHED PHOTOS (SHARH MATNI VA RASMLARI) */}
                  <div className="reviewCommentBlock">
                    <p className="commentText">{rev.comment}</p>
                    
                    {photoList.length > 0 && (
                      <div className="reviewAttachedPhotos">
                        <small className="photosLabel">Sharhga biriktirilgan rasmlar ({photoList.length}):</small>
                        <div className="photosThumbGrid">
                          {photoList.map((url, idx) => (
                            <button
                              key={`${url}-${idx}`}
                              type="button"
                              className="photoThumbBtn"
                              onClick={() => setPhotoLightbox({ urls: photoList, index: idx })}
                              title="Rasmni katta qilib ko‘rish"
                            >
                              <img src={url} alt="Mijoz yuklagan rasm" loading="lazy" />
                              <span className="zoomIcon">🔍</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. ACTIONS FOOTER (TOP QILISH, YASHIRISH/KO'RSATISH, TAHRIRLASH, O'CHIRISH) */}
                  <div className="reviewCardActions">
                    {/* Top Pin button */}
                    <button
                      type="button"
                      className={`actionBtn pinBtn ${rev.is_pinned ? "pinnedActive" : ""}`}
                      onClick={() => void handleTogglePin(rev)}
                      title={rev.is_pinned ? "Topdan chiqarish" : "Top birinchilardan qilish"}
                    >
                      {rev.is_pinned ? "⭐ Topdan olish" : "⭐ Top sharh qilish"}
                    </button>

                    {/* Hide / Show button */}
                    <button
                      type="button"
                      className={`actionBtn hideBtn ${rev.status === "hidden" ? "hiddenActive" : ""}`}
                      onClick={() => void handleToggleStatus(rev)}
                      title={rev.status === "hidden" ? "Saytda ko‘rsatish" : "Saytda yashirish"}
                    >
                      {rev.status === "hidden" ? "👁️ Ko‘rsatish" : "🔒 Yashirish"}
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      className="actionBtn editBtn"
                      onClick={() => setEditingReview({ ...rev })}
                      title="Sharhni tahrirlash"
                    >
                      ✏️ Tahrirlash
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      className="actionBtn deleteBtn"
                      onClick={() => void handleDelete(rev)}
                      title="Sharhni o‘chirish"
                    >
                      🗑️
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT REVIEW MODAL */}
      {editingReview && (
        <div className="reviewsModalBackdrop" onClick={() => setEditingReview(null)}>
          <div className="reviewsModalBox" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <span className="modalEyebrow">SHARHNI TAHRIRLASH</span>
                <h3>Sharh #{editingReview.id}</h3>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setEditingReview(null)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modalForm">
              {/* Product selector */}
              <div className="formGroup">
                <label>Mahsulot:</label>
                <select
                  value={editingReview.product_code || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const prod = productsList.find((p) => p.product_code === code);
                    setEditingReview({
                      ...editingReview,
                      product_code: code,
                      product_name: prod?.name || editingReview.product_name,
                      product_category: prod?.category || editingReview.product_category,
                      product_image: prod?.image || editingReview.product_image,
                    });
                  }}
                >
                  {productsList.map((p) => (
                    <option key={p.product_code || p.id} value={p.product_code || p.id}>
                      {p.name} ({p.product_code} · {p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer details */}
              <div className="formRow">
                <div className="formGroup">
                  <label>Ismi:</label>
                  <input
                    type="text"
                    value={editingReview.first_name || ""}
                    onChange={(e) =>
                      setEditingReview({ ...editingReview, first_name: e.target.value })
                    }
                    placeholder="Mijoz ismi"
                  />
                </div>
                <div className="formGroup">
                  <label>Familiyasi:</label>
                  <input
                    type="text"
                    value={editingReview.last_name || ""}
                    onChange={(e) =>
                      setEditingReview({ ...editingReview, last_name: e.target.value })
                    }
                    placeholder="Familiyasi"
                  />
                </div>
              </div>

              <div className="formRow">
                <div className="formGroup">
                  <label>Telegram @username:</label>
                  <input
                    type="text"
                    value={editingReview.username || ""}
                    onChange={(e) =>
                      setEditingReview({ ...editingReview, username: e.target.value })
                    }
                    placeholder="username (masalan: malika_b)"
                  />
                </div>
                <div className="formGroup">
                  <label>Telegram ID:</label>
                  <input
                    type="number"
                    value={editingReview.telegram_id || ""}
                    onChange={(e) =>
                      setEditingReview({ ...editingReview, telegram_id: Number(e.target.value) })
                    }
                    placeholder="Telegram ID raqami"
                  />
                </div>
              </div>

              {/* Rating */}
              <div className="formGroup">
                <label>Baho (Reyting):</label>
                <div className="ratingSelectRow">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`starSelectBtn ${editingReview.rating === star ? "active" : ""}`}
                      onClick={() => setEditingReview({ ...editingReview, rating: star })}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment text */}
              <div className="formGroup">
                <label>Sharh matni:</label>
                <textarea
                  rows={4}
                  value={editingReview.comment}
                  onChange={(e) =>
                    setEditingReview({ ...editingReview, comment: e.target.value })
                  }
                  required
                />
              </div>

              {/* Options checkboxes */}
              <div className="checkboxesRow">
                <label className="checkLabel">
                  <input
                    type="checkbox"
                    checked={editingReview.is_pinned ?? false}
                    onChange={(e) =>
                      setEditingReview({ ...editingReview, is_pinned: e.target.checked })
                    }
                  />
                  <span>⭐ TOP sharh qilish (Birinchi ko‘rsatish)</span>
                </label>

                <label className="checkLabel">
                  <input
                    type="checkbox"
                    checked={editingReview.status === "approved"}
                    onChange={(e) =>
                      setEditingReview({
                        ...editingReview,
                        status: e.target.checked ? "approved" : "hidden",
                      })
                    }
                  />
                  <span>👁️ Saytda ochiq ko‘rsatish</span>
                </label>

                <label className="checkLabel">
                  <input
                    type="checkbox"
                    checked={editingReview.verified_purchase ?? true}
                    onChange={(e) =>
                      setEditingReview({
                        ...editingReview,
                        verified_purchase: e.target.checked,
                      })
                    }
                  />
                  <span>✓ Tasdiqlangan xarid nishoni</span>
                </label>
              </div>

              {/* Modal action buttons */}
              <div className="modalFooter">
                <button
                  type="button"
                  className="cancelBtn"
                  onClick={() => setEditingReview(null)}
                >
                  Bekor qilish
                </button>
                <button type="submit" className="saveBtn">
                  Saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD NEW REVIEW MODAL */}
      {isAddingNew && (
        <div className="reviewsModalBackdrop" onClick={() => setIsAddingNew(false)}>
          <div className="reviewsModalBox" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <span className="modalEyebrow">YANGI SHARH QO‘SHISH</span>
                <h3>Mijoz sharhini kiritish</h3>
              </div>
              <button
                type="button"
                className="modalCloseBtn"
                onClick={() => setIsAddingNew(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateReview} className="modalForm">
              {/* Product selector */}
              <div className="formGroup">
                <label>Qaysi tovar uchun sharh?:</label>
                <select
                  value={newForm.product_code}
                  onChange={(e) => {
                    const code = e.target.value;
                    const prod = productsList.find((p) => p.product_code === code);
                    setNewForm({
                      ...newForm,
                      product_code: code,
                      product_name: prod?.name || newForm.product_name,
                    });
                  }}
                >
                  {productsList.map((p) => (
                    <option key={p.product_code || p.id} value={p.product_code || p.id}>
                      {p.name} ({p.product_code} · {p.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer details */}
              <div className="formRow">
                <div className="formGroup">
                  <label>Mijoz ismi:</label>
                  <input
                    type="text"
                    value={newForm.first_name}
                    onChange={(e) => setNewForm({ ...newForm, first_name: e.target.value })}
                    placeholder="Masalan: Malika"
                    required
                  />
                </div>
                <div className="formGroup">
                  <label>Familiyasi (ixtiyoriy):</label>
                  <input
                    type="text"
                    value={newForm.last_name}
                    onChange={(e) => setNewForm({ ...newForm, last_name: e.target.value })}
                    placeholder="Masalan: Soliho'jayeva"
                  />
                </div>
              </div>

              <div className="formRow">
                <div className="formGroup">
                  <label>Telegram @username:</label>
                  <input
                    type="text"
                    value={newForm.username}
                    onChange={(e) => setNewForm({ ...newForm, username: e.target.value })}
                    placeholder="masalan: malika_beauty"
                  />
                </div>
                <div className="formGroup">
                  <label>Profil rasmi URL (ixtiyoriy):</label>
                  <input
                    type="url"
                    value={newForm.photo_url}
                    onChange={(e) => setNewForm({ ...newForm, photo_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                  />
                </div>
              </div>

              {/* Rating */}
              <div className="formGroup">
                <label>Baho (Reyting):</label>
                <div className="ratingSelectRow">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`starSelectBtn ${newForm.rating === star ? "active" : ""}`}
                      onClick={() => setNewForm({ ...newForm, rating: star })}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment text */}
              <div className="formGroup">
                <label>Sharh matni:</label>
                <textarea
                  rows={4}
                  value={newForm.comment}
                  onChange={(e) => setNewForm({ ...newForm, comment: e.target.value })}
                  placeholder="Mijozning mahsulot haqidagi fikrini yozing..."
                  required
                />
              </div>

              {/* Photo url */}
              <div className="formGroup">
                <label>Sharhga biriktiriladigan rasm URL (ixtiyoriy):</label>
                <input
                  type="url"
                  value={newForm.photo_input}
                  onChange={(e) => setNewForm({ ...newForm, photo_input: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              {/* Options */}
              <div className="checkboxesRow">
                <label className="checkLabel">
                  <input
                    type="checkbox"
                    checked={newForm.is_pinned}
                    onChange={(e) => setNewForm({ ...newForm, is_pinned: e.target.checked })}
                  />
                  <span>⭐ TOP sharh qilish (Saytda eng yuqorida turadi)</span>
                </label>

                <label className="checkLabel">
                  <input
                    type="checkbox"
                    checked={newForm.status === "approved"}
                    onChange={(e) =>
                      setNewForm({ ...newForm, status: e.target.checked ? "approved" : "hidden" })
                    }
                  />
                  <span>👁️ Saytda darhol ko‘rsatish</span>
                </label>
              </div>

              {/* Modal footer */}
              <div className="modalFooter">
                <button
                  type="button"
                  className="cancelBtn"
                  onClick={() => setIsAddingNew(false)}
                >
                  Bekor qilish
                </button>
                <button type="submit" className="saveBtn">
                  + Sharhni qo‘shish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PHOTO LIGHTBOX */}
      {photoLightbox && (
        <div className="reviewLightboxBackdrop" onClick={() => setPhotoLightbox(null)}>
          <button
            type="button"
            className="lightboxClose"
            onClick={() => setPhotoLightbox(null)}
          >
            ×
          </button>
          
          {photoLightbox.urls.length > 1 && (
            <button
              type="button"
              className="lightboxNav prev"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoLightbox({
                  ...photoLightbox,
                  index:
                    (photoLightbox.index - 1 + photoLightbox.urls.length) %
                    photoLightbox.urls.length,
                });
              }}
            >
              ‹
            </button>
          )}

          <img
            src={photoLightbox.urls[photoLightbox.index]}
            alt="Sharh rasmi"
            className="lightboxImg"
            onClick={(e) => e.stopPropagation()}
          />

          {photoLightbox.urls.length > 1 && (
            <button
              type="button"
              className="lightboxNav next"
              onClick={(e) => {
                e.stopPropagation();
                setPhotoLightbox({
                  ...photoLightbox,
                  index: (photoLightbox.index + 1) % photoLightbox.urls.length,
                });
              }}
            >
              ›
            </button>
          )}

          <div className="lightboxCounter">
            {photoLightbox.index + 1} / {photoLightbox.urls.length}
          </div>
        </div>
      )}
    </section>
  );
}
