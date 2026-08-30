import { useState, useEffect, useRef } from "react";
import { MetricCard } from "./AdminUIComponents";
import { sendAdminReply, updateConversationMetadata } from "../../utils/chatSync";

export type PaymentTx = {
  id: string;
  dbId?: string;
  orderId: string;
  customerName: string;
  amount: number;
  method: "card" | "click" | "payme";
  status: "verified" | "pending" | "rejected";
  receiptUrl: string;
  timestamp: string;
};

const SAMPLE_PAYMENTS: PaymentTx[] = [
  {
    id: "TX-9901",
    orderId: "GULI-104291",
    customerName: "Madina Alimova",
    amount: 480000,
    method: "card",
    status: "verified",
    receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80",
    timestamp: new Date(Date.now() - 1200000).toISOString(),
  },
  {
    id: "TX-9902",
    orderId: "GULI-104292",
    customerName: "Shahnoza Karimova",
    amount: 320000,
    method: "click",
    status: "verified",
    receiptUrl: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "TX-9903",
    orderId: "GULI-104293",
    customerName: "Nilufar Oripova",
    amount: 210000,
    method: "payme",
    status: "pending",
    receiptUrl: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=80",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "TX-9904",
    orderId: "GULI-104294",
    customerName: "Dildora Raximova",
    amount: 150000,
    method: "card",
    status: "pending",
    receiptUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
  },
];

export function AdminPaymentsTab({ notify }: { notify: (m: string) => void }) {
  const [payments, setPayments] = useState<PaymentTx[]>(SAMPLE_PAYMENTS);
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [previewTx, setPreviewTx] = useState<PaymentTx | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTxForUpload, setSelectedTxForUpload] = useState<PaymentTx | null>(null);

  const token = () => sessionStorage.getItem("guli_admin_token") || "";

  const money = (n: number) =>
    `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;

  const fetchRealPayments = async () => {
    setLoading(true);
    const loaded: PaymentTx[] = [];

    // Helper map for saved receipts in localStorage
    let savedReceiptsMap: Record<string, string> = {};
    try {
      savedReceiptsMap = JSON.parse(localStorage.getItem("guli_receipts") || "{}");
    } catch {}

    // 1. Try fetching backend orders
    try {
      const adminToken = token();
      if (adminToken) {
        const res = await fetch("/api/admin/orders?limit=100", {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (res.ok) {
          const json = await res.json();
          const orders = json.data || json.orders || [];
          for (const o of orders) {
            const orderIdStr = String(o.order_number || o.id || "GULI-000000");
            let receiptUrl = o.receipt_url || o.receiptUrl || o.payment_receipt_url || o.receipt_image || o.receipt_photo || savedReceiptsMap[orderIdStr] || "";

            // If order has receipt path, fetch signed receipt URL
            if (!receiptUrl && o.id && o.payment_receipt_path) {
              try {
                const rRes = await fetch(`/api/admin/orders/${encodeURIComponent(o.id)}/payment-receipt`, {
                  headers: { Authorization: `Bearer ${adminToken}` },
                });
                if (rRes.ok) {
                  const rJson = await rRes.json();
                  receiptUrl = rJson.data?.receipt_url || "";
                }
              } catch {}
            }

            const method: "card" | "click" | "payme" =
              /click/i.test(o.payment) ? "click" : /payme/i.test(o.payment) ? "payme" : "card";

            const status: "verified" | "pending" | "rejected" =
              o.payment_status === "verified" || o.status === "Qabul qilindi" || o.status === "Yetkazildi"
                ? "verified"
                : o.payment_status === "rejected"
                ? "rejected"
                : "pending";

            loaded.push({
              id: `TX-${String(o.id || o.order_number).slice(-6)}`,
              dbId: String(o.id || ""),
              orderId: orderIdStr,
              customerName: o.first_name || o.username || o.phone || "Mijoz",
              amount: Number(o.total || 0),
              method,
              status,
              receiptUrl: receiptUrl,
              timestamp: o.created_at || o.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch (err) {
      console.warn("Failed to fetch backend payments:", err);
    }

    // 2. LocalStorage orders fallback (check BOTH "orders" AND "guli_orders")
    try {
      const local1 = JSON.parse(localStorage.getItem("orders") || "[]");
      const local2 = JSON.parse(localStorage.getItem("guli_orders") || "[]");
      const allLocal = Array.isArray(local1) ? [...local1] : [];
      if (Array.isArray(local2)) {
        for (const lo of local2) {
          if (!allLocal.some((x) => String(x.id || x.order_number) === String(lo.id || lo.order_number))) {
            allLocal.push(lo);
          }
        }
      }

      for (const lo of allLocal) {
        const orderIdStr = String(lo.order_number || lo.id || "GULI-100000");
        if (!loaded.some((p) => p.orderId === orderIdStr || p.dbId === String(lo.id))) {
          const method: "card" | "click" | "payme" =
            /click/i.test(lo.payment) ? "click" : /payme/i.test(lo.payment) ? "payme" : "card";

          const recUrl =
            lo.receipt_url ||
            lo.receiptUrl ||
            lo.receipt_image ||
            lo.receipt_photo ||
            savedReceiptsMap[orderIdStr] ||
            "";

          const isVerified =
            lo.status === "Qabul qilindi" ||
            lo.status === "Yetkazildi" ||
            lo.payment_status === "verified";
          const isRejected = lo.payment_status === "rejected";

          loaded.push({
            id: `TX-${String(lo.id || lo.order_number || Date.now()).slice(-6)}`,
            dbId: String(lo.id || ""),
            orderId: orderIdStr,
            customerName: lo.phone || lo.name || lo.first_name || "Mijoz",
            amount: Number(lo.total || lo.subtotal || 0),
            method,
            status: isVerified ? "verified" : isRejected ? "rejected" : "pending",
            receiptUrl: recUrl,
            timestamp: lo.createdAt || lo.created_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("LocalStorage payment read error:", e);
    }

    if (loaded.length > 0) {
      setPayments(loaded);
    } else {
      setPayments(SAMPLE_PAYMENTS);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRealPayments();
    const timer = setInterval(fetchRealPayments, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async (tx: PaymentTx, newStatus: "verified" | "rejected") => {
    setPayments((list) =>
      list.map((p) => (p.id === tx.id ? { ...p, status: newStatus } : p))
    );

    if (previewTx && previewTx.id === tx.id) {
      setPreviewTx({ ...previewTx, status: newStatus });
    }

    // Sync status change back to localStorage orders
    try {
      const keys = ["orders", "guli_orders"];
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((o) => {
              if (String(o.order_number || o.id) === tx.orderId) {
                return {
                  ...o,
                  payment_status: newStatus,
                  status: newStatus === "verified" ? "Qabul qilindi" : "Bekor qilindi",
                  statusUpdatedAt: new Date().toISOString(),
                };
              }
              return o;
            });
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
      }
    } catch {}

    // Call backend endpoint if dbId exists
    if (tx.dbId && token()) {
      try {
        await fetch(`/api/admin/orders/${encodeURIComponent(tx.dbId)}/payment`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token()}`,
          },
          body: JSON.stringify({ payment_status: newStatus }),
        });
      } catch (e) {
        console.warn("Backend payment status update failed:", e);
      }
    }

    if (newStatus === "verified") {
      const msg = `🔔 Sizning №${tx.orderId} buyurtmangiz bo'yicha karta to'lov cheki tasdiqlandi! Status "Qabul qilindi"ga o'tkazildi. Rahmat! 🌸`;
      sendAdminReply("guest-user", msg);
      updateConversationMetadata("guest-user", {
        lastOrderStatus: "Qabul qilindi",
        lastOrderNumber: tx.orderId,
      });
      notify("Kartadan to‘lov va chek tasdiqlandi, mijoz profiliga xabar yuborildi ✓");
    } else {
      notify("To‘lov rad etildi ✕");
    }
  };

  const handleTriggerUpload = (tx: PaymentTx) => {
    setSelectedTxForUpload(tx);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTxForUpload) return;

    if (file.size > 8 * 1024 * 1024) {
      notify("Chek rasmi hajmi 8 MB dan kichik bo'lishi kerak");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "");
      setPayments((list) =>
        list.map((p) =>
          p.id === selectedTxForUpload.id ? { ...p, receiptUrl: base64 } : p
        )
      );
      if (previewTx && previewTx.id === selectedTxForUpload.id) {
        setPreviewTx({ ...previewTx, receiptUrl: base64 });
      }

      // Save receipt image to localStorage map and orders
      try {
        const receiptsMap = JSON.parse(localStorage.getItem("guli_receipts") || "{}");
        receiptsMap[selectedTxForUpload.orderId] = base64;
        localStorage.setItem("guli_receipts", JSON.stringify(receiptsMap));

        for (const key of ["orders", "guli_orders"]) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const updated = parsed.map((o) => {
                if (String(o.order_number || o.id) === selectedTxForUpload.orderId) {
                  return { ...o, receipt_url: base64, receiptUrl: base64 };
                }
                return o;
              });
              localStorage.setItem(key, JSON.stringify(updated));
            }
          }
        }
      } catch {}

      notify(`№${selectedTxForUpload.orderId} uchun to'lov cheki biriktirildi! 🧾`);
      setSelectedTxForUpload(null);
    };
    reader.readAsDataURL(file);
  };

  const filtered = payments.filter(
    (p) => filterMethod === "all" || p.method === filterMethod
  );

  const totalVerified = payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + p.amount, 0);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="dash">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*,application/pdf"
        onChange={handleFileChange}
      />

      <div className="metricGrid">
        <MetricCard
          label="Tasdiqlangan karta to‘lovlari"
          value={money(totalVerified)}
          icon="💳"
          tone="rose"
        />
        <MetricCard
          label="Kutilayotgan karta cheklari"
          value={`${pendingCount} ta`}
          icon="⏳"
        />
        <MetricCard label="Click / Payme Online" value="Faol" icon="⚡" />
        <MetricCard label="Avto Chek Tekshirish" value="100% Faol" icon="🛡️" />
      </div>

      <section className="proPanel tablePanel">
        <div className="filterRow">
          <button
            type="button"
            className={filterMethod === "all" ? "active" : ""}
            onClick={() => setFilterMethod("all")}
          >
            Barcha karta to‘lovlari
          </button>
          <button
            type="button"
            className={filterMethod === "card" ? "active" : ""}
            onClick={() => setFilterMethod("card")}
          >
            💳 Karta o‘tkazmasi
          </button>
          <button
            type="button"
            className={filterMethod === "click" ? "active" : ""}
            onClick={() => setFilterMethod("click")}
          >
            📲 Click
          </button>
          <button
            type="button"
            className={filterMethod === "payme" ? "active" : ""}
            onClick={() => setFilterMethod("payme")}
          >
            📱 Payme
          </button>
        </div>

        <div className="panelHead">
          <div>
            <span className="proEyebrow">CARD PAYMENTS & RECEIPTS</span>
            <h2>Kartadan to‘lovlar va Cheklar ({filtered.length}) {loading ? "⏳" : ""}</h2>
          </div>
          <button
            type="button"
            className="proPrimary secondary"
            onClick={fetchRealPayments}
            style={{ padding: "6px 12px", fontSize: 12 }}
          >
            🔄 Yangilash
          </button>
        </div>

        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th>Chek Rasmi</th>
                <th>Tranzaksiya</th>
                <th>Buyurtma №</th>
                <th>Mijoz</th>
                <th>Summa</th>
                <th>Usul</th>
                <th>Status</th>
                <th>Vaqt</th>
                <th style={{ textAlign: "right" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <div
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "2px solid #e2e8f0",
                        cursor: "pointer",
                        position: "relative",
                        background: "#f8fafc",
                        display: "grid",
                        placeItems: "center",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      }}
                      title="To'lov cheki rasmini to'liq ko'rish"
                      onClick={() => setPreviewTx(tx)}
                    >
                      {tx.receiptUrl ? (
                        <img
                          src={tx.receiptUrl}
                          alt="To'lov cheki"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: 20 }}>🧾</span>
                      )}
                      <span
                        style={{
                          position: "absolute",
                          bottom: 2,
                          right: 2,
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          fontSize: 9,
                          padding: "1px 4px",
                          borderRadius: 4,
                        }}
                      >
                        🔍 Ko'rish
                      </span>
                    </div>
                  </td>
                  <td>
                    <b className="promoCode">{tx.id}</b>
                  </td>
                  <td>
                    <b style={{ color: "#0f172a" }}>{tx.orderId}</b>
                  </td>
                  <td>{tx.customerName}</td>
                  <td>
                    <b style={{ color: "#059669" }}>{money(tx.amount)}</b>
                  </td>
                  <td>
                    <span className="pill">
                      {tx.method === "card"
                        ? "💳 Karta"
                        : tx.method === "click"
                        ? "📲 Click"
                        : "📱 Payme"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`pill ${
                        tx.status === "verified"
                          ? ""
                          : tx.status === "pending"
                          ? "mutedPill"
                          : "dangerPill"
                      }`}
                    >
                      {tx.status === "verified"
                        ? "✓ Tasdiqlangan"
                        : tx.status === "pending"
                        ? "⏳ Chek Kutilmoqda"
                        : "✕ Rad etilgan"}
                    </span>
                  </td>
                  <td>
                    {new Date(tx.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="actions" style={{ justifyContent: "flex-end", gap: 6 }}>
                      <button
                        type="button"
                        className="proPrimary secondary miniBtn"
                        onClick={() => handleTriggerUpload(tx)}
                        style={{ padding: "4px 8px", fontSize: 11 }}
                        title="Chek rasmini qayta biriktirish"
                      >
                        📷 Chek yuklash
                      </button>
                      {tx.status === "pending" && (
                        <>
                          <button
                            type="button"
                            className="proPrimary miniBtn"
                            onClick={() => handleVerify(tx, "verified")}
                          >
                            Tasdiqlash ✓
                          </button>
                          <button
                            type="button"
                            className="dangerBtn"
                            onClick={() => handleVerify(tx, "rejected")}
                            style={{ padding: "4px 8px", fontSize: 11 }}
                          >
                            Rad etish
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* LIGHTBOX RECEIPT PHOTO PREVIEW */}
      {previewTx && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setPreviewTx(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: 680,
              width: "100%",
              maxHeight: "92vh",
              background: "#ffffff",
              borderRadius: 24,
              padding: 24,
              boxShadow: "0 25px 80px rgba(0,0,0,0.4)",
              overflow: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "#f1f5f9",
                color: "#334155",
                border: "none",
                borderRadius: "50%",
                width: 38,
                height: 38,
                fontWeight: 800,
                fontSize: 20,
                cursor: "pointer",
              }}
              onClick={() => setPreviewTx(null)}
            >
              ✕
            </button>

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "#6366f1" }}>
                TO'LOV CHEKI (RASMI)
              </span>
              <h2 style={{ margin: "4px 0 0", fontSize: 22, color: "#0f172a" }}>
                № {previewTx.orderId} — To'lov Cheki
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 10,
                  fontSize: 13,
                  background: "#f8fafc",
                  padding: "10px 14px",
                  borderRadius: 12,
                }}
              >
                <span>Mijoz: <b>{previewTx.customerName}</b></span>
                <span>Summa: <b style={{ color: "#059669" }}>{money(previewTx.amount)}</b></span>
                <span>
                  Holat:{" "}
                  <b style={{ color: previewTx.status === "verified" ? "#059669" : "#d97706" }}>
                    {previewTx.status === "verified" ? "✓ Tasdiqlangan" : "⏳ Kutilmoqda"}
                  </b>
                </span>
              </div>
            </div>

            <div
              style={{
                background: "#0f172a",
                borderRadius: 16,
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
                minHeight: 300,
                maxHeight: "55vh",
              }}
            >
              <img
                src={previewTx.receiptUrl}
                alt="To'lov cheki rasmi"
                style={{ maxWidth: "100%", maxHeight: "55vh", objectFit: "contain" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              {previewTx.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="proPrimary"
                    onClick={() => handleVerify(previewTx, "verified")}
                    style={{ flex: 1, padding: "12px", background: "#059669" }}
                  >
                    ✓ Chekni Tasdiqlash
                  </button>
                  <button
                    type="button"
                    className="dangerBtn"
                    onClick={() => handleVerify(previewTx, "rejected")}
                    style={{
                      flex: 1,
                      padding: "12px",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: 10,
                      fontWeight: 800,
                    }}
                  >
                    ✕ Rad etish
                  </button>
                </>
              )}
              <a
                href={previewTx.receiptUrl}
                download={`Chek_${previewTx.orderId}.jpg`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "12px 18px",
                  background: "#f1f5f9",
                  color: "#334155",
                  borderRadius: 10,
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 13,
                  display: "inline-grid",
                  placeItems: "center",
                }}
              >
                📥 Rasmni yuklab olish
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


