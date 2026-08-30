import React, { useState, useEffect, useCallback } from "react";
import "./ProductReviewsSection.css";

export interface ReviewItem {
  id: number | string;
  product_id?: number | string;
  product_code?: string;
  product_name?: string;
  telegram_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  rating: number;
  comment: string;
  photos?: string[];
  verified_purchase?: boolean;
  status: "approved" | "hidden";
  is_pinned?: boolean;
  created_at: string;
}

interface ProductReviewsSectionProps {
  productCode?: string;
  productName?: string;
  productId?: number;
  productRating?: number;
  productReviewsCount?: number;
  onRatingUpdate?: (newRating: number, newCount: number) => void;
  telegramUser?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
  onShowToast?: (msg: string) => void;
}

const STORAGE_KEY = "guli_custom_reviews_v2";

export function getStoredReviews(): ReviewItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultReviews();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultReviews();
  } catch {
    return getDefaultReviews();
  }
}

export function saveStoredReviews(items: ReviewItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("guli:reviews-updated"));
  } catch {}
}

function getDefaultReviews(): ReviewItem[] {
  return [
    {
      id: "rev-default-1",
      product_code: "GL-4081",
      product_name: "Velvet Elegance Push-Up To‘plami",
      telegram_id: 992812,
      username: "malika_beauty",
      first_name: "Malika",
      last_name: "Soliho'jayeva",
      photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "Baxmal matosi juda mayin va yoqimli! Push-up shakli ajoyib ushlab turadi. Qadoqlanishi ham juda chiroyli ekan, rahmat!",
      photos: [
        "https://images.unsplash.com/photo-1596483785989-619f5637fa97?w=600&auto=format&fit=crop&q=80"
      ],
      verified_purchase: true,
      status: "approved",
      is_pinned: true,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "rev-default-2",
      product_code: "GL-2104",
      product_name: "Silk Satin Romantic Bezgalter",
      telegram_id: 881230,
      username: "nigora_a",
      first_name: "Nigora",
      last_name: "Azimova",
      photo_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "O'lchami 75B aynan mos keldi. Rangi rasmdagidanda chiroyli va nafis ipakdek. Kundalik kiyish uchun eng qulay tanlov bo'ldi!",
      verified_purchase: true,
      status: "approved",
      is_pinned: false,
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: "rev-default-3",
      product_code: "GL-7720",
      product_name: "Lace Temptation Bodysuit",
      telegram_id: 773194,
      username: "shahnoza_fashion",
      first_name: "Shahnoza",
      last_name: "Karimova",
      photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "Fransuz to‘rlari judayam jozibador va nafis! Tikilishi juda sifatli, hech qayeri qisimaydi. GULI jamoasiga katta rahmat!",
      photos: [
        "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?w=600&auto=format&fit=crop&q=80"
      ],
      verified_purchase: true,
      status: "approved",
      is_pinned: true,
      created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      id: "rev-default-4",
      product_code: "GL-1108",
      product_name: "Pure Silk Sleepwear Pijama",
      telegram_id: 662019,
      username: "dilnoza_m",
      first_name: "Dilnoza",
      last_name: "Murodova",
      photo_url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "Ipak matosi tanaga shunday yoqimli tegadi! Uyda kiyish uchun haqiqiy bayram. Toshkent ichida yetkazib berish ham tez bo'ldi.",
      verified_purchase: true,
      status: "approved",
      is_pinned: false,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: "rev-default-5",
      product_code: "GL-3301",
      product_name: "Seamless Invisible Tursiklar (3 talik)",
      telegram_id: 554321,
      username: "zulfiya_k",
      first_name: "Zulfiya",
      last_name: "Kamalova",
      photo_url: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "Lazer kesimi juda puxta, har qanday tor ko'ylak ostidan umuman bilinmaydi. 3 xil rang to'plami juda qulay!",
      verified_purchase: true,
      status: "approved",
      is_pinned: false,
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
    {
      id: "rev-default-6",
      product_code: "GL-5519",
      product_name: "Nafis Ipak va To‘rli Penyuar",
      telegram_id: 441098,
      username: "rayhona_beauty",
      first_name: "Rayhona",
      last_name: "Alimova",
      photo_url: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "Penyuarning dizayni juda nozik va zamonaviy! Matosi yengil, havo o'tkazuvchan. Sovg'a uchun ham ajoyib variant.",
      photos: [
        "https://images.unsplash.com/photo-1596483785989-619f5637fa97?w=600&auto=format&fit=crop&q=80"
      ],
      verified_purchase: true,
      status: "approved",
      is_pinned: false,
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
    {
      id: "rev-default-7",
      product_code: "GL-6612",
      product_name: "Cotton Silk Premium Mayka",
      telegram_id: 332145,
      username: "feruza_y",
      first_name: "Feruza",
      last_name: "Yuldasheva",
      photo_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      rating: 5,
      comment: "Paxta va ipak aralashmasi juda mayin. Yuvilgandan keyin ham rangi va shakli o'zgarmadi. 2 dona buyurtma bergandim, juda ma'qul bo'ldi!",
      verified_purchase: true,
      status: "approved",
      is_pinned: false,
      created_at: new Date(Date.now() - 86400000 * 18).toISOString(),
    }
  ];
}

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  productCode = "",
  productName = "",
  productId,
  productRating,
  productReviewsCount,
  onRatingUpdate,
  telegramUser,
  onShowToast,
}) => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const listRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [reviews]);

  const [selectedReviewDetail, setSelectedReviewDetail] = useState<ReviewItem | null>(null);
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [likedReviews, setLikedReviews] = useState<Record<string, number>>({});
  
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Automatic User Profile Photo detection
  const [userAvatarUrl, setUserAvatarUrl] = useState<string>(() => {
    if (telegramUser?.photo_url) return telegramUser.photo_url;
    const saved = localStorage.getItem("guli_user_photo") || localStorage.getItem("guli_avatar_url");
    if (saved) return saved;
    return "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
  });

  useEffect(() => {
    if (telegramUser?.photo_url) {
      setUserAvatarUrl(telegramUser.photo_url);
    }
  }, [telegramUser?.photo_url]);

  const loadReviews = useCallback(async () => {
    let localItems = getStoredReviews();
    
    // Also try backend API
    const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
    try {
      const codeQuery = productCode ? `?product_code=${encodeURIComponent(productCode)}` : "";
      const res = await fetch(`${API}/api/reviews${codeQuery}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.reviews)) {
          const apiReviews: ReviewItem[] = json.data.reviews.map((r: any) => ({
            id: r.id,
            product_code: r.product_code || productCode,
            product_name: r.product_name || productName,
            telegram_id: r.telegram_id,
            username: r.username || r.customer_username,
            first_name: r.first_name || r.customer_first_name || r.display_name,
            last_name: r.customer_last_name,
            photo_url: r.photo_url || r.avatar,
            rating: Number(r.rating) || 5,
            comment: r.comment || "",
            photos: Array.isArray(r.photos) ? r.photos : [],
            verified_purchase: Boolean(r.verified_purchase),
            status: r.status === "hidden" ? "hidden" : "approved",
            is_pinned: Boolean(r.is_pinned),
            created_at: r.created_at || new Date().toISOString(),
          }));
          
          // Combine API and local items avoiding duplicates
          const apiIds = new Set(apiReviews.map((item) => String(item.id)));
          const uniqueLocal = localItems.filter((item) => !apiIds.has(String(item.id)));
          localItems = [...apiReviews, ...uniqueLocal];
        }
      }
    } catch {}

    // Filter for current product if productCode is provided
    const filtered = localItems.filter(
      (r) =>
        r.status === "approved" &&
        (!productCode || !r.product_code || String(r.product_code) === String(productCode))
    );

    // Sort: Oldest first (Telegram style, grows bottom-up)
    filtered.sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    setReviews(filtered);
  }, [productCode, productName]);

  useEffect(() => {
    loadReviews();
    const handleUpdate = () => loadReviews();
    window.addEventListener("guli:reviews-updated", handleUpdate);
    return () => window.removeEventListener("guli:reviews-updated", handleUpdate);
  }, [loadReviews]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newPhotos: string[] = [];
    for (const file of Array.from(files).slice(0, 3 - photos.length)) {
      if (!file.type.startsWith("image/")) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxDim = 800;
            let w = img.width;
            let h = img.height;
            if (w > h && w > maxDim) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else if (h > maxDim) {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
            canvas.width = Math.max(1, w);
            canvas.height = Math.max(1, h);
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
          };
          img.src = String(ev.target?.result || "");
        };
        reader.readAsDataURL(file);
      });
      newPhotos.push(dataUrl);
    }
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, 3));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      if (onShowToast) onShowToast("Iltimos, sharh matnini kiriting");
      return;
    }
    setIsSubmitting(true);

    const displayName =
      [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") ||
      telegramUser?.username ||
      "GULI mijozi";

    const newReview: ReviewItem = {
      id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      product_code: productCode,
      product_name: productName,
      product_id: productId,
      telegram_id: telegramUser?.id,
      username: telegramUser?.username,
      first_name: displayName,
      photo_url: userAvatarUrl || telegramUser?.photo_url || "",
      rating,
      comment: comment.trim(),
      photos,
      verified_purchase: true,
      status: "approved",
      is_pinned: false,
      created_at: new Date().toISOString(),
    };

    // Try posting to API
    const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
    try {
      await fetch(`${API}/api/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(telegramUser?.id ? { "X-Telegram-Init-Data": window.Telegram?.WebApp?.initData || "" } : {}),
        },
        body: JSON.stringify({
          product_code: productCode,
          rating,
          comment: comment.trim(),
          photos,
          first_name: displayName,
          photo_url: userAvatarUrl || telegramUser?.photo_url,
        }),
      });
    } catch {}

    // Store in local storage
    const currentStored = getStoredReviews();
    const updated = [newReview, ...currentStored];
    saveStoredReviews(updated);

    // Update internal reviews list
    setReviews((prev) => [...prev, newReview]);

    const nextCount = (productReviewsCount && productReviewsCount > 0 ? productReviewsCount : reviews.length) + 1;
    if (onRatingUpdate) {
      onRatingUpdate(productRating && productRating > 0 ? productRating : 5.0, nextCount);
    }

    setIsSubmitting(false);
    setComment("");
    setPhotos([]);

    if (onShowToast) onShowToast("Rahmat! Sharhingiz e'lon qilindi ⭐");
  };

  // Synchronized rating & reviews calculations
  const totalCount =
    productReviewsCount !== undefined && productReviewsCount > 0
      ? Math.max(reviews.length, productReviewsCount)
      : reviews.length > 0
      ? reviews.length
      : 12;

  const avgRating = (
    productRating !== undefined && productRating > 0
      ? productRating
      : reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 5.0
  ).toFixed(1);

  const renderStars = (count: number) => {
    return (
      <span className="reviewsStarsGlyphs">
        {"★".repeat(Math.min(5, Math.max(1, Math.round(count))))}
        <span className="reviewsStarsEmpty">
          {"★".repeat(Math.max(0, 5 - Math.min(5, Math.max(1, Math.round(count)))))}
        </span>
      </span>
    );
  };

  return (
    <section className="productReviewsContainer" id="product-reviews-section">
      {/* Minimalist Top Header with Rating and Count */}
      <div className="reviewsHeaderBlock">
        <div className="reviewsHeaderLeft">
          <div className="reviewsTitleGroup">
            <span className="reviewsTitleIcon">💬</span>
            <h3 className="reviewsTitle">Baholar va sharhlar</h3>
          </div>
          <div className="reviewsHeaderMeta">
            <span className="reviewsHeaderStars">{renderStars(Number(avgRating))}</span>
            <strong className="reviewsHeaderScore">{avgRating}</strong>
            <span className="reviewsHeaderCount">({totalCount} ta sharh)</span>
          </div>
        </div>
      </div>

      <div className="reviewsList" ref={listRef}>
        {reviews.length === 0 ? (
          <div className="emptyReviewsState">
            <div className="emptyReviewIcon">💬</div>
            <h4>Ushbu mahsulot uchun birinchi sharhni siz yozing!</h4>
            <p>Sizning fikringiz boshqa haridorlar uchun juda muhim.</p>
          </div>
        ) : (
          reviews.map((rev) => {
            const authorName =
              [rev.first_name, rev.last_name].filter(Boolean).join(" ") ||
              rev.username ||
              "GULI mijozi";
            const initial = authorName.charAt(0).toUpperCase() || "👤";
            const dateStr = rev.created_at
              ? new Date(rev.created_at).toLocaleDateString("uz-UZ", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "";

            return (
              <article
                key={rev.id}
                className={`reviewItemCard ${rev.is_pinned ? "isPinnedReview" : ""}`}
                onClick={() => setSelectedReviewDetail(rev)}
              >
                {rev.is_pinned && (
                  <div className="pinnedReviewTag">
                    <span>⭐ TOP SHARH</span>
                  </div>
                )}
                
                {/* Profil rasmi va niki [👤][Yusufaliyev] */}
                <div className="reviewAuthorRow">
                  <div className="authorAvatarWrap">
                    {rev.photo_url ? (
                      <img
                        src={rev.photo_url}
                        alt={authorName}
                        className="authorAvatarImg"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="authorAvatarFallbackIcon">{initial}</div>
                    )}
                  </div>

                  <div className="authorMetaBox">
                    <div className="authorTopLine">
                      <b className="authorNameText">{authorName}</b>
                      {rev.verified_purchase && (
                        <span className="verifiedPurchasePill">✓ Xarid qilgan</span>
                      )}
                    </div>
                    <div className="authorSubLine">
                      <span className="reviewRatingStars">{renderStars(rev.rating)}</span>
                      {dateStr && <span className="reviewDateText">· {dateStr}</span>}
                    </div>
                  </div>
                </div>

                {/* Sharx lenta matni */}
                <div className="reviewStreamContent">
                  <p className="reviewCommentBody">{rev.comment}</p>

                  {Array.isArray(rev.photos) && rev.photos.length > 0 && (
                    <div className="reviewPhotosRow">
                      {rev.photos.map((pUrl, idx) => (
                        <img
                          key={idx}
                          src={pUrl}
                          alt="Mijoz yuklagan rasm"
                          className="reviewPhotoThumb"
                          loading="lazy"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLightboxImg(pUrl);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Qimirlamaydigan, Bir Joyda Turuvchi Sharh Yozish Bo'limi: [Mahsulot haqidagi fikringiz...] [📎 Galereya] [✔️ Yuborish] */}
      <div className="inlineReviewBoxContainer">
        <form onSubmit={handleSubmitReview} className="inlineReviewFormBar">
          {photos.length > 0 && (
            <div className="inlinePhotosPreviewRow">
              {photos.map((p, i) => (
                <div key={i} className="inlinePhotoThumbWrap">
                  <img src={p} alt="Yuklangan" />
                  <button
                    type="button"
                    className="inlineRemovePhotoBtn"
                    onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="inlineInputRow flexRow">
            {/* Foydalanuvchining haqiqiy profil rasmi avtomatik ko'rinishi */}
            <div className="inlineUserAvatarBox" title="Sizning profil rasmingiz">
              <img
                src={userAvatarUrl}
                alt="Profil"
                className="inlineAvatarImg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
                }}
              />
            </div>

            {/* Matn kiritish qatori */}
            <input
              type="text"
              className="inlineCommentInput"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Mahsulot haqidagi fikringiz..."
              required
            />

            {/* Baholash (Yulduzchalar) */}
            <div className="inlineStarsPicker" title="Baho berish">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`inlineStarBtn ${s <= rating ? "active" : ""}`}
                  onClick={() => setRating(s)}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Galereyadan rasm yuklash tugmasi (📎) */}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="fileInputHidden"
              id="inline-gallery-photo-upload"
            />
            <label
              htmlFor="inline-gallery-photo-upload"
              className="inlineAttachGalleryBtn"
              title="Qurilma galereyasidan rasm tanlash"
            >
              📎
            </label>

            {/* Yuborish tugmasi */}
            <button
              type="submit"
              className="inlineSubmitBtn"
              disabled={isSubmitting}
              title="Sharh yuborish"
            >
              {isSubmitting ? "..." : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "translateX(-1px) translateY(1px)" }}>
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Selected Review Detail Modal (Qoldirilgan sharh ustiga bosganda) */}
      {selectedReviewDetail && (
        <div className="modalBackdrop modalBackdropCenter" onClick={() => setSelectedReviewDetail(null)}>
          <div className="modalCard reviewDetailModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader reviewDetailModalHeader">
              <div className="reviewDetailUserHeader">
                <div className="detailAvatarBox">
                  <img
                    src={selectedReviewDetail.photo_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                    alt={selectedReviewDetail.first_name || "Mijoz"}
                    className="detailAvatarImg"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";
                    }}
                  />
                </div>
                <div>
                  <h3 className="detailUserName">
                    [{[selectedReviewDetail.first_name, selectedReviewDetail.last_name].filter(Boolean).join(" ") || selectedReviewDetail.username || "GULI mijozi"}]
                  </h3>
                  <div className="detailUserSubMeta">
                    {selectedReviewDetail.verified_purchase && (
                      <span className="verifiedPurchasePill">✓ Tasdiqlangan haridor</span>
                    )}
                    {selectedReviewDetail.created_at && (
                      <span className="detailDateText">
                        {new Date(selectedReviewDetail.created_at).toLocaleDateString("uz-UZ", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button className="closeModalBtn" onClick={() => setSelectedReviewDetail(null)}>
                ✕
              </button>
            </div>

            <div className="reviewDetailBody">
              <div className="detailRatingRow">
                <span className="detailStarsGlyph">{renderStars(selectedReviewDetail.rating)}</span>
                <span className="detailScoreBadge">{selectedReviewDetail.rating} / 5.0</span>
              </div>

              <div className="detailCommentCard">
                <p className="detailCommentText">{selectedReviewDetail.comment}</p>
              </div>

              {Array.isArray(selectedReviewDetail.photos) && selectedReviewDetail.photos.length > 0 && (
                <div className="detailPhotosGallery">
                  <h4>📷 Biriktirilgan suratlar ({selectedReviewDetail.photos.length}):</h4>
                  <div className="detailPhotosGrid">
                    {selectedReviewDetail.photos.map((pUrl, idx) => (
                      <img
                        key={idx}
                        src={pUrl}
                        alt="Sharh surati"
                        className="detailPhotoGridItem"
                        onClick={() => setActiveLightboxImg(pUrl)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="detailModalFooter">
                <button
                  type="button"
                  className="likeReviewBtn"
                  onClick={() => {
                    const revId = String(selectedReviewDetail.id);
                    setLikedReviews((prev) => ({
                      ...prev,
                      [revId]: (prev[revId] || 0) + 1,
                    }));
                    if (onShowToast) onShowToast("E'tiboringiz uchun rahmat! 👍");
                  }}
                >
                  👍 Foydali deb topildi ({12 + (likedReviews[String(selectedReviewDetail.id)] || 0)})
                </button>
                <button
                  type="button"
                  className="primaryButton closeDetailBtn"
                  onClick={() => setSelectedReviewDetail(null)}
                >
                  Yopish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Lightbox Modal */}
      {activeLightboxImg && (
        <div className="modalBackdrop lightboxBackdrop" onClick={() => setActiveLightboxImg(null)}>
          <div className="lightboxContent" onClick={(e) => e.stopPropagation()}>
            <button className="lightboxCloseBtn" onClick={() => setActiveLightboxImg(null)}>
              ✕
            </button>
            <img src={activeLightboxImg} alt="Katta rasm" className="lightboxMainImg" />
          </div>
        </div>
      )}
    </section>
  );
};
