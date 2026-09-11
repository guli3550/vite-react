import React, { useState } from "react";
import type { Order } from "../App";
import type { Language } from "../utils/translations";
import type { Currency } from "../utils/currency";
import type { AuthUser } from "./CustomerAuthModal";

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
  t,
}) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState(authUser?.full_name || telegramUser?.first_name || "");
  const [editPhone, setEditPhone] = useState(authUser?.phone || localStorage.getItem("guli_phone") || "");
  const [editBirthDate, setEditBirthDate] = useState(localStorage.getItem("guli_birth_date") || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Derive display values
  const displayName = authUser?.full_name || 
    [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || 
    localStorage.getItem("guli_first_name") || 
    "GULI Mijozi";

  const userEmail = authUser?.email || localStorage.getItem("guli_email") || (telegramUser?.username ? `@${telegramUser.username}` : "Hisob ulangan");
  const userPhone = authUser?.phone || localStorage.getItem("guli_phone") || "+998 -- --- -- --";
  const userAvatar = authUser?.avatar_url || customAvatar || telegramUser?.photo_url || "";
  const isGoogle = authUser?.provider === "google" || (authUser?.email && authUser.email.endsWith("@gmail.com"));

  // Calculate order stats
  const pendingOrders = orders.filter((o) => o.status !== "Yetkazildi" && o.status !== "Bekor qilindi");
  const completedOrders = orders.filter((o) => o.status === "Yetkazildi");
  const totalSpent = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const cashbackBalance = Math.round(totalSpent * 0.03) + 25000; // 3% cashback bonus + 25,000 welcome gift

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      localStorage.setItem("guli_first_name", editName);
      localStorage.setItem("guli_phone", editPhone);
      localStorage.setItem("guli_birth_date", editBirthDate);

      // Call backend update if session token exists
      const token = localStorage.getItem("guli_access_token");
      if (token) {
        await fetch("/api/customer/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: editName,
            phone: editPhone,
          }),
        }).catch(() => null);
      }

      onUpdateProfile({
        full_name: editName,
        phone: editPhone,
      });

      setIsEditModalOpen(false);
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <main className="page modernProfilePage" style={{ paddingBottom: "110px", maxWidth: "680px", margin: "0 auto" }}>
      {/* 1. VIP Customer Card - Modern Online Market Style */}
      <section
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%)",
          borderRadius: "28px",
          padding: "24px 20px",
          color: "#ffffff",
          boxShadow: "0 14px 34px -10px rgba(49, 46, 129, 0.45)",
          position: "relative",
          overflow: "hidden",
          marginBottom: "18px",
        }}
      >
        {/* Background glow effects */}
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "160px",
            height: "160px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(236, 72, 153, 0.35) 0%, rgba(236, 72, 153, 0) 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          {/* Badge & ID */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                backgroundColor: "rgba(251, 191, 36, 0.2)",
                border: "1px solid rgba(251, 191, 36, 0.4)",
                color: "#fbbf24",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 800,
                letterSpacing: "0.5px",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              👑 GOLD VIP CLUB
            </span>
            {isGoogle && (
              <span
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  padding: "4px 9px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                ✓ Google ulangan
              </span>
            )}
          </div>

          {/* Quick Edit Profile Button */}
          <button
            onClick={() => {
              setEditName(displayName);
              setEditPhone(userPhone === "+998 -- --- -- --" ? "" : userPhone);
              setIsEditModalOpen(true);
            }}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "#ffffff",
              padding: "6px 12px",
              borderRadius: "14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(4px)",
              transition: "background 0.2s",
            }}
          >
            <span>✏️</span> Tahrirlash
          </button>
        </div>

        {/* User Info Row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Avatar with gradient ring */}
          <div
            style={{
              position: "relative",
              width: "68px",
              height: "68px",
              borderRadius: "50%",
              padding: "3px",
              background: "linear-gradient(135deg, #fbbf24, #ec4899, #60a5fa)",
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
                  backgroundColor: "#be185d",
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
                width: "20px",
                height: "20px",
                backgroundColor: "#10b981",
                border: "2.5px solid #1e1b4b",
                borderRadius: "50%",
              }}
              title="Faol mijoz"
            />
          </div>

          {/* Name & Contacts */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 800,
                margin: "0 0 4px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "#ffffff",
              }}
            >
              {displayName}
            </h1>
            <p
              style={{
                fontSize: "13px",
                margin: "0 0 2px",
                opacity: 0.85,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              ✉️ {userEmail}
            </p>
            <p style={{ fontSize: "12px", margin: 0, opacity: 0.75 }}>
              📞 {userPhone}
            </p>
          </div>
        </div>

        {/* Level progress bar */}
        <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid rgba(255, 255, 255, 0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px", opacity: 0.85 }}>
            <span>VIP Daraja: <b>Platinumga 2 ta buyurtma qoldi</b></span>
            <span>80%</span>
          </div>
          <div style={{ height: "6px", width: "100%", backgroundColor: "rgba(255, 255, 255, 0.18)", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "80%", background: "linear-gradient(90deg, #fbbf24, #ec4899)", borderRadius: "3px" }} />
          </div>
        </div>
      </section>

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
            3 ta faol
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
              backgroundColor: "var(--bg-subtle, #f8fafc)",
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
                color: "#d97706",
                backgroundColor: "#fef3c7",
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
              backgroundColor: "var(--bg-subtle, #f8fafc)",
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
                color: "#2563eb",
                backgroundColor: "#dbeafe",
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
              backgroundColor: "var(--bg-subtle, #f8fafc)",
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
                color: "#7c3aed",
                backgroundColor: "#ede9fe",
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
              backgroundColor: "var(--bg-subtle, #f8fafc)",
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
                color: "#16a34a",
                backgroundColor: "#dcfce7",
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

      {/* 5. Mijozlarga Xizmat Ko'rsatish (Customer Care) */}
      <section className="profileSection" style={{ marginBottom: "16px" }}>
        <h2>💬 Xizmat va Bog'lanish</h2>

        <button
          className="menuRow"
          id="profile-chat-btn"
          onClick={() => onNavigate("chat")}
        >
          <span className="profileSticker3D">💬</span>
          <div>
            <b>GULI Jonli Chat</b>
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
            <b>{t("help_support")}</b>
            <small>Call Center (+998 90 581-11-17) & FAQ</small>
          </div>
          <i>›</i>
        </button>

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
          id="profile-admin-panel-btn"
          onClick={() => {
            window.location.href = "/admin";
          }}
          style={{
            background: "linear-gradient(135deg, rgba(217, 119, 6, 0.08), rgba(236, 72, 153, 0.05))",
            borderLeft: "4px solid #d97706",
          }}
        >
          <span className="profileSticker3D">👑</span>
          <div>
            <b style={{ color: "var(--primary, #be185d)" }}>Admin Boshqaruv Paneli</b>
            <small>Do'kon tovarlari, buyurtmalar, keshbek va to'lovlar</small>
          </div>
          <i>›</i>
        </button>

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
          id="profile-security-btn"
          onClick={() => setIsSecurityModalOpen(true)}
        >
          <span>🔒</span>
          <div>
            <b>Xavfsizlik va Google akkaunt</b>
            <small>{isGoogle ? "Google hisobiga ulangan" : "Email va parol orqali himoyalangan"}</small>
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

        {/* Safe Logout Button */}
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
          className="modalBackdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="modalCard"
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#1e293b" }}>
                Profilni tahrirlash
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  border: "none",
                  backgroundColor: "#f1f5f9",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
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
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
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
          className="modalBackdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsWalletModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="modalCard"
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "42px" }}>💰</span>
            <h3 style={{ fontSize: "20px", fontWeight: 800, margin: "10px 0 6px", color: "#1e293b" }}>
              GULI Keshbek Hamyoni
            </h3>
            <div
              style={{
                fontSize: "28px",
                fontWeight: 800,
                color: "#be185d",
                margin: "12px 0 16px",
              }}
            >
              {cashbackBalance.toLocaleString()} so'm
            </div>
            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5, margin: "0 0 20px" }}>
              Siz har bir muvaffaqiyatli buyurtmangizdan <b>3% keshbek</b> olasiz. Ushbu mablag'ni keyingi xaridlarda chegirma sifatida ishlatishingiz mumkin!
            </p>
            <button
              onClick={() => setIsWalletModalOpen(false)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: "#f1f5f9",
                color: "#1e293b",
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

      {/* MODAL 3: Security & Google Account Modal */}
      {isSecurityModalOpen && (
        <div
          className="modalBackdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSecurityModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="modalCard"
            style={{
              width: "100%",
              maxWidth: "420px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "#1e293b" }}>
                🔒 Xavfsizlik va Kirish
              </h3>
              <button
                onClick={() => setIsSecurityModalOpen(false)}
                style={{
                  border: "none",
                  backgroundColor: "#f1f5f9",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "16px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <span style={{ fontSize: "24px" }}>{isGoogle ? "🌐" : "✉️"}</span>
                <div>
                  <b style={{ display: "block", fontSize: "14px", color: "#1e293b" }}>
                    {isGoogle ? "Google Akkaunt orqali autentifikatsiya" : "Email va Parol orqali kirilgan"}
                  </b>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {userEmail}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.5, marginBottom: "20px" }}>
              🛡️ Sizning buyurtmalaringiz va to'lov ma'lumotlaringiz xavfsiz himoyalangan. Boshqa qurilmadan kirganda ham buyurtmalaringiz avtomatik ko'rinadi.
            </div>

            <button
              onClick={() => setIsSecurityModalOpen(false)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: "#1e293b",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Yopish
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: Logout Confirmation */}
      {isLogoutConfirmOpen && (
        <div
          className="modalBackdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsLogoutConfirmOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            className="modalCard"
            style={{
              width: "100%",
              maxWidth: "380px",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: "40px" }}>🚪</span>
            <h3 style={{ fontSize: "18px", fontWeight: 800, margin: "10px 0 6px", color: "#1e293b" }}>
              Hisobdan chiqmoqchimisiz?
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.4, margin: "0 0 20px" }}>
              Hisobdan chiqsangiz, buyurtmalar va profil ma'lumotlarini ko'rish uchun qayta kirishingiz kerak bo'ladi.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <button
                onClick={() => setIsLogoutConfirmOpen(false)}
                style={{
                  padding: "12px",
                  borderRadius: "14px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Bekor qilish
              </button>
              <button
                onClick={() => {
                  setIsLogoutConfirmOpen(false);
                  onLogout();
                }}
                style={{
                  padding: "12px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
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
