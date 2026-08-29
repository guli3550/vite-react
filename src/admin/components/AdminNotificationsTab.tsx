import { useState } from "react";
import { MetricCard } from "./AdminUIComponents";

export type BroadcastMsg = {
  id: string;
  title: string;
  body: string;
  target: "all" | "active_buyers" | "vip";
  sentAt: string;
  recipientsCount: number;
  telegramChannelId?: string;
  isPublishedToTelegram?: boolean;
};

const SAMPLE_BROADCASTS: BroadcastMsg[] = [
  {
    id: "BC-501",
    title: "🌸 Bahoriy kolleksiya yetib keldi!",
    body: "Guli Lingerie eng so'nggi nafis ipak va to'rli to'plamlarini taqdim etadi. Barcha xaridlarga bepul yetkazib berish!",
    target: "all",
    sentAt: new Date(Date.now() - 86400000).toISOString(),
    recipientsCount: 1420,
    telegramChannelId: "@guli_official_channel",
    isPublishedToTelegram: true,
  },
  {
    id: "BC-502",
    title: "🎟 Siz uchun maxsus GULI10 kodi",
    body: "10% chegirma taqdim etuvchi promo-kodimizdan 3 kun davomida foydalaning!",
    target: "active_buyers",
    sentAt: new Date(Date.now() - 259200000).toISOString(),
    recipientsCount: 480,
    telegramChannelId: "@guli_official_channel",
    isPublishedToTelegram: false,
  },
];

export function AdminNotificationsTab({ notify }: { notify: (m: string) => void }) {
  const [broadcasts, setBroadcasts] = useState<BroadcastMsg[]>(() => {
    try {
      const stored = localStorage.getItem("guli_broadcast_announcements");
      return stored ? JSON.parse(stored) : SAMPLE_BROADCASTS;
    } catch {
      return SAMPLE_BROADCASTS;
    }
  });

  // Telegram Channel / Group ID setting
  const [telegramChannelId, setTelegramChannelId] = useState<string>(() => {
    return localStorage.getItem("guli_telegram_channel_id") || "@guli_official_channel";
  });

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMsg, setEditingMsg] = useState<BroadcastMsg | null>(null);

  // Form inputs
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<"all" | "active_buyers" | "vip">("all");
  const [publishToTelegram, setPublishToTelegram] = useState(true);

  const saveBroadcastsToStorage = (list: BroadcastMsg[]) => {
    setBroadcasts(list);
    try {
      localStorage.setItem("guli_broadcast_announcements", JSON.stringify(list));
    } catch {}
  };

  const handleSaveChannelId = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("guli_telegram_channel_id", telegramChannelId.trim());
    notify(`Telegram kanal/guruh ID si saqlandi: ${telegramChannelId} ✅`);
  };

  const handleOpenCreateModal = () => {
    setEditingMsg(null);
    setTitle("");
    setBody("");
    setTarget("all");
    setPublishToTelegram(true);
    setModalOpen(true);
  };

  const handleOpenEditModal = (b: BroadcastMsg) => {
    setEditingMsg(b);
    setTitle(b.title);
    setBody(b.body);
    setTarget(b.target);
    setPublishToTelegram(Boolean(b.isPublishedToTelegram));
    setModalOpen(true);
  };

  const handleDeleteBroadcast = (id: string) => {
    if (!window.confirm("Haqiqatan ham ushbu xabarnomani o'chirmoqchimisiz?")) return;
    const updated = broadcasts.filter((b) => b.id !== id);
    saveBroadcastsToStorage(updated);
    notify("Xabarnoma o'chirildi 🗑️");
  };

  const handlePublishToTelegramChannel = (b: BroadcastMsg) => {
    const channel = telegramChannelId.trim() || "@guli_official_channel";
    const updated = broadcasts.map((item) =>
      item.id === b.id ? { ...item, telegramChannelId: channel, isPublishedToTelegram: true } : item
    );
    saveBroadcastsToStorage(updated);
    notify(`Xabar Telegram kanalga (${channel}) nashr qilindi! ✈️🚀`);
  };

  const handleSaveBroadcastSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    const channel = telegramChannelId.trim() || "@guli_official_channel";

    if (editingMsg) {
      // Edit existing
      const updated = broadcasts.map((b) =>
        b.id === editingMsg.id
          ? {
              ...b,
              title: title.trim(),
              body: body.trim(),
              target,
              telegramChannelId: publishToTelegram ? channel : b.telegramChannelId,
              isPublishedToTelegram: publishToTelegram ? true : b.isPublishedToTelegram,
            }
          : b
      );
      saveBroadcastsToStorage(updated);
      notify("Xabarnoma muvaffaqiyatli tahrirlandi ✓");
    } else {
      // Create new
      const newMsg: BroadcastMsg = {
        id: `BC-${Date.now().toString().slice(-4)}`,
        title: title.trim(),
        body: body.trim(),
        target,
        sentAt: new Date().toISOString(),
        recipientsCount: target === "all" ? 1540 : target === "active_buyers" ? 520 : 120,
        telegramChannelId: publishToTelegram ? channel : undefined,
        isPublishedToTelegram: publishToTelegram,
      };
      saveBroadcastsToStorage([newMsg, ...broadcasts]);
      if (publishToTelegram) {
        notify(`Xabar ${newMsg.recipientsCount} ta foydalanuvchi va Telegram kanalga (${channel}) yuborildi! 🚀✈️`);
      } else {
        notify(`Xabar ${newMsg.recipientsCount} ta foydalanuvchiga yuborildi! 🚀`);
      }
    }

    setModalOpen(false);
  };

  return (
    <div className="dash" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* METRICS GRID */}
      <div className="metricGrid">
        <MetricCard label="Aktiv Obunachilar" value="1,540 ta" icon="🔔" tone="rose" />
        <MetricCard
          label="Oxirgi Xabarnoma"
          value={`${broadcasts[0]?.recipientsCount || 0} kishiga`}
          icon="📢"
        />
        <MetricCard
          label="Telegram Kanal ID"
          value={telegramChannelId || "Ulanmagan"}
          icon="✈️"
        />
        <MetricCard label="Muvaffaqiyatli Yetkazilgan" value="99.4%" icon="✅" />
      </div>

      {/* TELEGRAM CHANNEL / GROUP ID INTEGRATION CARD */}
      <section className="proPanel" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", color: "#ffffff", padding: 20, borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", color: "#bae6fd", textTransform: "uppercase" }}>
              TELEGRAM BOT CHANNEL / GROUP INTEGRATION
            </span>
            <h3 style={{ margin: "4px 0 0", fontSize: 18, color: "#ffffff", fontWeight: 700 }}>
              ✈️ Telegram Kanal / Guruh ID si
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#e0f2fe" }}>
              Xabarnoma va aksiyalar avtomatik nashr qilinishi uchun bot admin bo'lgan kanal yoki guruh usernamesi / ID sini kiriting.
            </p>
          </div>

          <form onSubmit={handleSaveChannelId} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={telegramChannelId}
              onChange={(e) => setTelegramChannelId(e.target.value)}
              placeholder="Masalan: @guli_official yoki -100123456789"
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #7dd3fc",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: 13,
                fontWeight: 600,
                minWidth: 260,
              }}
              required
            />
            <button
              type="submit"
              className="proPrimary"
              style={{ background: "#0f172a", color: "#ffffff", padding: "10px 16px", borderRadius: 10, fontSize: 13, border: "none" }}
            >
              💾 Saqlash
            </button>
          </form>
        </div>
      </section>

      {/* ANNOUNCEMENTS TABLE */}
      <section className="proPanel tablePanel">
        <div className="panelHead">
          <div>
            <span className="proEyebrow">PUSH & BROADCAST ANNOUNCEMENTS</span>
            <h2>Xabarnomalar va Aksiya Yuborish ({broadcasts.length})</h2>
          </div>
          <button type="button" className="proPrimary" onClick={handleOpenCreateModal}>
            + Yangi Xabarnoma Yuborish
          </button>
        </div>

        <div className="tableScroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Sarlavha</th>
                <th>Xabar Matni</th>
                <th>Auditoriya</th>
                <th>Telegram Kanal</th>
                <th>Yuborilgan Vaqt</th>
                <th style={{ textAlign: "right" }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id}>
                  <td>
                    <b className="promoCode">{b.id}</b>
                  </td>
                  <td>
                    <b>{b.title}</b>
                  </td>
                  <td>
                    <p className="broadcastBodyPreview" style={{ maxWidth: 300, margin: 0 }}>
                      {b.body}
                    </p>
                  </td>
                  <td>
                    <span className="pill">
                      {b.target === "all"
                        ? "Barchaga"
                        : b.target === "active_buyers"
                        ? "Aktiv xaridorlarga"
                        : "VIP mijozlarga"}
                    </span>
                  </td>
                  <td>
                    {b.isPublishedToTelegram ? (
                      <span className="pill bluePill" title={b.telegramChannelId}>
                        ✈️ {b.telegramChannelId || telegramChannelId} (Chop etilgan ✅)
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="proPrimary secondary"
                        onClick={() => handlePublishToTelegramChannel(b)}
                        style={{ padding: "4px 8px", fontSize: 11 }}
                      >
                        ✈️ Kanalga Yuborish
                      </button>
                    )}
                  </td>
                  <td>{new Date(b.sentAt).toLocaleDateString("uz-UZ")}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="proPrimary secondary"
                        onClick={() => handleOpenEditModal(b)}
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        title="Tahrirlash"
                      >
                        ✏️ Tahrirlash
                      </button>
                      <button
                        type="button"
                        className="dangerBtn"
                        onClick={() => handleDeleteBroadcast(b.id)}
                        style={{
                          padding: "5px 10px",
                          fontSize: 12,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: 8,
                          cursor: "pointer",
                        }}
                        title="O'chirish"
                      >
                        🗑️ O'chirish
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="modalShade" onMouseDown={() => setModalOpen(false)}>
          <div className="proModal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modalHead">
              <div>
                <span className="proEyebrow">MASS BROADCAST</span>
                <h2>{editingMsg ? "Xabarnomani Tahrirlash" : "Yangi Xabarnoma Yuborish"}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSaveBroadcastSubmit}>
              <div className="formGrid">
                <label>
                  Auditoriya
                  <select
                    value={target}
                    onChange={(e) =>
                      setTarget(e.target.value as "all" | "active_buyers" | "vip")
                    }
                  >
                    <option value="all">Barcha obunachilar (1,540)</option>
                    <option value="active_buyers">Aktiv xaridorlar (520)</option>
                    <option value="vip">VIP Doimiy mijozlar (120)</option>
                  </select>
                </label>
                <label>
                  Xabar Sarlavhasi
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Masalan: 🌸 Yangi Bahoriy to'plam!"
                    required
                  />
                </label>

                <label className="fullRow">
                  Xabar Matni
                  <textarea
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Mijozlar va Telegram kanaliga yuboriluvchi xabar matni..."
                    required
                  />
                </label>

                <label className="fullRow" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", background: "#f0f9ff", padding: "10px 14px", borderRadius: 12, border: "1px solid #bae6fd" }}>
                  <input
                    type="checkbox"
                    checked={publishToTelegram}
                    onChange={(e) => setPublishToTelegram(e.target.checked)}
                    style={{ width: 18, height: 18, margin: 0 }}
                  />
                  <div>
                    <b style={{ fontSize: 13, color: "#0369a1", display: "block" }}>
                      ✈️ Ulangan Telegram Kanal / Guruhga nashr etish ({telegramChannelId})
                    </b>
                    <span style={{ fontSize: 11, color: "#0284c7" }}>
                      Belgilansa, xabar Telegram boti orqali birdaniga ulangan kanalga yuboriladi
                    </span>
                  </div>
                </label>
              </div>

              <div className="modalActions" style={{ marginTop: 20 }}>
                <button type="button" onClick={() => setModalOpen(false)}>
                  Bekor qilish
                </button>
                <button type="submit" className="proPrimary">
                  {editingMsg ? "💾 Saqlash" : "🚀 Yuborish va Nashr Qilish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
