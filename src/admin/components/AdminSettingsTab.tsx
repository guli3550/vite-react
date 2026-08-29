import { useState } from "react";
import { type PlatformType } from "../../utils/platformAdapter";

type AdminSettingsTabProps = {
  notify: (m: string) => void;
  activePlatform?: PlatformType;
  onPlatformChange?: (p: PlatformType) => void;
};

export function AdminSettingsTab({
  notify,
  activePlatform = "browser",
  onPlatformChange,
}: AdminSettingsTabProps) {
  // Theme state (Kun / Tun)
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("guli_admin_theme") as "light" | "dark") || "light";
  });

  // Language selection (Tilni tanlash)
  const [language, setLanguage] = useState<"uz" | "ru" | "en">(() => {
    return (localStorage.getItem("guli_lang") as "uz" | "ru" | "en") || "uz";
  });

  // Notification sound toggle (Ovozni yoqish/o'chirish)
  const [notifSoundEnabled, setNotifSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("guli_notif_sound_enabled") !== "false";
  });

  // Payment card info (To'lov vaqtidagi karta va ism)
  const [paymentCardNumber, setPaymentCardNumber] = useState(() => {
    return localStorage.getItem("guli_payment_card_number") || "9860 1766 1229 1557";
  });
  const [paymentCardHolder, setPaymentCardHolder] = useState(() => {
    return localStorage.getItem("guli_payment_card_holder") || "X.Yusufaliyev";
  });

  // Support card info (Qo'llab-quvvatlash bo'limidagi karta va ism)
  const [supportCardNumber, setSupportCardNumber] = useState(() => {
    return localStorage.getItem("guli_support_card_number") || "9860 1766 1229 1557";
  });
  const [supportCardHolder, setSupportCardHolder] = useState(() => {
    return localStorage.getItem("guli_support_card_holder") || "X.Yusufaliyev";
  });

  // Call Center phone number (Call center raqami)
  const [callCenterPhone, setCallCenterPhone] = useState(() => {
    return localStorage.getItem("guli_callcenter_phone") || "+998 90 581 11 17";
  });

  // Store configuration
  const [storeName, setStoreName] = useState("Guli Lingerie");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("500000");
  const [standardDeliveryFee, setStandardDeliveryFee] = useState("30000");
  const [clickMerchantId, setClickMerchantId] = useState("38102");
  const [paymeMerchantId, setPaymeMerchantId] = useState("64a821901a");
  const [telegramBotToken, setTelegramBotToken] = useState("7182910245:AAH...");

  // Synchronize Theme Changes
  const toggleTheme = (mode: "light" | "dark") => {
    setThemeMode(mode);
    localStorage.setItem("guli_admin_theme", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    }
    notify(`Tizim rejimi o'zgartirildi: ${mode === "dark" ? "🌙 Tun" : "☀️ Kun"}`);
  };

  // Synchronize Language Changes
  const changeLanguage = (lang: "uz" | "ru" | "en") => {
    setLanguage(lang);
    localStorage.setItem("guli_lang", lang);
    notify(`Tizim tili o'zgartirildi: ${lang === "uz" ? "🇺🇿 O'zbekcha" : lang === "ru" ? "🇷🇺 Русский" : "🇬🇧 English"}`);
  };

  // Synchronize Sound Toggle
  const toggleSound = (enabled: boolean) => {
    setNotifSoundEnabled(enabled);
    localStorage.setItem("guli_notif_sound_enabled", enabled ? "true" : "false");
    notify(enabled ? "🔔 Bildirishnoma ovozi yoqildi" : "🔕 Bildirishnoma ovozi o'chirildi");
  };

  const handleSaveAllSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("guli_admin_theme", themeMode);
      localStorage.setItem("guli_lang", language);
      localStorage.setItem("guli_notif_sound_enabled", notifSoundEnabled ? "true" : "false");

      localStorage.setItem("guli_payment_card_number", paymentCardNumber.trim());
      localStorage.setItem("guli_payment_card_holder", paymentCardHolder.trim());

      localStorage.setItem("guli_support_card_number", supportCardNumber.trim());
      localStorage.setItem("guli_support_card_holder", supportCardHolder.trim());

      localStorage.setItem("guli_callcenter_phone", callCenterPhone.trim());

      localStorage.setItem(
        "guli_admin_settings",
        JSON.stringify({
          storeName,
          callCenterPhone,
          freeDeliveryThreshold,
          standardDeliveryFee,
          clickMerchantId,
          paymeMerchantId,
        })
      );

      // Broadcast update event
      window.dispatchEvent(new Event("guli_settings_updated"));
      notify("Barcha sozlamalar muvaffaqiyatli saqlandi! ✨");
    } catch {
      notify("Sozlamalarni saqlashda xatolik yuz berdi");
    }
  };

  return (
    <div className="dash" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER SECTION */}
      <div
        className="proPanel"
        style={{
          background: "linear-gradient(135deg, #2a151f 0%, #4a212f 100%)",
          color: "#ffffff",
          padding: 24,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(74,33,47,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", color: "#f4a2b3", textTransform: "uppercase" }}>
              GULI SYSTEM CONTROL
            </span>
            <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800 }}>⚙️ Admin Pro Sozlamalari</h1>
            <p style={{ margin: "6px 0 0", color: "#e2b8c4", fontSize: 13 }}>
              Tizim interfeysi, karta ma'lumotlari, bildirishnomalar hamda to'lov parametrlarini boshqarish
            </p>
          </div>
          <button
            type="button"
            className="proPrimary"
            onClick={handleSaveAllSettings}
            style={{ padding: "12px 24px", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}
          >
            💾 Barcha Sozlamalarni Saqlash
          </button>
        </div>
      </div>

      <form onSubmit={handleSaveAllSettings} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* 1. DISPLEY & INTERFEYS REJIMLARI */}
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">DISPLAY & INTERFACE CONTROL</span>
              <h2>🎨 Tashqi Ko'rinish va Rejimlar</h2>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 14 }}>
            {/* Kun / Tun rejimi */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: 18, borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>🌗</span>
                <div>
                  <b style={{ fontSize: 14, color: "#1e293b", display: "block" }}>Kun / Tun Rejimi</b>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Admin Pro va Web App mavzusini tanlang</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className={`proPrimary ${themeMode === "light" ? "" : "secondary"}`}
                  onClick={() => toggleTheme("light")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 12,
                    border: themeMode === "light" ? "2px solid #b6536b" : "1px solid #cbd5e1",
                    background: themeMode === "light" ? "#fcecef" : "#ffffff",
                    color: themeMode === "light" ? "#b6536b" : "#475569",
                    fontWeight: 700,
                  }}
                >
                  ☀️ Kun (Yorug')
                </button>
                <button
                  type="button"
                  className={`proPrimary ${themeMode === "dark" ? "" : "secondary"}`}
                  onClick={() => toggleTheme("dark")}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 12,
                    border: themeMode === "dark" ? "2px solid #b6536b" : "1px solid #cbd5e1",
                    background: themeMode === "dark" ? "#1e293b" : "#ffffff",
                    color: themeMode === "dark" ? "#f8fafc" : "#475569",
                    fontWeight: 700,
                  }}
                >
                  🌙 Tun (To'q)
                </button>
              </div>
            </div>

            {/* Tilni tanlash rejimi */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: 18, borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>🌐</span>
                <div>
                  <b style={{ fontSize: 14, color: "#1e293b", display: "block" }}>Tizim Tili</b>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Ilova uchun asosiy muloqot tili</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {[
                  { id: "uz", label: "🇺🇿 O'zbek" },
                  { id: "ru", label: "🇷🇺 Русский" },
                  { id: "en", label: "🇬🇧 English" },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => changeLanguage(l.id as any)}
                    style={{
                      flex: 1,
                      padding: "10px 6px",
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      border: language === l.id ? "2px solid #b6536b" : "1px solid #cbd5e1",
                      background: language === l.id ? "#fcecef" : "#ffffff",
                      color: language === l.id ? "#b6536b" : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bildirishnoma ovozi */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: 18, borderRadius: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>🔔</span>
                <div>
                  <b style={{ fontSize: 14, color: "#1e293b", display: "block" }}>Bildirishnoma Ovozi</b>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Yangi online chat xabarlarida jiringlash</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => toggleSound(true)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 12,
                    border: notifSoundEnabled ? "2px solid #10b981" : "1px solid #cbd5e1",
                    background: notifSoundEnabled ? "#ecfdf5" : "#ffffff",
                    color: notifSoundEnabled ? "#047857" : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔊 Yoqilgan
                </button>
                <button
                  type="button"
                  onClick={() => toggleSound(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: 12,
                    border: !notifSoundEnabled ? "2px solid #ef4444" : "1px solid #cbd5e1",
                    background: !notifSoundEnabled ? "#fef2f2" : "#ffffff",
                    color: !notifSoundEnabled ? "#b91c1c" : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🔇 O'chirilgan
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. DEVICE PREVIEW MODE */}
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">DEVICE PREVIEW MODE</span>
              <h2>📱 Qurilma & Displey Prevyusi</h2>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "12px 0" }}>
            {[
              { id: "android", label: "📱 Android", desc: "Android Smartfon" },
              { id: "telegram", label: "✈️ Telegram", desc: "Telegram Mini App" },
              { id: "windows", label: "🖥️ Windows", desc: "Kompyuter (Desktop)" },
              { id: "tv", label: "📺 TV", desc: "Smart TV Ekran" },
              { id: "browser", label: "🌐 Auto", desc: "Avtomatik Moslashuvchan" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`proPrimary ${activePlatform === p.id ? "" : "secondary"}`}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: activePlatform === p.id ? "2px solid #b6536b" : "1px solid #cbd5e1",
                  background: activePlatform === p.id ? "#fcecef" : "#ffffff",
                  color: activePlatform === p.id ? "#b6536b" : "#334155",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => onPlatformChange?.(p.id as PlatformType)}
              >
                <div style={{ fontSize: 14 }}>{p.label}</div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 3. TO'LOV KARTALARI VA ISMLAR SHAKLI */}
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">FINANCE & CARD DETAILS</span>
              <h2>💳 To'lov va Qollab-quvvatlash Kartalari</h2>
            </div>
          </div>

          <div className="formGrid" style={{ marginTop: 14 }}>
            {/* To'lov karta raqami */}
            <label>
              💳 To'lov Vaqtida Paydo Bo'luvchi Karta Raqami
              <input
                type="text"
                value={paymentCardNumber}
                onChange={(e) => setPaymentCardNumber(e.target.value)}
                placeholder="Masalan: 9860 1766 1229 1557"
                required
              />
            </label>

            {/* To'lov karta egasi ismi */}
            <label>
              👤 To'lov Kartasi Egasi Ismi (Holder Name)
              <input
                type="text"
                value={paymentCardHolder}
                onChange={(e) => setPaymentCardHolder(e.target.value)}
                placeholder="Masalan: X.Yusufaliyev"
                required
              />
            </label>

            {/* Qo'llab-quvvatlash karta raqami */}
            <label>
              🌷 Qo'llab-quvvatlash (Support) Karta Raqami
              <input
                type="text"
                value={supportCardNumber}
                onChange={(e) => setSupportCardNumber(e.target.value)}
                placeholder="Masalan: 9860 1766 1229 1557"
                required
              />
            </label>

            {/* Qo'llab-quvvatlash karta egasi ismi */}
            <label>
              👤 Support Kartasi Egasi Ismi
              <input
                type="text"
                value={supportCardHolder}
                onChange={(e) => setSupportCardHolder(e.target.value)}
                placeholder="Masalan: X.Yusufaliyev"
                required
              />
            </label>
          </div>
        </section>

        {/* 4. CALL CENTER VA DO'KON SOZLAMALARI */}
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">STORE & CALL CENTER CONFIGURATION</span>
              <h2>📞 Call Center va Do'kon Parametrlari</h2>
            </div>
          </div>

          <div className="formGrid" style={{ marginTop: 14 }}>
            <label>
              📞 Call Center Telefon Raqami
              <input
                type="text"
                value={callCenterPhone}
                onChange={(e) => setCallCenterPhone(e.target.value)}
                placeholder="+998 90 581 11 17"
                required
              />
            </label>

            <label>
              🛍️ Do‘kon Nomi
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
              />
            </label>

            <label>
              🚚 Bepul Yetkazib Berish Chegarasi (so'm)
              <input
                type="number"
                value={freeDeliveryThreshold}
                onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                required
              />
            </label>

            <label>
              📦 Standart Yetkazib Berish Narxi (so'm)
              <input
                type="number"
                value={standardDeliveryFee}
                onChange={(e) => setStandardDeliveryFee(e.target.value)}
                required
              />
            </label>

            <label>
              💳 Click Merchant ID
              <input
                type="text"
                value={clickMerchantId}
                onChange={(e) => setClickMerchantId(e.target.value)}
              />
            </label>

            <label>
              🔹 Payme Merchant ID
              <input
                type="text"
                value={paymeMerchantId}
                onChange={(e) => setPaymeMerchantId(e.target.value)}
              />
            </label>

            <label className="fullRow">
              ✈️ Telegram Bot Token (API)
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
              />
            </label>
          </div>

          <div className="modalActions" style={{ marginTop: 20 }}>
            <button type="submit" className="proPrimary" style={{ padding: "12px 28px", fontSize: 14 }}>
              💾 Barcha Sozlamalarni Saqlash
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
