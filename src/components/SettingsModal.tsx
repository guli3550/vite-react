import { useState, useEffect } from "react";
import { type Language, getTranslation, TranslationKey } from "../utils/translations";
import { type Currency } from "../utils/currency";
import { playTapSound, triggerHaptic } from "../utils/soundEffects";

type SettingsModalProps = {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  currency: Currency;
  onCurrencyChange: (curr: Currency) => void;
  hapticsEnabled: boolean;
  onHapticsToggle: (enabled: boolean) => void;
  density: "normal" | "compact" | "large";
  onDensityChange: (density: "normal" | "compact" | "large") => void;
  orderAlerts: boolean;
  onOrderAlertsToggle: (enabled: boolean) => void;
  promoAlerts: boolean;
  onPromoAlertsToggle: (enabled: boolean) => void;
  onClose: () => void;
  onClearCache: () => void;
  onResetSettings: () => void;
};

export function SettingsModal({
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  currency,
  onCurrencyChange,
  hapticsEnabled,
  onHapticsToggle,
  density,
  onDensityChange,
  orderAlerts,
  onOrderAlertsToggle,
  promoAlerts,
  onPromoAlertsToggle,
  onClose,
  onClearCache,
  onResetSettings,
}: SettingsModalProps) {
  const t = (key: TranslationKey) => getTranslation(key, language);

  const [cacheSizeKB, setCacheSizeKB] = useState<string>("16.4 KB");

  useEffect(() => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalBytes += (key.length + (localStorage.getItem(key) || "").length) * 2;
        }
      }
      setCacheSizeKB(`${(totalBytes / 1024).toFixed(1)} KB`);
    } catch {
      setCacheSizeKB("18 KB");
    }
  }, []);

  const handleSoundHapticClick = () => {
    playTapSound(hapticsEnabled);
    triggerHaptic(hapticsEnabled, "light");
  };

  return (
    <div className="modalShade" onMouseDown={onClose} id="settings-modal-overlay">
      <div
        className="settingsModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="settings-modal-card"
        style={{
          maxWidth: "520px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div className="modalHead" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)" }}>
          <div>
            <span className="proEyebrow" style={{ color: "var(--primary)", fontWeight: 700, letterSpacing: "1px" }}>
              {t("settings")}
            </span>
            <h2 style={{ fontSize: "20px", margin: "4px 0 0 0", fontWeight: 800 }}>
              {t("settings_title")}
            </h2>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={() => {
              handleSoundHapticClick();
              onClose();
            }}
            aria-label={t("close")}
            id="settings-close-btn"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid var(--border-color)",
              background: "var(--bg-card-sub)",
              color: "var(--text-main)",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div
          className="settingsBody"
          style={{
            padding: "16px 16px 24px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            boxSizing: "border-box",
            width: "100%",
          }}
        >
          {/* 1. Theme Section (Kun / Tun rejimini takomillashtirish) */}
          <section className="settingsSection" style={{ margin: 0, width: "100%", boxSizing: "border-box" }}>
            <div className="settingsSectionHeader" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span className="settingsIcon" style={{ fontSize: "20px" }}>🌓</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 750 }}>{t("theme_setting")}</h3>
                <small style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>{t("theme_desc")}</small>
              </div>
            </div>

            <div className="themeToggleGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))", gap: "10px", width: "100%", boxSizing: "border-box" }}>
              <button
                type="button"
                className={`themeChoiceBtn ${theme === "light" ? "active" : ""}`}
                onClick={() => {
                  onThemeChange("light");
                  handleSoundHapticClick();
                }}
                id="theme-btn-light"
                style={{
                  padding: "12px 14px",
                  borderRadius: "16px",
                  border: theme === "light" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: theme === "light" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>☀️</span>
                  <b style={{ fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("theme_light")}</b>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: 800, flexShrink: 0 }}>{theme === "light" ? "✓" : ""}</span>
              </button>

              <button
                type="button"
                className={`themeChoiceBtn ${theme === "dark" ? "active" : ""}`}
                onClick={() => {
                  onThemeChange("dark");
                  handleSoundHapticClick();
                }}
                id="theme-btn-dark"
                style={{
                  padding: "12px 14px",
                  borderRadius: "16px",
                  border: theme === "dark" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: theme === "dark" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, overflow: "hidden" }}>
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>🌙</span>
                  <b style={{ fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("theme_dark")}</b>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: 800, flexShrink: 0 }}>{theme === "dark" ? "✓" : ""}</span>
              </button>
            </div>
          </section>

          {/* 2. Language Section (O'zbek, Русский, English) */}
          <section className="settingsSection">
            <div className="settingsSectionHeader" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <span className="settingsIcon" style={{ fontSize: "22px" }}>🌐</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{t("lang_setting")}</h3>
                <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>{t("lang_desc")}</small>
              </div>
            </div>

            <div className="langOptionList" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                className={`langChoiceRow ${language === "uz" ? "active" : ""}`}
                onClick={() => {
                  onLanguageChange("uz");
                  handleSoundHapticClick();
                }}
                id="lang-btn-uz"
                style={{
                  padding: "12px 16px",
                  borderRadius: "14px",
                  border: language === "uz" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: language === "uz" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "22px" }}>🇺🇿</span>
                  <div style={{ textAlign: "left" }}>
                    <b style={{ fontSize: "14px", display: "block" }}>{t("lang_uz")}</b>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>O‘zbek tili (Lotin)</small>
                  </div>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: 800 }}>{language === "uz" ? "✓" : ""}</span>
              </button>

              <button
                type="button"
                className={`langChoiceRow ${language === "ru" ? "active" : ""}`}
                onClick={() => {
                  onLanguageChange("ru");
                  handleSoundHapticClick();
                }}
                id="lang-btn-ru"
                style={{
                  padding: "12px 16px",
                  borderRadius: "14px",
                  border: language === "ru" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: language === "ru" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "22px" }}>🇷🇺</span>
                  <div style={{ textAlign: "left" }}>
                    <b style={{ fontSize: "14px", display: "block" }}>{t("lang_ru")}</b>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>Русский язык</small>
                  </div>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: 800 }}>{language === "ru" ? "✓" : ""}</span>
              </button>

              <button
                type="button"
                className={`langChoiceRow ${language === "en" ? "active" : ""}`}
                onClick={() => {
                  onLanguageChange("en");
                  handleSoundHapticClick();
                }}
                id="lang-btn-en"
                style={{
                  padding: "12px 16px",
                  borderRadius: "14px",
                  border: language === "en" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: language === "en" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "22px" }}>🇬🇧</span>
                  <div style={{ textAlign: "left" }}>
                    <b style={{ fontSize: "14px", display: "block" }}>{t("lang_en")}</b>
                    <small style={{ color: "var(--text-muted)", fontSize: "11px" }}>English (US / UK)</small>
                  </div>
                </div>
                <span style={{ color: "var(--primary)", fontWeight: 800 }}>{language === "en" ? "✓" : ""}</span>
              </button>
            </div>
          </section>

          {/* 3. Currency Section (UZS, USD, RUB) */}
          <section className="settingsSection">
            <div className="settingsSectionHeader" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <span className="settingsIcon" style={{ fontSize: "22px" }}>💱</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{t("currency_setting")}</h3>
                <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>{t("currency_desc")}</small>
              </div>
            </div>

            <div className="currencyGrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {(["UZS", "USD", "RUB"] as Currency[]).map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => {
                    onCurrencyChange(curr);
                    handleSoundHapticClick();
                  }}
                  style={{
                    padding: "10px",
                    borderRadius: "12px",
                    border: currency === curr ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                    background: currency === curr ? "var(--bg-card-sub)" : "var(--bg-card)",
                    color: "var(--text-main)",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{curr === "UZS" ? "🇺🇿" : curr === "USD" ? "🇺🇸" : "🇷🇺"}</span>
                  <span>{curr}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 4. Haptic & Sound Feedback (Taktil va ovozli javob) */}
          <section className="settingsSection">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                borderRadius: "16px",
                background: "var(--bg-card-sub)",
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "22px" }}>🔊</span>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 700 }}>{t("haptics_setting")}</h4>
                  <small style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>{t("haptics_desc")}</small>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !hapticsEnabled;
                  onHapticsToggle(next);
                  playTapSound(next);
                  triggerHaptic(next, "medium");
                }}
                style={{
                  width: "50px",
                  height: "28px",
                  borderRadius: "20px",
                  background: hapticsEnabled ? "var(--primary)" : "var(--border-color)",
                  border: "none",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.25s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "3px",
                    left: hapticsEnabled ? "25px" : "3px",
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    transition: "left 0.25s ease",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                />
              </button>
            </div>
          </section>

          {/* 5. Font Scale & Layout Density */}
          <section className="settingsSection">
            <div className="settingsSectionHeader" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <span className="settingsIcon" style={{ fontSize: "22px" }}>📐</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{t("density_setting")}</h3>
                <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>{t("density_desc")}</small>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={() => {
                  onDensityChange("compact");
                  handleSoundHapticClick();
                }}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: density === "compact" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: density === "compact" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("density_compact")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDensityChange("normal");
                  handleSoundHapticClick();
                }}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: density === "normal" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: density === "normal" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("density_normal")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDensityChange("large");
                  handleSoundHapticClick();
                }}
                style={{
                  padding: "10px",
                  borderRadius: "12px",
                  border: density === "large" ? "2px solid var(--primary)" : "1px solid var(--border-color)",
                  background: density === "large" ? "var(--bg-card-sub)" : "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("density_large")}
              </button>
            </div>
          </section>

          {/* 6. Notifications Preferences */}
          <section className="settingsSection">
            <div className="settingsSectionHeader" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <span className="settingsIcon" style={{ fontSize: "22px" }}>🔔</span>
              <div>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{t("notif_prefs")}</h3>
                <small style={{ color: "var(--text-muted)", fontSize: "12px" }}>{t("notif_prefs_desc")}</small>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("order_alerts")}</span>
                <input
                  type="checkbox"
                  checked={orderAlerts}
                  onChange={(e) => {
                    onOrderAlertsToggle(e.target.checked);
                    handleSoundHapticClick();
                  }}
                  style={{ accentColor: "var(--primary)", width: "18px", height: "18px", cursor: "pointer" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{t("promo_alerts")}</span>
                <input
                  type="checkbox"
                  checked={promoAlerts}
                  onChange={(e) => {
                    onPromoAlertsToggle(e.target.checked);
                    handleSoundHapticClick();
                  }}
                  style={{ accentColor: "var(--primary)", width: "18px", height: "18px", cursor: "pointer" }}
                />
              </div>
            </div>
          </section>

          {/* 7. Storage, Cache & Reset */}
          <section
            className="settingsSection infoSection"
            style={{
              padding: "16px",
              borderRadius: "16px",
              background: "var(--bg-card-sub)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
              <span style={{ color: "var(--text-muted)" }}>{t("storage_used")}</span>
              <b style={{ color: "var(--text-main)", fontFamily: "monospace" }}>{cacheSizeKB}</b>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className="clearCacheBtn"
                onClick={() => {
                  onClearCache();
                  handleSoundHapticClick();
                  setCacheSizeKB("0.5 KB");
                }}
                id="clear-cache-btn"
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "12px",
                  background: "rgba(225,29,72,0.1)",
                  color: "#e11d48",
                  border: "1px solid rgba(225,29,72,0.2)",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>🗑️</span>
                <span>{t("clear_cache")}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onResetSettings();
                  handleSoundHapticClick();
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "12px",
                  background: "var(--bg-card)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-color)",
                  fontWeight: 600,
                  fontSize: "12.5px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <span>🔄</span>
                <span>{t("reset_settings")}</span>
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "4px" }}>
              <span>{t("app_version")}</span>
              <b>v2.6.0 Premium</b>
            </div>
          </section>
        </div>

        <div className="settingsFooter" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            className="primaryButton"
            onClick={() => {
              handleSoundHapticClick();
              onClose();
            }}
            id="settings-save-btn"
            style={{
              padding: "12px 32px",
              borderRadius: "14px",
              background: "var(--primary-gradient)",
              color: "#ffffff",
              border: "none",
              fontWeight: 800,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
