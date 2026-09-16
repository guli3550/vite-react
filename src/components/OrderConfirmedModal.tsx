import React from "react";

interface OrderConfirmedModalProps {
  orderNumber: string;
  onViewOrders: () => void;
  onGoHome: () => void;
  onClose?: () => void;
}

export const OrderConfirmedModal: React.FC<OrderConfirmedModalProps> = ({
  orderNumber,
  onViewOrders,
  onGoHome,
  onClose,
}) => {
  const formattedOrderNo = orderNumber.startsWith("#") ? orderNumber : `#${orderNumber}`;

  return (
    <div
      className="orderConfirmedBackdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(10, 8, 12, 0.82)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        animation: "orderModalFadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        className="orderConfirmedCard"
        style={{
          width: "100%",
          maxWidth: "380px",
          backgroundColor: "#161316",
          color: "#ffffff",
          borderRadius: "28px",
          padding: "24px 20px 0px 20px",
          boxShadow: "0 28px 80px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(244, 114, 182, 0.15)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            marginBottom: "28px",
          }}
        >
          <span
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#e2e8f0",
              letterSpacing: "0.2px",
            }}
          >
            Buyurtma tasdiqlandi
          </span>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Yopish"
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                background: "rgba(255, 255, 255, 0.08)",
                border: "none",
                color: "#94a3b8",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                fontSize: "14px",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Glowing Pink Circular Icon with Checkmark */}
        <div
          style={{
            width: "78px",
            height: "78px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fb7185 0%, #e11d48 55%, #be123c 100%)",
            display: "grid",
            placeItems: "center",
            boxShadow:
              "0 0 35px rgba(225, 29, 72, 0.55), 0 0 70px rgba(225, 29, 72, 0.3)",
            marginBottom: "20px",
            flexShrink: 0,
          }}
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: "21px",
            fontWeight: 800,
            margin: "0 0 6px",
            color: "#ffffff",
            letterSpacing: "-0.2px",
          }}
        >
          Buyurtmangiz qabul qilindi!
        </h2>

        {/* Dynamic Real Order Number */}
        <div
          style={{
            fontSize: "14.5px",
            fontWeight: 700,
            color: "#e2e8f0",
            letterSpacing: "0.6px",
            marginBottom: "12px",
          }}
        >
          {formattedOrderNo}
        </div>

        {/* Description Subtitle */}
        <p
          style={{
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.5,
            margin: "0 0 24px",
            maxWidth: "280px",
          }}
        >
          Buyurtmangiz tez orada tasdiqlanadi va yetkazib beriladi.
        </p>

        {/* Action Button 1: Buyurtmalarim */}
        <button
          onClick={onViewOrders}
          style={{
            width: "100%",
            padding: "14px 20px",
            borderRadius: "16px",
            border: "none",
            background: "linear-gradient(135deg, #e11d48 0%, #be123c 100%)",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: 750,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(225, 29, 72, 0.38)",
            marginBottom: "10px",
            transition: "all 0.2s ease",
            letterSpacing: "0.2px",
          }}
        >
          Buyurtmalarim
        </button>

        {/* Action Button 2: Asosiy sahifaga qaytish */}
        <button
          onClick={onGoHome}
          style={{
            width: "100%",
            padding: "13px 20px",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            background: "rgba(255, 255, 255, 0.07)",
            color: "#fda4af",
            fontSize: "14px",
            fontWeight: 650,
            cursor: "pointer",
            marginBottom: "18px",
            transition: "all 0.2s ease",
          }}
        >
          Asosiy sahifaga qaytish
        </button>

        {/* Bottom GULI Delivery Truck Illustration */}
        <div
          style={{
            width: "100%",
            position: "relative",
            marginTop: "4px",
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <img
            src="/guli_delivery_truck.jpg"
            alt="Guli Delivery Truck"
            style={{
              width: "100%",
              maxHeight: "150px",
              objectFit: "contain",
              display: "block",
              filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.5))",
            }}
          />
        </div>
      </div>
    </div>
  );
};
