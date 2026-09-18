import React from "react";
import type { Language } from "../utils/translations";

interface OrderConfirmedModalProps {
  orderNumber: string;
  onViewOrders: () => void;
  onGoHome: () => void;
  onClose: () => void;
  language?: Language;
}

export const OrderConfirmedModal: React.FC<OrderConfirmedModalProps> = ({
  orderNumber,
  onViewOrders,
  onGoHome,
  onClose,
  language = "uz",
}) => {
  const isRu = language === "ru";
  const isEn = language === "en";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "24px",
          padding: "28px 24px",
          backgroundColor: "var(--bg-card, #ffffff)",
          color: "var(--text-main, #1e293b)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.35)",
          textAlign: "center",
          border: "1px solid var(--border-color, rgba(0,0,0,0.08))",
          animation: "modalPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            margin: "0 auto 16px",
            borderRadius: "50%",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "36px",
            boxShadow: "0 8px 20px rgba(16, 185, 129, 0.25)",
          }}
        >
          ✓
        </div>

        <h2
          style={{
            fontSize: "22px",
            fontWeight: 800,
            margin: "0 0 8px",
            color: "var(--text-main, #1e293b)",
          }}
        >
          {isRu ? "Заказ принят!" : isEn ? "Order Confirmed!" : "Buyurtma qabul qilindi!"}
        </h2>

        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted, #64748b)",
            margin: "0 0 16px",
            lineHeight: 1.5,
          }}
        >
          {isRu
            ? "Ваш заказ успешно оформлен. Номер заказа:"
            : isEn
            ? "Your order has been placed successfully. Order number:"
            : "Buyurtmangiz muvaffaqiyatli rasmiylashtirildi. Buyurtma raqami:"}
        </p>

        <div
          style={{
            padding: "10px 16px",
            borderRadius: "14px",
            backgroundColor: "var(--bg-card-sub, #f8fafc)",
            border: "1px dashed var(--border-color, #cbd5e1)",
            fontSize: "16px",
            fontWeight: 800,
            color: "var(--primary, #be185d)",
            letterSpacing: "0.5px",
            marginBottom: "22px",
          }}
        >
          #{orderNumber}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={onViewOrders}
            style={{
              width: "100%",
              padding: "14px 20px",
              borderRadius: "14px",
              border: "none",
              backgroundColor: "var(--primary, #be185d)",
              color: "#ffffff",
              fontSize: "14.5px",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(190, 24, 93, 0.3)",
              transition: "transform 0.15s ease",
            }}
          >
            📦 {isRu ? "Перейти в мои заказы" : isEn ? "Go to My Orders" : "Buyurtmalarim bo‘limiga o‘tish"}
          </button>

          <button
            type="button"
            onClick={onGoHome}
            style={{
              width: "100%",
              padding: "12px 20px",
              borderRadius: "14px",
              border: "1px solid var(--border-color, #e2e8f0)",
              backgroundColor: "transparent",
              color: "var(--text-main, #334155)",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🛍️ {isRu ? "Продолжить покупки" : isEn ? "Continue Shopping" : "Xaridni davom ettirish"}
          </button>
        </div>
      </div>
    </div>
  );
};

