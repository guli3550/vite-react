import { useState, useEffect, type FC } from "react";
import type { Language } from "../utils/translations";

interface AdminPromo {
  id?: string | number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount?: number | null;
  max_discount_amount?: number | null;
  starts_at?: string | null;
  expires_at?: string | null;
  status: "active" | "expired" | "upcoming" | "exhausted" | "inactive";
  statusLabel: string;
}

export const PromosModal: FC<{
  language: Language;
  onClose: () => void;
  onApplyPromo?: (code: string) => void;
  onShowToast: (msg: string) => void;
}> = ({ onClose, onApplyPromo, onShowToast }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch("/api/promos")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.data)) {
          setPromos(data.data);
        }
      })
      .catch((err) => {
        console.warn("Failed to load admin promos:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = (code: string, isActive: boolean) => {
    if (!isActive) {
      onShowToast("Bu promokod muddati tugagan yoki nofaol");
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedCode(code);
    onShowToast(`✓ ${code} promokodi nusxalandi!`);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const formatExpiry = (isoString?: string | null) => {
    if (!isoString) return "Muddatsiz (doimiy)";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("uz-UZ", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div
        className="modalCard profileExtraModal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitleWrap">
            <span className="modalEyebrow">RASMIY TAKLIFLAR</span>
            <h2>Promokodlar va Kuponlar</h2>
          </div>
          <button className="modalCloseBtn" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="modalBodyContent">
          <p className="modalIntroText">
            Admin tomonidan tasdiqlangan rasmiy promokodlar ro‘yxati. Chegirmadan foydalanish uchun kodni nusxalang:
          </p>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
              <p style={{ margin: 0, fontSize: "13px" }}>Promokodlar tekshirilmoqda...</p>
            </div>
          ) : promos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                backgroundColor: "#f8fafc",
                borderRadius: "20px",
                border: "1px dashed #cbd5e1",
                margin: "12px 0",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎟️</div>
              <h4 style={{ margin: "0 0 6px", fontSize: "15px", color: "#334155", fontWeight: 700 }}>
                Hozircha faol promokodlar yo‘q
              </h4>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b", lineHeight: 1.5 }}>
                Admin tomonidan e'lon qilinadigan yangi kuponlar va maxsus chegirmalar shu yerda ko‘rinadi.
              </p>
            </div>
          ) : (
            <div className="promoCardsList">
              {promos.map((p) => {
                const isActive = p.status === "active";
                const discountText =
                  p.discount_type === "percent"
                    ? `${p.discount_value}% Chegirma`
                    : `${Number(p.discount_value).toLocaleString("uz-UZ")} so'm chegirma`;

                return (
                  <div
                    className="profilePromoCard"
                    key={p.code}
                    style={{
                      opacity: isActive ? 1 : 0.68,
                      border: isActive ? "1.5px solid #fbcfe8" : "1px solid #e2e8f0",
                      backgroundColor: isActive ? "#ffffff" : "#f8fafc",
                    }}
                  >
                    <div className="promoCardLeft">
                      <div className="promoCodeHeader" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span className="promoCodeBadge" style={{ fontWeight: 800, letterSpacing: "1px" }}>
                          {p.code}
                        </span>
                        {/* Real Status Pill on the edge */}
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "12px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            backgroundColor:
                              p.status === "active"
                                ? "#dcfce7"
                                : p.status === "expired"
                                ? "#fee2e2"
                                : p.status === "exhausted"
                                ? "#ffedd5"
                                : "#f1f5f9",
                            color:
                              p.status === "active"
                                ? "#15803d"
                                : p.status === "expired"
                                ? "#b91c1c"
                                : p.status === "exhausted"
                                ? "#c2410c"
                                : "#64748b",
                            border: `1px solid ${
                              p.status === "active"
                                ? "#86efac"
                                : p.status === "expired"
                                ? "#fca5a5"
                                : p.status === "exhausted"
                                ? "#fdba74"
                                : "#cbd5e1"
                            }`,
                          }}
                        >
                          {p.status === "active" && "● Faol"}
                          {p.status === "expired" && "✕ Muddati tugagan"}
                          {p.status === "exhausted" && "⚠ Limit tugagan"}
                          {p.status === "inactive" && "⏸ Nofaol"}
                          {p.status === "upcoming" && "⏳ Tez orada"}
                        </span>
                      </div>

                      <strong className="promoDiscountText" style={{ color: isActive ? "#be185d" : "#475569", marginTop: "4px" }}>
                        {discountText}
                      </strong>

                      <div style={{ marginTop: "4px", fontSize: "11px", color: "#64748b", display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span>
                          📅 <b>Amal qilish muddati:</b> {formatExpiry(p.expires_at)}
                        </span>
                        {p.min_order_amount ? (
                          <span>
                            🛒 <b>Minimal xarid:</b> {Number(p.min_order_amount).toLocaleString("uz-UZ")} so‘m
                          </span>
                        ) : (
                          <span>🛒 <b>Minimal xarid:</b> Cheklovsiz</span>
                        )}
                        {p.max_discount_amount && (
                          <span>
                            🛡️ <b>Maksimal chegirma:</b> {Number(p.max_discount_amount).toLocaleString("uz-UZ")} so‘m
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="promoCardRight" style={{ display: "flex", alignItems: "center" }}>
                      {isActive ? (
                        <button
                          className={`promoCopyBtn ${copiedCode === p.code ? "copied" : ""}`}
                          onClick={() => {
                            handleCopy(p.code, true);
                            if (onApplyPromo) onApplyPromo(p.code);
                          }}
                          style={{
                            padding: "8px 16px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {copiedCode === p.code ? "✓ Nusxalandi" : "Nusxalash"}
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#94a3b8",
                            fontWeight: 600,
                            padding: "6px 10px",
                            backgroundColor: "#f1f5f9",
                            borderRadius: "10px",
                          }}
                        >
                          Yaroqsiz
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modalFooterSingle">
          <button className="primaryButton" onClick={onClose}>
            Tushunarli
          </button>
        </div>
      </div>
    </div>
  );
};

export const DeliveryTermsModal: FC<{
  language: Language;
  onClose: () => void;
}> = ({ onClose }) => {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div
        className="modalCard profileExtraModal"
        role="dialog"
        aria-modal="true"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitleWrap">
            <span className="modalEyebrow">QOIDALAR & KAFOLAT</span>
            <h2>Yetkazib berish va To‘lov</h2>
          </div>
          <button className="modalCloseBtn" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="modalBodyContent termsList">
          <div className="termItem">
            <div className="termIcon">🎁</div>
            <div>
              <b>Bepul yetkazib berish (600 000 so‘m+)</b>
              <p>Bepul yetkazib berish faqatgina <b>600 000 so‘mdan oshgan</b> buyurtmalar uchun butun O‘zbekiston bo‘ylab amal qiladi. 600 000 so‘mgacha bo‘lgan buyurtmalar uchun standart yetkazib berish narxi 20 000 so‘m.</p>
            </div>
          </div>

          <div className="termItem">
            <div className="termIcon">🚚</div>
            <div>
              <b>Yetkazib berish muddatlari</b>
              <ul style={{ margin: "6px 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.6 }}>
                <li><b>Qo‘qon ichida:</b> 1 ish kuni</li>
                <li><b>Toshkent, Andijon, Namangan, Farg‘onaga:</b> 3 ish kuni</li>
                <li><b>Voha viloyatlariga:</b> 5 ish kuni</li>
              </ul>
            </div>
          </div>

          <div className="termItem">
            <div className="termIcon">💳</div>
            <div>
              <b>To‘lov usuli (Uzcard / Humo)</b>
              <p>Click, Payme, Beepul va boshqa barcha moliyaviy platformalardan qat'i nazar, to‘lov faqat rasmiy <b>Uzcard / Humo plastik kartasi</b> orqali amalga oshiriladi.</p>
            </div>
          </div>

          <div className="termItem">
            <div className="termIcon">⏱️</div>
            <div>
              <b>Chekni tasdiqlash (2 soat ichida)</b>
              <p>Yuborilgan to‘lov cheki <b>2 soat ichida</b> admin tomonidan tasdiqlanadi. Agar tasdiqlash vaqti uzayib ketsa, mijozga 1 marta bildirishnoma («To‘lovingiz admin tomonidan tasdiqlanishi kutilmoqda, tez orada tasdiqlanadi. Iltimos kuting yoki qo‘llab-quvvatlash markazi bilan bog‘laning») yuboriladi.</p>
            </div>
          </div>

          <div className="termItem">
            <div className="termIcon">🔒</div>
            <div>
              <b>100% Maxfiy va Nozik qadoqlash</b>
              <p>Ichki kiyim buyurtmalari shaffof bo‘lmagan, neytral va xavfsiz qadoqda yuboriladi. Qadoq tashqarisida buyurtma mazmuni yozilmaydi.</p>
            </div>
          </div>
        </div>

        <div className="modalFooterSingle">
          <button className="primaryButton" onClick={onClose}>
            Tushunarli
          </button>
        </div>
      </div>
    </div>
  );
};

export const SizeGuideModal: FC<{
  language: Language;
  onClose: () => void;
}> = ({ onClose }) => {
  const [tab, setTab] = useState<"bra" | "panties">("bra");

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div
        className="modalCard profileExtraModal"
        role="dialog"
        aria-modal="true"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitleWrap">
            <span className="modalEyebrow">QO‘LLANMA</span>
            <h2>O‘lchamlar jadvali (Size Guide)</h2>
          </div>
          <button className="modalCloseBtn" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="modalBodyContent">
          <div className="sizeGuideTabs">
            <button
              className={`guideTab ${tab === "bra" ? "active" : ""}`}
              onClick={() => setTab("bra")}
            >
              Byustgalter o‘lchami
            </button>
            <button
              className={`guideTab ${tab === "panties" ? "active" : ""}`}
              onClick={() => setTab("panties")}
            >
              Trusik va Pijamalar
            </button>
          </div>

          {tab === "bra" ? (
            <div className="sizeTableWrap">
              <p className="sizeGuideHint">
                📏 Ko‘krak osti aylanasi va eng bo‘rtgan nuqtasini santimetr lenta bilan o‘lchang:
              </p>
              <table className="sizeTable">
                <thead>
                  <tr>
                    <th>O‘lcham</th>
                    <th>Ko‘krak osti</th>
                    <th>Ko‘krak aylanasi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>70B</b></td>
                    <td>68–72 sm</td>
                    <td>84–86 sm</td>
                  </tr>
                  <tr>
                    <td><b>75B</b></td>
                    <td>73–77 sm</td>
                    <td>89–91 sm</td>
                  </tr>
                  <tr>
                    <td><b>75C</b></td>
                    <td>73–77 sm</td>
                    <td>91–93 sm</td>
                  </tr>
                  <tr>
                    <td><b>80B</b></td>
                    <td>78–82 sm</td>
                    <td>94–96 sm</td>
                  </tr>
                  <tr>
                    <td><b>80C</b></td>
                    <td>78–82 sm</td>
                    <td>96–98 sm</td>
                  </tr>
                  <tr>
                    <td><b>85B</b></td>
                    <td>83–87 sm</td>
                    <td>99–101 sm</td>
                  </tr>
                  <tr>
                    <td><b>85C</b></td>
                    <td>83–87 sm</td>
                    <td>101–103 sm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sizeTableWrap">
              <p className="sizeGuideHint">
                📏 Bel va son aylanasi bo‘yicha mos o‘lchamni tanlang:
              </p>
              <table className="sizeTable">
                <thead>
                  <tr>
                    <th>Xalqaro</th>
                    <th>O‘zbekiston</th>
                    <th>Bel / Son</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><b>XS</b></td>
                    <td>40–42</td>
                    <td>60–65 / 86–90 sm</td>
                  </tr>
                  <tr>
                    <td><b>S</b></td>
                    <td>42–44</td>
                    <td>66–70 / 91–95 sm</td>
                  </tr>
                  <tr>
                    <td><b>M</b></td>
                    <td>44–46</td>
                    <td>71–75 / 96–100 sm</td>
                  </tr>
                  <tr>
                    <td><b>L</b></td>
                    <td>46–48</td>
                    <td>76–81 / 101–106 sm</td>
                  </tr>
                  <tr>
                    <td><b>XL</b></td>
                    <td>48–50</td>
                    <td>82–88 / 107–112 sm</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modalFooterSingle">
          <button className="primaryButton" onClick={onClose}>
            Tushunarli
          </button>
        </div>
      </div>
    </div>
  );
};

export const AboutBrandModal: FC<{
  language: Language;
  onClose: () => void;
}> = ({ onClose }) => {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div
        className="modalCard profileExtraModal"
        role="dialog"
        aria-modal="true"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="modalHeader">
          <div className="modalTitleWrap">
            <span className="modalEyebrow">BREND HAQIDA</span>
            <h2>GULI Lingerie Premium</h2>
          </div>
          <button className="modalCloseBtn" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="modalBodyContent brandAboutBody">
          <div className="brandHeroCard">
            <span className="brandHeroIcon" style={{ overflow: "hidden", borderRadius: "50%", display: "inline-grid", placeItems: "center" }}>
              <img src="/guli_logo.jpg" alt="Guli Premium" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </span>
            <h3>Go‘zallik va O‘zingizga bo‘lgan ishonch</h3>
            <p>
              GULI — har bir ayolning betakror go‘zalligi, nozikligi va qulayligini ta’minlashga bag‘ishlangan premium ichki kiyimlar brendi. Biz faqat yuqori sifatli, teriga yoqimli va gipoallergen matolardan foydalanamiz.
            </p>
          </div>

          <div className="brandFeaturesGrid">
            <div className="brandFeat">
              <b>✨ Premium Sifat</b>
              <p>Fransuz to‘rlari, ipak va paxta</p>
            </div>
            <div className="brandFeat">
              <b>🛡️ 100% Maxfiylik</b>
              <p>To‘liq anonim xavfsiz qadoq</p>
            </div>
            <div className="brandFeat">
              <b>🚀 24/7 Xizmat</b>
              <p>Doimiy onlayn qo‘llab-quvvatlash</p>
            </div>
            <div className="brandFeat">
              <b>📍 O‘zbekiston bo‘ylab</b>
              <p>Tezkor va ishonchli yetkazish</p>
            </div>
          </div>

          <div className="brandContactsBlock">
            <h4>Biz bilan bog‘lanish:</h4>
            <div className="contactLinks">
              <a
                href="https://t.me/guli_lingerie_admin"
                target="_blank"
                rel="noreferrer"
                className="socialLinkBtn"
              >
                <span>✈️</span> Telegram Kanal & Menejer
              </a>
              <a
                href="tel:+998905811117"
                className="socialLinkBtn"
              >
                <span>📞</span> +998 (90) 581-11-17
              </a>
            </div>
          </div>
        </div>

        <div className="modalFooterSingle">
          <button className="primaryButton" onClick={onClose}>
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
};
