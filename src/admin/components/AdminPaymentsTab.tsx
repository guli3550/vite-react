import { useEffect, useRef, useState } from "react";
import { MetricCard } from "./AdminUIComponents";
import { sendAdminReply, updateConversationMetadata } from "../../utils/chatSync";

export type PaymentTx = {
  id: string;
  dbId?: string;
  telegramId?: number;
  orderId: string;
  customerName: string;
  amount: number;
  method: "card" | "click" | "payme";
  status: "verified" | "pending" | "rejected";
  paymentStatus?: string;
  receiptUrl: string;
  receiptMime?: string;
  timestamp: string;
};

const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const money = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("uz-UZ")} so'm`;

const paymentMethod = (value: unknown): PaymentTx["method"] => {
  const p = String(value || "").toLowerCase();
  if (p.includes("click")) return "click";
  if (p.includes("payme")) return "payme";
  return "card";
};

const paymentState = (o: any): PaymentTx["status"] => {
  const ps = String(o?.payment_status || "").toLowerCase();
  if (ps === "rejected") return "rejected";
  if (ps === "verified") return "verified";
  if (ps === "pending" || ps === "receipt_uploaded") return "pending";
  // Legacy rows: only infer paid from order status when payment_status is absent.
  if (!ps && ["Qabul qilindi", "Yetkazildi"].includes(String(o?.status || ""))) return "verified";
  return "pending";
};

async function signedReceipt(id: string, adminToken: string) {
  if (!id) return null;
  try {
    const r = await fetch(`${API}/api/admin/orders/${encodeURIComponent(id)}/payment-receipt`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.success) return j.data || null;
  } catch {}
  return null;
}

export function AdminPaymentsTab({ notify }: { notify: (m: string) => void }) {
  const [payments, setPayments] = useState<PaymentTx[]>([]);
  const [filterMethod, setFilterMethod] = useState("all");
  const [previewTx, setPreviewTx] = useState<PaymentTx | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTx, setSelectedTx] = useState<PaymentTx | null>(null);

  const token = () => sessionStorage.getItem("guli_admin_token") || "";

  const fetchRealPayments = async () => {
    const adminToken = token();
    if (!adminToken) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/orders?limit=500`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.message || `Server xatosi (${r.status})`);
      const orders = Array.isArray(j.data) ? j.data : [];
      const loaded = await Promise.all(orders.map(async (o: any) => {
        const receipt = o.payment_receipt_path ? await signedReceipt(String(o.id || ""), adminToken) : null;
        return {
          id: `TX-${String(o.id || o.order_number).slice(-6)}`,
          dbId: String(o.id || ""),
          telegramId: Number(o.telegram_id) || undefined,
          orderId: String(o.order_number || o.id || "—"),
          customerName: o.first_name || o.username || o.phone || "Mijoz",
          amount: Number(o.total || 0),
          method: paymentMethod(o.payment),
          status: paymentState(o),
          paymentStatus: String(o.payment_status || ""),
          receiptUrl: receipt?.receipt_url || o.receipt_url || o.receiptUrl || "",
          receiptMime: String(o.payment_receipt_path || "").toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*",
          timestamp: o.created_at || new Date().toISOString(),
        } as PaymentTx;
      }));
      setPayments(loaded);
    } catch (e) {
      notify(e instanceof Error ? e.message : "To‘lovlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRealPayments();
    const timer = window.setInterval(fetchRealPayments, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const handleVerify = async (tx: PaymentTx, newStatus: "verified" | "rejected") => {
    if (!tx.dbId) return notify("Buyurtmaning DB ID si topilmadi");
    setBusyId(tx.id);
    try {
      const adminToken = token();
      const paymentRes = await fetch(`${API}/api/admin/orders/${encodeURIComponent(tx.dbId)}/payment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ payment_status: newStatus }),
      });
      const paymentJson = await paymentRes.json().catch(() => ({}));
      if (!paymentRes.ok || !paymentJson.success) throw new Error(paymentJson.message || "To‘lov statusini saqlab bo‘lmadi");

      const orderStatus = newStatus === "verified" ? "Qabul qilindi" : "Bekor qilindi";
      const orderRes = await fetch(`${API}/api/admin/orders/${encodeURIComponent(tx.dbId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: orderStatus }),
      });
      const orderJson = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok || !orderJson.success) throw new Error(orderJson.message || "Buyurtma statusini saqlab bo‘lmadi");

      setPayments((list) => list.map((p) => p.id === tx.id ? { ...p, status: newStatus, paymentStatus: newStatus } : p));
      setPreviewTx((p) => p?.id === tx.id ? { ...p, status: newStatus, paymentStatus: newStatus } : p);

      const recipient = tx.telegramId ? String(tx.telegramId) : "guest-user";
      const msg = newStatus === "verified"
        ? `🔔 №${tx.orderId} buyurtmangizning karta to‘lovi tasdiqlandi. Status: "Qabul qilindi". Rahmat! 🌸`
        : `⚠️ №${tx.orderId} buyurtmangizning to‘lov cheki rad etildi. Iltimos, to‘g‘ri chek yuboring.`;
      sendAdminReply(recipient, msg);
      updateConversationMetadata(recipient, { lastOrderStatus: orderStatus, lastOrderNumber: tx.orderId, lastOrderTotal: tx.amount });
      notify(newStatus === "verified" ? "Chek tasdiqlandi va buyurtma statusi yangilandi ✓" : "Chek rad etildi va buyurtma bekor qilindi ✕");
      await fetchRealPayments();
    } catch (e) {
      notify(e instanceof Error ? e.message : "To‘lov statusini o‘zgartirishda xatolik");
    } finally {
      setBusyId(null);
    }
  };

  const handleTriggerUpload = (tx: PaymentTx) => {
    setSelectedTx(tx);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const tx = selectedTx;
    if (!file || !tx?.dbId) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") return notify("Faqat JPG, PNG, WEBP yoki PDF chek yuklang");
    if (file.size > 6 * 1024 * 1024) return notify("Chek 6 MB dan kichik bo‘lishi kerak");

    const reader = new FileReader();
    reader.onload = async () => {
      setBusyId(tx.id);
      try {
        const raw = String(reader.result || "");
        const data = raw.split(",")[1] || "";
        const ext = file.name.split(".").pop() || (file.type === "application/pdf" ? "pdf" : "jpg");
        const r = await fetch(`${API}/api/admin/orders/${encodeURIComponent(tx.dbId)}/payment-receipt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ data, mimeType: file.type, extension: ext }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.success) throw new Error(j.message || "Chekni saqlab bo‘lmadi");
        const next = { ...tx, receiptUrl: j.data?.receipt_url || "", receiptMime: file.type, status: "pending" as const, paymentStatus: "receipt_uploaded" };
        setPayments((list) => list.map((p) => p.id === tx.id ? next : p));
        setPreviewTx((p) => p?.id === tx.id ? next : p);
        notify(`№${tx.orderId} uchun chek serverga saqlandi ✓`);
        await fetchRealPayments();
      } catch (err) {
        notify(err instanceof Error ? err.message : "Chekni saqlashda xatolik");
      } finally {
        setBusyId(null);
        setSelectedTx(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const filtered = payments.filter((p) => filterMethod === "all" || p.method === filterMethod);
  const totalVerified = payments.filter((p) => p.status === "verified").reduce((s, p) => s + p.amount, 0);
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  const receiptView = (tx: PaymentTx, large = false) => {
    if (!tx.receiptUrl) return <div style={{ padding: 24, textAlign: "center" }}>🧾 Chek yuklanmagan</div>;
    if (tx.receiptMime === "application/pdf") return <iframe title="To‘lov cheki" src={tx.receiptUrl} style={{ width: "100%", height: large ? "60vh" : 260, border: 0 }} />;
    return <img src={tx.receiptUrl} alt="To‘lov cheki" style={{ width: "100%", height: large ? "60vh" : 260, objectFit: "contain" }} />;
  };

  return (
    <div className="dash">
      <input ref={fileInputRef} type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} />
      <div className="metricGrid">
        <MetricCard label="Tasdiqlangan karta to‘lovlari" value={money(totalVerified)} icon="💳" tone="rose" />
        <MetricCard label="Kutilayotgan cheklar" value={`${pendingCount} ta`} icon="⏳" />
        <MetricCard label="Click / Payme Online" value="Faol" icon="⚡" />
        <MetricCard label="Chek nazorati" value="Faol" icon="🛡️" />
      </div>
      <section className="proPanel tablePanel">
        <div className="filterRow">
          {[["all", "Barcha karta to‘lovlari"], ["card", "💳 Karta o‘tkazmasi"], ["click", "📲 Click"], ["payme", "📱 Payme"]].map(([v, label]) => (
            <button key={v} type="button" className={filterMethod === v ? "active" : ""} onClick={() => setFilterMethod(v)}>{label}</button>
          ))}
        </div>
        <div className="panelHead">
          <div><span className="proEyebrow">CARD PAYMENTS & RECEIPTS</span><h2>Kartadan to‘lovlar va Cheklar ({filtered.length}) {loading ? "⏳" : ""}</h2></div>
          <button type="button" className="proPrimary secondary" onClick={fetchRealPayments}>🔄 Yangilash</button>
        </div>
        <div className="tableScroll">
          <table>
            <thead><tr><th>Chek rasmi</th><th>Tranzaksiya</th><th>Buyurtma №</th><th>Mijoz</th><th>Summa</th><th>Usul</th><th>Status</th><th>Vaqt</th><th>Amallar</th></tr></thead>
            <tbody>{filtered.map((tx) => (
              <tr key={tx.id}>
                <td><button type="button" onClick={() => setPreviewTx(tx)} style={{ width: 58, height: 58, padding: 0, borderRadius: 10, overflow: "hidden", border: "2px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" }}>{tx.receiptUrl ? (tx.receiptMime === "application/pdf" ? "📄" : <img src={tx.receiptUrl} alt="Chek" style={{ width: "100%", height: "100%", objectFit: "cover" }} />) : "🧾"}</button></td>
                <td><b className="promoCode">{tx.id}</b></td>
                <td><b>{tx.orderId}</b></td>
                <td>{tx.customerName}</td>
                <td><b style={{ color: "#059669" }}>{money(tx.amount)}</b></td>
                <td><span className="pill">{tx.method === "card" ? "💳 Karta" : tx.method === "click" ? "📲 Click" : "📱 Payme"}</span></td>
                <td><span className={`pill ${tx.status === "pending" ? "mutedPill" : tx.status === "rejected" ? "dangerPill" : ""}`}>{tx.status === "verified" ? "✓ Tasdiqlangan" : tx.status === "rejected" ? "✕ Rad etilgan" : tx.paymentStatus === "receipt_uploaded" ? "🧾 Chek yuklangan" : "⏳ Tekshirilmoqda"}</span></td>
                <td>{new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                <td><div className="actions" style={{ justifyContent: "flex-end", gap: 6 }}>
                  <button type="button" className="proPrimary secondary miniBtn" disabled={busyId === tx.id} onClick={() => handleTriggerUpload(tx)}>📷 Chek yuklash</button>
                  {tx.status === "pending" && <><button type="button" className="proPrimary miniBtn" disabled={busyId === tx.id} onClick={() => handleVerify(tx, "verified")}>Tasdiqlash ✓</button><button type="button" className="dangerBtn" disabled={busyId === tx.id} onClick={() => handleVerify(tx, "rejected")}>Rad etish</button></>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      {previewTx && <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.86)", zIndex: 99999, display: "grid", placeItems: "center", padding: 16 }} onClick={() => setPreviewTx(null)}>
        <div style={{ position: "relative", maxWidth: 760, width: "100%", maxHeight: "92vh", overflow: "auto", background: "#fff", borderRadius: 24, padding: 24 }} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setPreviewTx(null)} style={{ position: "absolute", right: 16, top: 16, zIndex: 2, border: 0, borderRadius: "50%", width: 38, height: 38, fontSize: 20 }}>✕</button>
          <span className="proEyebrow">TO‘LOV CHEKI</span>
          <h2>№ {previewTx.orderId} — To‘lov cheki</h2>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", background: "#f8fafc", padding: 12, borderRadius: 12 }}><span>Mijoz: <b>{previewTx.customerName}</b></span><span>Summa: <b>{money(previewTx.amount)}</b></span><span>Holat: <b>{previewTx.status === "verified" ? "✓ Tasdiqlangan" : previewTx.status === "rejected" ? "✕ Rad etilgan" : "⏳ Kutilmoqda"}</b></span></div>
          <div style={{ marginTop: 16, background: "#0f172a", borderRadius: 16, overflow: "hidden", minHeight: 300 }}>{receiptView(previewTx, true)}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {previewTx.status === "pending" && <><button type="button" className="proPrimary" onClick={() => handleVerify(previewTx, "verified")}>✓ Chekni tasdiqlash</button><button type="button" className="dangerBtn" onClick={() => handleVerify(previewTx, "rejected")}>✕ Rad etish</button></>}
            {previewTx.receiptUrl && <a href={previewTx.receiptUrl} target="_blank" rel="noreferrer" download={`Chek_${previewTx.orderId}`} style={{ padding: "10px 16px", borderRadius: 10, background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 700 }}>📥 Chekni yuklab olish</a>}
          </div>
        </div>
      </div>}
    </div>
  );
}
