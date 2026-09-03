import React, { useState } from "react";
import type { Address, CartItem } from "../types";
import { formatColorName } from "../utils/colorHelpers";

interface CheckoutViewProps {
  onBack: () => void;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  phoneLoading: boolean;
  requestTelegramPhone: () => void;
  address: Address;
  setAddressField: (key: keyof Address, val: any) => void;
  requestLocation: () => void;
  locationLoading: boolean;
  updateMapPosition: (lat: number, lon: number) => void;
  uzbekistanRegionsData: Record<string, string[]>;
  cart: CartItem[];
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  formatPrice: (price: number) => string;
  showToast: (msg: string) => void;
  onProceedPayment: () => void;
  LocationPicker: React.ComponentType<{
    latitude: number;
    longitude: number;
    onChange: (lat: number, lon: number) => void;
  }>;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  onBack,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  birthDate,
  setBirthDate,
  phone,
  setPhone,
  phoneLoading,
  requestTelegramPhone,
  address,
  setAddressField,
  requestLocation,
  locationLoading,
  updateMapPosition,
  uzbekistanRegionsData,
  cart,
  total,
  subtotal,
  deliveryFee = 0,
  formatPrice,
  showToast,
  onProceedPayment,
  LocationPicker,
}) => {
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  const availableRegions = Object.keys(uzbekistanRegionsData);
  const isCustomRegion = Boolean(address.region && !availableRegions.includes(address.region));
  const currentDistricts = address.region && uzbekistanRegionsData[address.region] ? uzbekistanRegionsData[address.region] : [];
  const isCustomDistrict = Boolean(address.district && currentDistricts.length > 0 && !currentDistricts.includes(address.district));

  const isFormValid = Boolean(
    firstName.trim() &&
    phone.trim() &&
    address.region?.trim() &&
    address.district?.trim() &&
    address.street?.trim() &&
    cart.length > 0
  );

  const handlePayClick = () => {
    if (!firstName.trim()) {
      showToast("Iltimos ismingizni kiriting");
      return;
    }
    if (!phone.trim()) {
      showToast("Iltimos telefon raqamingizni kiriting");
      return;
    }
    if (!address.region?.trim() || !address.district?.trim() || !address.street?.trim()) {
      showToast("Iltimos manzilni (viloyat, tuman va ko‘cha) to‘liq kiriting");
      return;
    }
    if (!cart.length) {
      showToast("Savat bo‘sh");
      return;
    }
    onProceedPayment();
  };

  const getMissingFieldsTip = () => {
    if (!cart.length) return "Xarid savatingiz bo‘sh";
    const missing: string[] = [];
    if (!firstName.trim()) missing.push("Ism");
    if (!phone.trim()) missing.push("Telefon raqam");
    if (!address.region?.trim()) missing.push("Viloyat");
    if (!address.district?.trim()) missing.push("Tuman");
    if (!address.street?.trim()) missing.push("Ko‘cha");
    if (missing.length === 0) return null;
    return `To‘lovga o‘tish uchun to‘ldiring: ${missing.join(", ")}`;
  };

  const missingTip = getMissingFieldsTip();

  return (
    <main className="page checkoutPage modernCheckoutContainer">
      {/* Top Bar with Back Button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button
          type="button"
          onClick={onBack}
          className="backButton"
          id="checkout-back-btn"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-card-sub)",
            border: "1px solid var(--border-color)",
            padding: "8px 16px",
            borderRadius: "14px",
            fontSize: "13px",
            fontWeight: "750",
            color: "var(--text-main)",
            cursor: "pointer",
          }}
        >
          ← Savatga qaytish
        </button>

        <span
          style={{
            fontSize: "11px",
            fontWeight: "800",
            letterSpacing: "0.8px",
            color: "var(--success-badge-color, #059669)",
            background: "var(--success-badge-bg, rgba(16,185,129,0.12))",
            padding: "4px 10px",
            borderRadius: "999px",
          }}
        >
          🔒 Xavfsiz to‘lov
        </span>
      </div>

      {/* Modern Page Header */}
      <div className="pageHeader" style={{ marginBottom: "16px" }}>
        <span style={{ fontSize: "11px", fontWeight: "850", letterSpacing: "1px", color: "var(--primary)" }}>
          BUYURTMA BOSQICHI
        </span>
        <h1 style={{ fontSize: "23px", fontWeight: "900", margin: "4px 0", color: "var(--text-main)" }}>Buyurtmani rasmiylashtirish</h1>
        <p style={{ color: "var(--text-muted)", fontSize: "12.5px" }}>
          Ma’lumotlarni kiriting va buyurtmangizni 1 bosishda rasmiylashtiring.
        </p>
      </div>

      {/* Stepper Indicator */}
      <div
        className="checkoutStepper"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          padding: "10px 14px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: firstName && phone ? "#10b981" : "var(--primary)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: "800",
              display: "grid",
              placeItems: "center",
            }}
          >
            {firstName && phone ? "✓" : "1"}
          </span>
          <span style={{ fontSize: "12px", fontWeight: "750", color: "var(--text-main)" }}>Ma’lumotlar</span>
        </div>

        <span style={{ color: "var(--border-color)", fontSize: "14px" }}>—</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: address.street && address.region ? "#10b981" : "var(--bg-card-sub)",
              color: address.street && address.region ? "#fff" : "var(--text-muted)",
              fontSize: "11px",
              fontWeight: "800",
              display: "grid",
              placeItems: "center",
            }}
          >
            {address.street && address.region ? "✓" : "2"}
          </span>
          <span style={{ fontSize: "12px", fontWeight: "750", color: "var(--text-main)" }}>Manzil</span>
        </div>

        <span style={{ color: "var(--border-color)", fontSize: "14px" }}>—</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: isFormValid ? "var(--primary)" : "var(--bg-card-sub)",
              color: isFormValid ? "#fff" : "var(--text-muted)",
              fontSize: "11px",
              fontWeight: "800",
              display: "grid",
              placeItems: "center",
            }}
          >
            3
          </span>
          <span style={{ fontSize: "12px", fontWeight: "750", color: "var(--text-main)" }}>To‘lov</span>
        </div>
      </div>

      {/* Cart Summary Accordion */}
      {cart.length > 0 && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "18px",
            marginBottom: "16px",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <button
            type="button"
            onClick={() => setShowOrderSummary(!showOrderSummary)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 16px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: "18px" }}>🛍️</span>
              <div>
                <b style={{ fontSize: "13px", color: "var(--text-main)" }}>
                  Savatdagi mahsulotlar ({cart.reduce((acc, it) => acc + (it.quantity || 1), 0)} ta)
                </b>
                <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)" }}>
                  {formatPrice(total)} · Ko‘rish uchun bosing
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: "14px",
                color: "var(--text-muted)",
                transform: showOrderSummary ? "rotate(180deg)" : "none",
                transition: "transform 0.2s ease",
              }}
            >
              ▼
            </span>
          </button>

          {showOrderSummary && (
            <div style={{ borderTop: "1px solid var(--border-color)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {cart.map((item, idx) => {
                const img = item.product.image || item.product.images?.[0] || "/placeholder.jpg";
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: idx < cart.length - 1 ? "1px dashed var(--border-color)" : "none" }}>
                    <img
                      src={img}
                      alt={item.product.name}
                      style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--border-color)" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder.jpg";
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.product.name}
                      </h4>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                        {item.size && <span>O‘lcham: <b>{item.size}</b></span>}
                        {item.color && <span>Rang: <b>{formatColorName(item.color)}</b></span>}
                        <span>× {item.quantity}</span>
                      </div>
                    </div>
                    <b style={{ fontSize: "13px", color: "var(--primary)", flexShrink: 0 }}>
                      {formatPrice(item.product.price * item.quantity)}
                    </b>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Personal Info Card */}
      <div
        className="checkoutCard modernCard"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          padding: "18px 16px",
          marginBottom: "14px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="cardTitle" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(189,82,106,0.18), rgba(189,82,106,0.06))",
              color: "var(--primary)",
              display: "grid",
              placeItems: "center",
              fontSize: "16px",
              flexShrink: 0,
            }}
          >
            👤
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "850", color: "var(--text-main)" }}>
              Shaxsiy ma’lumotlar
            </h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
              Qabul qiluvchi ismi, tug‘ilgan kuni va telefon raqami
            </p>
          </div>
        </div>

        {/* First and Last Name */}
        <div className="twoInputs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
              Ism <span style={{ color: "#e11d48" }}>*</span>
            </label>
            <input
              className="input full"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ismingiz (masalan: Malika)"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "13px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
              Familiya
            </label>
            <input
              className="input full"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Familiyangiz"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "13px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Birth Date */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
            🎂 Tug‘ilgan sana
          </label>
          <input
            className="input full"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: "13px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block", marginTop: 4, lineHeight: "1.4" }}>
            ✨ Tug‘ilgan kuningizda GULI brendidan maxsus bayram sovg‘alari va chegirmalarni taqdim etamiz.
          </span>
        </div>

        {/* Phone Number */}
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
            📱 Telefon raqami <span style={{ color: "#e11d48" }}>*</span>
          </label>
          <input
            className="input full"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            type="tel"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: "13px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />

          <button
            type="button"
            className="phoneAutoButton"
            onClick={requestTelegramPhone}
            disabled={phoneLoading}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "10px 14px",
              borderRadius: "13px",
              background: "var(--phone-btn-bg)",
              border: "1px solid var(--phone-btn-border)",
              color: "var(--phone-btn-color)",
              fontSize: "12px",
              fontWeight: "750",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {phoneLoading ? (
              <>⏳ Telegramdan olinmoqda…</>
            ) : phone ? (
              <>✓ Telegram raqamini yangilash</>
            ) : (
              <>📱 Telegram raqamimni avtomatik olish</>
            )}
          </button>
        </div>
      </div>

      {/* Step 2: Delivery Address Card */}
      <div
        className="checkoutCard modernCard"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          padding: "18px 16px",
          marginBottom: "14px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="cardTitle" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(14,165,233,0.06))",
              color: "var(--phone-btn-color, #0284c7)",
              display: "grid",
              placeItems: "center",
              fontSize: "16px",
              flexShrink: 0,
            }}
          >
            📍
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "850", color: "var(--text-main)" }}>
              Yetkazib berish manzili
            </h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
              GPS orqali aniqlang yoki xaritadan tanlang
            </p>
          </div>
        </div>

        {/* GPS Button */}
        <button
          type="button"
          className="locationButton"
          onClick={requestLocation}
          disabled={locationLoading}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #0284c7, #0369a1)",
            color: "#ffffff",
            border: "none",
            fontWeight: "750",
            fontSize: "12.5px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(2,132,199,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          {locationLoading ? (
            <>⌛ Joylashuv aniqlanmoqda...</>
          ) : address.latitude ? (
            <>↻ Joylashuvni qayta aniqlash (GPS)</>
          ) : (
            <>🎯 Hozirgi joylashuvimni aniqlash (GPS)</>
          )}
        </button>

        {/* Map Picker */}
        {address.latitude ? (
          <div style={{ borderRadius: "16px", overflow: "hidden", border: "1px solid var(--border-color)", marginBottom: 14 }}>
            <LocationPicker
              latitude={address.latitude}
              longitude={address.longitude}
              onChange={updateMapPosition}
            />
          </div>
        ) : null}

        {/* Region & District Selectors */}
        <div className="twoInputs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
              Viloyat / Shahar <span style={{ color: "#e11d48" }}>*</span>
            </label>
            <select
              className="input"
              value={isCustomRegion ? "Boshqa" : (address.region || "")}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "Boshqa") {
                  setAddressField("region", "");
                  setAddressField("district", "");
                } else {
                  setAddressField("region", val);
                  const dists = uzbekistanRegionsData[val] || [];
                  setAddressField("district", dists[0] || "");
                }
              }}
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "13px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: "12.5px",
                boxSizing: "border-box",
              }}
            >
              <option value="">Viloyatni tanlang...</option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>{reg}</option>
              ))}
              <option value="Boshqa">✍️ Boshqa (qo‘lda kiritish)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
              Tuman / Shaharcha <span style={{ color: "#e11d48" }}>*</span>
            </label>
            {currentDistricts.length > 0 ? (
              <select
                className="input"
                value={isCustomDistrict ? "Boshqa" : (address.district || "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "Boshqa") {
                    setAddressField("district", "");
                  } else {
                    setAddressField("district", val);
                  }
                }}
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: "13px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "12.5px",
                  boxSizing: "border-box",
                }}
              >
                <option value="">Tumanni tanlang...</option>
                {currentDistricts.map((dist) => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
                <option value="Boshqa">✍️ Boshqa (qo‘lda kiritish)</option>
              </select>
            ) : (
              <input
                className="input"
                value={address.district || ""}
                onChange={(e) => setAddressField("district", e.target.value)}
                placeholder="Tuman nomi"
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: "13px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "12.5px",
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        </div>

        {(isCustomRegion || !address.region) && (
          <input
            className="input full"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: "13px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontSize: "12.5px",
              boxSizing: "border-box",
              marginBottom: 10,
            }}
            value={address.region || ""}
            onChange={(e) => setAddressField("region", e.target.value)}
            placeholder="Viloyatni qo‘lda kiriting (masalan: Toshkent)"
          />
        )}

        {(isCustomDistrict || (currentDistricts.length > 0 && address.district === "")) && (
          <input
            className="input full"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: "13px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontSize: "12.5px",
              boxSizing: "border-box",
              marginBottom: 10,
            }}
            value={address.district || ""}
            onChange={(e) => setAddressField("district", e.target.value)}
            placeholder="Tumanni qo‘lda kiriting (masalan: Chilonzor)"
          />
        )}

        {/* Street Name */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
            Ko‘cha nomi va manzil <span style={{ color: "#e11d48" }}>*</span>
          </label>
          <input
            className="input full"
            value={address.street || ""}
            onChange={(e) => setAddressField("street", e.target.value)}
            placeholder="Ko‘cha nomi va uyingiz manzili (masalan: Mustaqillik ko'chasi)"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: "13px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* House & Apartment */}
        <div className="twoInputs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
              Uy raqami / Dom
            </label>
            <input
              className="input"
              value={address.house || ""}
              onChange={(e) => setAddressField("house", e.target.value)}
              placeholder="Masalan: 42"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "13px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
              Xonadon / Padezd
            </label>
            <input
              className="input"
              value={address.apartment || ""}
              onChange={(e) => setAddressField("apartment", e.target.value)}
              placeholder="Masalan: 15"
              style={{
                width: "100%",
                padding: "11px 12px",
                borderRadius: "13px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: "13px",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Landmark */}
        <div>
          <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 750, display: "block", marginBottom: 5 }}>
            Mo‘ljal (orientir)
          </label>
          <input
            className="input full"
            value={address.landmark || ""}
            onChange={(e) => setAddressField("landmark", e.target.value)}
            placeholder="Masalan: Korzinka ro‘parasida, 3-podyezd"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: "13px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-main)",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Summary Calculations Card */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          padding: "16px 18px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: 8 }}>
          <span>Mahsulotlar qiymati:</span>
          <b style={{ color: "var(--text-main)" }}>{formatPrice(subtotal || total)}</b>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-muted)", marginBottom: 10 }}>
          <span>Yetkazib berish xizmati:</span>
          <b style={{ color: deliveryFee > 0 ? "var(--text-main)" : "#059669" }}>
            {deliveryFee > 0 ? formatPrice(deliveryFee) : "Bepul"}
          </b>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 12,
            borderTop: "1px dashed var(--border-color)",
          }}
        >
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Jami to‘lov miqdori:</span>
            <b style={{ fontSize: "21px", color: "var(--primary)", fontWeight: "900" }}>
              {formatPrice(total)}
            </b>
          </div>

          <span
            style={{
              fontSize: "11px",
              color: "var(--success-badge-color, #059669)",
              background: "var(--success-badge-bg, rgba(16,185,129,0.1))",
              padding: "4px 8px",
              borderRadius: "8px",
              fontWeight: "750",
            }}
          >
            ✓ Yetkazib berish bepul
          </span>
        </div>
      </div>

      {/* Step 3: Payment Method Card (at the bottom) */}
      <div
        className="checkoutCard modernCard"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          padding: "18px 16px",
          marginBottom: "16px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="cardTitle" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))",
              color: "#059669",
              display: "grid",
              placeItems: "center",
              fontSize: "16px",
              flexShrink: 0,
            }}
          >
            💳
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "850", color: "var(--text-main)" }}>
              To‘lov usuli
            </h3>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
              Uzcard va Humo kartalari orqali xavfsiz to‘lov
            </p>
          </div>
        </div>

        <div
          className="paymentOptionVibrant"
          onClick={handlePayClick}
          style={{
            cursor: isFormValid ? "pointer" : "not-allowed",
            opacity: isFormValid ? 1 : 0.75,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "14px",
              background: "var(--primary-gradient)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "22px",
              flexShrink: 0,
              boxShadow: "0 4px 10px rgba(189,82,106,0.3)",
            }}
          >
            💳
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <b style={{ fontSize: "14px", color: "var(--text-main)" }}>Karta (Uzcard / Humo)</b>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "var(--success-badge-color, #059669)",
                  background: "var(--success-badge-bg, rgba(16,185,129,0.12))",
                  padding: "2px 6px",
                  borderRadius: "6px",
                }}
              >
                Tanlangan
              </span>
            </div>
            <small style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "block", marginTop: 2 }}>
              Istalgan Uzcard yoki Humo kartasi orqali onlayn to‘lov
            </small>
          </div>

          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "var(--primary)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "12px",
              fontWeight: "900",
              flexShrink: 0,
            }}
          >
            ✓
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 12px", borderRadius: "12px", background: "var(--bg-card-sub)", fontSize: "11px", color: "var(--text-muted)" }}>
          <span>🛡️</span>
          <span>To‘lovlar 256-bitli SSL orqali to‘liq himoyalangan va xavfsiz.</span>
        </div>
      </div>

      {/* Validation Hint (if not valid) */}
      {missingTip && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: "14px",
            background: "rgba(225, 29, 72, 0.12)",
            border: "1px solid rgba(225, 29, 72, 0.25)",
            color: "var(--primary)",
            fontSize: "11.5px",
            fontWeight: "750",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠️</span>
          <span>{missingTip}</span>
        </div>
      )}

      {/* Primary Checkout Button */}
      <button
        type="button"
        className="primaryButton large btn-3d"
        id="checkout-proceed-btn"
        disabled={!isFormValid}
        onClick={handlePayClick}
        style={{
          width: "100%",
          padding: "16px 20px",
          borderRadius: "18px",
          background: isFormValid
            ? "var(--primary-gradient)"
            : "var(--bg-card-sub)",
          color: isFormValid ? "#ffffff" : "var(--text-muted)",
          fontSize: "15px",
          fontWeight: "850",
          border: "none",
          cursor: isFormValid ? "pointer" : "not-allowed",
          boxShadow: isFormValid ? "0 8px 24px rgba(189,82,106,0.35)" : "none",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <span>💳</span>
        <span>Karta orqali to‘lov qilish — {formatPrice(total)}</span>
      </button>
    </main>
  );
};
