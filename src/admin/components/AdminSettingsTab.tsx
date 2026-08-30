import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import { type PlatformType } from "../../utils/platformAdapter";

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

// Production backend is the Render web service. Keep a compatibility guard so an
// older Vercel VITE_API_URL pointing at the retired *-api service cannot produce 404s.
const configuredApi = String(import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
const API = configuredApi && !configuredApi.includes("guli-lingerie-api.onrender.com")
  ? configuredApi
  : "https://guli-lingerie-web.onrender.com";

function adminHeaders() {
  const token = sessionStorage.getItem("guli_admin_token") || "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export function AdminSettingsTab({ notify, activePlatform = "browser", onPlatformChange }: AdminSettingsTabProps) {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("guli_admin_settings") || "{}"); } catch { return {}; }
  })();

  const [activeTab, setActiveTab] = useState<"all" | "appearance" | "finance" | "store" | "integrations" | "system">("all");
  const [themeMode, setThemeMode] = useState<"light" | "dark">((localStorage.getItem("guli_admin_theme") as "light" | "dark") || "light");
  const [language, setLanguage] = useState<"uz" | "ru" | "en">((localStorage.getItem("guli_lang") as "uz" | "ru" | "en") || "uz");
  const [notifSoundEnabled, setNotifSoundEnabled] = useState(localStorage.getItem("guli_notif_sound_enabled") !== "false");

  const [paymentCardNumber, setPaymentCardNumber] = useState(localStorage.getItem("guli_payment_card_number") || saved.paymentCardNumber || "9860 1766 1229 1557");
  const [paymentCardHolder, setPaymentCardHolder] = useState(localStorage.getItem("guli_payment_card_holder") || saved.paymentCardHolder || "X.Yusufaliyev");
  const [supportCardNumber, setSupportCardNumber] = useState(localStorage.getItem("guli_support_card_number") || saved.supportCardNumber || "9860 1766 1229 1557");
  const [supportCardHolder, setSupportCardHolder] = useState(localStorage.getItem("guli_support_card_holder") || saved.supportCardHolder || "X.Yusufaliyev");

  const [callCenterPhone, setCallCenterPhone] = useState(localStorage.getItem("guli_callcenter_phone") || saved.callCenterPhone || "+998 90 581 11 17");
  const [storeName, setStoreName] = useState(saved.storeName || "Guli Lingerie");
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
        if (primary) setTelegramChannelId(primary.username ? `@${primary.username}` : primary.chat_id || "");
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
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.setAttribute("data-theme", mode);
    window.dispatchEvent(new Event("guli_settings_updated"));
  };

  const changeLanguage = (lang: "uz" | "ru" | "en") => {
    setLanguage(lang);
    localStorage.setItem("guli_lang", lang);
    window.dispatchEvent(new Event("guli_settings_updated"));
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
      if (telegramChannelId.trim()) await saveTelegramChat();
      window.dispatchEvent(new Event("guli_settings_updated"));
      notify("✅ Sozlamalar saqlandi. Telegram token esa faqat Render serverida saqlanadi.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sozlamalarni saqlashda xatolik");
    }
  };

  const handleExportSettings = () => {
    const exportData = {
      themeMode, language, notifSoundEnabled, paymentCardNumber, paymentCardHolder,
      supportCardNumber, supportCardHolder, callCenterPhone, storeName, workHours,
      storeAddress, freeDeliveryThreshold, standardDeliveryFee, clickMerchantId,
      paymeMerchantId, telegramChannelId, exportedAt: new Date().toISOString(),
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
    setPaymentCardNumber("9860 1766 1229 1557"); setPaymentCardHolder("X.Yusufaliyev");
    setSupportCardNumber("9860 1766 1229 1557"); setSupportCardHolder("X.Yusufaliyev");
    setCallCenterPhone("+998 90 581 11 17"); setStoreName("Guli Lingerie");
    setWorkHours("09:00 - 21:00 (Har kuni)"); setStoreAddress("Toshkent sh., Navoiy ko'chasi 14");
    setFreeDeliveryThreshold("300000"); setStandardDeliveryFee("20000");
    setClickMerchantId("38102"); setPaymeMerchantId("64a821901a"); setTelegramChannelId("");
    setShowResetConfirm(false); notify("Sozlamalar dastlabki holatga qaytarildi");
  };

  const tabs = [
    ["all", "📋 Barchasi"], ["appearance", "🎨 Tashqi Ko'rinish"], ["finance", "💳 Moliya"],
    ["store", "📞 Do'kon & Aloqa"], ["integrations", "⚡ Integratsiyalar"], ["system", "⚙️ Tizim & Zaxira"],
  ] as const;

  const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box" };
  const sectionStyle: React.CSSProperties = { background: "var(--bg-card, #fff)", padding: 22, borderRadius: 20, border: "1px solid var(--border-color, #e2e8f0)" };

  return (
    <div className="dash" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="proPanel" style={{ background: "linear-gradient(135deg,#1e0f18,#541d2e)", color: "#fff", padding: "24px 28px", borderRadius: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: "#fca5a5" }}>GULI PRO CONTROL CENTER</span><h1 style={{ margin: "6px 0 0", fontSize: 26 }}>⚙️ Tizim va Ilova Sozlamalari</h1><p style={{ margin: "6px 0 0", opacity: 0.8 }}>Telegram, to'lov, do'kon va interfeys sozlamalarini xavfsiz boshqaring.</p></div>
          <div style={{ display: "flex", gap: 10 }}><button type="button" onClick={handleExportSettings}>📤 Eksport</button><button type="button" onClick={() => fileInputRef.current?.click()}>📥 Import</button><button type="button" onClick={handleSaveAllSettings}>💾 Saqlash</button><input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportSettings} style={{ display: "none" }} /></div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>{tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setActiveTab(id)} style={{ padding: "10px 16px", borderRadius: 14, border: activeTab === id ? "2px solid #b11d4a" : "1px solid #e2e8f0", background: activeTab === id ? "#fff0f4" : "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{label}</button>)}</div>

      {(activeTab === "all" || activeTab === "appearance") && <section style={sectionStyle}><h2>🎨 Tashqi Ko'rinish</h2><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={() => toggleTheme("light")}>☀️ Kun</button><button type="button" onClick={() => toggleTheme("dark")}>🌙 Tun</button><select value={language} onChange={(e) => changeLanguage(e.target.value as "uz" | "ru" | "en")}><option value="uz">🇺🇿 O'zbekcha</option><option value="ru">🇷🇺 Русский</option><option value="en">🇬🇧 English</option></select><label><input type="checkbox" checked={notifSoundEnabled} onChange={(e) => toggleSound(e.target.checked)} /> 🔔 Ovoz</label></div></section>}

      {(activeTab === "all" || activeTab === "finance") && <section style={sectionStyle}><h2>💳 To'lov va Support Kartalari</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}><label>Checkout karta<input style={inputStyle} value={paymentCardNumber} onChange={(e) => setPaymentCardNumber(formatCardDigits(e.target.value))} /></label><label>Karta egasi<input style={inputStyle} value={paymentCardHolder} onChange={(e) => setPaymentCardHolder(e.target.value)} /></label><label>Support karta<input style={inputStyle} value={supportCardNumber} onChange={(e) => setSupportCardNumber(formatCardDigits(e.target.value))} /></label><label>Support karta egasi<input style={inputStyle} value={supportCardHolder} onChange={(e) => setSupportCardHolder(e.target.value)} /></label></div></section>}

      {(activeTab === "all" || activeTab === "store") && <section style={sectionStyle}><h2>📞 Do'kon va Yetkazib Berish</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}><label>Do'kon nomi<input style={inputStyle} value={storeName} onChange={(e) => setStoreName(e.target.value)} /></label><label>Call Center<input style={inputStyle} value={callCenterPhone} onChange={(e) => setCallCenterPhone(e.target.value)} /></label><label>Ish vaqti<input style={inputStyle} value={workHours} onChange={(e) => setWorkHours(e.target.value)} /></label><label>Bepul yetkazish chegarasi<input style={inputStyle} value={freeDeliveryThreshold} onChange={(e) => setFreeDeliveryThreshold(e.target.value)} /></label><label>Standart yetkazish<input style={inputStyle} value={standardDeliveryFee} onChange={(e) => setStandardDeliveryFee(e.target.value)} /></label><label>Do'kon manzili<input style={inputStyle} value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} /></label></div></section>}

      {(activeTab === "all" || activeTab === "integrations") && <section style={sectionStyle}><h2>⚡ Click, Payme va Telegram</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}><label>Click Merchant ID<input style={inputStyle} value={clickMerchantId} onChange={(e) => setClickMerchantId(e.target.value)} /></label><label>Payme Merchant ID<input style={inputStyle} value={paymeMerchantId} onChange={(e) => setPaymeMerchantId(e.target.value)} /></label></div><div style={{ marginTop: 18, padding: 18, borderRadius: 16, background: "#f8fafc", border: "1px solid #e2e8f0" }}><h3>🔐 Telegram Bot Token</h3><p style={{ color: "#64748b" }}>Bot token brauzerda saqlanmaydi. U faqat Render Environment Variable: <b>TELEGRAM_BOT_TOKEN</b> orqali ishlaydi.</p><div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><strong style={{ color: botConfigured ? "#15803d" : "#b91c1c" }}>{botConfigured ? "🟢 Server bot tokeni sozlangan" : "🔴 Server bot tokeni sozlanmagan"}</strong><button type="button" onClick={testServerBot} disabled={botTest.loading}>{botTest.loading ? "Tekshirilmoqda..." : "🤖 Botni tekshirish"}</button>{botUsername && <span>@{botUsername}</span>}</div>{botTest.message && <div style={{ marginTop: 10 }}>{botTest.success ? "✅ " : "❌ "}{botTest.message}</div>}<hr style={{ margin: "18px 0", border: 0, borderTop: "1px solid #e2e8f0" }} /><label>📢 Asosiy Telegram kanal/guruh ID yoki username<input style={inputStyle} value={telegramChannelId} onChange={(e) => setTelegramChannelId(e.target.value)} placeholder="@guli_official yoki -1001234567890" /></label><button type="button" onClick={saveTelegramChat} disabled={telegramLoading} style={{ marginTop: 12 }}>🌐 Serverga global saqlash</button>{telegramChats.length > 0 ? <div style={{ marginTop: 16 }}><b>📡 Ro'yxatdan o'tgan Telegram chatlar</b>{telegramChats.map((chat) => <div key={chat.chat_id} style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#fff", border: "1px solid #e2e8f0" }}>{chat.title || chat.chat_id} — {chat.bot_status || "unknown"}</div>)}</div> : <div style={{ marginTop: 16, color: "#64748b" }}>Hali chat registri yo'q.</div>}</div></section>}

      {(activeTab === "all" || activeTab === "system") && <section style={sectionStyle}><h2>⚙️ Tizim va Zaxira</h2><p style={{ color: "#64748b" }}>JSON backup ichiga bot token kiritilmaydi. Tokenni faqat Render Environment Variables boshqaradi.</p><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" onClick={handleExportSettings}>📤 Xavfsiz JSON eksport</button><button type="button" onClick={() => fileInputRef.current?.click()}>📥 Import</button><button type="button" onClick={() => setShowResetConfirm(true)}>⚠️ Reset</button></div></section>}

      <div style={{ display: "flex", justifyContent: "center" }}><button type="button" onClick={handleSaveAllSettings} style={{ padding: "14px 26px", borderRadius: 16, fontWeight: 800 }}>💾 Barcha sozlamalarni saqlash</button></div>
      {showResetConfirm && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 1000 }}><div style={{ background: "#fff", padding: 24, borderRadius: 18, maxWidth: 360 }}><h3>Sozlamalarni reset qilasizmi?</h3><p>Faqat browserdagi sozlamalar boshlang'ich holatga qaytadi.</p><div style={{ display: "flex", gap: 10 }}><button type="button" onClick={resetSettings}>Ha, reset</button><button type="button" onClick={() => setShowResetConfirm(false)}>Bekor</button></div></div></div>}
    </div>
  );
}
