import { useState, type FC } from "react";
import type { Language } from "../utils/translations";

interface PromoItem {
  code: string;
  discount: string;
  description: string;
  minSpend?: string;
  tag?: string;
}

const AVAILABLE_PROMOS: PromoItem[] = [
  {
    code: "GULI10",
    discount: "10% Chegirma",
    description: "Barcha nozik to‘plamlar va byustgalterlar uchun",
    minSpend: "Cheklovsiz",
    tag: "Ommabop"
  },
  {
    code: "YANGI2026",
    discount: "15% Chegirma",
    description: "Birinchi buyurtmangiz uchun maxsus sovg‘a chegirmasi",
    minSpend: "250 000 so'mdan yuqori",
    tag: "Yangi mijozlar"
  },
  {
    code: "BEPUL",
    discount: "Bepul Yetkazish",
    description: "O‘zbekiston bo‘ylab istalgan viloyatga bepul yetkazib berish",
    minSpend: "200 000 so'mdan yuqori",
    tag: "Yetkazib berish"
  }
];

export const PromosModal: FC<{
  language: Language;
  onClose: () => void;
  onApplyPromo?: (code: string) => void;
  onShowToast: (msg: string) => void;
}> = ({ onClose, onApplyPromo, onShowToast }) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string) => {
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
            <span className="modalEyebrow">MAXSUS TAKLIFLAR</span>
            <h2>Promokodlar va Kuponlar</h2>
          </div>
          <button className="modalCloseBtn" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="modalBodyContent">
          <p className="modalIntroText">
            Buyurtma rasmiylashtirishda ushbu promokodlardan foydalanib chegirmaga ega bo‘ling:
          </p>

          <div className="promoCardsList">
            {AVAILABLE_PROMOS.map(p => (
              <div className="profilePromoCard" key={p.code}>
                <div className="promoCardLeft">
                  <div className="promoCodeHeader">
                    <span className="promoCodeBadge">{p.code}</span>
                    {p.tag && <span className="promoTagPill">{p.tag}</span>}
                  </div>
                  <strong className="promoDiscountText">{p.discount}</strong>
                  <p className="promoDescText">{p.description}</p>
                  {p.minSpend && (
                    <small className="promoMinSpend">Shart: {p.minSpend}</small>
                  )}
                </div>
                <div className="promoCardRight">
                  <button
                    className={`promoCopyBtn ${copiedCode === p.code ? "copied" : ""}`}
                    onClick={() => {
                      handleCopy(p.code);
                      if (onApplyPromo) onApplyPromo(p.code);
                    }}
                  >
                    {copiedCode === p.code ? "✓ Nusxalandi" : "Nusxalash"}
                  </button>
                </div>
              </div>
            ))}
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
            <div className="termIcon">🚚</div>
            <div>
              <b>Tezkor yetkazib berish</b>
              <p>Toshkent shahri bo‘ylab 24 soat ichida, O‘zbekistonning barcha viloyatlari va tumanlariga 1–3 kun ichida yetkaziladi.</p>
            </div>
          </div>

          <div className="termItem">
            <div className="termIcon">🎁</div>
            <div>
              <b>Bepul yetkazish chegarasi</b>
              <p>300 000 so‘mdan yuqori har qanday buyurtma O‘zbekiston bo‘ylab mutlaqo bepul yetkazib beriladi.</p>
            </div>
          </div>

          <div className="termItem">
            <div className="termIcon">💳</div>
            <div>
              <b>Qulay to‘lov usullari</b>
              <p>Buyurtmani qabul qilishda naqd pul bilan yoki Uzcard/Humo karta orqali to‘lashingiz mumkin.</p>
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
            <span className="brandHeroIcon">🌷</span>
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
