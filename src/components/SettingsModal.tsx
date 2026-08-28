import { type Language, getTranslation } from "../utils/translations";

type SettingsModalProps = {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onClose: () => void;
  onClearCache: () => void;
};

export function SettingsModal({
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  onClose,
  onClearCache,
}: SettingsModalProps) {
  const t = (key: any) => getTranslation(key, language);

  return (
    <div className="modalShade" onMouseDown={onClose} id="settings-modal-overlay">
      <div
        className="settingsModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="settings-modal-card"
      >
        <div className="modalHead">
          <div>
            <span className="proEyebrow">{t("settings")}</span>
            <h2>{t("settings_title")}</h2>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
            aria-label={t("close")}
            id="settings-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="settingsBody">
          {/* Theme Section */}
          <section className="settingsSection">
            <div className="settingsSectionHeader">
              <span className="settingsIcon">🌓</span>
              <div>
                <h3>{t("theme_setting")}</h3>
                <small>Kunduzgi va tungi ko‘rinishni tanlang</small>
              </div>
            </div>

            <div className="themeToggleGrid">
              <button
                type="button"
                className={`themeChoiceBtn ${theme === "light" ? "active" : ""}`}
                onClick={() => onThemeChange("light")}
                id="theme-btn-light"
              >
                <span className="themeIconPreview">☀️</span>
                <b>{t("theme_light")}</b>
                <span className="themeCheckmark">{theme === "light" ? "✓" : ""}</span>
              </button>

              <button
                type="button"
                className={`themeChoiceBtn ${theme === "dark" ? "active" : ""}`}
                onClick={() => onThemeChange("dark")}
                id="theme-btn-dark"
              >
                <span className="themeIconPreview">🌙</span>
                <b>{t("theme_dark")}</b>
                <span className="themeCheckmark">{theme === "dark" ? "✓" : ""}</span>
              </button>
            </div>
          </section>

          {/* Language Section */}
          <section className="settingsSection">
            <div className="settingsSectionHeader">
              <span className="settingsIcon">🌐</span>
              <div>
                <h3>{t("lang_setting")}</h3>
                <small>Ilova matnlari va tavsiflari tili</small>
              </div>
            </div>

            <div className="langOptionList">
              <button
                type="button"
                className={`langChoiceRow ${language === "uz" ? "active" : ""}`}
                onClick={() => onLanguageChange("uz")}
                id="lang-btn-uz"
              >
                <span className="flagIcon">🇺🇿</span>
                <div className="langDetails">
                  <b>{t("lang_uz")}</b>
                  <small>O‘zbek tili (Lotin)</small>
                </div>
                <span className="langRadio">{language === "uz" ? "✓" : ""}</span>
              </button>

              <button
                type="button"
                className={`langChoiceRow ${language === "ru" ? "active" : ""}`}
                onClick={() => onLanguageChange("ru")}
                id="lang-btn-ru"
              >
                <span className="flagIcon">🇷🇺</span>
                <div className="langDetails">
                  <b>{t("lang_ru")}</b>
                  <small>Русский язык</small>
                </div>
                <span className="langRadio">{language === "ru" ? "✓" : ""}</span>
              </button>

              <button
                type="button"
                className={`langChoiceRow ${language === "en" ? "active" : ""}`}
                onClick={() => onLanguageChange("en")}
                id="lang-btn-en"
              >
                <span className="flagIcon">🇬🇧</span>
                <div className="langDetails">
                  <b>{t("lang_en")}</b>
                  <small>English (US / UK)</small>
                </div>
                <span className="langRadio">{language === "en" ? "✓" : ""}</span>
              </button>
            </div>
          </section>

          {/* Cache & App Info */}
          <section className="settingsSection infoSection">
            <div className="appInfoRow">
              <span>{t("app_version")}</span>
              <b>v2.5.0 Premium</b>
            </div>

            <button
              type="button"
              className="clearCacheBtn"
              onClick={onClearCache}
              id="clear-cache-btn"
            >
              <span>🗑️</span>
              <span>{t("clear_cache")}</span>
            </button>
          </section>
        </div>

        <div className="settingsFooter">
          <button type="button" className="primaryButton" onClick={onClose} id="settings-save-btn">
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
