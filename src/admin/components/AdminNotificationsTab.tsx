import { useCallback, useEffect, useMemo, useState } from "react";
import { MetricCard } from "./AdminUIComponents";

export type BroadcastMsg = {
  id: string; title: string; body: string; imageUrl?: string;
  target: "groups" | "users" | "all"; sentAt: string; recipientsCount: number; failedCount?: number;
};
type TelegramGroup = { chat_id: string | number; title: string; username?: string; chat_type: string; bot_status: string; can_post_messages: boolean; active: boolean; updated_at: string };
type ApiResponse = { success?: boolean; message?: string; data?: any };

const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");
const MINI_APP_URL = "https://vite-react-seven-inky-10.vercel.app/?tgapp=v20260829";
function adminRequest(path: string, options: RequestInit = {}) {
  const token = sessionStorage.getItem("guli_admin_token") || "";
  const base = (sessionStorage.getItem("guli_custom_api_url") || API).replace(/\/$/, "");
  return fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
}

export function AdminNotificationsTab({ notify }: { notify: (m: string) => void }) {
  const [broadcasts, setBroadcasts] = useState<BroadcastMsg[]>(() => { try { const raw = localStorage.getItem("guli_broadcast_announcements"); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; } });
  const [registeredGroups, setRegisteredGroups] = useState<TelegramGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [checkingBot, setCheckingBot] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [adImage, setAdImage] = useState("");
  const [buttonText, setButtonText] = useState("🛍️ Online Marketni Ochish");
  const [target, setTarget] = useState<"groups" | "users" | "all">("groups");
  const [lastError, setLastError] = useState("");
  const [botStatus, setBotStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const [telegramChannelId] = useState(() => localStorage.getItem("guli_telegram_channel_id") || "");

  const persist = (list: BroadcastMsg[]) => { setBroadcasts(list); localStorage.setItem("guli_broadcast_announcements", JSON.stringify(list)); };
  const fetchRegisteredGroups = useCallback(async () => {
    setLoadingGroups(true);
    try { const res = await adminRequest("/api/admin/broadcast-chats"); const json: ApiResponse = await res.json().catch(() => ({})); if (!res.ok || json.success === false) throw new Error(json.message || `Server xatosi (${res.status})`); setRegisteredGroups(Array.isArray(json.data?.chats) ? json.data.chats : []); }
    catch (e) { notify(e instanceof Error ? e.message : "Telegram chatlarini yuklab bo'lmadi"); }
    finally { setLoadingGroups(false); }
  }, [notify]);
  useEffect(() => { fetchRegisteredGroups(); }, [fetchRegisteredGroups]);

  const checkBot = async () => {
    setCheckingBot(true);
    try { const res = await adminRequest("/api/admin/telegram-config/test"); const json: ApiResponse = await res.json().catch(() => ({})); if (!res.ok || json.success === false) throw new Error(json.message || `Server xatosi (${res.status})`); setBotStatus("ok"); notify(`Telegram bot ishlayapti${json.data?.botUsername ? `: @${json.data.botUsername}` : ""} ✅`); await fetchRegisteredGroups(); }
    catch (e) { setBotStatus("error"); notify(e instanceof Error ? e.message : "Telegram botni tekshirib bo'lmadi"); }
    finally { setCheckingBot(false); }
  };
  const openCreate = () => { setTitle(""); setBody(""); setAdImage(""); setButtonText("🛍️ Online Marketni Ochish"); setTarget("groups"); setLastError(""); setModalOpen(true); };

  const sendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim(), cleanBody = body.trim(), cleanChannel = telegramChannelId.trim();
    if (!cleanTitle && !cleanBody) return notify("Reklama matnini kiriting");
    if (target !== "users" && !registeredGroups.length && !cleanChannel) return notify("Avval Telegram kanal/guruhni sozlang");
    setIsSending(true); setLastError("");
    try {
      const res = await adminRequest("/api/admin/broadcast-telegram", { method: "POST", body: JSON.stringify({ title: cleanTitle, body: cleanBody, imageUrl: adImage.trim(), target, telegramChannelId: cleanChannel, buttonText: buttonText.trim() || "🛍️ Online Marketni Ochish", buttonUrl: MINI_APP_URL }) });
      const json: ApiResponse = await res.json().catch(() => ({}));
      if (!res.ok || json.success !== true) throw new Error(json.message || `Reklama yuborilmadi (${res.status})`);
      const sent = Number(json.data?.sent || 0), failed = Number(json.data?.failed || 0);
      if (sent <= 0) throw new Error(json.message || "Telegram hech bir chatga reklamani yubormadi");
      const record: BroadcastMsg = { id: `BC-${Date.now()}`, title: cleanTitle, body: cleanBody, imageUrl: adImage.trim() || undefined, target, sentAt: new Date().toISOString(), recipientsCount: sent, failedCount: failed };
      persist([record, ...broadcasts]); setModalOpen(false); notify(json.message || `Reklama ${sent} ta chatga yuborildi ✅`); await fetchRegisteredGroups();
    } catch (e) { const message = e instanceof Error ? e.message : "Reklama yuborishda xatolik"; setLastError(message); notify(`❌ ${message}`); }
    finally { setIsSending(false); }
  };

  const adminGroups = useMemo(() => registeredGroups.filter((g) => g.active && (g.can_post_messages || ["administrator", "creator"].includes(g.bot_status))), [registeredGroups]);
  const lastSent = broadcasts[0]?.recipientsCount || 0;
  return <div className="dash" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div className="metricGrid"><MetricCard label="Bot Admin Chatlar" value={`${adminGroups.length} ta`} icon="👥" tone="rose" /><MetricCard label="Oxirgi muvaffaqiyatli yuborish" value={`${lastSent} chat`} icon="📢" /><MetricCard label="Asosiy Telegram kanal" value={telegramChannelId || "Sozlanmagan"} icon="✈️" /><MetricCard label="Bot holati" value={botStatus === "ok" ? "Online" : botStatus === "error" ? "Xato" : "Tekshirilmagan"} icon={botStatus === "ok" ? "✅" : "🔎"} /></div>
    <section className="proPanel" style={{ background: "linear-gradient(135deg,#4f46e5 0%,#3730a3 100%)", color: "#fff", padding: 22, borderRadius: 20 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}><div style={{ maxWidth: 650 }}><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", color: "#c7d2fe" }}>TELEGRAM BROADCAST</span><h2 style={{ margin: "6px 0", color: "#fff" }}>📢 Reklama va xabarnomalar</h2><p style={{ margin: 0, fontSize: 13, color: "#e0e7ff", lineHeight: 1.5 }}>Faqat haqiqiy Telegram yuborishlar tarixga yoziladi. Xatolik bo‘lsa reklama yuborildi deb ko‘rsatilmaydi.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={checkBot} disabled={checkingBot} style={{ padding: "11px 15px", borderRadius: 11, border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.14)", color: "#fff", fontWeight: 700 }}>{checkingBot ? "⏳ Tekshirilmoqda" : "🤖 Botni tekshirish"}</button><button type="button" onClick={openCreate} style={{ padding: "11px 17px", borderRadius: 11, border: 0, background: "#fff", color: "#3730a3", fontWeight: 800 }}>🚀 Yangi reklama yuborish</button></div></div></section>
    <section className="proPanel"><div className="panelHead"><div><span className="proEyebrow">ACTIVE TELEGRAM TARGETS</span><h2>Yuborish mumkin bo‘lgan chatlar ({adminGroups.length})</h2></div><button type="button" className="proPrimary secondary" onClick={fetchRegisteredGroups} disabled={loadingGroups}>🔄 Yangilash</button></div>{adminGroups.length === 0 ? <p style={{ color: "#64748b" }}>Hozircha bot admin bo‘lgan chat topilmadi. Sozlamalarda asosiy kanal ID sini saqlang yoki botni guruh/kanalga admin qiling.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 10, marginTop: 12 }}>{adminGroups.map((g) => <div key={String(g.chat_id)} style={{ padding: 13, borderRadius: 13, background: "#f8fafc", border: "1px solid #e2e8f0" }}><b>{g.chat_type === "channel" ? "📣" : "👥"} {g.title || "Telegram chat"}</b><div style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>ID: {g.chat_id}{g.username ? ` · @${g.username}` : ""}</div><span style={{ display: "inline-block", marginTop: 7, fontSize: 10, padding: "3px 7px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontWeight: 700 }}>✅ Post qilish mumkin</span></div>)}</div>}</section>
    <section className="proPanel tablePanel"><div className="panelHead"><div><span className="proEyebrow">REAL SEND HISTORY</span><h2>Yuborilgan reklamalar ({broadcasts.length})</h2></div></div>{broadcasts.length === 0 ? <p style={{ color: "#64748b" }}>Hali muvaffaqiyatli reklama yuborilmagan.</p> : <div className="tableScroll"><table><thead><tr><th>ID</th><th>Sarlavha</th><th>Auditoriya</th><th>Yuborildi</th><th>Xatolik</th><th>Vaqt</th></tr></thead><tbody>{broadcasts.map((b) => <tr key={b.id}><td><b className="promoCode">{b.id.slice(-8)}</b></td><td><b>{b.title || "(Sarlavhasiz)"}</b><div className="broadcastBodyPreview">{b.body}</div></td><td>{b.target === "groups" ? "📢 Bot admin chatlar" : b.target === "users" ? "👤 Telegram mijozlar" : "🚀 Barchasi"}</td><td><span className="pill bluePill">✈️ {b.recipientsCount}</span></td><td>{b.failedCount ? <span style={{ color: "#b91c1c" }}>{b.failedCount}</span> : "—"}</td><td>{new Date(b.sentAt).toLocaleString("uz-UZ", { dateStyle: "short", timeStyle: "short" })}</td></tr>)}</tbody></table></div>}</section>
    {modalOpen && <div className="modalShade" onMouseDown={() => !isSending && setModalOpen(false)}><div className="proModal" style={{ maxWidth: 650 }} onMouseDown={(e) => e.stopPropagation()}><div className="modalHead"><div><span className="proEyebrow">NEW BROADCAST</span><h2>📢 Yangi reklama yuborish</h2></div><button type="button" onClick={() => setModalOpen(false)} disabled={isSending}>×</button></div><form onSubmit={sendBroadcast}><div className="formGrid"><label>Maqsadli auditoriya<select value={target} onChange={(e) => setTarget(e.target.value as "groups" | "users" | "all")}><option value="groups">📢 Bot admin bo‘lgan guruhlar/kanallar ({adminGroups.length})</option><option value="users">👤 Telegram mijozlar</option><option value="all">🚀 Barchasi</option></select></label><label>Reklama sarlavhasi<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="🌸 Yangi kolleksiya!" /></label><label className="fullRow">Rasm / Banner URL (ixtiyoriy)<input type="url" value={adImage} onChange={(e) => setAdImage(e.target.value)} placeholder="https://..." /></label><label className="fullRow">Reklama matni<textarea rows={5} required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Aksiya, chegirma yoki mahsulot haqida yozing..." /></label><label className="fullRow">Tugma matni<input value={buttonText} onChange={(e) => setButtonText(e.target.value)} /></label></div>{lastError && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13 }}>❌ {lastError}</div>}<div className="modalActions" style={{ marginTop: 18 }}><button type="button" onClick={() => setModalOpen(false)} disabled={isSending}>Bekor qilish</button><button type="submit" className="proPrimary" disabled={isSending}>{isSending ? "⏳ Telegramga yuborilmoqda..." : "🚀 Reklamani yuborish"}</button></div></form></div></div>}
  </div>;
}
