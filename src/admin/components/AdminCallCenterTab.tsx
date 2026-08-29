import { useState } from "react";
import { MetricCard, EmptyState } from "./AdminUIComponents";

type CallbackTicket = {
  id: string;
  customerName: string;
  phone: string;
  topic: string;
  status: "pending" | "in_progress" | "resolved";
  createdAt: string;
  notes?: string;
};

const INITIAL_TICKETS: CallbackTicket[] = [
  {
    id: "CC-101",
    customerName: "Gulnoza Usmonova",
    phone: "+998 90 123 45 67",
    topic: "O‘lcham maslahati (75B vs 80A)",
    status: "pending",
    createdAt: new Date(Date.now() - 900000).toISOString(),
    notes: "Qayta qo‘ng‘iroq so‘radi. Kechki 18:00 dan keyin qulay.",
  },
  {
    id: "CC-102",
    customerName: "Zilola Aliyeva",
    phone: "+998 97 987 65 43",
    topic: "Toshkent shahri boyicha ekspress yetkazib berish",
    status: "in_progress",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    notes: "Kuryer bilan bog‘landi, soat 15:00 da yetkazadi.",
  },
  {
    id: "CC-103",
    customerName: "Kamola Tursunova",
    phone: "+998 93 456 78 90",
    topic: "To‘lov cheki tasdig‘i",
    status: "resolved",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    notes: "Karta o‘tkazmasi tekshirildi va tasdiqlandi.",
  },
];

export function AdminCallCenterTab({ notify }: { notify: (m: string) => void }) {
  const [tickets, setTickets] = useState<CallbackTicket[]>(INITIAL_TICKETS);
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [selectedTicket, setSelectedTicket] = useState<CallbackTicket | null>(null);
  const [newNote, setNewNote] = useState("");

  const handleUpdateStatus = (
    id: string,
    newStatus: "pending" | "in_progress" | "resolved"
  ) => {
    setTickets((list) =>
      list.map((t) => (t.id === id ? { ...t, status: newStatus } : t))
    );
    notify("Murojaat holati yangilandi ✓");
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newNote.trim()) return;

    setTickets((list) =>
      list.map((t) =>
        t.id === selectedTicket.id
          ? {
              ...t,
              notes: `${t.notes || ""}\n• [${new Date().toLocaleTimeString()}]: ${newNote.trim()}`,
            }
          : t
      )
    );
    setNewNote("");
    notify("Operator izohi saqlandi ✓");
  };

  const filtered = tickets.filter(
    (t) => activeTab === "all" || t.status === "pending" || t.status === "in_progress"
  );

  return (
    <div className="dash">
      <div className="metricGrid">
        <MetricCard
          label="Kutilayotgan qo‘ng‘iroqlar"
          value={`${tickets.filter((t) => t.status === "pending").length} ta`}
          icon="☎️"
          tone="rose"
        />
        <MetricCard
          label="Jarayonda"
          value={`${tickets.filter((t) => t.status === "in_progress").length} ta`}
          icon="🎧"
        />
        <MetricCard
          label="Bugun hal qilindi"
          value={`${tickets.filter((t) => t.status === "resolved").length} ta`}
          icon="✅"
        />
        <MetricCard label="Operatsiyalar liniyasi" value="Ochiq (09:00 - 21:00)" icon="🕒" />
      </div>

      <section className="proPanel tablePanel">
        <div className="filterRow">
          <button
            type="button"
            className={activeTab === "pending" ? "active" : ""}
            onClick={() => setActiveTab("pending")}
          >
            🔥 Faol murojaatlar
          </button>
          <button
            type="button"
            className={activeTab === "all" ? "active" : ""}
            onClick={() => setActiveTab("all")}
          >
            📋 Barcha murojaatlar
          </button>
        </div>

        <div className="panelHead">
          <div>
            <span className="proEyebrow">CALL CENTER & CALLBACK</span>
            <h2>Qayta Qo‘ng‘iroqlar Va Operator Chiptalari ({filtered.length})</h2>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="☎️"
            title="Kutilayotgan qo‘ng‘iroqlar yo‘q"
            description="Barcha mijozlar murojaatiga javob berilgan!"
          />
        ) : (
          <div className="tableScroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Mijoz</th>
                  <th>Telefon</th>
                  <th>Mavzu</th>
                  <th>Status</th>
                  <th>Vaqt</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b className="promoCode">{t.id}</b>
                    </td>
                    <td>
                      <b>{t.customerName}</b>
                    </td>
                    <td>
                      <a href={`tel:${t.phone.replace(/\s/g, "")}`} className="phoneCallLink">
                        📞 {t.phone}
                      </a>
                    </td>
                    <td>{t.topic}</td>
                    <td>
                      <span
                        className={`pill ${
                          t.status === "resolved"
                            ? ""
                            : t.status === "in_progress"
                            ? "bluePill"
                            : "dangerPill"
                        }`}
                      >
                        {t.status === "resolved"
                          ? "✓ Hal etildi"
                          : t.status === "in_progress"
                          ? "🎧 Jarayonda"
                          : "⏳ Kutilmoqda"}
                      </span>
                    </td>
                    <td>
                      {new Date(t.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          type="button"
                          onClick={() => setSelectedTicket(t)}
                        >
                          Izohlar
                        </button>
                        {t.status !== "resolved" && (
                          <button
                            type="button"
                            className="proPrimary miniBtn"
                            onClick={() => handleUpdateStatus(t.id, "resolved")}
                          >
                            Hal etildi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedTicket && (
        <div className="drawerShade" onMouseDown={() => setSelectedTicket(null)}>
          <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawerHead">
              <div>
                <span className="proEyebrow">CALL CENTER TICKET</span>
                <h2>{selectedTicket.customerName}</h2>
                <small>{selectedTicket.phone}</small>
              </div>
              <button type="button" onClick={() => setSelectedTicket(null)}>
                ×
              </button>
            </div>
            <div className="drawerBody">
              <div className="detailHero">
                <span className="orderIcon">☎️</span>
                <div>
                  <b>{selectedTicket.topic}</b>
                  <small>ID: {selectedTicket.id}</small>
                </div>
              </div>

              <div className="detailSection">
                <h3>Operator Izohlari</h3>
                <pre className="operatorNotesBox">
                  {selectedTicket.notes || "Izohlar hali mavjud emas."}
                </pre>

                <form onSubmit={handleAddNote} style={{ marginTop: "12px" }}>
                  <textarea
                    rows={3}
                    className="adminChatInput"
                    placeholder="Yangi izoh yozing..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="proPrimary"
                    style={{ width: "100%", marginTop: "8px" }}
                  >
                    Izoh qo‘shish
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
