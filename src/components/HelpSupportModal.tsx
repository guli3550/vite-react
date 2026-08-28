import { useState } from "react";
import { type Language, getTranslation } from "../utils/translations";

type HelpSupportModalProps = {
  language: Language;
  onClose: () => void;
  onOpenChat: () => void;
  onShowToast: (msg: string) => void;
};

export function HelpSupportModal({
  language,
  onClose,
  onOpenChat,
  onShowToast,
}: HelpSupportModalProps) {
  const t = (key: any) => getTranslation(key, language);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const CALL_CENTER_RAW = "+998905811117";
  const CALL_CENTER_FORMATTED = "+998 (90) 581-11-17";

  const handleCopyNumber = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(CALL_CENTER_RAW);
      }
      onShowToast(`✓ ${t("copied")}: ${CALL_CENTER_FORMATTED}`);
    } catch {
      onShowToast(`✓ ${CALL_CENTER_FORMATTED}`);
    }
  };

  const faqs = [
    {
      q: t("quick_q1"),
      a: language === "ru"
        ? "Доставка по Ташкенту осуществляется в течение 2-4 часов, по областям Узбекистана — 1-2 рабочих дня. При заказе от 300 000 сум доставка бесплатная!"
        : language === "en"
        ? "Delivery within Tashkent takes 2-4 hours, and across Uzbekistan regions 1-2 business days. Free delivery for orders over 300,000 UZS!"
        : "Toshkent shahri bo‘ylab yetkazib berish 2-4 soatda, viloyatlar bo‘ylab 1-2 ish kunida amalga oshiriladi. 300 000 so‘mdan yuqori buyurtmalarda yetkazib berish mutlaqo bepul!"
    },
    {
      q: t("quick_q2"),
      a: language === "ru"
        ? "В карточке каждого товара указаны размеры (70B, 75B, 80C и др.). Если вы сомневаетесь, напишите в онлайн-чат или позвоните в Call Center, и мы поможем подобрать идеальный размер."
        : language === "en"
        ? "Each product page shows exact sizing (70B, 75B, 80C, etc.). If you are unsure, feel free to ask in online chat or call our Call Center."
        : "Har bir mahsulot sahifasida aniq o‘lchamlar (70B, 75B, 80C, S, M, L) ko‘rsatilgan. Tanlashda ikkilansangiz, online chatda operatorimizga yozing yoki Call Center raqamiga qo‘ng‘iroq qiling."
    },
    {
      q: t("quick_q3"),
      a: language === "ru"
        ? "Вы можете оплатить заказ наличными при получении курьеру, либо онлайн через Uzcard/Humo/Visa/Mastercard."
        : language === "en"
        ? "You can pay with Cash on delivery upon receiving your package, or via online card payment (Uzcard / Humo / Visa)."
        : "Buyurtmani qabul qilib olganingizda kuryerga naqd pulda yoki bank kartasi (Uzcard, Humo, Visa) orqali to‘lashingiz mumkin."
    },
    {
      q: t("quick_q4"),
      a: language === "ru"
        ? "Если размер не подошел, сохраните товарный вид и бирку. Обратитесь к нам в течение 24 часов после получения для оформления обмена."
        : language === "en"
        ? "If the size doesn't fit, please keep the original packaging and tags, and contact our support within 24 hours."
        : "Agar o‘lcham to‘g‘ri kelmasa, mahsulotning etiketkasi va qadog‘ini saqlagan holda 24 soat ichida bizga murojaat qiling, bepul almashtirib beramiz."
    }
  ];

  return (
    <div className="modalShade" onMouseDown={onClose} id="help-modal-overlay">
      <div
        className="helpModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="help-modal-card"
      >
        <div className="modalHead">
          <div>
            <span className="proEyebrow">{t("help_support")}</span>
            <h2>{t("help_support")}</h2>
          </div>
          <button
            type="button"
            className="modalCloseBtn"
            onClick={onClose}
            aria-label={t("close")}
            id="help-close-btn"
          >
            ✕
          </button>
        </div>

        <div className="helpBody">
          {/* Quick Actions Grid */}
          <div className="helpQuickGrid">
            {/* Online Chat Box */}
            <div className="helpActionCard chatCard">
              <div className="helpActionHeader">
                <span className="helpIconBubble chatIcon">💬</span>
                <div>
                  <span className="livePill">{t("online_status")}</span>
                  <h3>{t("online_chat")}</h3>
                  <p>{t("online_chat_desc")}</p>
                </div>
              </div>
              <button
                type="button"
                className="chatLaunchBtn"
                onClick={() => {
                  onClose();
                  onOpenChat();
                }}
                id="open-online-chat-btn"
              >
                <span>💬</span>
                <span>{t("chat_with_admin")} →</span>
              </button>
            </div>

            {/* Call Center Box */}
            <div className="helpActionCard callCard">
              <div className="helpActionHeader">
                <span className="helpIconBubble callIcon">📞</span>
                <div>
                  <span className="callCenterBadge">24/7 SUPPORT</span>
                  <h3>{t("call_center")}</h3>
                  <strong className="callNumberText">{CALL_CENTER_FORMATTED}</strong>
                  <p>{t("call_center_desc")}</p>
                </div>
              </div>

              <div className="callBtnGroup">
                <a
                  href={`tel:${CALL_CENTER_RAW}`}
                  className="callDirectBtn"
                  id="call-center-direct-btn"
                >
                  <span>📞</span>
                  <span>{t("call_now")}</span>
                </a>
                <button
                  type="button"
                  className="callCopyBtn"
                  onClick={handleCopyNumber}
                  id="copy-phone-btn"
                  title={t("copy_number")}
                >
                  <span>📋</span>
                  <span>{t("copy_number")}</span>
                </button>
              </div>
            </div>
          </div>

          {/* FAQ Accordion */}
          <section className="faqSection">
            <div className="faqTitleRow">
              <span className="sectionEyebrow">FAQ</span>
              <h3>{t("quick_questions")}</h3>
            </div>

            <div className="faqList">
              {faqs.map((faq, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className={`faqItem ${isOpen ? "open" : ""}`}
                    id={`faq-item-${index}`}
                  >
                    <button
                      type="button"
                      className="faqQuestionBtn"
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                    >
                      <span>{faq.q}</span>
                      <i className="faqToggleIcon">{isOpen ? "−" : "+"}</i>
                    </button>
                    {isOpen && (
                      <div className="faqAnswer">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="helpFooter">
          <button type="button" className="primaryButton" onClick={onClose} id="help-ok-btn">
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}
