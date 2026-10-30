import React, { useState, useEffect, useMemo } from "react";
import type { Product } from "../ProductImageGallery";
import type { ReelItem } from "../../types/reels";
import type { VideoAd } from "../../types/videoAd";
import { loadReelsFromStorage } from "../../data/demoReels";
import { getSocialLinks } from "../../utils/socialLinks";
import { GULI_LOGO_BASE64 } from "../../utils/guliLogoBase64";
import { copyToClipboard } from "../../utils/clipboard";
import { PromosModal, DeliveryTermsModal } from "../ProfileExtraModals";
import { FullscreenVideoAdModal } from "../videoAds/FullscreenVideoAdModal";
import { SocialPromoSection } from "../socialPromo/SocialPromoSection";
import "./GuliMarketProfile.css";

interface GuliMarketProfileProps {
  onBack: () => void;
  products: Product[];
  onOpenProduct: (product: Product) => void;
  onNavigateToCatalog: (category?: string) => void;
  onSelectReel: (reelId: string) => void;
  onOpenChat: () => void;
  onShowToast: (message: string) => void;
  initialTab?: "tovarlar" | "reels" | "reklamalar";
  isUserAuthenticated?: boolean;
  onOpenAuthModal?: () => void;
}

const FOLLOW_STORAGE_KEY = "guli_market_followed";

export const GuliMarketProfile: React.FC<GuliMarketProfileProps> = ({
  onBack,
  products,
  onOpenProduct,
  onNavigateToCatalog,
  onSelectReel,
  onOpenChat,
  onShowToast,
  initialTab = "tovarlar",
  isUserAuthenticated = false,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<"tovarlar" | "reels" | "reklamalar">(initialTab);
  const [reels, setReels] = useState<ReelItem[]>([]);
  const [videoAds, setVideoAds] = useState<VideoAd[]>([]);
  const [selectedAdForModal, setSelectedAdForModal] = useState<VideoAd | null>(null);

  // Registered users count for real subscriber stat
  const [registeredUsersCount, setRegisteredUsersCount] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("guli_registered_users_count");
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  // Fetch real registered users count from system
  useEffect(() => {
    fetch("/api/registered-users-count")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && typeof j.count === "number") {
          setRegisteredUsersCount(j.count);
          try {
            localStorage.setItem("guli_registered_users_count", String(j.count));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Filter within Tovarlar tab (e.g. from highlights)
  const [selectedHighlightCategory, setSelectedHighlightCategory] = useState<string>("Barchasi");
  const [visibleProductCount, setVisibleProductCount] = useState<number>(24);

  // Modals for highlights
  const [isPromosOpen, setIsPromosOpen] = useState(false);
  const [isDeliveryOpen, setIsDeliveryOpen] = useState(false);

  // Theme check
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return document.documentElement.getAttribute("data-theme") === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Follower system: Real user follow toggle + registered user count
  const [isFollowed, setIsFollowed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(FOLLOW_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const socialLinks = useMemo(() => getSocialLinks(), []);

  // Load active reels
  useEffect(() => {
    try {
      const all = loadReelsFromStorage();
      const active = all.filter((r) => r.status === "active");
      setReels(active);
    } catch (e) {
      console.warn("[GuliProfile] Error loading reels:", e);
    }
  }, []);

  // Load video ads from local cache or API
  useEffect(() => {
    try {
      const raw = localStorage.getItem("guli_video_ads");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setVideoAds(parsed.filter((ad) => ad && ad.is_active !== false));
        }
      }
    } catch {}

    // Also fetch fresh active video ads
    fetch("/api/video-ads?placement=all")
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) {
          setVideoAds(j.data.filter((ad: VideoAd) => ad && ad.is_active !== false));
        }
      })
      .catch(() => {});
  }, []);

  // Active products list
  const activeProducts = useMemo(() => {
    return products.filter((p) => p && p.active !== false);
  }, [products]);

  // Filtered products for Tovarlar tab
  const displayedProducts = useMemo(() => {
    if (selectedHighlightCategory === "Barchasi") {
      return activeProducts;
    }
    if (selectedHighlightCategory === "Yangi") {
      return activeProducts.filter((p) => p.featured || p.id % 2 === 0);
    }
    return activeProducts.filter((p) => {
      const cat = String(p.category || "").toLowerCase();
      const target = selectedHighlightCategory.toLowerCase();
      return cat.includes(target) || target.includes(cat);
    });
  }, [activeProducts, selectedHighlightCategory]);

  // Real follower count based on registered users count + user follow state
  const followersCount = useMemo(() => {
    const base = Math.max(0, registeredUsersCount);
    return isFollowed ? base + 1 : base;
  }, [registeredUsersCount, isFollowed]);

  const handleToggleFollow = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");
    } catch {}

    // Requirement: Unregistered users clicking red follow button triggers registration modal
    if (!isUserAuthenticated) {
      if (onOpenAuthModal) {
        onOpenAuthModal();
      } else if (typeof (window as any).openGuliCustomerAuthModal === "function") {
        (window as any).openGuliCustomerAuthModal("signup");
      }
      return;
    }

    const nextState = !isFollowed;
    setIsFollowed(nextState);
    try {
      localStorage.setItem(FOLLOW_STORAGE_KEY, String(nextState));
    } catch {}
    if (nextState) {
      onShowToast("Guli Market profiliga obuna bo‘ldingiz ✨");
    } else {
      onShowToast("Obuna bekor qilindi");
    }
  };

  const handleShareProfile = async () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
    const url = "https://gulii.uz/profile/guli-market";
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Guli Market — Ayollar kiyimlari do‘koni",
          text: "Guli Market rasmiy sahifasi va katalogi",
          url: url,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    copyToClipboard(url);
    onShowToast("Profil havolasi nusxalandi! 📋");
  };

  const formatCount = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
    if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
    return n.toLocaleString("uz-UZ");
  };

  return (
    <main className="brandProfileContainer" aria-label="Guli Market rasmiy profili">
      {/* 1. Sticky Instagram Top Bar */}
      <header className="brandProfileTopBar">
        <button
          type="button"
          className="brandProfileBackBtn"
          onClick={onBack}
          aria-label="Orqaga qaytish"
          title="Orqaga"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="brandProfileTitleRow">
          <span className="brandProfileHandle">guli_market</span>
          <span
            className="brandProfileVerifiedBadge"
            title="Tasdiqlangan rasmiy brend"
            aria-label="Tasdiqlangan brend"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.8-4.2-4.2 1.41-1.41 2.79 2.79 6.29-6.29 1.41 1.41-7.7 7.7z" />
            </svg>
          </span>
        </div>

        <button
          type="button"
          className="brandProfileShareBtn"
          onClick={handleShareProfile}
          aria-label="Profil havolasini ulashish"
          title="Ulashish"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </header>

      {/* 2. Profile Header & Bio */}
      <section className="brandProfileHeader">
        <div className="brandProfileTopRow">
          {/* Avatar with gradient Story Ring */}
          <div className="brandProfileAvatarWrap">
            <div className="brandProfileAvatarInner">
              <img
                src="/guli-logo.png"
                alt="Guli Market"
                className="brandProfileAvatarImg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = GULI_LOGO_BASE64 || "/icons/icon-192.png";
                }}
              />
            </div>
          </div>

          {/* 3 Real Instagram Stats */}
          <div className="brandProfileStats">
            <button
              type="button"
              className="brandProfileStatItem"
              onClick={() => {
                setActiveTab("tovarlar");
                setSelectedHighlightCategory("Barchasi");
              }}
            >
              <span className="brandProfileStatNumber">{activeProducts.length}</span>
              <span className="brandProfileStatLabel">Tovarlar</span>
            </button>

            <button
              type="button"
              className="brandProfileStatItem"
              onClick={handleToggleFollow}
            >
              <span className="brandProfileStatNumber">{formatCount(followersCount)}</span>
              <span className="brandProfileStatLabel">Obunachilar</span>
            </button>

            <div className="brandProfileStatItem">
              <span className="brandProfileStatNumber">1</span>
              <span className="brandProfileStatLabel">Kuzatmoqda</span>
            </div>
          </div>
        </div>

        {/* Bio & Details */}
        <div className="brandProfileBio">
          <div className="brandProfileDisplayName">
            Guli Market
            <span className="brandProfileVerifiedBadge" style={{ width: "15px", height: "15px" }}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.8-4.2-4.2 1.41-1.41 2.79 2.79 6.29-6.29 1.41 1.41-7.7 7.7z" />
              </svg>
            </span>
          </div>

          <div className="brandProfileCategoryTag">Ayollar kiyimlari va ichki kiyimlar brendi</div>

          <p className="brandProfileBioText">
            🌸 Nafis pijamalar, penyuarlar va sifatli ayollar ichki kiyimlari do‘koni.
            {"\n"}🚚 O‘zbekiston bo‘ylab tezkor va xavfsiz yetkazib berish.
            {"\n"}📍 Qo‘qon | Optom Mumtoz bozori
            {"\n"}🏪 3-blok • 1-qator • 1-joy • 27-do‘kon
          </p>

          <div className="brandProfileLinksList">
            <a
              href="https://gulii.uz"
              target="_blank"
              rel="noopener noreferrer"
              className="brandProfileLinkItem"
            >
              🌐 <span>gulii.uz</span>
            </a>

            {socialLinks.telegram && (
              <a
                href={socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="brandProfileLinkItem"
              >
                ✈️ <span>Telegram: @pijama3550</span>
              </a>
            )}

            {socialLinks.instagram && (
              <a
                href={socialLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="brandProfileLinkItem"
              >
                📸 <span>Instagram: @guli_3550_</span>
              </a>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="brandProfileActions">
          <button
            type="button"
            className={`brandProfileFollowBtn ${isUserAuthenticated && isFollowed ? "following" : ""}`}
            onClick={handleToggleFollow}
          >
            {isUserAuthenticated && isFollowed ? "✓ Obunadasiz" : "Obuna bo‘lish"}
          </button>

          <button
            type="button"
            className="brandProfileActionBtn"
            onClick={() => onNavigateToCatalog()}
          >
            🛍️ Do‘kon
          </button>

          <button
            type="button"
            className="brandProfileActionBtn"
            onClick={onOpenChat}
          >
            💬 Xabar
          </button>

          <button
            type="button"
            className="brandProfileActionBtn"
            style={{ flex: "0 0 42px", padding: 0 }}
            onClick={handleShareProfile}
            title="Ulashish"
            aria-label="Ulashish"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </section>

      {/* 3. Circular Ad Marquee (Instagram Highlights Region) */}
      <section className="brandProfileHighlights" aria-label="Dumaloq reklama lentasi">
        <SocialPromoSection variant="highlight" maxRows={1} isDark={isDark} />
      </section>

      {/* 4. Instagram Content Tabs */}
      <nav className="brandProfileTabsBar" aria-label="Kontent tablari">
        <button
          type="button"
          className={`brandProfileTabBtn ${activeTab === "tovarlar" ? "active" : ""}`}
          onClick={() => setActiveTab("tovarlar")}
          aria-label="Tovarlar"
        >
          <span className="brandProfileTabIcon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </span>
          <span>Tovarlar</span>
          <span className="brandProfileTabCount">{displayedProducts.length}</span>
        </button>

        <button
          type="button"
          className={`brandProfileTabBtn ${activeTab === "reels" ? "active" : ""}`}
          onClick={() => setActiveTab("reels")}
          aria-label="Reels"
        >
          <span className="brandProfileTabIcon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
          </span>
          <span>Reels</span>
          <span className="brandProfileTabCount">{reels.length}</span>
        </button>

        <button
          type="button"
          className={`brandProfileTabBtn ${activeTab === "reklamalar" ? "active" : ""}`}
          onClick={() => setActiveTab("reklamalar")}
          aria-label="Reklamalar"
        >
          <span className="brandProfileTabIcon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          </span>
          <span>Reklamalar</span>
          <span className="brandProfileTabCount">{videoAds.length}</span>
        </button>
      </nav>

      {/* 5. Tab Contents */}
      <div className="brandProfileGridWrap">
        {/* Tab 1: Tovarlar (3-column square grid) */}
        {activeTab === "tovarlar" && (
          <>
            {selectedHighlightCategory !== "Barchasi" && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 8px 10px" }}>
                <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--text-muted, #71717a)" }}>
                  Bo‘lim: <b>{selectedHighlightCategory}</b> ({displayedProducts.length})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedHighlightCategory("Barchasi")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e11d48",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Barchasini ko‘rish ✕
                </button>
              </div>
            )}

            {displayedProducts.length > 0 ? (
              <>
                <div className="brandProfileProductGrid">
                  {displayedProducts.slice(0, visibleProductCount).map((product) => {
                    const imgUrl = product.image || product.images?.[0] || "";
                    const priceFormatted = product.price
                      ? product.price.toLocaleString("uz-UZ") + " so‘m"
                      : "";

                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="brandProfileProductTile"
                        onClick={() => onOpenProduct(product)}
                        aria-label={product.name}
                      >
                        <img
                          src={imgUrl}
                          alt={product.name}
                          loading="lazy"
                          className="brandProfileProductImg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80";
                          }}
                        />
                        {priceFormatted && (
                          <span className="brandProfileProductBadge">{priceFormatted}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {visibleProductCount < displayedProducts.length && (
                  <div className="brandProfileLoadMoreWrap">
                    <button
                      type="button"
                      className="brandProfileLoadMoreBtn"
                      onClick={() => setVisibleProductCount((prev) => prev + 24)}
                    >
                      Ko‘proq yuklash ({displayedProducts.length - visibleProductCount})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="brandProfileEmptyState">
                <div className="brandProfileEmptyIcon">🛍️</div>
                <h3 className="brandProfileEmptyTitle">Mahsulotlar topilmadi</h3>
                <p className="brandProfileEmptyDesc">
                  Ushbu toifada hozircha tovarlar mavjud emas. Boshqa toifalarni ko‘ring.
                </p>
              </div>
            )}
          </>
        )}

        {/* Tab 2: Reels (3-column vertical 9:16 grid) */}
        {activeTab === "reels" && (
          <>
            {reels.length > 0 ? (
              <div className="brandProfileReelsGrid">
                {reels.map((reel) => {
                  const viewsFormatted = reel.viewsCount ? formatCount(reel.viewsCount) : "1.2k";

                  return (
                    <button
                      key={reel.id}
                      type="button"
                      className="brandProfileReelTile"
                      onClick={() => onSelectReel(reel.id)}
                      aria-label={reel.caption || "Guli Market Reels videosi"}
                    >
                      <img
                        src={reel.posterUrl}
                        alt={reel.caption}
                        loading="lazy"
                        className="brandProfileReelPoster"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                      <div className="brandProfileReelOverlay">
                        <div className="brandProfileReelTopIcon">
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
                          </svg>
                        </div>
                        <span className="brandProfileReelViews">
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          {viewsFormatted}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="brandProfileEmptyState">
                <div className="brandProfileEmptyIcon">🎬</div>
                <h3 className="brandProfileEmptyTitle">Reels roliklari yo‘q</h3>
                <p className="brandProfileEmptyDesc">
                  Hozircha faol Reels roliklari mavjud emas. Tez orada yangi videolar qo‘shiladi.
                </p>
              </div>
            )}
          </>
        )}

        {/* Tab 3: Reklamalar (3-column vertical grid) */}
        {activeTab === "reklamalar" && (
          <>
            {videoAds.length > 0 ? (
              <div className="brandProfileReelsGrid">
                {videoAds.map((ad) => {
                  const poster = ad.poster_url || "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80";

                  return (
                    <button
                      key={ad.id}
                      type="button"
                      className="brandProfileAdTile"
                      onClick={() => setSelectedAdForModal(ad)}
                      aria-label={ad.title || "Reklama videosi"}
                    >
                      <img
                        src={poster}
                        alt={ad.title}
                        loading="lazy"
                        className="brandProfileAdPoster"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                      <span className="brandProfileAdBadge">Reklama</span>
                      <div className="brandProfileAdCaption">{ad.title || "Guli Market"}</div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="brandProfileEmptyState">
                <div className="brandProfileEmptyIcon">📢</div>
                <h3 className="brandProfileEmptyTitle">Faol reklamalar yo‘q</h3>
                <p className="brandProfileEmptyDesc">
                  Hozircha maxsus reklama roliklari mavjud emas. Tovarlar va Reels bo‘limlarini ko‘ring.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Promos Modal from Highlights */}
      {isPromosOpen && (
        <PromosModal
          language="uz"
          onClose={() => setIsPromosOpen(false)}
          onApplyPromo={(code) => {
            setIsPromosOpen(false);
            onShowToast(`✓ Promo kod: ${code}`);
          }}
          onShowToast={onShowToast}
        />
      )}

      {/* Delivery Terms Modal from Highlights */}
      {isDeliveryOpen && (
        <DeliveryTermsModal
          language="uz"
          onClose={() => setIsDeliveryOpen(false)}
        />
      )}

      {/* Fullscreen Video Ad Modal */}
      {selectedAdForModal && (
        <FullscreenVideoAdModal
          isOpen={Boolean(selectedAdForModal)}
          ad={selectedAdForModal}
          ads={videoAds}
          onClose={() => setSelectedAdForModal(null)}
          onOpenProduct={(prodId) => {
            setSelectedAdForModal(null);
            const target = products.find((p) => String(p.id) === String(prodId));
            if (target) onOpenProduct(target);
          }}
        />
      )}
    </main>
  );
};
