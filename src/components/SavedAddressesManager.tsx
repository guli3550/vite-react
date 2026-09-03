import React, { useState } from "react";
import type { Address } from "../types";

interface SavedAddressesManagerProps {
  address: Address;
  setAddress: React.Dispatch<React.SetStateAction<Address>>;
  onBack: () => void;
  locationLoading: boolean;
  onRequestLocation: () => void;
  onUpdateMapPosition: (lat: number, lon: number) => void;
  uzbekistanRegionsData: Record<string, string[]>;
  showToast: (msg: string) => void;
  LocationPicker: React.ComponentType<{
    latitude: number;
    longitude: number;
    onChange: (lat: number, lon: number) => void;
  }>;
}

export const SavedAddressesManager: React.FC<SavedAddressesManagerProps> = ({
  address,
  setAddress,
  onBack,
  locationLoading,
  onRequestLocation,
  onUpdateMapPosition,
  uzbekistanRegionsData,
  showToast,
  LocationPicker,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  // Form draft state
  const [draft, setDraft] = useState<Address>({ ...address });

  const startEditing = () => {
    setDraft({ ...address });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setAddress(draft);
    setIsEditing(false);
    showToast("✓ Manzil muvaffaqiyatli saqlandi!");
  };

  const handleClear = () => {
    if (window.confirm("Rostdan ham saqlangan manzilni tozalashni xohlaysizmi?")) {
      const emptyAddr: Address = {
        latitude: 41.2995,
        longitude: 69.2401,
        region: "Toshkent sh.",
        district: "",
        street: "",
        house: "",
        apartment: "",
        landmark: "",
      };
      setAddress(emptyAddr);
      setDraft(emptyAddr);
      showToast("Saqlangan manzil tozalandi.");
    }
  };

  const handleCopyCoordinates = () => {
    if (!address.latitude || !address.longitude) return;
    const text = `${address.latitude.toFixed(6)}, ${address.longitude.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    setCopiedCoords(true);
    showToast("📍 Koordinatalar nusxalandi!");
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const openExternalMap = (type: "yandex" | "google") => {
    const lat = address.latitude || 41.2995;
    const lon = address.longitude || 69.2401;
    let url = "";
    if (type === "yandex") {
      url = `https://yandex.com/maps/?pt=${lon},${lat}&z=16&l=map`;
    } else {
      url = `https://www.google.com/maps?q=${lat},${lon}`;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const hasSavedDetails = Boolean(
    address.street ||
    address.district ||
    (address.latitude && (address.latitude !== 41.2995 || address.longitude !== 69.2401))
  );

  const availableDistricts = draft.region ? uzbekistanRegionsData[draft.region] || [] : [];

  return (
    <main className="page savedAddressPage" style={{ paddingBottom: "40px" }}>
      {/* Top Bar with Back Button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button
          type="button"
          onClick={onBack}
          className="backButton"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-card-sub, #f1f5f9)",
            border: "1px solid var(--border-color, #e2e8f0)",
            padding: "8px 16px",
            borderRadius: "14px",
            fontSize: "13px",
            fontWeight: "700",
            color: "var(--text-main, #0f172a)",
            cursor: "pointer",
          }}
        >
          ← Profilga qaytish
        </button>

        {!isEditing && hasSavedDetails && (
          <button
            type="button"
            onClick={startEditing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--primary-gradient, linear-gradient(135deg, #be123c, #9f1239))",
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: "14px",
              fontSize: "12.5px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(190,18,60,0.2)",
            }}
          >
            ✏️ Tahrirlash
          </button>
        )}
      </div>

      <div className="pageHeader" style={{ marginBottom: 20 }}>
        <span style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "1px", color: "var(--primary, #be123c)" }}>
          PROFIL & SOZLAMALAR
        </span>
        <h1 style={{ fontSize: "24px", fontWeight: "900", margin: "4px 0" }}>Manzillarim</h1>
        <p style={{ color: "var(--text-muted, #64748b)", fontSize: "13px" }}>
          Buyurtmalarni tezkor va aniq yetkazib berish uchun asosiy manzilingiz va lokatsiyangiz
        </p>
      </div>

      {isEditing ? (
        /* Edit Form */
        <form
          onSubmit={handleSave}
          style={{
            background: "var(--bg-card, #ffffff)",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "24px",
            padding: "20px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-color, #e2e8f0)", paddingBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "850" }}>📍 Manzilni tahrirlash</h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>Aniq lokatsiya</span>
          </div>

          {/* GPS Auto Detect Button */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={locationLoading}
              style={{
                flex: "1 1 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "12px 18px",
                background: "linear-gradient(135deg, #0284c7, #0369a1)",
                color: "#fff",
                border: "none",
                borderRadius: "16px",
                fontWeight: "750",
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(2,132,199,0.25)",
              }}
            >
              {locationLoading ? (
                <>⏳ Joylashuv aniqlanmoqda...</>
              ) : (
                <>🎯 Hozirgi joylashuvimni aniqlash (GPS)</>
              )}
            </button>
          </div>

          {/* Interactive Map */}
          <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid var(--border-color)" }}>
            <LocationPicker
              latitude={draft.latitude || 41.2995}
              longitude={draft.longitude || 69.2401}
              onChange={(lat, lon) => {
                setDraft((prev) => ({ ...prev, latitude: lat, longitude: lon }));
                onUpdateMapPosition(lat, lon);
              }}
            />
          </div>

          {/* Region & District Pickers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)" }}>Viloyat / Shahar:</span>
              <select
                value={draft.region || "Toshkent sh."}
                onChange={(e) => {
                  const newReg = e.target.value;
                  const newDistList = uzbekistanRegionsData[newReg] || [];
                  setDraft((prev) => ({
                    ...prev,
                    region: newReg,
                    district: newDistList[0] || "",
                  }));
                }}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "13.5px",
                }}
              >
                {Object.keys(uzbekistanRegionsData).map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)" }}>Tuman / Shaharcha:</span>
              <select
                value={draft.district || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, district: e.target.value }))}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "13.5px",
                }}
              >
                {availableDistricts.length > 0 ? (
                  availableDistricts.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))
                ) : (
                  <option value="">Tumanni tanlang</option>
                )}
              </select>
            </label>
          </div>

          {/* Street & House & Apartment */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)" }}>Ko'cha nomi:</span>
              <input
                type="text"
                value={draft.street || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, street: e.target.value }))}
                placeholder="Masalan: Amir Temur ko'chasi"
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "13.5px",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)" }}>Uy:</span>
              <input
                type="text"
                value={draft.house || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, house: e.target.value }))}
                placeholder="42"
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "13.5px",
                }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)" }}>Xonadon:</span>
              <input
                type="text"
                value={draft.apartment || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, apartment: e.target.value }))}
                placeholder="15"
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  border: "1px solid var(--border-input)",
                  background: "var(--bg-input)",
                  color: "var(--text-main)",
                  fontSize: "13.5px",
                }}
              />
            </label>
          </div>

          {/* Landmark */}
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: "12.5px", fontWeight: "750", color: "var(--text-main)" }}>Mo'ljal (orientir):</span>
            <input
              type="text"
              value={draft.landmark || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, landmark: e.target.value }))}
              placeholder="Masalan: Korzinka ro'parasida, 3-podyezd"
              style={{
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid var(--border-input)",
                background: "var(--bg-input)",
                color: "var(--text-main)",
                fontSize: "13.5px",
              }}
            />
          </label>

          {/* Form Actions */}
          <div style={{ display: "flex", gap: 12, marginTop: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              style={{
                padding: "12px 20px",
                borderRadius: "14px",
                background: "var(--bg-card-sub)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-color)",
                fontWeight: "750",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              style={{
                padding: "12px 24px",
                borderRadius: "14px",
                background: "var(--primary-gradient, linear-gradient(135deg, #be123c, #9f1239))",
                color: "#ffffff",
                border: "none",
                fontWeight: "800",
                fontSize: "13.5px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(190,18,60,0.25)",
              }}
            >
              ✓ Manzilni saqlash
            </button>
          </div>
        </form>
      ) : hasSavedDetails ? (
        /* Enhanced Saved Address Card View */
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            className="savedAddressCardModern"
            style={{
              background: "var(--bg-card, #ffffff)",
              border: "1.5px solid var(--border-color, #f1e4e8)",
              borderRadius: "24px",
              padding: "24px 22px",
              boxShadow: "0 12px 36px rgba(190,18,60,0.06), 0 2px 8px rgba(0,0,0,0.03)",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top Badge & Status */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: "999px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#059669", letterSpacing: "0.5px" }}>
                  ASOSIY YETKAZIB BERISH MANZILI
                </span>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={startEditing}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "12px",
                    background: "var(--bg-card-sub)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-main)",
                    fontSize: "12px",
                    fontWeight: "750",
                    cursor: "pointer",
                  }}
                >
                  ✏️ Tahrirlash
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "6px 12px",
                    borderRadius: "12px",
                    background: "rgba(225, 29, 72, 0.08)",
                    border: "1px solid rgba(225, 29, 72, 0.2)",
                    color: "#e11d48",
                    fontSize: "12px",
                    fontWeight: "750",
                    cursor: "pointer",
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>

            {/* Address Main Info */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "18px",
                  background: "linear-gradient(135deg, rgba(225,29,72,0.12) 0%, rgba(225,29,72,0.04) 100%)",
                  border: "1px solid rgba(225,29,72,0.2)",
                  color: "#be123c",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "26px",
                  flexShrink: 0,
                }}
              >
                📍
              </div>

              <div style={{ flex: 1 }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", fontWeight: "850", color: "var(--text-main)" }}>
                  {address.region || "O'zbekiston"}
                  {address.district ? `, ${address.district}` : ""}
                </h3>

                <p style={{ margin: "0 0 6px 0", fontSize: "14px", color: "var(--text-main)", lineHeight: "1.5" }}>
                  {[
                    address.street ? `${address.street}` : null,
                    address.house ? `${address.house}-uy` : null,
                    address.apartment ? `${address.apartment}-xonadon` : null,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Ko'cha kiritilmagan"}
                </p>

                {address.landmark && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: "10px", background: "var(--bg-card-sub)", fontSize: "12px", color: "var(--text-muted)", marginTop: 2 }}>
                    <span>🚩 Mo'ljal:</span>
                    <b style={{ color: "var(--text-main)" }}>{address.landmark}</b>
                  </div>
                )}
              </div>
            </div>

            {/* Coordinates & Copy Row */}
            {address.latitude && address.longitude && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: "16px",
                  background: "var(--bg-card-sub)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "14px" }}>🌐</span>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "10.5px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>
                      GPS Koordinatalari
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: "750", fontFamily: "monospace", color: "var(--text-main)" }}>
                      {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyCoordinates}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: "10px",
                    background: copiedCoords ? "#10b981" : "var(--bg-card)",
                    color: copiedCoords ? "#ffffff" : "var(--text-main)",
                    border: "1px solid var(--border-color)",
                    fontSize: "12px",
                    fontWeight: "750",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {copiedCoords ? "✓ Nusxalandi" : "📋 Nusxalash"}
                </button>
              </div>
            )}

            {/* Interactive Leaflet Map Preview */}
            <div style={{ borderRadius: "18px", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.05)" }}>
              <LocationPicker
                latitude={address.latitude || 41.2995}
                longitude={address.longitude || 69.2401}
                onChange={(lat, lon) => {
                  setAddress((prev) => ({ ...prev, latitude: lat, longitude: lon }));
                  onUpdateMapPosition(lat, lon);
                }}
              />
            </div>

            {/* Map Navigation & GPS Refresh Actions */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => openExternalMap("yandex")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: "14px",
                  background: "#fc3f1d",
                  color: "#fff",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(252,63,29,0.2)",
                }}
              >
                <span>🗺️</span> Yandex Xaritada ochish
              </button>

              <button
                type="button"
                onClick={() => openExternalMap("google")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: "14px",
                  background: "#4285F4",
                  color: "#fff",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(66,133,244,0.2)",
                }}
              >
                <span>📍</span> Google Maps-da ochish
              </button>

              <button
                type="button"
                onClick={onRequestLocation}
                disabled={locationLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 14px",
                  borderRadius: "14px",
                  background: "var(--bg-card-sub)",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-color)",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  cursor: "pointer",
                }}
              >
                {locationLoading ? "⏳ Aniqlanmoqda..." : "🎯 Hozirgi joylashuvni yangilash"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px dashed var(--border-color)",
            borderRadius: "24px",
            padding: "40px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(190, 18, 60, 0.08)",
              display: "grid",
              placeItems: "center",
              fontSize: "32px",
              color: "var(--primary)",
            }}
          >
            📍
          </div>

          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "850" }}>Manzil hali saqlanmagan</h3>
          <p style={{ margin: 0, color: "var(--text-muted, #64748b)", fontSize: "13.5px", maxWidth: "420px", lineHeight: "1.5" }}>
            Buyurtmalaringizni o‘z vaqtida va aniq manzilga yetkazishimiz uchun joylashuvingizni belgilang yoki qo‘lda kiriting.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={locationLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                background: "linear-gradient(135deg, #0284c7, #0369a1)",
                color: "#ffffff",
                border: "none",
                borderRadius: "16px",
                fontSize: "13.5px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(2,132,199,0.25)",
              }}
            >
              {locationLoading ? "⏳ Aniqlanmoqda..." : "🎯 Hozirgi joylashuvni aniqlash"}
            </button>

            <button
              type="button"
              onClick={startEditing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 22px",
                background: "var(--primary-gradient, linear-gradient(135deg, #be123c, #9f1239))",
                color: "#ffffff",
                border: "none",
                borderRadius: "16px",
                fontSize: "13.5px",
                fontWeight: "800",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(190,18,60,0.25)",
              }}
            >
              ✍️ Manzil kiritish
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
