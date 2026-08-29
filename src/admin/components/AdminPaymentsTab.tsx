import { useState } from "react";
import { MetricCard } from "./AdminUIComponents";
import { sendAdminReply, updateConversationMetadata } from "../../utils/chatSync";

type PaymentTx = {
  id: string;
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
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  const money = (n: number) =>
    `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;

  const handleVerify = (tx: PaymentTx, newStatus: "verified" | "rejected") => {
    setPayments((list) =>
      list.map((p) => (p.id === tx.id ? { ...p, status: newStatus } : p))
    );

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

  const filtered = payments.filter(
    (p) => filterMethod === "all" || p.method === filterMethod
  );

  const totalVerified = payments
    .filter((p) => p.status === "verified")
    .reduce((s, p) => s + p.amount, 0);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="dash">
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
        <MetricCard label="Faqat Kartadan To'lovlar" value="100% Karta" icon="🛡️" />
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
            <h2>Kartadan to‘lovlar va Cheklar ({filtered.length})</h2>
          </div>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #cbd5e1",
                        cursor: "pointer",
                        position: "relative",
                      }}
                      title="Chek rasmini to'liq ko'rish"
                      onClick={() => setPreviewReceiptUrl(tx.receiptUrl)}
                    >
                      <img
                        src={tx.receiptUrl}
                        alt="To'lov cheki"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  </td>
                  <td>
                    <b className="promoCode">{tx.id}</b>
                  </td>
                  <td>
                    <b>{tx.orderId}</b>
                  </td>
                  <td>{tx.customerName}</td>
                  <td>
                    <b>{money(tx.amount)}</b>
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
                  <td>
                    {tx.status === "pending" && (
                      <div className="actions">
                        <button
                          type="button"
                          className="proPrimary miniBtn"
                          onClick={() => handleVerify(tx, "verified")}
                        >
                          Chekni tasdiqlash
                        </button>
                        <button
                          type="button"
                          className="dangerBtn"
                          onClick={() => handleVerify(tx, "rejected")}
                        >
                          Rad etish
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lightbox Receipt Preview */}
      {previewReceiptUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 99999,
            display: "grid",
            placeItems: "center",
          }}
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <img
              src={previewReceiptUrl}
              alt="Chek rasmi"
              style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
            />
            <button
              type="button"
              style={{
                position: "absolute",
                top: -16,
                right: -16,
                background: "#ffffff",
                color: "#000",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                fontWeight: 700,
                fontSize: 18,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
              onClick={() => setPreviewReceiptUrl(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

