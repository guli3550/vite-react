import { useState, useEffect, useMemo, type FC } from "react";
import { buildApiUrl } from "../lib/apiOrigin";
import type { Language } from "../utils/translations";
import { copyToClipboard } from "../utils/clipboard";

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
  const [adminPromos, setAdminPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Management State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    status: "found" | "not_found";
    promo?: AdminPromo;
    searchedCode?: string;
  } | null>(null);

  // User deleted & added promo codes
  const [deletedCodes, setDeletedCodes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("guli_deleted_promos") || "[]");
    } catch {
      return [];
    }
  });

  const [customAddedPromos, setCustomAddedPromos] = useState<AdminPromo[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("guli_added_promos") || "[]");
    } catch {
      return [];
    }
  });

  // Fetch admin created promos
  useEffect(() => {
    let isMounted = true;
    fetch(buildApiUrl("/api/promos"))
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.data)) {
          setAdminPromos(data.data);
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

  // Compute active displayed promos
  const combinedPromos = useMemo(() => {
    const map = new Map<string, AdminPromo>();
    for (const p of adminPromos) {
      if (!deletedCodes.includes(p.code.toUpperCase())) {
        map.set(p.code.toUpperCase(), p);
      }
    }
    for (const p of customAddedPromos) {
      if (!deletedCodes.includes(p.code.toUpperCase())) {
        map.set(p.code.toUpperCase(), p);
      }
    }
    return Array.from(map.values());
  }, [adminPromos, customAddedPromos, deletedCodes]);

  const handleCopy = async (code: string, isActive: boolean) => {
    if (!isActive) {
      onShowToast("Bu promokod muddati tugagan yoki nofaol");
      return;
    }
    await copyToClipboard(code);
    setCopiedCode(code);
    onShowToast(`✓ ${code} promokodi nusxalandi!`);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Search promo from admin system
  const handleSearchPromo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) {
      onShowToast("Iltimos, promokod nomini kiriting");
      return;
    }

    setIsSearching(true);
    setSearchResult(null);

    try {
      // 1. Check in already loaded admin promos list
      const matched = adminPromos.find(
        (p) => p.code.trim().toUpperCase() === query
      );

      if (matched) {
        setSearchResult({
          status: "found",
          promo: matched,
          searchedCode: query,
        });
        setIsSearching(false);
        return;
      }

      // 2. Query backend validate endpoint
      const res = await fetch(buildApiUrl("/api/promo/validate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: query, subtotal: 100000 }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.data) {
        const foundPromo: AdminPromo = {
          id: data.data.id || query,
          code: data.data.code || query,
          discount_type: data.data.discount_type || "percent",
          discount_value: Number(data.data.discount_value || data.data.discount || 10),
          min_order_amount: data.data.min_order_amount || null,
          max_discount_amount: data.data.max_discount_amount || null,
          expires_at: data.data.expires_at || null,
          status: "active",
          statusLabel: "Faol",
        };
        setSearchResult({
          status: "found",
          promo: foundPromo,
          searchedCode: query,
        });
      } else {
        setSearchResult({
          status: "not_found",
          searchedCode: query,
        });
      }
    } catch {
      setSearchResult({
        status: "not_found",
        searchedCode: query,
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Add promo to user list
  const handleAddPromo = (promoToAdd: AdminPromo) => {
    const code = promoToAdd.code.toUpperCase();
    // Remove from deleted list if it was deleted
    const updatedDeleted = deletedCodes.filter((c) => c !== code);
    setDeletedCodes(updatedDeleted);
    localStorage.setItem("guli_deleted_promos", JSON.stringify(updatedDeleted));

    // Add to custom added list if not present
    if (!customAddedPromos.some((p) => p.code.toUpperCase() === code)) {
      const updatedAdded = [...customAddedPromos, promoToAdd];
      setCustomAddedPromos(updatedAdded);
      localStorage.setItem("guli_added_promos", JSON.stringify(updatedAdded));
    }

    onShowToast(`✓ ${code} promokodi ro'yxatga qo'shildi!`);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {}
    setSearchResult(null);
    setSearchQuery("");
  };

  // Delete/Remove promo from user list
  const handleDeletePromo = (code: string) => {
    const upper = code.toUpperCase();
    const nextDeleted = [...new Set([...deletedCodes, upper])];
    setDeletedCodes(nextDeleted);
    localStorage.setItem("guli_deleted_promos", JSON.stringify(nextDeleted));

    const nextAdded = customAddedPromos.filter((p) => p.code.toUpperCase() !== upper);
    setCustomAddedPromos(nextAdded);
    localStorage.setItem("guli_added_promos", JSON.stringify(nextAdded));

    onShowToast(`✓ ${code} promokodi ro‘yxatdan o‘chirildi`);
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
    } catch {}
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
    <div className="modalBackdrop modalBackdropCenter" onMouseDown={onClose}>
      <div
        className="modalCard profileExtraModal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          maxHeight: "88vh",
          overflowY: "auto",
          backgroundColor: "var(--bg-card, #ffffff)",
          color: "var(--text-main, #0f172a)",
          border: "1px solid var(--border-color, #e2e8f0)",
          borderRadius: "24px",
        }}
      >
        <div className="modalHeader" style={{ borderBottom: "1px solid var(--border-color, #f1f5f9)" }}>
          <div className="modalTitleWrap">
            <span className="modalEyebrow" style={{ color: "var(--primary, #e11d48)" }}>RASMIY TAKLIFLAR</span>
            <h2 style={{ color: "var(--text-main, #0f172a)", margin: "4px 0 0" }}>Promokodlar va Kuponlar</h2>
          </div>
          <button className="modalCloseBtn" onClick={onClose} aria-label="Yopish">
            ×
          </button>
        </div>

        <div className="modalBodyContent" style={{ padding: "4px 0" }}>
          {/* SEARCH FOR PROMO SECTION */}
          <form
            onSubmit={handleSearchPromo}
            style={{
              marginBottom: "16px",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Admin promokodini qidiring (masalan: GULI2025)..."
              style={{
                flex: 1,
                padding: "12px 14px",
                borderRadius: "14px",
                border: "1px solid var(--border-color, #cbd5e1)",
                backgroundColor: "var(--bg-card-hover, #f8fafc)",
                color: "var(--text-main, #0f172a)",
                fontSize: "13.5px",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isSearching}
              style={{
                padding: "12px 18px",
                borderRadius: "14px",
                border: "none",
                backgroundColor: "var(--primary, #e11d48)",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13.5px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                opacity: isSearching ? 0.7 : 1,
              }}
            >
              {isSearching ? "⏳ Qidirilmoqda..." : "🔍 Qidirish"}
            </button>
          </form>

          {/* SEARCH RESULT DISPLAY (FOUND OR NOT FOUND) */}
          {searchResult && (
            <div style={{ marginBottom: "18px" }}>
              {searchResult.status === "found" && searchResult.promo ? (
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "18px",
                    background: "linear-gradient(135deg, rgba(22, 163, 74, 0.08) 0%, rgba(34, 197, 94, 0.12) 100%)",
                    border: "1.5px solid #86efac",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span
                          style={{
                            fontWeight: 900,
                            letterSpacing: "1px",
                            fontSize: "16px",
                            color: "var(--text-main, #0f172a)",
                            backgroundColor: "var(--bg-card, #ffffff)",
                            padding: "4px 10px",
                            borderRadius: "10px",
                            border: "1px solid #86efac",
                          }}
                        >
                          {searchResult.promo.code}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: searchResult.promo.status === "active" ? "#dcfce7" : "#fee2e2",
                            color: searchResult.promo.status === "active" ? "#15803d" : "#b91c1c",
                            border: `1px solid ${searchResult.promo.status === "active" ? "#86efac" : "#fca5a5"}`,
                          }}
                        >
                          {searchResult.promo.status === "active" ? "● Faol (Aktiv)" : "✕ Muddati tugagan"}
                        </span>
                      </div>

                      <div style={{ marginTop: "8px", fontSize: "14px", fontWeight: 800, color: "var(--primary, #e11d48)" }}>
                        {searchResult.promo.discount_type === "percent"
                          ? `${searchResult.promo.discount_value}% Chegirma`
                          : `${Number(searchResult.promo.discount_value).toLocaleString("uz-UZ")} so'm chegirma`}
                      </div>

                      <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                        Amal qilish muddati: <b>{formatExpiry(searchResult.promo.expires_at)}</b>
                        {searchResult.promo.min_order_amount ? (
                          <span> • Min. xarid: <b>{Number(searchResult.promo.min_order_amount).toLocaleString("uz-UZ")} so'm</b></span>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => handleAddPromo(searchResult.promo!)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: "12px",
                          border: "none",
                          backgroundColor: "#16a34a",
                          color: "#ffffff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        ➕ Ro'yxatga qo'shish
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleCopy(searchResult.promo!.code, searchResult.promo!.status === "active");
                          if (onApplyPromo) onApplyPromo(searchResult.promo!.code);
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "12px",
                          border: "1px solid var(--border-color, #cbd5e1)",
                          backgroundColor: "var(--bg-card, #ffffff)",
                          color: "var(--text-main, #334155)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        📋 Nusxalash
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* NOT FOUND STATE */
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "18px",
                    background: "linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(248, 113, 113, 0.12) 100%)",
                    border: "1.5px solid #fca5a5",
                    textAlign: "center",
                  }}
                >
                  <span style={{ fontSize: "28px", display: "block", marginBottom: "4px" }}>❌</span>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#b91c1c", marginBottom: "4px" }}>
                    "{searchResult.searchedCode}" promokodi topilmadi
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                    Ushbu promokod mavjud emas yoki admin tomonidan kiritilmagan. Kodni to'g'ri kiritganingizni tekshiring.
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--text-main, #0f172a)" }}>
              Mavjud promokodlar ({combinedPromos.length})
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted, #64748b)" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
              <p style={{ margin: 0, fontSize: "13px" }}>Promokodlar tekshirilmoqda...</p>
            </div>
          ) : combinedPromos.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 16px",
                backgroundColor: "var(--bg-card-hover, #f8fafc)",
                borderRadius: "20px",
                border: "1px dashed var(--border-color, #cbd5e1)",
                margin: "12px 0",
              }}
            >
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>🎟️</div>
              <h4 style={{ margin: "0 0 6px", fontSize: "15px", color: "var(--text-main, #334155)", fontWeight: 700 }}>
                Hozircha saqlangan promokodlar yo‘q
              </h4>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted, #64748b)", lineHeight: 1.5 }}>
                Admin promokodini yuqoridagi qidiruv maydoni orqali topib, ro'yxatingizga qo'shishingiz mumkin.
              </p>
            </div>
          ) : (
            <div className="promoCardsList" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {combinedPromos.map((p) => {
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
                      opacity: isActive ? 1 : 0.72,
                      border: isActive ? "1.5px solid var(--primary-light, #fbcfe8)" : "1px solid var(--border-color, #e2e8f0)",
                      backgroundColor: "var(--bg-card, #ffffff)",
                      padding: "14px 16px",
                      borderRadius: "18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div className="promoCardLeft" style={{ flex: 1, minWidth: "180px" }}>
                      <div className="promoCodeHeader" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span className="promoCodeBadge" style={{ fontWeight: 800, letterSpacing: "1px" }}>
                          {p.code}
                        </span>
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
                                : "var(--bg-card-hover, #f1f5f9)",
                            color:
                              p.status === "active"
                                ? "#15803d"
                                : p.status === "expired"
                                ? "#b91c1c"
                                : p.status === "exhausted"
                                ? "#c2410c"
                                : "var(--text-muted, #64748b)",
                            border: `1px solid ${
                              p.status === "active"
                                ? "#86efac"
                                : p.status === "expired"
                                ? "#fca5a5"
                                : p.status === "exhausted"
                                ? "#fdba74"
                                : "var(--border-color, #cbd5e1)"
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

                      <strong className="promoDiscountText" style={{ color: isActive ? "var(--primary, #be185d)" : "var(--text-muted, #475569)", marginTop: "4px", display: "block" }}>
                        {discountText}
                      </strong>

                      <div style={{ marginTop: "4px", fontSize: "11px", color: "var(--text-muted, #64748b)", display: "flex", flexDirection: "column", gap: "2px" }}>
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

                    <div className="promoCardRight" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isActive ? (
                        <button
                          type="button"
                          className={`promoCopyBtn ${copiedCode === p.code ? "copied" : ""}`}
                          onClick={() => {
                            handleCopy(p.code, true);
                            if (onApplyPromo) onApplyPromo(p.code);
                          }}
                          style={{
                            padding: "8px 14px",
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
                            color: "var(--text-muted, #94a3b8)",
                            fontWeight: 600,
                            padding: "6px 10px",
                            backgroundColor: "var(--bg-card-hover, #f1f5f9)",
                            borderRadius: "10px",
                          }}
                        >
                          Yaroqsiz
                        </span>
                      )}

                      {/* Delete Promo Button */}
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(p.code)}
                        title="Promokodni o'chirish"
                        style={{
                          padding: "7px 10px",
                          borderRadius: "12px",
                          border: "1px solid var(--border-color, #cbd5e1)",
                          backgroundColor: "var(--bg-card-hover, #f8fafc)",
                          color: "#ef4444",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        🗑️ O'chirish
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="modalFooterSingle" style={{ borderTop: "1px solid var(--border-color, #f1f5f9)", marginTop: "14px", paddingTop: "12px" }}>
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
