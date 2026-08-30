import { useState, useRef } from "react";
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
  // Helper to load parsed JSON settings
  const getSavedSettingsObj = () => {
    try {
      return JSON.parse(localStorage.getItem("guli_admin_settings") || "{}");
    } catch {
      return {};
    }
  };

  const savedObj = getSavedSettingsObj();

  // Active sub-tab filter
  const [activeTab, setActiveTab] = useState<"all" | "appearance" | "finance" | "store" | "integrations" | "system">("all");

  // Theme state (Kun / Tun)
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("guli_admin_theme") as "light" | "dark") || "light";
  });

  // Language selection
  const [language, setLanguage] = useState<"uz" | "ru" | "en">(() => {
    return (localStorage.getItem("guli_lang") as "uz" | "ru" | "en") || "uz";
  });

  // Notification sound toggle
  const [notifSoundEnabled, setNotifSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("guli_notif_sound_enabled") !== "false";
  });

  // Payment card info
  const [paymentCardNumber, setPaymentCardNumber] = useState(() => {
    return localStorage.getItem("guli_payment_card_number") || savedObj.paymentCardNumber || "9860 1766 1229 1557";
  });
  const [paymentCardHolder, setPaymentCardHolder] = useState(() => {
    return localStorage.getItem("guli_payment_card_holder") || savedObj.paymentCardHolder || "X.Yusufaliyev";
  });

  // Support card info
  const [supportCardNumber, setSupportCardNumber] = useState(() => {
    return localStorage.getItem("guli_support_card_number") || savedObj.supportCardNumber || "9860 1766 1229 1557";
  });
  const [supportCardHolder, setSupportCardHolder] = useState(() => {
    return localStorage.getItem("guli_support_card_holder") || savedObj.supportCardHolder || "X.Yusufaliyev";
  });

  // Call Center & Store configuration
  const [callCenterPhone, setCallCenterPhone] = useState(() => {
    return localStorage.getItem("guli_callcenter_phone") || savedObj.callCenterPhone || "+998 90 581 11 17";
  });
  const [storeName, setStoreName] = useState(() => savedObj.storeName || "Guli Lingerie");
  const [workHours, setWorkHours] = useState(() => savedObj.workHours || "09:00 - 21:00 (Har kuni)");
  const [storeAddress, setStoreAddress] = useState(() => savedObj.storeAddress || "Toshkent sh., Navoiy ko'chasi 14");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(() => savedObj.freeDeliveryThreshold || "300000");
  const [standardDeliveryFee, setStandardDeliveryFee] = useState(() => savedObj.standardDeliveryFee || "20000");

  // Payment gateways & Telegram
  const [clickMerchantId, setClickMerchantId] = useState(() => savedObj.clickMerchantId || "38102");
  const [paymeMerchantId, setPaymeMerchantId] = useState(() => savedObj.paymeMerchantId || "64a821901a");
  const [telegramBotToken, setTelegramBotToken] = useState(() => {
    return localStorage.getItem("guli_telegram_bot_token") || savedObj.telegramBotToken || "7182910245:AAH...";
  });
  const [telegramChannelId, setTelegramChannelId] = useState(() => {
    return localStorage.getItem("guli_telegram_channel_id") || savedObj.telegramChannelId || "@guli_official";
  });

  // Bot Status Tester state
  const [botTestState, setBotTestState] = useState<{
    loading: boolean;
    tested: boolean;
    success: boolean;
    botName?: string;
    botUsername?: string;
    message?: string;
  }>({ loading: false, tested: false, success: false });

  // Confirmation modal state for reset
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Hidden file input ref for JSON import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format card number with spaces every 4 digits
  const formatCardDigits = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
  };

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
    window.dispatchEvent(new Event("guli_settings_updated"));
    notify(`Tizim rejimi o'zgartirildi: ${mode === "dark" ? "🌙 Tun" : "☀️ Kun"}`);
  };

  // Synchronize Language Changes
  const changeLanguage = (lang: "uz" | "ru" | "en") => {
    setLanguage(lang);
    localStorage.setItem("guli_lang", lang);
    window.dispatchEvent(new Event("guli_settings_updated"));
    notify(`Tizim tili o'zgartirildi: ${lang === "uz" ? "🇺🇿 O'zbekcha" : lang === "ru" ? "🇷🇺 Русский" : "🇬🇧 English"}`);
  };

  // Synchronize Sound Toggle
  const toggleSound = (enabled: boolean) => {
    setNotifSoundEnabled(enabled);
    localStorage.setItem("guli_notif_sound_enabled", enabled ? "true" : "false");
    window.dispatchEvent(new Event("guli_settings_updated"));
    notify(enabled ? "🔔 Bildirishnoma ovozi yoqildi" : "🔕 Bildirishnoma ovozi o'chirildi");
  };

  // Test Telegram Bot Token Connection
  const handleTestBotToken = async () => {
    const cleanToken = telegramBotToken.trim();
    if (!cleanToken) {
      notify("⚠️ Bot token kiritilmagan");
      return;
    }
    setBotTestState({ loading: true, tested: false, success: false });
    try {
      const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.result) {
          setBotTestState({
            loading: false,
            tested: true,
            success: true,
            botName: data.result.first_name,
            botUsername: data.result.username,
            message: `Bot aloqasi muvaffaqiyatli! (${data.result.first_name} - @${data.result.username})`,
          });
          notify(`✅ Bot faol: @${data.result.username}`);
          return;
        }
      }
      setBotTestState({
        loading: false,
        tested: true,
        success: false,
        message: "Bot tokeni noto'g'ri yoki Telegram API javob bermadi",
      });
      notify("❌ Bot tokenini tekshirib ko'ring");
    } catch {
      setBotTestState({
        loading: false,
        tested: true,
        success: false,
        message: "Server bilan bog'lanib bo'lmadi",
      });
      notify("⚠️ Telegram API serveriga ulanishda xatolik");
    }
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notify(`${label} buferga nusxalandi! 📋`);
  };

  // Save All Settings
  const handleSaveAllSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const cleanPayCardNum = paymentCardNumber.trim();
      const cleanPayCardHolder = paymentCardHolder.trim();
      const cleanSuppCardNum = supportCardNumber.trim();
      const cleanSuppCardHolder = supportCardHolder.trim();
      const cleanPhone = callCenterPhone.trim();
      const cleanBotToken = telegramBotToken.trim();
      const cleanChanId = telegramChannelId.trim();

      localStorage.setItem("guli_admin_theme", themeMode);
      localStorage.setItem("guli_lang", language);
      localStorage.setItem("guli_notif_sound_enabled", notifSoundEnabled ? "true" : "false");

      localStorage.setItem("guli_payment_card_number", cleanPayCardNum);
      localStorage.setItem("guli_payment_card_holder", cleanPayCardHolder);

      localStorage.setItem("guli_support_card_number", cleanSuppCardNum);
      localStorage.setItem("guli_support_card_holder", cleanSuppCardHolder);

      localStorage.setItem("guli_callcenter_phone", cleanPhone);
      localStorage.setItem("guli_telegram_bot_token", cleanBotToken);
      localStorage.setItem("guli_telegram_channel_id", cleanChanId);

      const settingsObj = {
        storeName: storeName.trim(),
        workHours: workHours.trim(),
        storeAddress: storeAddress.trim(),
        callCenterPhone: cleanPhone,
        freeDeliveryThreshold: freeDeliveryThreshold.trim(),
        standardDeliveryFee: standardDeliveryFee.trim(),
        clickMerchantId: clickMerchantId.trim(),
        paymeMerchantId: paymeMerchantId.trim(),
        paymentCardNumber: cleanPayCardNum,
        paymentCardHolder: cleanPayCardHolder,
        supportCardNumber: cleanSuppCardNum,
        supportCardHolder: cleanSuppCardHolder,
        telegramBotToken: cleanBotToken,
        telegramChannelId: cleanChanId,
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem("guli_admin_settings", JSON.stringify(settingsObj));

      // Broadcast update event to entire application
      window.dispatchEvent(new Event("guli_settings_updated"));
      notify("Barcha sozlamalar muvaffaqiyatli saqlandi va sinxronlandi! ✨");
    } catch {
      notify("Sozlamalarni saqlashda xatolik yuz berdi");
    }
  };

  // Export Settings to JSON
  const handleExportSettings = () => {
    try {
      const exportData = {
        themeMode,
        language,
        notifSoundEnabled,
        paymentCardNumber,
        paymentCardHolder,
        supportCardNumber,
        supportCardHolder,
        callCenterPhone,
        storeName,
        workHours,
        storeAddress,
        freeDeliveryThreshold,
        standardDeliveryFee,
        clickMerchantId,
        paymeMerchantId,
        telegramBotToken,
        telegramChannelId,
        exportedAt: new Date().toISOString(),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `guli-settings-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify("Sozlamalar zaxira fayli (.json) yuklab olindi! 📥");
    } catch {
      notify("Zaxiralashda xatolik yuz berdi");
    }
  };

  // Import Settings from JSON File
  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed) {
          if (parsed.themeMode) setThemeMode(parsed.themeMode);
          if (parsed.language) setLanguage(parsed.language);
          if (parsed.notifSoundEnabled !== undefined) setNotifSoundEnabled(Boolean(parsed.notifSoundEnabled));
          if (parsed.paymentCardNumber) setPaymentCardNumber(parsed.paymentCardNumber);
          if (parsed.paymentCardHolder) setPaymentCardHolder(parsed.paymentCardHolder);
          if (parsed.supportCardNumber) setSupportCardNumber(parsed.supportCardNumber);
          if (parsed.supportCardHolder) setSupportCardHolder(parsed.supportCardHolder);
          if (parsed.callCenterPhone) setCallCenterPhone(parsed.callCenterPhone);
          if (parsed.storeName) setStoreName(parsed.storeName);
          if (parsed.workHours) setWorkHours(parsed.workHours);
          if (parsed.storeAddress) setStoreAddress(parsed.storeAddress);
          if (parsed.freeDeliveryThreshold) setFreeDeliveryThreshold(parsed.freeDeliveryThreshold);
          if (parsed.standardDeliveryFee) setStandardDeliveryFee(parsed.standardDeliveryFee);
          if (parsed.clickMerchantId) setClickMerchantId(parsed.clickMerchantId);
          if (parsed.paymeMerchantId) setPaymeMerchantId(parsed.paymeMerchantId);
          if (parsed.telegramBotToken) setTelegramBotToken(parsed.telegramBotToken);
          if (parsed.telegramChannelId) setTelegramChannelId(parsed.telegramChannelId);

          notify("Zaxiradagi sozlamalar yuklandi va qo'llanildi! 📤");
        }
      } catch {
        notify("JSON faylini o'qishda xatolik yuz berdi");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Reset All Settings
  const handleResetToDefaults = () => {
    const defPayCard = "9860 1766 1229 1557";
    const defHolder = "X.Yusufaliyev";
    const defPhone = "+998 90 581 11 17";

    setThemeMode("light");
    setLanguage("uz");
    setNotifSoundEnabled(true);
    setPaymentCardNumber(defPayCard);
    setPaymentCardHolder(defHolder);
    setSupportCardNumber(defPayCard);
    setSupportCardHolder(defHolder);
    setCallCenterPhone(defPhone);
    setStoreName("Guli Lingerie");
    setWorkHours("09:00 - 21:00 (Har kuni)");
    setStoreAddress("Toshkent sh., Navoiy ko'chasi 14");
    setFreeDeliveryThreshold("300000");
    setStandardDeliveryFee("20000");
    setClickMerchantId("38102");
    setPaymeMerchantId("64a821901a");
    setTelegramBotToken("7182910245:AAH...");
    setTelegramChannelId("@guli_official");

    setShowResetConfirm(false);
    notify("Barcha sozlamalar dastlabki holatga qaytarildi ✓");
  };

  return (
    <div className="dash" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 1. TOP HEADER & SYSTEM STATUS BANNER */}
      <div
        className="proPanel"
        style={{
          background: "linear-gradient(135deg, #1e0f18 0%, #3d1b28 50%, #541d2e 100%)",
          color: "#ffffff",
          padding: "24px 28px",
          borderRadius: 22,
          boxShadow: "0 12px 36px rgba(61,27,40,0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", color: "#fca5a5", textTransform: "uppercase", background: "rgba(255,255,255,0.1)", padding: "3px 10px", borderRadius: 20 }}>
                GULI PRO CONTROL CENTER
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#86efac", background: "rgba(34,197,94,0.15)", padding: "3px 10px", borderRadius: 20 }}>
                ● Onlayn
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px" }}>⚙️ Tizim va Ilova Sozlamalari</h1>
            <p style={{ margin: "6px 0 0", color: "#f3d2dc", fontSize: 13, maxWidth: 650, lineHeight: 1.5 }}>
              Ilova ko'rinishi, to'lov va support kartalari, do'kon va yetkazib berish parametrlari hamda Telegram bot integratsiyalarini bir joyda xatosiz boshqaring.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleExportSettings}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(255,255,255,0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title="Sozlamalarni JSON fayliga eksport qilish"
            >
              📥 Eksport
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
                background: "rgba(255,255,255,0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.2)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              title="JSON faylidan sozlamalarni yuklash"
            >
              📤 Import
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportSettings}
              accept=".json"
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => handleSaveAllSettings()}
              style={{
                padding: "12px 24px",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 800,
                background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
                color: "#ffffff",
                border: "none",
                boxShadow: "0 4px 16px rgba(225,29,72,0.4)",
                cursor: "pointer",
              }}
            >
              💾 Barchasini Saqlash
            </button>
          </div>
        </div>
      </div>

      {/* 2. CATEGORY SUB-NAVIGATION TABS */}
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {[
          { id: "all", label: "📋 Barchasi", desc: "Barcha sozlamalar" },
          { id: "appearance", label: "🎨 Tashqi Ko'rinish", desc: "Mavzu, til va ovoz" },
          { id: "finance", label: "💳 Moliya & Kartalar", desc: "To'lov rekvizitlari" },
          { id: "store", label: "📞 Do'kon & Aloqa", desc: "Call center va yetkazish" },
          { id: "integrations", label: "⚡ Integratsiyalar", desc: "Payme, Click & Bot" },
          { id: "system", label: "⚙️ Tizim & Zaxira", desc: "Kesh va qaytarish" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: "10px 18px",
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              border: activeTab === t.id ? "2px solid #be123c" : "1px solid var(--border-color, #e2e8f0)",
              background: activeTab === t.id ? "var(--accent-light, #fcecef)" : "var(--bg-card, #ffffff)",
              color: activeTab === t.id ? "#be123c" : "var(--text-main, #334155)",
              cursor: "pointer",
              boxShadow: activeTab === t.id ? "0 4px 12px rgba(190,18,60,0.15)" : "none",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSaveAllSettings} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 3. SECTION: TASHQI KO'RINISH VA REJIMLAR */}
        {(activeTab === "all" || activeTab === "appearance") && (
          <section className="proPanel" style={{ background: "var(--bg-card, #ffffff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div className="panelHead" style={{ marginBottom: 16 }}>
              <div>
                <span className="proEyebrow" style={{ color: "#be123c", fontWeight: 700, fontSize: 11 }}>DISPLAY & INTERFACE CONTROL</span>
                <h2 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>🎨 Tashqi Ko'rinish, Til va Ovoz</h2>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Kun / Tun Rejimi */}
              <div style={{ background: "var(--bg-card-sub, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)", padding: 18, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 24, background: "#fcecef", padding: 8, borderRadius: 12 }}>🌗</span>
                  <div>
                    <b style={{ fontSize: 14, color: "var(--text-main, #1e293b)", display: "block" }}>Kun / Tun Rejimi</b>
                    <span style={{ fontSize: 11, color: "var(--text-muted, #64748b)" }}>Admin va Web App mavzusini tanlang</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleTheme("light")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 12,
                      border: themeMode === "light" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: themeMode === "light" ? "#fcecef" : "#ffffff",
                      color: themeMode === "light" ? "#be123c" : "#475569",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ☀️ Kun (Yorug')
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTheme("dark")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 12,
                      border: themeMode === "dark" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: themeMode === "dark" ? "#1e293b" : "#ffffff",
                      color: themeMode === "dark" ? "#f8fafc" : "#475569",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    🌙 Tun (To'q)
                  </button>
                </div>
              </div>

              {/* Tizim Tili */}
              <div style={{ background: "var(--bg-card-sub, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)", padding: 18, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 24, background: "#fcecef", padding: 8, borderRadius: 12 }}>🌐</span>
                  <div>
                    <b style={{ fontSize: 14, color: "var(--text-main, #1e293b)", display: "block" }}>Tizim Tili</b>
                    <span style={{ fontSize: 11, color: "var(--text-muted, #64748b)" }}>Ilova foydalanuvchi tili</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
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
                        padding: "10px 4px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        border: language === l.id ? "2px solid #be123c" : "1px solid #cbd5e1",
                        background: language === l.id ? "#fcecef" : "#ffffff",
                        color: language === l.id ? "#be123c" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bildirishnoma Ovozi */}
              <div style={{ background: "var(--bg-card-sub, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)", padding: 18, borderRadius: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 24, background: "#fcecef", padding: 8, borderRadius: 12 }}>🔔</span>
                  <div>
                    <b style={{ fontSize: 14, color: "var(--text-main, #1e293b)", display: "block" }}>Bildirishnoma Ovozi</b>
                    <span style={{ fontSize: 11, color: "var(--text-muted, #64748b)" }}>Yangi chat xabarlarida ovozli ishora</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
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

            {/* Qurilma Prevyusi */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--border-color, #e2e8f0)" }}>
              <b style={{ fontSize: 13, color: "var(--text-main, #1e293b)", display: "block", marginBottom: 8 }}>
                📱 Qurilma Ko'rinishi Prevyusi (Device Mode)
              </b>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { id: "android", label: "📱 Android", desc: "Smartfon" },
                  { id: "telegram", label: "✈️ Telegram", desc: "Mini App" },
                  { id: "windows", label: "🖥️ Desktop", desc: "Windows PC" },
                  { id: "tv", label: "📺 Smart TV", desc: "Katta Ekran" },
                  { id: "browser", label: "🌐 Avto", desc: "Brauzer" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPlatformChange?.(p.id as PlatformType)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: activePlatform === p.id ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: activePlatform === p.id ? "#fcecef" : "#ffffff",
                      color: activePlatform === p.id ? "#be123c" : "#334155",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {p.label} <span style={{ opacity: 0.6, fontWeight: 400 }}>({p.desc})</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 4. SECTION: MOLIYA VA KARTALAR (PAYMENT & SUPPORT CARDS + LIVE MOCKUP) */}
        {(activeTab === "all" || activeTab === "finance") && (
          <section className="proPanel" style={{ background: "var(--bg-card, #ffffff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div className="panelHead" style={{ marginBottom: 16 }}>
              <div>
                <span className="proEyebrow" style={{ color: "#be123c", fontWeight: 700, fontSize: 11 }}>FINANCE & REQUISITES</span>
                <h2 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>💳 To'lov va Qo'llab-quvvatlash Kartalari</h2>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
              {/* Form inputs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                    💳 Checkout To'lov Kartasi Raqami
                  </label>
                  <input
                    type="text"
                    value={paymentCardNumber}
                    onChange={(e) => setPaymentCardNumber(formatCardDigits(e.target.value))}
                    placeholder="8600 0000 0000 0000"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "monospace", fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                    👤 To'lov Kartasi Egasi Ismi (Holder Name)
                  </label>
                  <input
                    type="text"
                    value={paymentCardHolder}
                    onChange={(e) => setPaymentCardHolder(e.target.value)}
                    placeholder="Masalan: X.Yusufaliyev"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 600 }}
                  />
                </div>

                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                    🌷 Support (Xayriya/Yordam) Karta Raqami
                  </label>
                  <input
                    type="text"
                    value={supportCardNumber}
                    onChange={(e) => setSupportCardNumber(formatCardDigits(e.target.value))}
                    placeholder="9860 0000 0000 0000"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "monospace", fontWeight: 700 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                    👤 Support Kartasi Egasi Ismi
                  </label>
                  <input
                    type="text"
                    value={supportCardHolder}
                    onChange={(e) => setSupportCardHolder(e.target.value)}
                    placeholder="Masalan: X.Yusufaliyev"
                    style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 600 }}
                  />
                </div>
              </div>

              {/* LIVE 3D CREDIT CARD PREVIEW MOCKUP */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "1px" }}>
                  Mijozlar Ko'radigan Karta Ko'rinishi (Live Preview)
                </span>

                <div
                  style={{
                    width: "100%",
                    maxWidth: 340,
                    height: 200,
                    borderRadius: 20,
                    background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #31102f 100%)",
                    padding: 22,
                    color: "#ffffff",
                    boxShadow: "0 16px 32px rgba(15,23,42,0.35)",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: "1px", color: "#fca5a5" }}>GULI</span>
                      <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>PAY</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#cbd5e1" }}>
                      {paymentCardNumber.startsWith("8600") ? "UZCARD" : "HUMO / UZCARD"}
                    </span>
                  </div>

                  {/* EMV Chip & Contactless */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
                    <div style={{ width: 36, height: 26, background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)", borderRadius: 6, border: "1px solid #d97706" }} />
                    <span style={{ fontSize: 16, opacity: 0.7 }}>📡</span>
                  </div>

                  {/* Card Number */}
                  <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, letterSpacing: "2px", color: "#ffffff", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>
                    {paymentCardNumber || "9860 1766 1229 1557"}
                  </div>

                  {/* Card Holder & Expiry */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>KARTA EGASI</div>
                      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#f8fafc" }}>
                        {paymentCardHolder || "X.YUSUFALIYEV"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "1px" }}>AMAL QILISH</div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#f8fafc" }}>12 / 28</div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(paymentCardNumber, "To'lov kartasi")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "var(--bg-card-sub, #f1f5f9)",
                    border: "1px solid #cbd5e1",
                    color: "var(--text-main, #334155)",
                    cursor: "pointer",
                  }}
                >
                  📋 Karta Raqamini Nusxalash
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 5. SECTION: DO'KON VA CALL CENTER PARAMETRLARI */}
        {(activeTab === "all" || activeTab === "store") && (
          <section className="proPanel" style={{ background: "var(--bg-card, #ffffff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div className="panelHead" style={{ marginBottom: 16 }}>
              <div>
                <span className="proEyebrow" style={{ color: "#be123c", fontWeight: 700, fontSize: 11 }}>STORE & CALL CENTER</span>
                <h2 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>📞 Do'kon va Yetkazib Berish Parametrlari</h2>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  🛍️ Do'kon Nomi (Brand Name)
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 600 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  📞 Call Center Telefon Raqami
                </label>
                <input
                  type="text"
                  value={callCenterPhone}
                  onChange={(e) => setCallCenterPhone(e.target.value)}
                  placeholder="+998 90 581 11 17"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  ⏰ Do'kon Ish Vaqti
                </label>
                <input
                  type="text"
                  value={workHours}
                  onChange={(e) => setWorkHours(e.target.value)}
                  placeholder="09:00 - 21:00"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  🚚 Bepul Yetkazib Berish Chegarasi (so'm)
                </label>
                <input
                  type="number"
                  value={freeDeliveryThreshold}
                  onChange={(e) => setFreeDeliveryThreshold(e.target.value)}
                  placeholder="300000"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  📦 Standart Yetkazish Narxi (so'm)
                </label>
                <input
                  type="number"
                  value={standardDeliveryFee}
                  onChange={(e) => setStandardDeliveryFee(e.target.value)}
                  placeholder="20000"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700 }}
                  required
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  📍 Do'kon Manzili (Do'kondan olib ketish nuqtasi)
                </label>
                <input
                  type="text"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  placeholder="Toshkent sh., Navoiy ko'chasi 14"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 600 }}
                />
              </div>
            </div>
          </section>
        )}

        {/* 6. SECTION: TO'LOV GATEWAYLARI VA TELEGRAM BOT (INTEGRATIONS) */}
        {(activeTab === "all" || activeTab === "integrations") && (
          <section className="proPanel" style={{ background: "var(--bg-card, #ffffff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div className="panelHead" style={{ marginBottom: 16 }}>
              <div>
                <span className="proEyebrow" style={{ color: "#be123c", fontWeight: 700, fontSize: 11 }}>GATEWAYS & TELEGRAM BOT</span>
                <h2 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>⚡ Click, Payme va Telegram Integratsiyalari</h2>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  💳 Click Merchant ID
                </label>
                <input
                  type="text"
                  value={clickMerchantId}
                  onChange={(e) => setClickMerchantId(e.target.value)}
                  placeholder="38102"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "monospace", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  🔹 Payme Merchant ID
                </label>
                <input
                  type="text"
                  value={paymeMerchantId}
                  onChange={(e) => setPaymeMerchantId(e.target.value)}
                  placeholder="64a821901a"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "monospace", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  ✈️ Telegram Kanal Username / Guruh ID
                </label>
                <input
                  type="text"
                  value={telegramChannelId}
                  onChange={(e) => setTelegramChannelId(e.target.value)}
                  placeholder="@guli_official yoki -10012345678"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontWeight: 700 }}
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", display: "block", marginBottom: 4 }}>
                  ✈️ Telegram Bot API Token
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="password"
                    value={telegramBotToken}
                    onChange={(e) => setTelegramBotToken(e.target.value)}
                    placeholder="7182910245:AAH..."
                    style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, fontFamily: "monospace" }}
                  />
                  <button
                    type="button"
                    onClick={handleTestBotToken}
                    disabled={botTestState.loading}
                    style={{
                      padding: "11px 20px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      background: "#0284c7",
                      color: "#ffffff",
                      border: "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {botTestState.loading ? "⏳ Tekshirilmoqda..." : "🤖 Botni Tekshirish"}
                  </button>
                </div>

                {/* Bot Connection Tester Feedback */}
                {botTestState.tested && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 600,
                      background: botTestState.success ? "#ecfdf5" : "#fef2f2",
                      color: botTestState.success ? "#047857" : "#b91c1c",
                      border: `1px solid ${botTestState.success ? "#a7f3d0" : "#fecaca"}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span>{botTestState.success ? "✅" : "❌"}</span>
                    <span>{botTestState.message}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 7. SECTION: TIZIM, KESH VA ZAXIRA (SYSTEM & BACKUP) */}
        {(activeTab === "all" || activeTab === "system") && (
          <section className="proPanel" style={{ background: "var(--bg-card, #ffffff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" }}>
            <div className="panelHead" style={{ marginBottom: 16 }}>
              <div>
                <span className="proEyebrow" style={{ color: "#be123c", fontWeight: 700, fontSize: 11 }}>SYSTEM CACHE & BACKUP</span>
                <h2 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 800 }}>⚙️ Tizim Xotirasi va Qaytarish</h2>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              <div style={{ background: "var(--bg-card-sub, #f8fafc)", padding: 16, borderRadius: 16, border: "1px solid var(--border-color, #e2e8f0)" }}>
                <b style={{ fontSize: 14, color: "var(--text-main, #1e293b)", display: "block", marginBottom: 4 }}>📦 Zaxira Nusxasini Olish (JSON)</b>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Barcha sozlamalarni zaxira shaklida kompyuterga yuklab oling.
                </p>
                <button
                  type="button"
                  onClick={handleExportSettings}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#0f172a",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  📥 JSON Eksport Qilish
                </button>
              </div>

              <div style={{ background: "var(--bg-card-sub, #f8fafc)", padding: 16, borderRadius: 16, border: "1px solid var(--border-color, #e2e8f0)" }}>
                <b style={{ fontSize: 14, color: "var(--text-main, #1e293b)", display: "block", marginBottom: 4 }}>🔄 Dastlabki Holatga Qaytarish</b>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-muted, #64748b)" }}>
                  Barcha sozlamalarni tizim standartlariga tiklang.
                </p>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  ⚠️ Sozlamalarni Qaytarish
                </button>
              </div>
            </div>
          </section>
        )}

        {/* BOTTOM SAVE BAR */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
          <button
            type="submit"
            style={{
              padding: "14px 32px",
              borderRadius: 16,
              fontSize: 15,
              fontWeight: 800,
              background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
              color: "#ffffff",
              border: "none",
              boxShadow: "0 6px 20px rgba(225,29,72,0.35)",
              cursor: "pointer",
            }}
          >
            💾 Barcha Sozlamalarni Saqlash
          </button>
        </div>
      </form>

      {/* CONFIRMATION MODAL FOR RESET */}
      {showResetConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: 28,
              borderRadius: 24,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <span style={{ fontSize: 44, display: "block", marginBottom: 10 }}>⚠️</span>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
              Dastlabki Sozlamalarga Qaytarilsinmi?
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px", lineHeight: 1.5 }}>
              Ushbu amal barcha karta raqamlari, do'kon parametrlari hamda sozlamalarni standart holatga tiklaydi.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Bekor Qilish
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#ef4444",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Ha, Qaytarilsin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
