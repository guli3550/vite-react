import { useState } from "react";
import { type Language, getTranslation } from "../utils/translations";
import { playTapSound, triggerHaptic } from "../utils/soundEffects";

const API_URL = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");

type HelpSupportModalProps = {
  language: Language;
  onClose: () => void;
  onOpenChat: () => void;
  onShowToast: (msg: string) => void;
  initialStep?: "none" | "details";
  telegramUser?: any;
};

export function HelpSupportModal({
  language,
  onClose,
  onOpenChat,
  onShowToast,
  initialStep = "none",
  telegramUser,
}: HelpSupportModalProps) {
  const t = (key: any) => getTranslation(key, language);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Support state
  const [supportStep, setSupportStep] = useState<"none" | "details" | "upload" | "thanks">(
    initialStep
  );
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 3D Card Hover Perspective and Shine Variables
  const [cardRotate, setCardRotate] = useState({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState({ x: 50, y: 50 }); // Shimmer position percentage

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within element
    const y = e.clientY - rect.top;  // y position within element
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = -(y - centerY) / 8; // Adjust sensitivity
    const rotateY = (x - centerX) / 8;
    setCardRotate({ x: rotateX, y: rotateY });

    // Calculate shimmer gloss percentage
    const shineX = (x / rect.width) * 100;
    const shineY = (y / rect.height) * 100;
    setShinePos({ x: shineX, y: shineY });
  };

  const handleMouseLeave = () => {
    setCardRotate({ x: 0, y: 0 });
    setShinePos({ x: 50, y: 50 });
  };

  const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        setReceiptPhoto(base64Data);

        try {
          const res = await fetch(`${API_URL}/api/contributions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              telegram_id: telegramUser?.id ? String(telegramUser.id) : "Noma’lum",
              first_name: [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(" ") || "Mijoz",
              username: telegramUser?.username || "",
              receipt_photo: base64Data
            })
          });
          const json = await res.json();
          if (json.success) {
            onShowToast(
              language === "ru"
                ? "✓ Спасибо за вашу щедрость!"
                : language === "en"
                ? "✓ Thank you for your kindness!"
                : "✓ Saxovatingiz uchun chin dildan rahmat!"
            );
          }
        } catch (err) {
          console.error("Failed to upload contribution receipt:", err);
        } finally {
          setIsUploading(false);
          setSupportStep("thanks");
          triggerHaptic();
          playTapSound();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const callCenterPhone = localStorage.getItem("guli_callcenter_phone") || "+998 90 581 11 17";
  const CALL_CENTER_RAW = callCenterPhone.replace(/\s+/g, "");
  const CALL_CENTER_FORMATTED = callCenterPhone;

  const supportCardNumber = localStorage.getItem("guli_support_card_number") || localStorage.getItem("guli_payment_card_number") || "9860 1766 1229 1557";
  const supportCardHolder = localStorage.getItem("guli_support_card_holder") || localStorage.getItem("guli_payment_card_holder") || "X.Yusufaliyev";

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
    <div className="modalShade" onMouseDown={onClose} id="help-modal-overlay" style={{ backdropFilter: "blur(12px)" }}>
      <div
        className="helpModalCard"
        onMouseDown={(e) => e.stopPropagation()}
        id="help-modal-card"
        style={{
          boxShadow: "0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1)",
          background: "var(--bg-card)",
          borderRadius: "24px",
          overflow: "hidden"
        }}
      >
        {supportStep !== "none" ? (
          <>
            <div className="modalHead" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "1.4rem" }}>🤗</span>
                <span style={{ fontWeight: "850", fontSize: "16px", color: "var(--text-main)" }}>
                  {language === "ru" ? "Поддержка админа" : language === "en" ? "Support Admin" : "Adminni qo'llab-quvvatlash"}
                </span>
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

            <div className="helpBody" style={{ minHeight: "360px", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: "15px" }}>
              {supportStep === "thanks" ? (
                <div className="supportThanksContainer" style={{ textAlign: "center", padding: "15px" }}>
                  <div className="thanksIcon" style={{ fontSize: "65px", marginBottom: "16px", filter: "drop-shadow(0 10px 15px rgba(185, 90, 112, 0.35))", animation: "bounce 2s infinite" }}>🥹💖✨</div>
                  <h3 style={{ fontSize: "22px", fontWeight: "900", color: "var(--primary)", marginBottom: "14px" }}>
                    {language === "ru" ? "Спасибо вам огромное!" : language === "en" ? "Thank you so much!" : "Cheksiz minnatdorchilik!"}
                  </h3>
                  <p style={{ fontSize: "13.5px", lineHeight: "1.6", color: "var(--text-main)", margin: "0 auto", maxWidth: "440px" }}>
                    {language === "ru" 
                      ? "Мы выражаем вам искреннюю благодарность за поддержку нашего проекта и админа! Благодаря таким добрым людям, как вы, мы стремимся развиваться и оказывать еще более качественные услуги. Желаем вам крепкого здоровья, семейного счастья и больших успехов! 🌸"
                      : language === "en"
                      ? "We express our sincere gratitude to you for supporting our project and the admin! Thanks to kind people like you, we strive to grow and provide even better services. Wishing you robust health, family happiness, and great success! 🌸"
                      : "Loyihamizni va adminni chin dildan qo'llab-quvvatlaganingiz uchun sizga o'z minnatdorchiligimizni bildiramiz! Siz kabi saxovatli insonlar borligi tufayli biz yanada yaxrogeroq va mukammalroq xizmat ko'rsatishga intilamiz. Sizga sihat-salomatlik, oilaviy xotirjamlik va omad tilaymiz! 🌸"}
                  </p>
                  {receiptPhoto && (
                    <div className="uploadedReceiptPreview" style={{ marginTop: "20px", border: "2px dashed var(--primary)", padding: "10px", borderRadius: "16px", display: "inline-block", background: "var(--bg-card-sub)", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary)", display: "block", marginBottom: "6px" }}>
                        {language === "ru" ? "Чек успешно загружен" : language === "en" ? "Receipt successfully uploaded" : "Chek muvaffaqiyatli yuklandi"}
                      </span>
                      <img src={receiptPhoto} alt="Receipt Preview" style={{ maxHeight: "120px", maxWidth: "100%", borderRadius: "10px", objectFit: "contain", border: "1px solid var(--border-color)" }} />
                    </div>
                  )}
                  <button
                    type="button"
                    className="primaryButton"
                    onClick={onClose}
                    style={{ marginTop: "28px", width: "100%", padding: "14px", borderRadius: "16px", fontWeight: "800", fontSize: "14px" }}
                  >
                    {t("close")}
                  </button>
                </div>
              ) : (
                <div className="supportDetailsContainer" style={{ width: "100%" }}>
                  <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <span style={{ fontSize: "45px", display: "inline-block", filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.1))" }}>🤗</span>
                    <h3 style={{ fontSize: "20px", fontWeight: "900", color: "var(--text-main)", marginTop: "12px" }}>
                      {language === "ru" ? "Поддержка админа" : language === "en" ? "Support the Admin" : "Adminni qo'llab-quvvatlash"}
                    </h3>
                    <p style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--text-muted)", marginTop: "6px", padding: "0 15px", maxWidth: "400px", margin: "6px auto 0" }}>
                      {language === "ru"
                        ? "Ваша поддержка дает нам огромную силу для развития проекта и предоставления качественных услуг! Каждое пожертвование невероятно ценно для нас."
                        : language === "en"
                        ? "Your support gives us great strength to develop the project and provide high-quality services! Every support is incredibly valuable to us."
                        : "Sizning yordamingiz loyihamiz yanada rivojlanishiga va sizga sifatli xizmat ko'rsatishimizga katta kuch bag'ishlaydi! Har bir qo'llab-quvvatlashingiz biz uchun cheksiz qadrlidir."}
                    </p>
                  </div>

                  {/* Majestic 3D Luxury Bank Card with Interactive Shimmer */}
                  <div 
                    className="supportCardBox3D" 
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      background: "linear-gradient(135deg, #09090b 0%, #1c1124 45%, #25091a 100%)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "20px",
                      padding: "24px",
                      marginBottom: "24px",
                      boxShadow: `
                        0 20px 40px rgba(0, 0, 0, 0.45), 
                        inset 0 1px 2px rgba(255, 255, 255, 0.25), 
                        0 0 1px rgba(255, 255, 255, 0.1)
                      `,
                      position: "relative",
                      overflow: "hidden",
                      transform: `perspective(1000px) rotateX(${cardRotate.x}deg) rotateY(${cardRotate.y}deg)`,
                      transition: "transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease",
                      color: "#fff",
                      userSelect: "none"
                    }}
                  >
                    {/* Live Dynamic Gloss Shimmer Overlay */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: `radial-gradient(circle at ${shinePos.x}% ${shinePos.y}%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 50%, transparent 100%)`,
                      pointerEvents: "none",
                      mixBlendMode: "overlay",
                      zIndex: 3
                    }} />

                    {/* Faint Abstract Tech Background grid lines inside card */}
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      opacity: 0.08,
                      background: "radial-gradient(circle, transparent 20%, #000 20%, #000 80%, transparent 80%, transparent), radial-gradient(circle, transparent 20%, #000 20%, #000 80%, transparent 80%, transparent) 10px 10px",
                      backgroundSize: "20px 20px",
                      pointerEvents: "none"
                    }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px", position: "relative", zIndex: 5 }}>
                      <div>
                        <span style={{ fontSize: "10px", fontWeight: "900", color: "#f59e0b", letterSpacing: "2.5px", textShadow: "0 2px 4px rgba(0,0,0,0.4)" }}>PREMIUM CONTRIBUTOR</span>
                        <div style={{ fontSize: "9.5px", color: "rgba(255,255,255,0.5)", marginTop: "3px", fontWeight: "600" }}>Uzcard / Humo</div>
                      </div>
                      
                      {/* Interactive Holographic Shifting Circle Badge */}
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: `linear-gradient(${shinePos.x}deg, #22d3ee 0%, #ec4899 45%, #eab308 100%)`,
                        opacity: "0.9",
                        boxShadow: "0 0 15px rgba(34,211,238,0.25)",
                        transition: "background 0.15s ease",
                        position: "relative",
                        border: "1px solid rgba(255,255,255,0.2)"
                      }}>
                        {/* Shimmer overlay on hologram badge */}
                        <div style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: "50%",
                          background: "linear-gradient(transparent, rgba(255,255,255,0.4), transparent)"
                        }} />
                      </div>
                    </div>

                    {/* Gold Engraved SIM Microchip & NFC Contactless Wave icon */}
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "22px", position: "relative", zIndex: 5 }}>
                      <div style={{
                        width: "44px",
                        height: "33px",
                        borderRadius: "8px",
                        background: "linear-gradient(135deg, #fef08a 0%, #eab308 40%, #ca8a04 80%, #a16207 100%)",
                        boxShadow: "inset 0 1px 3px rgba(255,255,255,0.3), 0 3px 6px rgba(0,0,0,0.3)",
                        position: "relative",
                        overflow: "hidden",
                        border: "1px solid rgba(0,0,0,0.15)"
                      }}>
                        {/* Intricate Microchip Conductive Grid Lines */}
                        <div style={{ position: "absolute", top: "0", bottom: "0", left: "25%", width: "1px", background: "rgba(0,0,0,0.25)" }} />
                        <div style={{ position: "absolute", top: "0", bottom: "0", left: "50%", width: "1px", background: "rgba(0,0,0,0.25)" }} />
                        <div style={{ position: "absolute", top: "0", bottom: "0", left: "75%", width: "1px", background: "rgba(0,0,0,0.25)" }} />
                        <div style={{ position: "absolute", left: "0", right: "0", top: "33%", height: "1px", background: "rgba(0,0,0,0.25)" }} />
                        <div style={{ position: "absolute", left: "0", right: "0", top: "66%", height: "1px", background: "rgba(0,0,0,0.25)" }} />
                        
                        {/* Center gold keyhole */}
                        <div style={{
                          position: "absolute",
                          inset: "8px 12px",
                          borderRadius: "3px",
                          border: "1px solid rgba(0,0,0,0.18)",
                          background: "rgba(0,0,0,0.05)"
                        }} />
                      </div>
                      
                      {/* Stylized Wireless Signal */}
                      <div style={{ display: "flex", gap: "3px", alignItems: "center", opacity: "0.7" }}>
                        <div style={{ width: "3px", height: "8px", backgroundColor: "#fff", borderRadius: "2px" }} />
                        <div style={{ width: "3px", height: "12px", backgroundColor: "#fff", borderRadius: "2px" }} />
                        <div style={{ width: "3px", height: "16px", backgroundColor: "#fff", borderRadius: "2px" }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: "22px", position: "relative", zIndex: 5 }}>
                      <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.45)", display: "block", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "1.2px", fontWeight: "700" }}>Karta raqami / Card Number</span>
                      <b id="support-card-number" style={{ fontSize: "20px", letterSpacing: "2.5px", color: "#fff", fontFamily: "'Courier New', Courier, monospace", textShadow: "0 2px 5px rgba(0,0,0,0.65)", display: "block", fontWeight: "bold" }}>
                        {supportCardNumber}
                      </b>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", position: "relative", zIndex: 5 }}>
                      <div>
                        <span style={{ fontSize: "8.5px", color: "rgba(255,255,255,0.45)", display: "block", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "3px", fontWeight: "700" }}>Karta egasi / Holder</span>
                        <strong style={{ fontSize: "14px", color: "#f9fafb", fontWeight: "800", textShadow: "0 2px 4px rgba(0,0,0,0.5)", letterSpacing: "0.5px" }}>{supportCardHolder}</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              navigator.clipboard.writeText(supportCardNumber.replace(/\s+/g, ""));
                            }
                            onShowToast(language === "ru" ? "✓ Номер карты скопирован!" : "✓ Karta raqami nusxalandi!");
                            triggerHaptic();
                            playTapSound();
                          } catch {
                            onShowToast(supportCardNumber);
                          }
                        }}
                        style={{
                          background: "linear-gradient(135deg, #f59e0b, #d97706)",
                          color: "#111",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: "900",
                          cursor: "pointer",
                          boxShadow: "0 8px 16px rgba(217,119,6,0.3)",
                          transition: "all 0.25s cubic-bezier(0.25, 1, 0.5, 1)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                        onMouseEnter={(e) => { 
                          e.currentTarget.style.transform = "translateY(-2px)"; 
                          e.currentTarget.style.boxShadow = "0 12px 20px rgba(217,119,6,0.45)"; 
                        }}
                        onMouseLeave={(e) => { 
                          e.currentTarget.style.transform = "translateY(0)"; 
                          e.currentTarget.style.boxShadow = "0 8px 16px rgba(217,119,6,0.3)"; 
                        }}
                      >
                        <span>📋</span>
                        <span>{language === "ru" ? "Копировать" : language === "en" ? "Copy" : "Nusxalash"}</span>
                      </button>
                    </div>
                  </div>

                  {supportStep === "details" ? (
                    <button
                      type="button"
                      className="primaryButton"
                      onClick={() => {
                        setSupportStep("upload");
                        triggerHaptic();
                        playTapSound();
                      }}
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: "16px",
                        background: "var(--primary-gradient)",
                        color: "#fff",
                        fontWeight: "800",
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: "0 8px 24px rgba(185, 90, 112, 0.3)",
                        transition: "transform 0.2s"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      <span>📸</span>
                      <span>{language === "ru" ? "Загрузить чек перевода" : language === "en" ? "Upload Transfer Receipt" : "Pul o'tkazish & Chek yuklash"}</span>
                    </button>
                  ) : (
                    <div className="receiptUploadSection" style={{ animation: "fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
                      <label
                        htmlFor="receipt-upload"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "32px 20px",
                          border: "2px dashed var(--primary)",
                          borderRadius: "20px",
                          background: "var(--bg-card-sub)",
                          cursor: "pointer",
                          transition: "all 0.25s ease",
                          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.02)",
                          position: "relative"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-dark)"; e.currentTarget.style.backgroundColor = "rgba(185, 90, 112, 0.03)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.backgroundColor = "var(--bg-card-sub)"; }}
                      >
                        <span style={{ fontSize: "40px", marginBottom: "12px", filter: "drop-shadow(0 5px 10px rgba(185, 90, 112, 0.2))" }}>📸</span>
                        <strong style={{ fontSize: "14px", color: "var(--text-main)", textAlign: "center" }}>
                          {language === "ru" ? "Выбрать фото чека" : language === "en" ? "Select receipt photo" : "Chek rasmini tanlash"}
                        </strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                          {language === "ru" ? "Нажмите для загрузки файла" : language === "en" ? "Click to browse files" : "Faylni yuklash uchun ustiga bosing"}
                        </span>
                      </label>
                      <input
                        id="receipt-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleReceiptChange}
                        disabled={isUploading}
                      />
                      {isUploading && (
                        <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "var(--primary)", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                          <span className="spinner" style={{ display: "inline-block", width: "16px", height: "16px", border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}></span>
                          <span>⏳ {language === "ru" ? "Обработка..." : language === "en" ? "Uploading..." : "Chek yuklanmoqda va tekshirilmoqda..."}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="modalHead" style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
              <div>
                <span className="proEyebrow">{t("help_support")}</span>
                <h2 style={{ fontSize: "20px", fontWeight: "900" }}>{t("help_support")}</h2>
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
                <div className="helpActionCard chatCard" style={{ borderRadius: "20px", padding: "18px" }}>
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
                <div className="helpActionCard callCard" style={{ borderRadius: "20px", padding: "18px" }}>
                  <div className="helpActionHeader">
                    <span className="helpIconBubble callIcon">📞</span>
                    <div>
                      <span className="callCenterBadge">24/7 SUPPORT</span>
                      <h3>{t("call_center")}</h3>
                      <strong className="callNumberText" style={{ fontSize: "13px", color: "var(--primary)", marginTop: "4px", display: "inline-block" }}>{CALL_CENTER_FORMATTED}</strong>
                      <p>{t("call_center_desc")}</p>
                    </div>
                  </div>

                  <div className="callBtnGroup" style={{ marginTop: "12px" }}>
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

                {/* Support Admin Card */}
                <div 
                  className="helpActionCard supportCard" 
                  style={{ 
                    gridColumn: "1 / -1", 
                    borderRadius: "20px", 
                    padding: "20px",
                    background: "linear-gradient(135deg, rgba(217,119,6,0.1) 0%, rgba(180,83,9,0.03) 100%)",
                    border: "1px dashed #d97706"
                  }}
                >
                  <div className="helpActionHeader">
                    <span className="helpIconBubble supportIcon" style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)", color: "#d97706", fontSize: "22px" }}>🤗</span>
                    <div>
                      <span className="livePill" style={{ background: "#fef3c7", color: "#d97706", fontWeight: "800" }}>PROJECT SUPPORT</span>
                      <h3 style={{ fontSize: "16px", fontWeight: "850" }}>{language === "ru" ? "Поддержка админа" : language === "en" ? "Support the Admin" : "Adminni qo'llab-quvvatlash"}</h3>
                      <p style={{ fontSize: "11.5px" }}>{language === "ru" ? "Поддержите проект теплыми словами или пожертвованием" : language === "en" ? "Support our project with warm words or a contribution" : "Loyihamiz va adminni qo'llab-quvvatlash"}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="chatLaunchBtn"
                    style={{ background: "linear-gradient(135deg, #d97706, #b45309)", boxShadow: "0 6px 18px rgba(217,119,6,.22)", marginTop: "14px" }}
                    onClick={() => {
                      setSupportStep("details");
                      triggerHaptic();
                      playTapSound();
                    }}
                    id="open-support-btn"
                  >
                    <span>🤗</span>
                    <span>{language === "ru" ? "Поддержать админа →" : language === "en" ? "Support Admin →" : "Adminni qo'llab-quvvatlash →"}</span>
                  </button>
                </div>
              </div>

              {/* FAQ Accordion */}
              <section className="faqSection" style={{ marginTop: "24px" }}>
                <div className="faqTitleRow" style={{ marginBottom: "14px" }}>
                  <span className="sectionEyebrow">FAQ</span>
                  <h3 style={{ fontSize: "16px", fontWeight: "850" }}>{t("quick_questions")}</h3>
                </div>

                <div className="faqList">
                  {faqs.map((faq, index) => {
                    const isOpen = openFaq === index;
                    return (
                      <div
                        key={index}
                        className={`faqItem ${isOpen ? "open" : ""}`}
                        id={`faq-item-${index}`}
                        style={{ borderRadius: "14px", overflow: "hidden", marginBottom: "8px" }}
                      >
                        <button
                          type="button"
                          className="faqQuestionBtn"
                          onClick={() => setOpenFaq(isOpen ? null : index)}
                          style={{ padding: "14px", fontSize: "13px" }}
                        >
                          <span style={{ fontWeight: "700" }}>{faq.q}</span>
                          <i className="faqToggleIcon">{isOpen ? "−" : "+"}</i>
                        </button>
                        {isOpen && (
                          <div className="faqAnswer" style={{ padding: "14px", fontSize: "12.5px", lineHeight: "1.6" }}>
                            <p>{faq.a}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="helpFooter" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
              <button type="button" className="primaryButton" onClick={onClose} id="help-ok-btn" style={{ borderRadius: "14px", padding: "12px", fontSize: "13px", fontWeight: "700" }}>
                {t("close")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
