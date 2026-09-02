import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { type PlatformType } from "../../utils/platformAdapter";
import { getSocialLinks, saveSocialLinks, DEFAULT_SOCIAL_LINKS } from "../../utils/socialLinks";

type AdminSettingsTabProps = {
  notify: (m: string) => void;
  activePlatform?: PlatformType;
  onPlatformChange?: (p: PlatformType) => void;
};

type TelegramChat = {
  chat_id: string;
  title?: string;
  username?: string | null;
  chat_type?: string;
  bot_status?: string;
  can_post_messages?: boolean;
  active?: boolean;
};

const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");

function adminHeaders() {
  const token = sessionStorage.getItem("guli_admin_token") || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export function AdminSettingsTab({ notify, activePlatform = "browser", onPlatformChange }: AdminSettingsTabProps) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("guli_admin_settings") || "{}"); } catch { return {}; }
  })();

  const [activeTab, setActiveTab] = useState<"all" | "appearance" | "social" | "finance" | "store" | "integrations" | "system">("all");
  const [themeMode, setThemeMode] = useState<"light" | "dark">((localStorage.getItem("guli_admin_theme") as "light" | "dark") || "light");
  const [language, setLanguage] = useState<"uz" | "ru" | "en">((localStorage.getItem("guli_lang") as "uz" | "ru" | "en") || "uz");
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(localStorage.getItem("guli_notif_sound_enabled") !== "false");

  // Web App Custom Logo
  const [appLogo, setAppLogo] = useState<string>(localStorage.getItem("guli_custom_logo") || "/guli_logo.jpg");
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // Social Links
  const initialSocial = getSocialLinks();
  const [instagramUrl, setInstagramUrl] = useState(initialSocial.instagram || DEFAULT_SOCIAL_LINKS.instagram);
  const [telegramUrl, setTelegramUrl] = useState(initialSocial.telegram || DEFAULT_SOCIAL_LINKS.telegram);
  const [tiktokUrl, setTiktokUrl] = useState(initialSocial.tiktok || DEFAULT_SOCIAL_LINKS.tiktok);

  const [paymentCardNumber, setPaymentCardNumber] = useState(localStorage.getItem("guli_payment_card_number") || saved.paymentCardNumber || "9860 1766 1229 1557");
  const [paymentCardHolder, setPaymentCardHolder] = useState(localStorage.getItem("guli_payment_card_holder") || saved.paymentCardHolder || "X.Yusufaliyev");
  const [supportCardNumber, setSupportCardNumber] = useState(localStorage.getItem("guli_support_card_number") || saved.supportCardNumber || "9860 1766 1229 1557");
  const [supportCardHolder, setSupportCardHolder] = useState(localStorage.getItem("guli_support_card_holder") || saved.supportCardHolder || "X.Yusufaliyev");

  const [callCenterPhone, setCallCenterPhone] = useState(localStorage.getItem("guli_callcenter_phone") || saved.callCenterPhone || "+998 90 581 11 17");
  const [storeName, setStoreName] = useState(localStorage.getItem("guli_store_name") || saved.storeName || "Guli premium");
  const [workHours, setWorkHours] = useState(saved.workHours || "09:00 - 21:00 (Har kuni)");
  const [storeAddress, setStoreAddress] = useState(saved.storeAddress || "Toshkent sh., Navoiy ko'chasi 14");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState(saved.freeDeliveryThreshold || "300000");
  const [standardDeliveryFee, setStandardDeliveryFee] = useState(saved.standardDeliveryFee || "20000");
  const [clickMerchantId, setClickMerchantId] = useState(saved.clickMerchantId || "38102");
  const [paymeMerchantId, setPaymeMerchantId] = useState(saved.paymeMerchantId || "64a821901a");

  // Telegram secrets are intentionally NOT stored in browser/localStorage.
  const [telegramChannelId, setTelegramChannelId] = useState("");
  const [telegramChats, setTelegramChats] = useState<TelegramChat[]>([]);
  const [botConfigured, setBotConfigured] = useState(false);
  const [botUsername, setBotUsername] = useState("");
  const [botTest, setBotTest] = useState<{ loading: boolean; success: boolean; message: string }>({ loading: false, success: false, message: "" });
  const [telegramLoading, setTelegramLoading] = useState(false);

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatCardDigits = (value: string) => value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

  useEffect(() => {
    let cancelled = false;
    const loadTelegramConfig = async () => {
      const token = sessionStorage.getItem("guli_admin_token");
      if (!token) return;
      setTelegramLoading(true);
      try {
        const response = await fetch(`${API}/api/admin/telegram-config`, { headers: adminHeaders() });
        const json = await response.json().catch(() => null);
        if (!response.ok || !json?.success) throw new Error(json?.message || `Server xatosi (${response.status})`);
        if (cancelled) return;
        const chats = Array.isArray(json.data?.chats) ? json.data.chats : [];
        setTelegramChats(chats);
        setBotConfigured(Boolean(json.data?.botConfigured));
        const primary = chats.find((c: TelegramChat) => c.active !== false);
        if (primary) setTelegramChannelId(primary.chat_id || primary.username ? (primary.username ? `@${primary.username}` : primary.chat_id) : "");
      } catch (error) {
        if (!cancelled) notify(error instanceof Error ? `Telegram sozlamalari: ${error.message}` : "Telegram sozlamalarini yuklashda xatolik");
      } finally {
        if (!cancelled) setTelegramLoading(false);
      }
    };
    loadTelegramConfig();
    return () => { cancelled = true; };
  }, [notify]);

  const toggleTheme = (mode: "light" | "dark") => {
    setThemeMode(mode);
    localStorage.setItem("guli_admin_theme", mode);
    localStorage.setItem("guli_theme", mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.setAttribute("data-theme", mode);
    window.dispatchEvent(new CustomEvent("guli_theme_changed", { detail: mode }));
    window.dispatchEvent(new Event("guli_settings_updated"));
    notify(mode === "dark" ? "🌙 Tun (Dark) rejimi yoqildi" : "☀️ Kun (Light) rejimi yoqildi");
  };

  const changeLanguage = (lang: "uz" | "ru" | "en") => {
    setLanguage(lang);
    localStorage.setItem("guli_lang", lang);
    localStorage.setItem("guli_admin_lang", lang);
    window.dispatchEvent(new CustomEvent("guli_lang_changed", { detail: lang }));
    window.dispatchEvent(new Event("guli_settings_updated"));
    notify(lang === "uz" ? "🇺🇿 O'zbek tili tanlandi" : lang === "ru" ? "🇷🇺 Русский язык выбран" : "🇬🇧 English language selected");
  };

  const toggleSound = (enabled: boolean) => {
    setNotifSoundEnabled(enabled);
    localStorage.setItem("guli_notif_sound_enabled", enabled ? "true" : "false");
    window.dispatchEvent(new Event("guli_settings_updated"));
  };

  const testServerBot = async () => {
    setBotTest({ loading: true, success: false, message: "Serverdagi bot token tekshirilmoqda..." });
    try {
      const response = await fetch(`${API}/api/admin/telegram-config/test`, { headers: adminHeaders() });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) throw new Error(json?.message || `Server xatosi (${response.status})`);
      setBotConfigured(true);
      setBotUsername(json.data?.botUsername || "");
      setBotTest({ loading: false, success: true, message: `Bot faol${json.data?.botUsername ? `: @${json.data.botUsername}` : ""}` });
      notify("✅ Telegram bot server tomonda muvaffaqiyatli tekshirildi");
    } catch (error) {
      setBotTest({ loading: false, success: false, message: error instanceof Error ? error.message : "Botni tekshirishda xatolik" });
      notify("❌ Telegram bot tekshiruvi muvaffaqiyatsiz");
    }
  };

  const saveTelegramChat = async () => {
    const raw = telegramChannelId.trim();
    if (!raw) { notify("⚠️ Kanal/guruh ID kiritilmagan"); return; }
    try {
      const response = await fetch(`${API}/api/admin/telegram-config/chat`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ chatId: raw, title: raw }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success) throw new Error(json?.message || `Server xatosi (${response.status})`);
      setTelegramChats((current) => [json.data, ...current.filter((c) => c.chat_id !== json.data.chat_id)]);
      notify("✅ Kanal/guruh ID serverda global saqlandi");
    } catch (error) {
      notify(error instanceof Error ? `❌ ${error.message}` : "❌ Kanal/guruhni saqlashda xatolik");
    }
  };

  const handleLogoFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify("⚠️ Rasm hajmi 3MB dan oshmasligi kerak");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setAppLogo(result);
      notify("🖼️ Yangi logo yuklandi! 'Saqlash' tugmasini bosing.");
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = () => {
    setAppLogo("/guli_logo.jpg");
    notify("🔄 Standart logotip tiklandi");
  };

  const handleSaveAllSettings = async (event?: FormEvent) => {
    event?.preventDefault();
    try {
      const settingsObj = {
        storeName: storeName.trim(), workHours: workHours.trim(), storeAddress: storeAddress.trim(),
        callCenterPhone: callCenterPhone.trim(), freeDeliveryThreshold: freeDeliveryThreshold.trim(),
        standardDeliveryFee: standardDeliveryFee.trim(), clickMerchantId: clickMerchantId.trim(),
        paymeMerchantId: paymeMerchantId.trim(), paymentCardNumber: paymentCardNumber.trim(),
        paymentCardHolder: paymentCardHolder.trim(), supportCardNumber: supportCardNumber.trim(),
        supportCardHolder: supportCardHolder.trim(), updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("guli_admin_theme", themeMode);
      localStorage.setItem("guli_lang", language);
      localStorage.setItem("guli_notif_sound_enabled", notifSoundEnabled ? "true" : "false");
      localStorage.setItem("guli_payment_card_number", paymentCardNumber.trim());
      localStorage.setItem("guli_payment_card_holder", paymentCardHolder.trim());
      localStorage.setItem("guli_support_card_number", supportCardNumber.trim());
      localStorage.setItem("guli_support_card_holder", supportCardHolder.trim());
      localStorage.setItem("guli_callcenter_phone", callCenterPhone.trim());
      localStorage.setItem("guli_admin_settings", JSON.stringify(settingsObj));
      
      // Save Logo & Social Links
      localStorage.setItem("guli_custom_logo", appLogo.trim() || "/guli_logo.jpg");
      localStorage.setItem("guli_store_name", storeName.trim() || "Guli premium");
      localStorage.setItem("guli_custom_brand_name", storeName.trim() || "Guli premium");
      saveSocialLinks({
        instagram: instagramUrl.trim(),
        telegram: telegramUrl.trim(),
        tiktok: tiktokUrl.trim(),
      });

      if (telegramChannelId.trim()) await saveTelegramChat();
      window.dispatchEvent(new CustomEvent("guli_logo_updated", { detail: appLogo.trim() || "/guli_logo.jpg" }));
      window.dispatchEvent(new CustomEvent("guli_brand_name_updated", { detail: storeName.trim() || "Guli premium" }));
      window.dispatchEvent(new Event("guli_settings_updated"));
      notify("✅ Barcha sozlamalar, logotip va ijtimoiy tarmoqlar saqlandi!");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sozlamalarni saqlashda xatolik");
    }
  };

  const handleExportSettings = () => {
    const exportData = {
      themeMode, language, notifSoundEnabled, appLogo,
      socialLinks: { instagram: instagramUrl, telegram: telegramUrl, tiktok: tiktokUrl },
      paymentCardNumber, paymentCardHolder, supportCardNumber, supportCardHolder,
      callCenterPhone, storeName, workHours, storeAddress, freeDeliveryThreshold,
      standardDeliveryFee, clickMerchantId, paymeMerchantId, telegramChannelId,
      exportedAt: new Date().toISOString(),
      telegramBotToken: "[SERVER_ONLY — export qilinmaydi]",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `guli-settings-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    notify("📥 Xavfsiz settings backup yaratildi — bot token kiritilmadi.");
  };

  const handleImportSettings = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || "{}"));
        if (parsed.themeMode) setThemeMode(parsed.themeMode);
        if (parsed.language) setLanguage(parsed.language);
        if (typeof parsed.notifSoundEnabled === "boolean") setNotifSoundEnabled(parsed.notifSoundEnabled);
        if (parsed.appLogo) setAppLogo(parsed.appLogo);
        if (parsed.socialLinks) {
          if (parsed.socialLinks.instagram) setInstagramUrl(parsed.socialLinks.instagram);
          if (parsed.socialLinks.telegram) setTelegramUrl(parsed.socialLinks.telegram);
          if (parsed.socialLinks.tiktok) setTiktokUrl(parsed.socialLinks.tiktok);
        }
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
        if (parsed.telegramChannelId) setTelegramChannelId(parsed.telegramChannelId);
        notify("📤 Sozlamalar yuklandi. Bot token import qilinmaydi.");
      } catch { notify("❌ JSON faylini o'qishda xatolik"); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetSettings = () => {
    setThemeMode("light"); setLanguage("uz"); setNotifSoundEnabled(true);
    setAppLogo("/guli_logo.jpg");
    setInstagramUrl(DEFAULT_SOCIAL_LINKS.instagram);
    setTelegramUrl(DEFAULT_SOCIAL_LINKS.telegram);
    setTiktokUrl(DEFAULT_SOCIAL_LINKS.tiktok);
    localStorage.removeItem("guli_custom_logo");
    saveSocialLinks(DEFAULT_SOCIAL_LINKS);
    setPaymentCardNumber("9860 1766 1229 1557"); setPaymentCardHolder("X.Yusufaliyev");
    setSupportCardNumber("9860 1766 1229 1557"); setSupportCardHolder("X.Yusufaliyev");
    setCallCenterPhone("+998 90 581 11 17"); setStoreName("Guli Lingerie");
    setWorkHours("09:00 - 21:00 (Har kuni)"); setStoreAddress("Toshkent sh., Navoiy ko'chasi 14");
    setFreeDeliveryThreshold("300000"); setStandardDeliveryFee("20000");
    setClickMerchantId("38102"); setPaymeMerchantId("64a821901a"); setTelegramChannelId("");
    setShowResetConfirm(false); notify("Sozlamalar dastlabki holatga qaytarildi");
  };

  const tabs = [
    ["all", "📋 Barchasi"],
    ["appearance", "🎨 Tashqi Ko'rinish & Logo"],
    ["social", "🌐 Ijtimoiy Tarmoqlar"],
    ["finance", "💳 Moliya"],
    ["store", "📞 Do'kon & Aloqa"],
    ["integrations", "⚡ Integratsiyalar"],
    ["system", "⚙️ Tizim & Zaxira"],
  ] as const;

  const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
  const sectionStyle: React.CSSProperties = { background: "var(--bg-card, #fff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" };

  return (
    <div className="dash" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="proPanel" style={{ background: "linear-gradient(135deg,#1e0f18,#541d2e)", color: "#fff", padding: "24px 28px", borderRadius: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#fca5a5" }}>GULI PRO CONTROL CENTER</span><h1 style={{ margin: "6px 0 0", fontSize: 26 }}>⚙️ Tizim va Ilova Sozlamalari</h1><p style={{ margin: "6px 0 0", color: "#f3d2dc", fontSize: 13 }}>Telegram, to'lov, do'kon va interfeys sozlamalarini xavfsiz boshqaring.</p></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handleExportSettings} style={{ padding: "10px 16px", borderRadius: 12, fontWeight: 700 }}>📥 Eksport</button>
            <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "10px 16px", borderRadius: 12, fontWeight: 700 }}>📤 Import</button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportSettings} style={{ display: "none" }} />
            <button type="button" onClick={() => handleSaveAllSettings()} style={{ padding: "11px 18px", borderRadius: 12, fontWeight: 800 }}>💾 Saqlash</button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} style={{ padding: "10px 16px", borderRadius: 14, whiteSpace: "nowrap", fontWeight: 700, border: activeTab === id ? "2px solid #be123c" : "1px solid #e2e8f0", background: activeTab === id ? "#fcecef" : "#fff", color: activeTab === id ? "#be123c" : "#334155" }}>{label}</button>)}
      </div>

      <form onSubmit={handleSaveAllSettings} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {(activeTab === "all" || activeTab === "appearance") && (
          <section style={sectionStyle}>
            <h2>🎨 Tashqi Ko'rinish, Logo va Ovoz</h2>
            
            {/* Logo Configuration */}
            <div style={{ marginTop: 14, marginBottom: 20, padding: 18, borderRadius: 16, background: "var(--bg-card-sub, #f8fafc)", border: "1px solid var(--border-color, #e2e8f0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>🖼️</span>
                <div>
                  <b style={{ fontSize: 15, display: "block" }}>Web App Logotipi</b>
                  <small style={{ color: "#64748b" }}>Mijoz web ilovasi tepasidagi va boshqa bo'limlaridagi do'kon logotipini o'zgartirish</small>
                </div>
              </div>

              <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "3px solid #be123c", boxShadow: "0 4px 14px rgba(190,18,60,0.2)", background: "#fff", display: "grid", placeItems: "center" }}>
                    <img src={appLogo} alt="Logo preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/guli_logo.jpg"; }} />
                  </div>
                  <small style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>Aylana ko'rinish</small>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 16, overflow: "hidden", border: "2px solid #cbd5e1", background: "#fff", display: "grid", placeItems: "center" }}>
                    <img src={appLogo} alt="Logo preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/guli_logo.jpg"; }} />
                  </div>
                  <small style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>Kvadrat ko'rinish</small>
                </div>

                <div style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>Rasm URL manzili:</span>
                    <input
                      style={inputStyle}
                      value={appLogo}
                      onChange={(e) => setAppLogo(e.target.value)}
                      placeholder="https://example.com/logo.png yoki /guli_logo.jpg"
                    />
                  </label>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      style={{ padding: "8px 14px", borderRadius: 10, background: "#be123c", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}
                    >
                      📁 Fayldan yuklash
                    </button>
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoFileChange}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      style={{ padding: "8px 14px", borderRadius: 10, background: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 13, border: "1px solid #cbd5e1", cursor: "pointer" }}
                    >
                      🔄 Standart logoni tiklash
                    </button>
                  </div>
                </div>
              </div>

              {/* Do'kon nomini tahrirlash qatori (Guli premium) */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--border-color, #cbd5e1)" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main, #334155)", display: "flex", alignItems: "center", gap: 8 }}>
                    🏪 Do'kon / Brend nomi (Hozirgi: <b style={{ color: "#be123c" }}>{storeName}</b>):
                  </span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      style={{ ...inputStyle, flex: "1 1 260px" }}
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="Guli premium"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setStoreName("Guli premium");
                        notify("Nom standart 'Guli premium' ga tiklandi");
                      }}
                      style={{ padding: "9px 15px", borderRadius: 10, background: "#f1f5f9", color: "#475569", fontWeight: 700, fontSize: 13, border: "1px solid #cbd5e1", cursor: "pointer" }}
                    >
                      🔄 Standart nom ("Guli premium")
                    </button>
                  </div>
                  <small style={{ color: "#64748b", fontSize: 11.5 }}>
                    Ushbu nom mijoz web app yuqori qismida, sahifalar boshida va do'kon identifikatorlarida to'liq aks etadi.
                  </small>
                </label>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
              <div>
                <b style={{ color: "var(--text-main, #0f172a)" }}>🌗 Kun / Tun (Dark / Light)</b>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => toggleTheme("light")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: themeMode === "light" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: themeMode === "light" ? "#fcecef" : "var(--bg-main, #fff)",
                      color: themeMode === "light" ? "#be123c" : "var(--text-main, #334155)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    ☀️ Kun (Light)
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleTheme("dark")}
                    style={{
                      padding: "9px 18px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: themeMode === "dark" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: themeMode === "dark" ? "#381e28" : "var(--bg-main, #fff)",
                      color: themeMode === "dark" ? "#fb7185" : "var(--text-main, #334155)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    🌙 Tun (Dark)
                  </button>
                </div>
              </div>

              <div>
                <b style={{ color: "var(--text-main, #0f172a)" }}>🌐 Til (Tilni tanlash)</b>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => changeLanguage("uz")}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: language === "uz" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: language === "uz" ? "#fcecef" : "var(--bg-main, #fff)",
                      color: language === "uz" ? "#be123c" : "var(--text-main, #334155)",
                      cursor: "pointer",
                    }}
                  >
                    🇺🇿 O'zbek
                  </button>
                  <button
                    type="button"
                    onClick={() => changeLanguage("ru")}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: language === "ru" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: language === "ru" ? "#fcecef" : "var(--bg-main, #fff)",
                      color: language === "ru" ? "#be123c" : "var(--text-main, #334155)",
                      cursor: "pointer",
                    }}
                  >
                    🇷🇺 Русский
                  </button>
                  <button
                    type="button"
                    onClick={() => changeLanguage("en")}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: language === "en" ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: language === "en" ? "#fcecef" : "var(--bg-main, #fff)",
                      color: language === "en" ? "#be123c" : "var(--text-main, #334155)",
                      cursor: "pointer",
                    }}
                  >
                    🇬🇧 English
                  </button>
                </div>
              </div>

              <div>
                <b style={{ color: "var(--text-main, #0f172a)" }}>🔔 Chat bildirishnoma ovozi</b>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => toggleSound(true)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: notifSoundEnabled ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: notifSoundEnabled ? "#fcecef" : "var(--bg-main, #fff)",
                      color: notifSoundEnabled ? "#be123c" : "var(--text-main, #334155)",
                      cursor: "pointer",
                    }}
                  >
                    🔊 Yoqilgan
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSound(false)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: 12,
                      fontWeight: 700,
                      fontSize: 13,
                      border: !notifSoundEnabled ? "2px solid #be123c" : "1px solid #cbd5e1",
                      background: !notifSoundEnabled ? "#fcecef" : "var(--bg-main, #fff)",
                      color: !notifSoundEnabled ? "#be123c" : "var(--text-main, #334155)",
                      cursor: "pointer",
                    }}
                  >
                    🔇 O'chirilgan
                  </button>
                </div>
              </div>
            </div>
            
            <div style={{ marginTop: 18 }}><b>📱 Qurilma preview</b><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>{["android","telegram","windows","tv","browser"].map((p) => <button key={p} type="button" onClick={() => onPlatformChange?.(p as PlatformType)}>{p === activePlatform ? "✓ " : ""}{p}</button>)}</div></div>
          </section>
        )}

        {(activeTab === "all" || activeTab === "social") && (
          <section style={sectionStyle}>
            <h2>🌐 RASMIY SAHIFALARIMIZ (Ijtimoiy Tarmoqlar)</h2>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 2, marginBottom: 16 }}>
              Mijoz web app dagi "Ijtimoiy tarmoqlar" oynasida chiqadigan Instagram, Telegram va TikTok rasmiy sahifalar havolalarini sozlang.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#e1306c" }}>📸</span> Instagram URL
                </b>
                <input
                  style={inputStyle}
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/guli_lingerie"
                  required
                />
                <small style={{ color: "#64748b", fontSize: 11.5 }}>
                  Do'konning rasmiy Instagram profili havolasi
                </small>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#229ed9" }}>✈️</span> Telegram URL
                </b>
                <input
                  style={inputStyle}
                  type="url"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  placeholder="https://t.me/guli_lingerie_official"
                  required
                />
                <small style={{ color: "#64748b", fontSize: 11.5 }}>
                  Do'konning rasmiy Telegram kanali yoki boti havolasi
                </small>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <b style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🎵</span> TikTok URL
                </b>
                <input
                  style={inputStyle}
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@guli_lingerie"
                  required
                />
                <small style={{ color: "#64748b", fontSize: 11.5 }}>
                  Do'konning rasmiy TikTok profili havolasi
                </small>
              </label>
            </div>
          </section>
        )}

        {(activeTab === "all" || activeTab === "finance") && <section style={sectionStyle}><h2>💳 To'lov va Support Kartalari</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <label>Checkout karta<input style={inputStyle} value={paymentCardNumber} onChange={(e) => setPaymentCardNumber(formatCardDigits(e.target.value))} /></label>
          <label>Karta egasi<input style={inputStyle} value={paymentCardHolder} onChange={(e) => setPaymentCardHolder(e.target.value)} /></label>
          <label>Support karta<input style={inputStyle} value={supportCardNumber} onChange={(e) => setSupportCardNumber(formatCardDigits(e.target.value))} /></label>
          <label>Support karta egasi<input style={inputStyle} value={supportCardHolder} onChange={(e) => setSupportCardHolder(e.target.value)} /></label>
        </div></section>}

        {(activeTab === "all" || activeTab === "store") && <section style={sectionStyle}><h2>📞 Do'kon va Yetkazib Berish</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          <label>Do'kon nomi<input style={inputStyle} value={storeName} onChange={(e) => setStoreName(e.target.value)} /></label>
          <label>Call Center<input style={inputStyle} value={callCenterPhone} onChange={(e) => setCallCenterPhone(e.target.value)} /></label>
          <label>Ish vaqti<input style={inputStyle} value={workHours} onChange={(e) => setWorkHours(e.target.value)} /></label>
          <label>Bepul yetkazish chegarasi<input type="number" style={inputStyle} value={freeDeliveryThreshold} onChange={(e) => setFreeDeliveryThreshold(e.target.value)} /></label>
          <label>Standart yetkazish<input type="number" style={inputStyle} value={standardDeliveryFee} onChange={(e) => setStandardDeliveryFee(e.target.value)} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Do'kon manzili<input style={inputStyle} value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} /></label>
        </div></section>}

        {(activeTab === "all" || activeTab === "integrations") && <section style={sectionStyle}><h2>⚡ Click, Payme va Telegram</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          <label>Click Merchant ID<input style={inputStyle} value={clickMerchantId} onChange={(e) => setClickMerchantId(e.target.value)} /></label>
          <label>Payme Merchant ID<input style={inputStyle} value={paymeMerchantId} onChange={(e) => setPaymeMerchantId(e.target.value)} /></label>
          <div style={{ gridColumn: "1 / -1", padding: 16, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <b>🔐 Telegram Bot Token</b><p style={{ margin: "6px 0 12px", fontSize: 12, color: "#64748b" }}>Bot token endi brauzerda saqlanmaydi. U faqat Render Environment Variable: <code>TELEGRAM_BOT_TOKEN</code> orqali ishlaydi.</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 800, color: botConfigured ? "#047857" : "#b91c1c" }}>{botConfigured ? "🟢 Server bot sozlangan" : "🔴 Server bot tokeni sozlanmagan"}</span>{botUsername && <span>@{botUsername}</span>}<button type="button" onClick={testServerBot} disabled={botTest.loading}>{botTest.loading ? "⏳ Tekshirilmoqda" : "🤖 Botni tekshirish"}</button></div>
            {botTest.message && <div style={{ marginTop: 10, color: botTest.success ? "#047857" : "#b91c1c", fontWeight: 700 }}>{botTest.success ? "✅ " : "❌ "}{botTest.message}</div>}
          </div>
          <div style={{ gridColumn: "1 / -1" }}><label>📣 Asosiy Telegram kanal/guruh ID yoki username<input style={inputStyle} value={telegramChannelId} onChange={(e) => setTelegramChannelId(e.target.value)} placeholder="@guli_official yoki -1001234567890" /></label><button type="button" onClick={saveTelegramChat} disabled={telegramLoading} style={{ marginTop: 10 }}>🌐 Serverga global saqlash</button></div>
          <div style={{ gridColumn: "1 / -1" }}><b>📡 Ro'yxatdan o'tgan Telegram chatlar</b><div style={{ marginTop: 8, display: "grid", gap: 8 }}>{telegramChats.length ? telegramChats.map((chat) => <div key={chat.chat_id} style={{ padding: 10, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}><b>{chat.title || chat.chat_id}</b> — <code>{chat.chat_id}</code> <span style={{ color: chat.can_post_messages === false ? "#b91c1c" : "#047857" }}>{chat.can_post_messages === false ? "❌ post yo'q" : "✅ post mumkin"}</span></div>) : <span style={{ color: "#64748b" }}>Hali chat registry yo'q.</span>}</div></div>
        </div></section>}

        {(activeTab === "all" || activeTab === "system") && <section style={sectionStyle}><h2>⚙️ Tizim va Zaxira</h2><p style={{ color: "#64748b", fontSize: 13 }}>JSON backup ichiga bot token kiritilmaydi. Tokenni faqat Render Environment Variables boshqaradi.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={handleExportSettings}>📥 Xavfsiz JSON eksport</button><button type="button" onClick={() => fileInputRef.current?.click()}>📤 Import</button><button type="button" onClick={() => setShowResetConfirm(true)}>⚠️ Reset</button></div></section>}

        <div style={{ display: "flex", justifyContent: "flex-end" }}><button type="submit" style={{ padding: "14px 30px", borderRadius: 16, fontWeight: 800 }}>💾 Barcha sozlamalarni saqlash</button></div>
      </form>

      {showResetConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 99999, display: "grid", placeItems: "center", padding: 20 }}><div style={{ background: "#fff", padding: 28, borderRadius: 20, maxWidth: 420, width: "100%" }}><h3>⚠️ Dastlabki holatga qaytarilsinmi?</h3><p>Barcha lokal admin sozlamalari standart qiymatlarga qaytadi. Telegram bot tokeni serverda qoladi.</p><div style={{ display: "flex", gap: 10 }}><button type="button" onClick={() => setShowResetConfirm(false)}>Bekor qilish</button><button type="button" onClick={resetSettings}>Ha, qaytarish</button></div></div></div>}
    </div>
  );
}
