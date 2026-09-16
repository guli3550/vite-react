import React, { useState, useEffect } from "react";
import type { Order } from "../App";
import type { Language } from "../utils/translations";
import type { Currency } from "../utils/currency";
import type { AuthUser } from "./CustomerAuthModal";

// Background images for guest promo cards
import goldCoinsCashbackImg from "../assets/images/gold_coins_cashback_1789530473466.jpg";
import onlineChatBgImg from "../assets/images/online_chat_bg_1789530489414.jpg";
import operatorCallBgImg from "../assets/images/operator_call_bg_1789530502870.jpg";
import lionVipBgImg from "../assets/images/lion_vip_bg_1789530516581.jpg";

export const TelegramLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 240 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="120" cy="120" r="120" fill="url(#tg_logo_icon_grad)" />
    <path
      d="M183.9 61.2L35.6 118.4C25.4 122.5 25.5 128.2 33.8 130.8L71.9 142.7L160.1 87C164.3 84.4 168.1 85.9 164.9 88.7L93.5 153.2L90.7 195.4C94.8 195.4 96.6 193.5 98.9 191.3L120.5 170.3L165.4 203.4C173.7 208 179.6 205.6 181.7 195.7L211.1 57.5C214.1 45.4 206.5 40 183.9 61.2Z"
      fill="white"
    />
    <defs>
      <linearGradient id="tg_logo_icon_grad" x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2AABEE" />
        <stop offset="1" stopColor="#229ED9" />
      </linearGradient>
    </defs>
  </svg>
);

export const CashbackLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#cashback_badge_grad)" stroke="#FDE68A" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="8" stroke="rgba(255,255,255,0.45)" strokeWidth="0.8" strokeDasharray="2 1.5" />
    <path
      d="M9 9.5a1.5 1.5 0 1 1 3 0c0 1.5-3 1.8-3 3.5h3.5M12 17v-1M15.5 8.5l-7 7"
      stroke="#FFFFFF"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <defs>
      <linearGradient id="cashback_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F59E0B" />
        <stop offset="1" stopColor="#D97706" />
      </linearGradient>
    </defs>
  </svg>
);

export const LiveChatLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#livechat_badge_grad)" stroke="#BAE6FD" strokeWidth="1.2" />
    <path
      d="M7.5 14.5L6 17.5l3.2-1c.9.3 1.8.5 2.8.5 4 0 7-2.6 7-6s-3-6-7-6-7 2.6-7 6c0 1.5.6 2.9 1.5 4v0z"
      fill="#FFFFFF"
    />
    <circle cx="9.5" cy="10.5" r="1" fill="#0284C7" />
    <circle cx="12" cy="10.5" r="1" fill="#0284C7" />
    <circle cx="14.5" cy="10.5" r="1" fill="#0284C7" />
    <defs>
      <linearGradient id="livechat_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#38BDF8" />
        <stop offset="1" stopColor="#0284C7" />
      </linearGradient>
    </defs>
  </svg>
);

export const CallCenterLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#callcenter_badge_grad)" stroke="#A7F3D0" strokeWidth="1.2" />
    <path
      d="M7 13.5v-2a5 5 0 0 1 10 0v2"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <rect x="5.5" y="12" width="3" height="4.5" rx="1.5" fill="#FFFFFF" />
    <rect x="15.5" y="12" width="3" height="4.5" rx="1.5" fill="#FFFFFF" />
    <path
      d="M17 14.5v1.2a2 2 0 0 1-2 2h-2.5"
      stroke="#FFFFFF"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="17.7" r="1" fill="#FFFFFF" />
    <defs>
      <linearGradient id="callcenter_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
  </svg>
);

export const VipCrownLogoIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
  >
    <circle cx="12" cy="12" r="10" fill="url(#vipcrown_badge_grad)" stroke="#E9D5FF" strokeWidth="1.2" />
    <path
      d="M6 16.5h12l-1.5-6.5-3 3.5-1.5-5-1.5 5-3-3.5L6 16.5z"
      fill="#FEF08A"
      stroke="#F59E0B"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="8" r="0.9" fill="#FFFFFF" />
    <circle cx="7.5" cy="9.5" r="0.8" fill="#FFFFFF" />
    <circle cx="16.5" cy="9.5" r="0.8" fill="#FFFFFF" />
    <rect x="7" y="15" width="10" height="1.2" rx="0.6" fill="#F59E0B" />
    <defs>
      <linearGradient id="vipcrown_badge_grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#A855F7" />
        <stop offset="1" stopColor="#7E22CE" />
      </linearGradient>
    </defs>
  </svg>
);

interface ModernProfileViewProps {
  authUser: AuthUser | null;
  telegramUser?: any;
  userAvatar?: string;
  orders: Order[];
  wishlistCount: number;
  unreadChatCount: number;
  language: Language;
  currency: Currency;
  theme: "light" | "dark";
  onNavigate: (page: any) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenSocial: () => void;
  onOpenPromos: () => void;
  onOpenDeliveryTerms: () => void;
  onOpenSizeGuide: () => void;
  onOpenAboutBrand: () => void;
  onExportPdf: () => void;
  onShare: () => void;
  onClearCache: () => void;
  onLogout: () => void;
  onUpdateProfile: (updated: Partial<AuthUser>) => void;
  onSelectOrderFilter?: (filter: "all" | "recent" | "in_progress" | "completed" | "cancelled") => void;
  onOpenAuth?: (tab?: "signin" | "signup") => void;
  t: (key: any) => string;
}

export const ModernProfileView: React.FC<ModernProfileViewProps> = ({
  authUser,
  telegramUser,
  userAvatar: customAvatar,
  orders,
  wishlistCount,
  unreadChatCount,
  language,
  currency,
  theme,
  onNavigate,
  onOpenSettings,
  onOpenHelp,
  onOpenSocial,
  onOpenPromos,
  onOpenDeliveryTerms,
  onOpenSizeGuide,
  onOpenAboutBrand,
  onExportPdf,
  onShare,
  onClearCache,
  onLogout,
  onUpdateProfile,
  onSelectOrderFilter,
  onOpenAuth,
  t,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Automatic Day / Night Theme synchronizer (syncs with prop, document data-theme, and theme change events)
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const domTheme = document.documentElement.getAttribute("data-theme");
      if (domTheme === "dark" || domTheme === "light") return domTheme;
    }
    return theme || "light";
  });

  useEffect(() => {
    if (theme === "dark" || theme === "light") {
      setActiveTheme(theme);
    }
  }, [theme]);

  useEffect(() => {
    const handleThemeChange = (e: any) => {
      const mode = e?.detail || (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")) || "light";
      if (mode === "dark" || mode === "light") {
        setActiveTheme(mode);
      }
    };
    window.addEventListener("guli_theme_changed", handleThemeChange);

    let observer: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      observer = new MutationObserver(() => {
        const domTheme = document.documentElement.getAttribute("data-theme");
        if (domTheme === "dark" || domTheme === "light") {
          setActiveTheme(domTheme);
        }
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }

    return () => {
      window.removeEventListener("guli_theme_changed", handleThemeChange);
      if (observer) observer.disconnect();
    };
  }, []);

  const isDark = activeTheme === "dark";

  const isAuthenticated = Boolean(authUser?.id || telegramUser?.id);
  const userKey = authUser?.id || (telegramUser?.id ? `tg_${telegramUser.id}` : "");

  // Clean up legacy global avatar keys so they do not leak across accounts
  try {
    localStorage.removeItem("guli_custom_avatar");
    localStorage.removeItem("guli_avatar_url");
    localStorage.removeItem("guli_customer_photo");
  } catch {}

  const savedUserAvatar = userKey ? localStorage.getItem(`guli_avatar_${userKey}`) : "";
  const initialAvatar = authUser?.avatar_url || savedUserAvatar || customAvatar || telegramUser?.photo_url || "";
  const [currentAvatar, setCurrentAvatar] = useState(initialAvatar);
  const [editAvatar, setEditAvatar] = useState(initialAvatar);

  // Edit fields scoped to authenticated user
  const [editName, setEditName] = useState(
    authUser?.full_name || telegramUser?.first_name || (userKey ? localStorage.getItem(`guli_name_${userKey}`) || "" : "")
  );
  const [editPhone, setEditPhone] = useState(
    authUser?.phone || (userKey ? localStorage.getItem(`guli_phone_${userKey}`) || "" : "")
  );
  const [editBirthDate, setEditBirthDate] = useState(
    userKey ? localStorage.getItem(`guli_dob_${userKey}`) || "" : ""
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Derive display values
  const displayName = authUser?.full_name || 
    [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || 
    (userKey ? localStorage.getItem(`guli_name_${userKey}`) : "") || 
    "Mijoz";

  // NOTE: email auth has been removed from GULI. There is no real email
  // address anywhere in this flow. `telegramUsername` below is the ONLY
  // "handle" we display, and it is rendered as an @username - never
  // disguised as an email address with an envelope icon (that was the
  // previous bug: the Telegram username was being shown as a fake email).
  const telegramUsername =
    (authUser?.telegram_username || telegramUser?.username || "").toString().trim().replace(/^@+/, "") || null;
  const userPhone = authUser?.phone || (userKey ? localStorage.getItem(`guli_phone_${userKey}`) : "") || "+998 -- --- -- --";
  const userAvatar = currentAvatar || authUser?.avatar_url || customAvatar || telegramUser?.photo_url || "";

  // Price formatter helper
  const formatPrice = (val: number) => `${Number(val || 0).toLocaleString("uz-UZ")} so'm`;

  // Real verified orders calculation (no fake numbers)
  const pendingOrders = orders.filter((o) => o.status !== "Yetkazildi" && o.status !== "Bekor qilindi");
  const completedOrders = orders.filter(
    (o) =>
      o.status === "Yetkazildi" ||
      o.status === "Qabul qilindi" ||
      o.status === "To'lov tasdiqlandi" ||
      o.status === "Yo‘lda" ||
      o.status === "Tayyorlanmoqda"
  );

  // Real total money spent
  const realTotalSpent = completedOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  // Real 2% Cashback strictly calculated
  const REAL_CASHBACK_PERCENT = 0.02; // exactly 2%
  const realCashbackEarned = Math.round(realTotalSpent * REAL_CASHBACK_PERCENT);
  const usedCashback = orders.reduce((sum, o) => sum + (Number((o as any).cashback_used) || 0), 0);
  const cashbackBalance = Math.max(0, realCashbackEarned - usedCashback);

  // Real VIP threshold: 2,000,000 UZS
  const VIP_THRESHOLD = 2000000;
  const isVip = realTotalSpent >= VIP_THRESHOLD;
  const vipProgressPercent = Math.min(100, Math.round((realTotalSpent / VIP_THRESHOLD) * 100));
  const remainingForVip = Math.max(0, VIP_THRESHOLD - realTotalSpent);

  // Real active admin promos count
  const [activePromosCount, setActivePromosCount] = useState<number | null>(null);
  useEffect(() => {
    let isMounted = true;
    fetch("/api/promos")
      .then((r) => r.json())
      .then((d) => {
        if (isMounted && d.success && Array.isArray(d.data)) {
          const activeList = d.data.filter((p: any) => p.status === "active");
          setActivePromosCount(activeList.length);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      if (userKey) {
        localStorage.setItem(`guli_name_${userKey}`, editName);
        localStorage.setItem(`guli_phone_${userKey}`, editPhone);
        localStorage.setItem(`guli_dob_${userKey}`, editBirthDate);
        if (editAvatar) {
          localStorage.setItem(`guli_avatar_${userKey}`, editAvatar);
        } else {
          localStorage.removeItem(`guli_avatar_${userKey}`);
        }
      }

      // Dispatch real-time avatar event
      window.dispatchEvent(new CustomEvent("guli_avatar_updated", { detail: { avatar: editAvatar } }));
      setCurrentAvatar(editAvatar);

      // Call backend update if session token exists
      const token = localStorage.getItem("guli_access_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const tgData = (window as any).Telegram?.WebApp?.initData;
      if (tgData) headers["X-Telegram-Init-Data"] = tgData;

      await fetch("/api/customer/profile", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          full_name: editName,
          phone: editPhone,
          avatar_url: editAvatar || null,
        }),
      }).catch(() => null);

      onUpdateProfile({
        full_name: editName,
        phone: editPhone,
        avatar_url: editAvatar,
      });

      setIsEditModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Rasm hajmi 5MB dan oshmasligi kerak");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize to 320x320 max for optimal storage and rendering
        const canvas = document.createElement("canvas");
        const maxDim = 320;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setEditAvatar(compressed);
        } else {
          setEditAvatar(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <main className="page modernProfilePage" style={{ paddingBottom: "110px", maxWidth: "680px", margin: "0 auto" }}>
      {!isAuthenticated ? (
        /* Bright, Radiant, Beautiful Guest Card */
        <section
          style={{
            background: isDark
              ? "linear-gradient(135deg, #1f0b18 0%, #430c22 40%, #1e1b4b 100%)"
              : "linear-gradient(135deg, #9d174d 0%, #be123c 35%, #e11d48 70%, #fb7185 100%)",
            borderRadius: "28px",
            padding: "32px 20px",
            color: "#ffffff",
            boxShadow: isDark
              ? "0 18px 40px -10px rgba(0, 0, 0, 0.75), 0 0 24px rgba(225, 29, 72, 0.25)"
              : "0 18px 40px -10px rgba(225, 29, 72, 0.45), 0 0 24px rgba(251, 113, 133, 0.35)",
            position: "relative",
            overflow: "hidden",
            marginBottom: "22px",
            textAlign: "center",
            border: isDark ? "1.5px solid rgba(255, 255, 255, 0.18)" : "1.5px solid rgba(255, 255, 255, 0.3)",
          }}
        >
          {/* Ambient luminous spots */}
          <div
            style={{
              position: "absolute",
              top: "-50px",
              right: "-50px",
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-40px",
              left: "-40px",
              width: "140px",
              height: "140px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(253, 164, 175, 0.3) 0%, rgba(253, 164, 175, 0) 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Official Web App Logo in glowing circular rim */}
          <div
            style={{
              width: "68px",
              height: "68px",
              minWidth: "68px",
              minHeight: "68px",
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              overflow: "hidden",
              margin: "0 auto 16px auto",
              boxShadow: "0 10px 26px rgba(0, 0, 0, 0.22)",
              border: "3px solid #ffffff",
              backgroundColor: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/guli_logo.jpg"
              alt="GULI Logo"
              style={{
                width: "100%",
                height: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "0 0 8px 0", textShadow: "0 2px 8px rgba(0,0,0,0.2)" }}>
            GULI Shaxsiy hisobingizga xush kelibsiz!
          </h2>
          <p style={{ fontSize: "13.5px", color: "rgba(255, 255, 255, 0.94)", margin: "0 auto 20px auto", lineHeight: 1.55, maxWidth: "480px" }}>
            Har bir xaridingizdan <b>2% real keshbek</b>, 24/7 shaxsiy <b>Online Chat</b>, to‘lov cheklari nazorati va VIP imtiyozlardan foydalanish uchun hisobingizga kiring:
          </p>

          {/* Key Advantages & Services Ads Showcase with Real Photographic Backgrounds & Crisp Vector Logos */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "10px",
              marginBottom: "22px",
              textAlign: "left",
            }}
          >
            {/* Card 1: 2% Real Keshbek (Real Oltin tangalar rasmi) */}
            <div
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "12px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
              }}
            >
              <img
                src={goldCoinsCashbackImg}
                alt="Oltin tangalar keshbek"
                referrerPolicy="no-referrer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <CashbackLogoIcon size={22} />
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: isDark ? "#fef08a" : "#ffffff",
                    backgroundColor: isDark ? "rgba(245, 158, 11, 0.4)" : "rgba(217, 119, 6, 0.85)",
                    padding: "2px 7px",
                    borderRadius: "6px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  Bonus
                </span>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  2% Real Keshbek
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  Har bir xariddan avtomatik
                </div>
              </div>
            </div>

            {/* Card 2: 24/7 Shaxsiy Online Chat (Real Online Chat rasmi) */}
            <div
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "12px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
              }}
            >
              <img
                src={onlineChatBgImg}
                alt="Online Chat interfeysi"
                referrerPolicy="no-referrer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <LiveChatLogoIcon size={22} />
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: isDark ? "#7dd3fc" : "#ffffff",
                    backgroundColor: isDark ? "rgba(14, 165, 233, 0.4)" : "rgba(2, 132, 199, 0.85)",
                    padding: "2px 7px",
                    borderRadius: "6px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  24/7 Live
                </span>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  24/7 Online Chat
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  Ro‘yxatdan o‘tgan a'zolar uchun
                </div>
              </div>
            </div>

            {/* Card 3: Call-Center (Real Operator Qiz rasmi) */}
            <div
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "12px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
              }}
            >
              <img
                src={operatorCallBgImg}
                alt="Operator Call Center"
                referrerPolicy="no-referrer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <CallCenterLogoIcon size={22} />
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: isDark ? "#86efac" : "#ffffff",
                    backgroundColor: isDark ? "rgba(16, 185, 129, 0.4)" : "rgba(5, 150, 105, 0.85)",
                    padding: "2px 7px",
                    borderRadius: "6px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  Operator
                </span>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  Call-Center
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  Tezkor shaxsiy konsultatsiya
                </div>
              </div>
            </div>

            {/* Card 4: VIP Mijoz (Toj kiygan multik sher rasmi) */}
            <div
              style={{
                position: "relative",
                borderRadius: "18px",
                overflow: "hidden",
                padding: "12px 14px",
                minHeight: "105px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                border: isDark ? "1px solid rgba(255, 255, 255, 0.25)" : "1.5px solid rgba(255, 255, 255, 0.85)",
                boxShadow: isDark ? "0 8px 20px rgba(0, 0, 0, 0.5)" : "0 8px 24px rgba(0, 0, 0, 0.16)",
              }}
            >
              <img
                src={lionVipBgImg}
                alt="VIP Mijoz Toj kiygan sher"
                referrerPolicy="no-referrer"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.05)",
                  filter: isDark ? "brightness(0.85) contrast(1.05)" : "brightness(1.08) saturate(1.15) contrast(1.02)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: isDark
                    ? "linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.88) 100%)"
                    : "linear-gradient(180deg, rgba(0, 0, 0, 0.05) 0%, rgba(15, 23, 42, 0.58) 100%)",
                }}
              />
              <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    backgroundColor: isDark ? "rgba(15, 23, 42, 0.65)" : "rgba(255, 255, 255, 0.85)",
                    backdropFilter: "blur(6px)",
                    WebkitBackdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <VipCrownLogoIcon size={22} />
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: isDark ? "#d8b4fe" : "#ffffff",
                    backgroundColor: isDark ? "rgba(168, 85, 247, 0.4)" : "rgba(147, 51, 234, 0.85)",
                    padding: "2px 7px",
                    borderRadius: "6px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                  }}
                >
                  VIP
                </span>
              </div>
              <div style={{ position: "relative", zIndex: 1, marginTop: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.2px", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                  VIP Mijoz
                </div>
                <div style={{ fontSize: "10.5px", color: "rgba(255, 255, 255, 0.95)", marginTop: "2px", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                  2 000 000 so‘mda maxsus chegirmalar
                </div>
              </div>
            </div>
          </div>

          {/* Telegram Login Button (Tun va Kun rejimiga moslangan) */}
          <button
            onClick={() => onOpenAuth?.("signin")}
            id="guest-telegram-login-btn"
            style={{
              backgroundColor: isDark ? "#0f172a" : "#ffffff",
              color: isDark ? "#38bdf8" : "#0284c7",
              border: isDark ? "1.5px solid rgba(56, 189, 248, 0.45)" : "1px solid rgba(255, 255, 255, 0.85)",
              borderRadius: "16px",
              padding: "14px 24px",
              fontSize: "15px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: isDark
                ? "0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(42, 171, 238, 0.3)"
                : "0 8px 24px rgba(0, 0, 0, 0.22)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              transition: "transform 0.15s ease, box-shadow 0.15s ease, background-color 0.2s ease",
              width: "100%",
            }}
          >
            <TelegramLogoIcon size={24} />
            <span style={{ color: isDark ? "#f8fafc" : "#0284c7" }}>Telegram orqali kirish</span>
          </button>
        </section>
      ) : (
        <>
          {/* Customer Profile Card (Standard vs Glowing VIP Card) */}
          {isVip ? (
            /* VIBRANT & BRIGHT LUXURY VIP CARD (Spent >= 2,000,000 UZS) */
            <section
              className="vipGlowingCard"
              style={{
                background: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 28%, #f43f5e 72%, #be123c 100%)",
                borderRadius: "28px",
                padding: "26px 22px",
                color: "#ffffff",
                border: "2px solid #fef08a",
                boxShadow: "0 18px 45px -8px rgba(245, 158, 11, 0.48), 0 0 30px rgba(251, 191, 36, 0.35)",
                position: "relative",
                overflow: "hidden",
                marginBottom: "20px",
              }}
            >
              {/* Shimmering radiant light reflections */}
              <div
                style={{
                  position: "absolute",
                  top: "-50px",
                  right: "-50px",
                  width: "200px",
                  height: "200px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: "-60px",
                  left: "-40px",
                  width: "180px",
                  height: "180px",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(254, 240, 138, 0.35) 0%, rgba(254, 240, 138, 0) 70%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", position: "relative", zIndex: 2, paddingRight: "80px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      background: "#ffffff",
                      color: "#b45309",
                      padding: "6px 14px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 900,
                      letterSpacing: "0.6px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    👑 OLTIN VIP MAQOMI
                  </span>
                  <span
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.25)",
                      border: "1px solid rgba(255, 255, 255, 0.45)",
                      color: "#ffffff",
                      padding: "4px 10px",
                      borderRadius: "18px",
                      fontSize: "11px",
                      fontWeight: 800,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    ✨ 2 000 000+ so'm
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditName(displayName);
                    setEditPhone(userPhone === "+998 -- --- -- --" ? "" : userPhone);
                    setIsEditModalOpen(true);
                  }}
                  aria-label="Profilni tahrirlash"
                  title="Profilni tahrirlash"
                  style={{
                    position: "absolute",
                    top: "-6px",
                    right: "-2px",
                    backgroundColor: "rgba(255, 255, 255, 0.32)",
                    border: "1px solid rgba(255, 255, 255, 0.6)",
                    color: "#ffffff",
                    padding: "5px 11px",
                    borderRadius: "14px",
                    fontSize: "11.5px",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>✏️</span>
                  <span>Tahrirlash</span>
                </button>
              </div>

              {/* VIP Member Info Row */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    position: "relative",
                    width: "74px",
                    height: "74px",
                    minWidth: "74px",
                    minHeight: "74px",
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    padding: "3px",
                    background: "#ffffff",
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
                    flexShrink: 0,
                  }}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={displayName}
                      style={{
                        width: "100%",
                        height: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "#f59e0b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "28px",
                        fontWeight: 900,
                      }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "-2px",
                      right: "-2px",
                      width: "24px",
                      height: "24px",
                      backgroundColor: "#fbbf24",
                      color: "#78350f",
                      fontSize: "12px",
                      fontWeight: 900,
                      border: "2px solid #ffffff",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    }}
                    title="VIP a'zo"
                  >
                    ★
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1
                    style={{
                      fontSize: "22px",
                      fontWeight: 900,
                      margin: "0 0 4px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: "#ffffff",
                      textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                    }}
                  >
                    {displayName}
                  </h1>
                  {telegramUsername && (
                    <p style={{ fontSize: "13px", margin: "0 0 2px", opacity: 0.95, color: "#fffbeb", fontWeight: 600 }}>
                      @{telegramUsername}
                    </p>
                  )}
                  <p style={{ fontSize: "12px", margin: 0, opacity: 0.95, color: "#fef3c7", fontWeight: 600 }}>
                    📞 {userPhone}
                  </p>
                </div>
              </div>

              {/* VIP Extra Privileges Grid (Qo'shimcha Imkoniyatlar) */}
              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "16px",
                  borderTop: "1px solid rgba(255, 255, 255, 0.3)",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 900, color: "#ffffff", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px", textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
                  <span>👑 VIP A'ZONING MAXSUS IMTIYOZLARI:</span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "11.5px",
                    color: "#ffffff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>🚀</span> Bepul Ekspress Yetkazish
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>💎</span> Shaxsiy VIP Menejer
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>⚡</span> Navbatsiz Birinchi Yig'ish
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(255, 255, 255, 0.22)", padding: "8px 10px", borderRadius: "12px", fontWeight: 700, backdropFilter: "blur(4px)" }}>
                    <span>🎁</span> Yopiq VIP Aksiyalar
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", fontSize: "12.5px", color: "#ffffff", backgroundColor: "rgba(0, 0, 0, 0.16)", padding: "8px 12px", borderRadius: "12px" }}>
                  <span>Tasdiqlangan xaridlar: <b>{formatPrice(realTotalSpent)}</b></span>
                  <span>Keshbek: <b style={{ color: "#fef08a", fontSize: "13px" }}>{formatPrice(cashbackBalance)}</b></span>
                </div>
              </div>
            </section>
          ) : (
            /* STANDARD NON-VIP CUSTOMER CARD (Full-bleed 16:9 Day & Night Background with zero dividing lines) */
            <section
              style={{
                borderRadius: "26px",
                padding: "22px 18px",
                color: isDark ? "#ffffff" : "#1c1917",
                boxShadow: isDark
                  ? "0 18px 40px -10px rgba(0, 0, 0, 0.75), 0 2px 12px rgba(0, 0, 0, 0.5)"
                  : "0 14px 34px -8px rgba(225, 29, 72, 0.18), 0 2px 10px rgba(0, 0, 0, 0.04)",
                position: "relative",
                overflow: "hidden",
                marginBottom: "18px",
                border: isDark
                  ? "1.5px solid rgba(255, 255, 255, 0.18)"
                  : "1.5px solid rgba(244, 114, 182, 0.45)",
                backgroundColor: isDark ? "#12030a" : "#fff1f2",
                transition: "border-color 0.4s ease, box-shadow 0.4s ease",
              }}
            >
              {/* Full-bleed 16:9 Persistent CSS Background Layers (No loading flicker, instant offline & tab switch) */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  overflow: "hidden",
                  zIndex: 1,
                  background: isDark
                    ? "linear-gradient(135deg, #1c0512 0%, #0c0207 100%)"
                    : "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%)",
                }}
              >
                {/* Night Mode Background Layer */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4338ca 100%)",
                    opacity: isDark ? 1 : 0,
                    transition: "opacity 0.35s ease-in-out",
                  }}
                />

                {/* Day Mode Background Layer */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fecdd3 100%)",
                    opacity: isDark ? 0 : 1,
                    transition: "opacity 0.35s ease-in-out",
                  }}
                />

                {/* Subtle uniform scrim for text contrast - completely uniform, NO dividing line */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: isDark
                      ? "linear-gradient(180deg, rgba(12, 2, 7, 0.18) 0%, rgba(12, 2, 7, 0.38) 100%)"
                      : "linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.3) 100%)",
                    transition: "background 0.35s ease",
                  }}
                />
              </div>

              {/* Header Badge & Corner Edit Button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", position: "relative", zIndex: 2, paddingRight: "80px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      backgroundColor: isDark ? "rgba(20, 4, 12, 0.76)" : "rgba(255, 255, 255, 0.88)",
                      border: isDark ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(225, 29, 72, 0.28)",
                      color: isDark ? "#ffffff" : "#9f1239",
                      padding: "5px 12px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(159, 18, 57, 0.12)",
                      transition: "all 0.3s ease",
                    }}
                  >
                    🌸 GULI PREMIUM MIJOZ
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditName(displayName);
                    setEditPhone(userPhone === "+998 -- --- -- --" ? "" : userPhone);
                    setIsEditModalOpen(true);
                  }}
                  aria-label="Profilni tahrirlash"
                  title="Profilni tahrirlash"
                  style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-2px",
                    backgroundColor: isDark ? "rgba(20, 4, 12, 0.78)" : "rgba(255, 255, 255, 0.92)",
                    border: isDark ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(225, 29, 72, 0.28)",
                    color: isDark ? "#ffffff" : "#9f1239",
                    padding: "5px 11px",
                    borderRadius: "14px",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    boxShadow: isDark ? "0 2px 8px rgba(0,0,0,0.5)" : "0 2px 8px rgba(159, 18, 57, 0.12)",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "12px" }}>✏️</span>
                  <span>Tahrirlash</span>
                </button>
              </div>

              {/* Standard Member Info Row */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", position: "relative", zIndex: 2 }}>
                <div
                  style={{
                    position: "relative",
                    width: "66px",
                    height: "66px",
                    minWidth: "66px",
                    minHeight: "66px",
                    aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    padding: "3px",
                    background: "linear-gradient(135deg, #f472b6, #fb7185)",
                    flexShrink: 0,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                  }}
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={displayName}
                      style={{
                        width: "100%",
                        height: "100%",
                        aspectRatio: "1 / 1",
                        objectFit: "cover",
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "#831843",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "24px",
                        fontWeight: 800,
                      }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span
                    style={{
                      position: "absolute",
                      bottom: "0",
                      right: "0",
                      width: "18px",
                      height: "18px",
                      backgroundColor: "#10b981",
                      border: "2px solid #500724",
                      borderRadius: "50%",
                    }}
                    title="Faol a'zo"
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1
                    style={{
                      fontSize: "21px",
                      fontWeight: 800,
                      margin: "0 0 4px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: isDark ? "#ffffff" : "#831843",
                      textShadow: isDark ? "0 2px 8px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)" : "0 1px 4px rgba(255,255,255,0.9)",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {displayName}
                  </h1>
                  {telegramUsername && (
                    <p style={{ fontSize: "13px", margin: "0 0 3px", opacity: 0.95, color: isDark ? "#fce7f3" : "#9f1239", fontWeight: 700, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.8)" : "0 1px 3px rgba(255,255,255,0.85)", transition: "color 0.3s ease" }}>
                      @{telegramUsername}
                    </p>
                  )}
                  <p style={{ fontSize: "12.5px", margin: 0, opacity: 0.95, color: isDark ? "#fbcfe8" : "#9f1239", fontWeight: 600, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.8)" : "0 1px 3px rgba(255,255,255,0.85)", transition: "color 0.3s ease" }}>
                    📞 {userPhone}
                  </p>
                </div>
              </div>

              {/* Real VIP Progression: 2,000,000 UZS target (clean background-free layout per user request) */}
              <div
                style={{
                  marginTop: "16px",
                  padding: "0",
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px", color: isDark ? "#ffffff" : "#831843", fontWeight: 700, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.95)" : "0 1px 3px rgba(255,255,255,0.9)", transition: "color 0.3s ease" }}>
                  <span>
                    VIP Maqomi: <b>{vipProgressPercent}%</b> (Xarid: {formatPrice(realTotalSpent)})
                  </span>
                  <span>Maqsad: 2 000 000 so'm</span>
                </div>
                <div style={{ height: "7px", width: "100%", backgroundColor: isDark ? "rgba(255, 255, 255, 0.28)" : "rgba(225, 29, 72, 0.22)", borderRadius: "4px", overflow: "hidden", boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.6)" : "none", transition: "background 0.3s ease" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${vipProgressPercent}%`,
                      background: isDark ? "linear-gradient(90deg, #fbbf24, #f59e0b)" : "linear-gradient(90deg, #f43f5e, #be123c)",
                      borderRadius: "4px",
                      transition: "width 0.4s ease, background 0.3s ease",
                    }}
                  />
                </div>
                <div style={{ fontSize: "11px", color: isDark ? "#fce7f3" : "#9f1239", marginTop: "8px", lineHeight: 1.4, fontWeight: 600, textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.95)" : "0 1px 3px rgba(255,255,255,0.9)", transition: "color 0.3s ease" }}>
                  VIP maqomi va bepul ekspress yetkazish uchun yana <b>{formatPrice(remainingForVip)}</b> lik xarid yetarli.
                </div>
              </div>
            </section>
          )}

          {/* Account status note removed per user request */}

      {/* 2. Wallet & Loyalty Points Widget (Uzum / Amazon Market Style) */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
          marginBottom: "18px",
        }}
      >
        {/* Cashback Balance */}
        <div
          onClick={() => setIsWalletModalOpen(true)}
          style={{
            backgroundColor: "var(--bg-card, #ffffff)",
            borderRadius: "20px",
            padding: "14px 12px",
            border: "1px solid var(--border-color, #f1f5f9)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            textAlign: "center",
            transition: "transform 0.15s ease",
          }}
        >
          <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>💰</span>
          <b style={{ fontSize: "14px", display: "block", color: "var(--primary, #be185d)" }}>
            {cashbackBalance.toLocaleString()} so'm
          </b>
          <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Keshbek balansi</span>
        </div>

        {/* Coupons */}
        <div
          onClick={onOpenPromos}
          style={{
            backgroundColor: "var(--bg-card, #ffffff)",
            borderRadius: "20px",
            padding: "14px 12px",
            border: "1px solid var(--border-color, #f1f5f9)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>🎟️</span>
          <b style={{ fontSize: "14px", display: "block", color: "#d97706" }}>
            {activePromosCount !== null ? `${activePromosCount} ta faol` : "Kuponlar"}
          </b>
          <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Promokodlar</span>
        </div>

        {/* Wishlist */}
        <div
          onClick={() => onNavigate("wishlist")}
          style={{
            backgroundColor: "var(--bg-card, #ffffff)",
            borderRadius: "20px",
            padding: "14px 12px",
            border: "1px solid var(--border-color, #f1f5f9)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: "20px", display: "block", marginBottom: "4px" }}>💖</span>
          <b style={{ fontSize: "14px", display: "block", color: "#ec4899" }}>
            {wishlistCount} ta
          </b>
          <span style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Saralanganlar</span>
        </div>
      </section>

      {/* 3. Quick Orders Tracker Widget (Online Market Essential) */}
      <section
        style={{
          backgroundColor: "var(--bg-card, #ffffff)",
          borderRadius: "24px",
          padding: "18px",
          border: "1px solid var(--border-color, #f1f5f9)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.03)",
          marginBottom: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "var(--text-main, #1e293b)" }}>
              Buyurtmalar holati
            </h2>
            <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
              Jami {orders.length} ta buyurtma
            </span>
          </div>
          <button
            onClick={() => onNavigate("orders")}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: "var(--primary, #be185d)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "8px",
            }}
          >
            Barchasi ›
          </button>
        </div>

        {/* 4 Interactive Order Status Buttons */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: "8px",
            textAlign: "center",
          }}
        >
          {/* 1. To'lov / Kutilmoqda */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("in_progress");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              position: "relative",
            }}
          >
            <span style={{ fontSize: "22px" }}>⏳</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Kutilmoqda</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-pending-color, #d97706)",
                backgroundColor: "var(--status-pending-bg, #fef3c7)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {pendingOrders.length}
            </span>
          </button>

          {/* 2. Tayyorlanmoqda */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("in_progress");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "22px" }}>📦</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Yig'ilmoqda</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-processing-color, #2563eb)",
                backgroundColor: "var(--status-processing-bg, #dbeafe)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {pendingOrders.filter((o) => o.status === "Qabul qilindi" || o.status === "Tayyorlanmoqda").length}
            </span>
          </button>

          {/* 3. Yo'lda / Kuryerda */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("in_progress");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "22px" }}>🚚</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Yo'lda</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-shipping-color, #7c3aed)",
                backgroundColor: "var(--status-shipping-bg, #ede9fe)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {pendingOrders.filter((o) => o.status === "Yetkazilmoqda" || o.status === "Yo'lda").length}
            </span>
          </button>

          {/* 4. Yetkazildi */}
          <button
            onClick={() => {
              if (onSelectOrderFilter) onSelectOrderFilter("completed");
              onNavigate("orders");
            }}
            style={{
              backgroundColor: "var(--bg-card-sub, var(--bg-subtle, #f8fafc))",
              border: "1px solid var(--border-color, #e2e8f0)",
              borderRadius: "16px",
              padding: "12px 6px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: "22px" }}>✓</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-main, #334155)" }}>Yetkazildi</span>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 800,
                color: "var(--status-delivered-color, #16a34a)",
                backgroundColor: "var(--status-delivered-bg, #dcfce7)",
                padding: "1px 6px",
                borderRadius: "10px",
              }}
            >
              {completedOrders.length}
            </span>
          </button>
        </div>
      </section>

      {/* 4. Asosiy Bo'limlar (Structured Online Market List) */}
      <section className="profileSection" style={{ marginBottom: "16px" }}>
        <h2>🛍️ Xaridlar va Ma'lumotlar</h2>

        <button
          className="menuRow"
          id="profile-orders-btn"
          onClick={() => onNavigate("orders")}
        >
          <span className="profileSticker3D">📦</span>
          <div>
            <b>{t("my_orders")}</b>
            <small>Barcha buyurtmalar tarixi va cheklar ({orders.length} ta)</small>
          </div>
          <i>›</i>
        </button>

        {orders.length > 0 && (
          <button
            className="menuRow"
            id="profile-pdf-btn"
            onClick={onExportPdf}
          >
            <span className="profileSticker3D">📄</span>
            <div>
              <b>{t("pdf_report")}</b>
              <small>Shaxsiy xaridlar hisobotini PDF formatida yuklab olish</small>
            </div>
            <i>›</i>
          </button>
        )}

        <button
          className="menuRow"
          id="profile-wishlist-btn"
          onClick={() => onNavigate("wishlist")}
        >
          <span className="profileSticker3D">💖</span>
          <div>
            <b>{t("my_wishlist")}</b>
            <small>{wishlistCount} ta saralangan mahsulot</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-addresses-btn"
          onClick={() => onNavigate("addresses")}
        >
          <span className="profileSticker3D">📍</span>
          <div>
            <b>{t("my_addresses")}</b>
            <small>Yetkazib berish manzillarini boshqarish</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-promos-btn"
          onClick={onOpenPromos}
        >
          <span className="profileSticker3D">🏷️</span>
          <div>
            <b>Kuponlar va Aksiya promokodlari</b>
            <small>Shaxsiy chegirmalar va yangi aksiyalar</small>
          </div>
          <i>›</i>
        </button>
      </section>
      </>
      )}

      {/* 5. Mijozlarga Xizmat Ko'rsatish (Customer Care) */}
      <section className="profileSection" style={{ marginBottom: "16px" }}>
        <h2>💬 Xizmat va Bog'lanish</h2>

        {/* Faqat ro'yxatdan o'tgan foydalanuvchilarga ko'rinadi */}
        {isAuthenticated && (
          <>
            <button
              className="menuRow"
              id="profile-chat-btn"
              onClick={() => onNavigate("chat")}
            >
              <span className="profileSticker3D">💬</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <b>GULI Chat</b>
                </div>
                {unreadChatCount > 0 ? (
                  <span className="badgePill" style={{ backgroundColor: "#ef4444" }}>{unreadChatCount} yangi</span>
                ) : null}
                <small>Operatorlarimiz 24/7 sizga yordam berishga tayyor</small>
              </div>
              <i>›</i>
            </button>

            <button
              className="menuRow"
              id="profile-help-btn"
              onClick={onOpenHelp}
            >
              <span className="profileSticker3D">📞</span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <b>{t("help_support")}</b>
                </div>
                <small>Call Center (+998 90 581-11-17) & FAQ</small>
              </div>
              <i>›</i>
            </button>
          </>
        )}

        <button
          className="menuRow"
          id="profile-size-guide-btn"
          onClick={onOpenSizeGuide}
        >
          <span className="profileSticker3D">📏</span>
          <div>
            <b>O'lchamlar jadvali (Size Guide)</b>
            <small>To'g'ri o'lchamni aniqlash yo'riqnomasi</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-delivery-terms-btn"
          onClick={onOpenDeliveryTerms}
        >
          <span className="profileSticker3D">🚚</span>
          <div>
            <b>Yetkazib berish va qaytarish</b>
            <small>O'zbekiston bo'ylab yetkazish muddatlari</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-about-brand-btn"
          onClick={onOpenAboutBrand}
        >
          <span className="profileSticker3D">👑</span>
          <div>
            <b>GULI Brendi haqida</b>
            <small>Premium sifat va nozik kolleksiyalar tarixi</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-social-btn"
          onClick={onOpenSocial}
        >
          <span className="profileSticker3D">🌐</span>
          <div>
            <b>{t("social_media")}</b>
            <small>Telegram kanal, Instagram va yangiliklar</small>
          </div>
          <i>›</i>
        </button>
      </section>

      {/* 6. Sozlamalar va Xavfsizlik */}
      <section className="profileSection" style={{ marginBottom: "20px" }}>
        <h2>⚙️ Sozlamalar va Hisob</h2>

        <button
          className="menuRow"
          id="profile-settings-btn"
          onClick={onOpenSettings}
        >
          <span>⚙️</span>
          <div>
            <b>{t("settings")}</b>
            <small>
              {theme === "dark" ? t("theme_dark") : t("theme_light")} · {currency} · {language.toUpperCase()}
            </small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-share-btn"
          onClick={onShare}
        >
          <span>↗</span>
          <div>
            <b>{t("share_guli")}</b>
            <small>Ilovani do'stlaringizga ulashing</small>
          </div>
          <i>›</i>
        </button>

        <button
          className="menuRow"
          id="profile-clear-cache-btn"
          onClick={onClearCache}
        >
          <span>🗑️</span>
          <div>
            <b>{t("clear_cache")}</b>
            <small>Vaqtinchalik rasmlar va keshni tozalash</small>
          </div>
          <i>›</i>
        </button>

        {/* Safe Logout Button - Only for authenticated users */}
        {authUser && (
          <button
            className="menuRow"
            id="profile-logout-btn"
            onClick={() => setIsLogoutConfirmOpen(true)}
            style={{
              borderLeft: "4px solid #ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.04)",
            }}
          >
            <span style={{ fontSize: "20px" }}>🚪</span>
            <div>
              <b style={{ color: "#ef4444" }}>Tizimdan chiqish (Hisobni yopish)</b>
              <small>Boshqa hisobga kirish yoki sessiyani yakunlash</small>
            </div>
            <i style={{ color: "#ef4444" }}>›</i>
          </button>
        )}
      </section>

      {/* Watermark */}
      <div
        style={{
          textAlign: "center",
          padding: "16px 0",
          color: "var(--text-muted, #94a3b8)",
          opacity: 0.6,
          fontSize: "12px",
          letterSpacing: "0.5px",
        }}
      >
        GULI Lingerie & Homewear · Online Market v3.0
      </div>

      {/* MODAL 1: Edit Profile Modal */}
      {isEditModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.82)" : "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: isDark ? "#1c1317" : "#ffffff",
              color: isDark ? "#fbeff2" : "#1e293b",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: isDark ? "0 24px 80px rgba(0, 0, 0, 0.8)" : "0 24px 80px rgba(0, 0, 0, 0.25)",
              border: isDark ? "1px solid #38262d" : "1px solid rgba(0, 0, 0, 0.08)",
              margin: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: isDark ? "#fbeff2" : "#1e293b" }}>
                Profilni tahrirlash
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  border: isDark ? "1px solid #38262d" : "none",
                  backgroundColor: isDark ? "#2a1e24" : "#f1f5f9",
                  color: isDark ? "#b89ea6" : "#64748b",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  fontSize: "16px",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              {/* Profile Main Picture Upload */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "14px",
                  borderRadius: "20px",
                  backgroundColor: isDark ? "#23171d" : "#f8fafc",
                  border: isDark ? "1px dashed #4a323c" : "1px dashed #cbd5e1",
                  marginBottom: "16px",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "74px",
                    height: "74px",
                    borderRadius: "50%",
                    padding: "3px",
                    background: "linear-gradient(135deg, #fbbf24, #ec4899, #60a5fa)",
                    boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12)",
                  }}
                >
                  {editAvatar ? (
                    <img
                      src={editAvatar}
                      alt="Profil rasmi"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                        backgroundColor: isDark ? "#1c1317" : "#ffffff",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "50%",
                        backgroundColor: "#be185d",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        fontSize: "26px",
                        fontWeight: 800,
                      }}
                    >
                      {editName ? editName.charAt(0).toUpperCase() : "👤"}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
                  <label
                    style={{
                      padding: "7px 14px",
                      borderRadius: "12px",
                      backgroundColor: isDark ? "#be123c" : "#be185d",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      boxShadow: "0 3px 10px rgba(190, 24, 93, 0.3)",
                    }}
                  >
                    <span>📷</span> Yangi rasm yuklash
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      style={{ display: "none" }}
                    />
                  </label>

                  {editAvatar && (
                    <button
                      type="button"
                      onClick={() => setEditAvatar("")}
                      style={{
                        padding: "7px 12px",
                        borderRadius: "12px",
                        backgroundColor: "rgba(239, 68, 68, 0.15)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        color: "#ef4444",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      🗑️ O‘chirish
                    </button>
                  )}
                </div>

                {/* Quick Avatar Presets */}
                <div style={{ textAlign: "center", width: "100%", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", color: isDark ? "#b89ea6" : "#64748b", display: "block", marginBottom: "6px" }}>
                    Yoki tayyor avatarlardan tanlang:
                  </span>
                  <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                    {[
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
                      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80",
                      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80",
                      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80",
                    ].map((sampleUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setEditAvatar(sampleUrl)}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          border: editAvatar === sampleUrl ? "2px solid #e26b84" : (isDark ? "1px solid #38262d" : "1px solid #cbd5e1"),
                          padding: "1px",
                          cursor: "pointer",
                          backgroundColor: isDark ? "#261b20" : "#ffffff",
                          overflow: "hidden",
                        }}
                      >
                        <img src={sampleUrl} alt="Preset" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "#e2d9dc" : "#475569", marginBottom: "6px" }}>
                  Ism va Familiya
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ismingizni kiriting"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "14px",
                    backgroundColor: isDark ? "#23171d" : "#f8fafc",
                    color: isDark ? "#fbeff2" : "#1e293b",
                    border: isDark ? "1.5px solid #38262d" : "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                    colorScheme: isDark ? "dark" : "light",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "#e2d9dc" : "#475569", marginBottom: "6px" }}>
                  Telefon raqam (Yetkazib berish uchun)
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+998 90 123-45-67"
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "14px",
                    backgroundColor: isDark ? "#23171d" : "#f8fafc",
                    color: isDark ? "#fbeff2" : "#1e293b",
                    border: isDark ? "1.5px solid #38262d" : "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                    colorScheme: isDark ? "dark" : "light",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: isDark ? "#e2d9dc" : "#475569", marginBottom: "6px" }}>
                  Tug'ilgan sana (Bayram bonusi uchun)
                </label>
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(e) => setEditBirthDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "14px",
                    backgroundColor: isDark ? "#23171d" : "#f8fafc",
                    color: isDark ? "#fbeff2" : "#1e293b",
                    border: isDark ? "1.5px solid #38262d" : "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    outline: "none",
                    colorScheme: isDark ? "dark" : "light",
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: "16px",
                  border: "none",
                  background: "linear-gradient(135deg, #be185d, #ec4899)",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(190, 24, 93, 0.4)",
                }}
              >
                {savingProfile ? "Saqlanmoqda..." : "O'zgarishlarni saqlash ✓"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Wallet & Cashback details */}
      {isWalletModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWalletModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.82)" : "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: isDark ? "#1c1317" : "#ffffff",
              color: isDark ? "#fbeff2" : "#1e293b",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: isDark ? "0 24px 80px rgba(0,0,0,0.8)" : "0 24px 80px rgba(0,0,0,0.25)",
              border: isDark ? "1px solid #38262d" : "1px solid rgba(0,0,0,0.08)",
              textAlign: "center",
              margin: "auto",
            }}
          >
            <span style={{ fontSize: "42px" }}>💰</span>
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "10px 0 6px", color: isDark ? "#fbeff2" : "#1e293b" }}>
              GULI Keshbek Hamyoni
            </h3>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: isDark ? "#f472b6" : "#be185d",
                margin: "12px 0 16px",
              }}
            >
              {formatPrice(cashbackBalance)}
            </div>

            <div
              style={{
                backgroundColor: isDark ? "#23171d" : "#f8fafc",
                borderRadius: "16px",
                padding: "14px",
                textAlign: "left",
                marginBottom: "16px",
                border: isDark ? "1px solid #38262d" : "1px solid #e2e8f0",
                fontSize: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#b89ea6" : "#64748b" }}>Tasdiqlangan xaridlar:</span>
                <b>{formatPrice(realTotalSpent)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#b89ea6" : "#64748b" }}>2% Keshbek darajasi:</span>
                <b style={{ color: "var(--success-badge-color, #16a34a)" }}>+{formatPrice(realCashbackEarned)}</b>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: isDark ? "#b89ea6" : "#64748b" }}>Avval ishlatilgan:</span>
                <b style={{ color: "#dc2626" }}>-{formatPrice(usedCashback)}</b>
              </div>
              <div style={{ borderTop: isDark ? "1px dashed #4a323c" : "1px dashed #cbd5e1", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ fontWeight: 700, color: isDark ? "#fbeff2" : "#1e293b" }}>Mavjud foydalanish balansi:</span>
                <b style={{ color: isDark ? "#f472b6" : "#be185d", fontWeight: 800 }}>{formatPrice(cashbackBalance)}</b>
              </div>
            </div>

            <p style={{ fontSize: "12.5px", color: isDark ? "#b89ea6" : "#64748b", lineHeight: 1.5, margin: "0 0 18px" }}>
              Har bir xaridingizdan <b>2% kafolatlangan keshbek</b> hisoblanadi. Buyurtma rasmiylashtirishda ushbu summani to‘lovdan chegirib tovar sotib olishingiz mumkin!
            </p>
            <button
              type="button"
              onClick={() => setIsWalletModalOpen(false)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: isDark ? "1px solid #38262d" : "none",
                backgroundColor: isDark ? "#2a1e24" : "#1e293b",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Logout Confirmation (Centered in the viewport, modern platform design) */}
      {isLogoutConfirmOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLogoutConfirmOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.82)" : "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 999999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "380px",
              backgroundColor: isDark ? "#1c1317" : "#ffffff",
              color: isDark ? "#fbeff2" : "#1e293b",
              borderRadius: "26px",
              padding: "26px 22px",
              boxShadow: isDark ? "0 24px 80px rgba(0, 0, 0, 0.85)" : "0 24px 80px rgba(0, 0, 0, 0.25)",
              border: isDark ? "1px solid #38262d" : "1px solid #e2e8f0",
              textAlign: "center",
              margin: "auto",
            }}
          >
            {/* Elegant Danger Icon Circle */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: isDark ? "rgba(239, 68, 68, 0.18)" : "rgba(239, 68, 68, 0.12)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px auto",
                boxShadow: "0 4px 14px rgba(239, 68, 68, 0.18)",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 style={{ fontSize: "19px", fontWeight: 800, margin: "0 0 8px", color: isDark ? "#fbeff2" : "#1e293b" }}>
              Tizimdan chiqish
            </h3>
            <p style={{ fontSize: "13.5px", color: isDark ? "#b89ea6" : "#64748b", lineHeight: 1.5, margin: "0 0 22px" }}>
              Haqiqatan ham GULI hisobingizdan chiqmoqchimisiz? Barcha xaridlar tarixi va keshbek balansingiz saqlanib qoladi.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                style={{
                  padding: "13px 16px",
                  borderRadius: "14px",
                  border: isDark ? "1px solid #38262d" : "1px solid #cbd5e1",
                  backgroundColor: isDark ? "#2a1e24" : "#f8fafc",
                  color: isDark ? "#fbeff2" : "#475569",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  onLogout();
                }}
                style={{
                  padding: "13px 16px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(239, 68, 68, 0.4)",
                  transition: "all 0.15s ease",
                }}
              >
                Ha, chiqish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
