import React, { useState, useMemo } from "react";
import { AgentOfficeCanvas } from "./agentOffice3d/AgentOfficeCanvas";
import { AGENT_CONFIGS, Agent, AgentTask, AgentEvent, CameraPresetKey } from "./agentOffice3d/types";
import "./agentOffice3d/AgentOffice3D.css";

interface Props {
  agents: Agent[];
  tasks: AgentTask[];
  events: AgentEvent[];
  onRunTask?: (taskId: string) => Promise<void>;
  onStopTask?: (taskId: string) => Promise<void>;
  onRetryTask?: (task: AgentTask) => Promise<void>;
  onCreateTask?: (agentId: string, tool: string, identifier?: string) => Promise<void>;
  onRefresh?: () => Promise<void>;
}

export const AgentOffice3D: React.FC<Props> = ({
  agents,
  tasks,
  events,
  onRunTask,
  onStopTask,
  onRetryTask,
  onCreateTask,
  onRefresh,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"office" | "queue" | "dispatch" | "audit">("office");
  const [camPreset, setCamPreset] = useState<CameraPresetKey>("overview");

  // Task creation inputs inside agent detail modal
  const [modalTool, setModalTool] = useState("catalog_check");
  const [modalInput, setModalInput] = useState("");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Selected agent config & data
  const selectedConfig = selectedAgentId ? AGENT_CONFIGS[selectedAgentId] : null;
  const selectedAgentData = agents.find((a) => a.id === selectedAgentId);
  const agentTasks = tasks.filter((t) => t.agent_id === selectedAgentId);
  const agentEvents = events.filter((e) => e.agent_id === selectedAgentId);

  // Stats calculation
  const workingCount = useMemo(() => {
    return Object.keys(AGENT_CONFIGS).filter((id) => {
      const a = agents.find((x) => x.id === id);
      const hasActive = tasks.some((t) => t.agent_id === id && ["queued", "running"].includes(t.status));
      return a?.status === "working" || hasActive;
    }).length;
  }, [agents, tasks]);

  const queuedTasksCount = useMemo(() => tasks.filter((t) => t.status === "queued").length, [tasks]);

  const handleSelectAgent = (id: string) => {
    setSelectedAgentId(id);
    if (id) {
      setModalOpen(true);
      // Auto-pick suitable tool for this agent
      if (id === "sales") setModalTool("catalog_check");
      else if (id === "order") setModalTool("order_lookup");
      else if (id === "payment") setModalTool("payment_status");
      else if (id === "support") setModalTool("chat_inspect");
      else if (id === "security") setModalTool("security_audit");
      else setModalTool("catalog_check");
    }
  };

  const handleCreateTaskFromModal = async () => {
    if (!selectedAgentId || !onCreateTask) return;
    setIsSubmittingTask(true);
    try {
      await onCreateTask(selectedAgentId, modalTool, modalInput);
      setModalInput("");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <div className="agentOfficeWrapper">
      {/* Main 3D Office Stage */}
      <div className="agentOfficeHero">
        {/* Top Header Toolbar */}
        <div className="agentOfficeToolbar">
          <div className="agentOfficeTitleGroup">
            <h2>
              <span>🏢</span> 3D Virtual Agent Ofisi
            </h2>
            <p>
              Interaktiv 3D boshqaruv maydoni · Har bir agent o‘z ish stoli, monitorlari va harakatlari bilan
            </p>
          </div>

          <div className="agentOfficeStatsBar">
            <div className="agentStatItem">
              <span className="agentStatDot active" />
              <span>Jami: {Object.keys(AGENT_CONFIGS).length} ta agent</span>
            </div>
            <div className="agentStatItem">
              <span className="agentStatDot working" />
              <span>Ishlayotganlar: {workingCount} ta</span>
            </div>
            <div className="agentStatItem">
              <span className="agentStatDot queued" />
              <span>Navbatda: {queuedTasksCount} ta task</span>
            </div>
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh()}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>↻</span> Yangilash
              </button>
            )}
          </div>
        </div>

        {/* The 3D Canvas Viewport */}
        <AgentOfficeCanvas
          agents={agents}
          tasks={tasks}
          events={events}
          selectedAgentId={selectedAgentId}
          onSelectAgent={handleSelectAgent}
          presetKey={camPreset}
          onChangePreset={setCamPreset}
        />
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="officeNavTabs">
        <button
          type="button"
          className={`officeNavTab ${activeTab === "office" ? "active" : ""}`}
          onClick={() => setActiveTab("office")}
        >
          <span>👥</span> Agentlar jamoasi ({Object.keys(AGENT_CONFIGS).length})
        </button>
        <button
          type="button"
          className={`officeNavTab ${activeTab === "queue" ? "active" : ""}`}
          onClick={() => setActiveTab("queue")}
        >
          <span>📋</span> Vazifalar navbati ({tasks.length})
        </button>
        <button
          type="button"
          className={`officeNavTab ${activeTab === "dispatch" ? "active" : ""}`}
          onClick={() => setActiveTab("dispatch")}
        >
          <span>⚡</span> Tezkor vazifa berish
        </button>
        <button
          type="button"
          className={`officeNavTab ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <span>🛡️</span> Audit va xavfsizlik ({events.length})
        </button>
      </div>

      {/* TAB 1: AGENTLAR JAMOASI (CARDS GRID) */}
      {activeTab === "office" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {Object.values(AGENT_CONFIGS).map((cfg) => {
            const data = agents.find((a) => a.id === cfg.id);
            const activeTasks = tasks.filter((t) => t.agent_id === cfg.id && ["queued", "running"].includes(t.status));
            const isWorking = data?.status === "working" || activeTasks.length > 0;
            const latestEvt = events.find((e) => e.agent_id === cfg.id);

            return (
              <div
                key={cfg.id}
                className="extensionCard"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  borderLeft: `4px solid ${cfg.color}`,
                  background: selectedAgentId === cfg.id ? "rgba(225, 29, 72, 0.04)" : "#fff",
                }}
                onClick={() => handleSelectAgent(cfg.id)}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 28 }}>{cfg.icon}</span>
                      <div>
                        <b style={{ fontSize: 14, display: "block" }}>{cfg.nameUz}</b>
                        <small style={{ color: "var(--muted)", fontSize: 11 }}>{cfg.roleUz}</small>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: isWorking ? "#e0f2fe" : "#f1f5f9",
                        color: isWorking ? "#0284c7" : "#64748b",
                      }}
                    >
                      {isWorking ? "● Ishlamoqda" : "● Kutmoqda"}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "12px 0 8px", lineHeight: 1.5 }}>
                    {cfg.descriptionUz}
                  </p>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#f8fafc", border: "1px solid var(--line)" }}>
                      📍 {cfg.zone}
                    </span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#f8fafc", border: "1px solid var(--line)" }}>
                      📋 {activeTasks.length} ta faol vazifa
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {latestEvt ? `Oxirgi: ${latestEvt.event_type}` : "Tayyor"}
                  </span>
                  <button
                    type="button"
                    className="mgmtBtn"
                    style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAgent(cfg.id);
                    }}
                  >
                    Batafsil / Vazifa →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: VAZIFALAR NAVBATI */}
      {activeTab === "queue" && (
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">REAL-TIME TASK REGISTRY</span>
              <h2>Vazifalar navbati va ijro monitoringi</h2>
              <p>Har bir agentga yuborilgan buyruqlar, ularning bajarilish holati va natijalari</p>
            </div>
            {onRefresh && (
              <button type="button" className="mgmtBtn" onClick={() => onRefresh()}>
                ↻ Yangilash
              </button>
            )}
          </div>

          {tasks.length === 0 ? (
            <p style={{ color: "var(--muted)", padding: "16px 0" }}>Hozircha vazifalar mavjud emas.</p>
          ) : (
            <div className="tableWrap" style={{ maxHeight: 380, overflowY: "auto" }}>
              <table>
                <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 1 }}>
                  <tr>
                    <th>Agent</th>
                    <th>Tool / Buyruq</th>
                    <th>Holati</th>
                    <th>Boshlangan sana</th>
                    <th style={{ minWidth: 190 }}>Boshqaruv</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 25).map((t) => {
                    const cfg = AGENT_CONFIGS[t.agent_id];
                    let toolName = t.command;
                    try {
                      toolName = JSON.parse(t.command).type;
                    } catch {}

                    return (
                      <tr key={t.id}>
                        <td>
                          <b>
                            {cfg?.icon || "🤖"} {cfg?.nameUz || t.agent_id}
                          </b>
                        </td>
                        <td>
                          <code style={{ fontSize: 12, padding: "2px 6px", borderRadius: 4, background: "#f1f5f9" }}>
                            {toolName}
                          </code>
                        </td>
                        <td>
                          <span
                            className={`queueStatus status-${t.status}`}
                            style={{
                              padding: "4px 9px",
                              borderRadius: 999,
                              fontWeight: 700,
                              fontSize: 10,
                            }}
                          >
                            {t.status === "queued" ? "Kutilmoqda" :
                             t.status === "running" ? "Bajarilmoqda" :
                             t.status === "completed" ? "Bajarildi ✓" :
                             t.status === "failed" ? "Xatolik ✗" :
                             t.status === "paused" ? "Pauzada" : t.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          {new Date(t.created_at).toLocaleString("uz-UZ")}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            {t.status === "queued" && onRunTask && (
                              <button
                                type="button"
                                className="proPrimary miniBtn"
                                style={{ whiteSpace: "nowrap", padding: "5px 10px", fontSize: 11 }}
                                onClick={() => onRunTask(t.id)}
                              >
                                ▶ Ishga tushirish
                              </button>
                            )}
                            {["queued", "paused"].includes(t.status) && onStopTask && (
                              <button
                                type="button"
                                className="mgmtBtn"
                                style={{ whiteSpace: "nowrap", padding: "5px 9px", fontSize: 11, color: "#dc2626" }}
                                onClick={() => onStopTask(t.id)}
                              >
                                ■ To‘xtatish
                              </button>
                            )}
                            {["completed", "failed", "cancelled"].includes(t.status) && onRetryTask && (
                              <button
                                type="button"
                                className="mgmtBtn"
                                style={{ whiteSpace: "nowrap", padding: "5px 10px", fontSize: 11 }}
                                onClick={() => onRetryTask(t)}
                              >
                                ↻ Qayta urinish
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: TEZKOR VAZIFA BERISH */}
      {activeTab === "dispatch" && (
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">AUTONOMOUS TASK DISPATCH</span>
              <h2>Agentga vazifa biriktirish</h2>
              <p>
                Agent va bajarilishi kerak bo‘lgan vazifa turini tanlang. Tizim uni xavfsiz navbatga joylaydi.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {Object.values(AGENT_CONFIGS).map((cfg) => {
              const defaultTool =
                cfg.id === "sales" ? "catalog_check" :
                cfg.id === "order" ? "order_lookup" :
                cfg.id === "payment" ? "payment_status" :
                cfg.id === "support" ? "chat_inspect" :
                cfg.id === "security" ? "security_audit" : "catalog_check";

              return (
                <div
                  key={cfg.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 16,
                    padding: 16,
                    background: "#fff",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 24 }}>{cfg.icon}</span>
                      <div>
                        <b style={{ fontSize: 13 }}>{cfg.nameUz}</b>
                        <small style={{ display: "block", color: "var(--muted)", fontSize: 10 }}>
                          {cfg.roleUz}
                        </small>
                      </div>
                    </div>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 14px", lineHeight: 1.4 }}>
                      {cfg.descriptionUz}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="proPrimary miniBtn"
                    style={{ width: "100%", textAlign: "center" }}
                    onClick={() => handleSelectAgent(cfg.id)}
                  >
                    Vazifa berish ({defaultTool}) →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TAB 4: AUDIT VA XAVFSIZLIK */}
      {activeTab === "audit" && (
        <section className="proPanel">
          <div className="panelHead">
            <div>
              <span className="proEyebrow">IMMUTABLE AUDIT LOG</span>
              <h2>Xavfsizlik va audit xronologiyasi</h2>
              <p>Agentlar tomonidan amalga oshirilgan barcha harakatlar va tizim tekshiruvlari</p>
            </div>
            {onRefresh && (
              <button type="button" className="mgmtBtn" onClick={() => onRefresh()}>
                ↻ Yangilash
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <p style={{ color: "var(--muted)", padding: "16px 0" }}>Hozircha audit yozuvlari mavjud emas.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
              {events.slice(0, 30).map((evt) => {
                const cfg = AGENT_CONFIGS[evt.agent_id];
                return (
                  <div
                    key={evt.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 12,
                      background: "#fff",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{cfg?.icon || "🛡️"}</span>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <b style={{ fontSize: 12 }}>{cfg?.nameUz || evt.agent_id}</b>
                          <span
                            style={{
                              fontSize: 10,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "#f1f5f9",
                              color: "#475569",
                              fontWeight: 600,
                            }}
                          >
                            {evt.event_type}
                          </span>
                        </div>
                        <small style={{ color: "var(--muted)", fontSize: 11, display: "block", marginTop: 2 }}>
                          {evt.message || "Xabar yo‘q"}
                        </small>
                      </div>
                    </div>

                    <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(evt.created_at).toLocaleString("uz-UZ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* AGENT DETAIL MODAL / DRAWER */}
      {modalOpen && selectedConfig && (
        <div className="agentModalOverlay" onClick={() => setModalOpen(false)}>
          <div className="agentModalCard" onClick={(e) => e.stopPropagation()}>
            <div className="agentModalHeader">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 32 }}>{selectedConfig.icon}</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedConfig.nameUz}</h3>
                  <small style={{ color: "#94a3b8", fontSize: 12 }}>{selectedConfig.roleUz}</small>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#fff",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div className="agentModalBody">
              {/* Status & Zone Overview */}
              <div className="agentDetailGrid">
                <div className="agentDetailBox">
                  <span>Holati</span>
                  <b style={{ color: selectedAgentData?.status === "working" ? "#38bdf8" : "#10b981" }}>
                    {selectedAgentData?.status === "working" ? "● Ishlamoqda" : "● Kutmoqda"}
                  </b>
                </div>
                <div className="agentDetailBox">
                  <span>Ofisdagi joylashuvi</span>
                  <b>{selectedConfig.zone}</b>
                </div>
                <div className="agentDetailBox">
                  <span>Faol vazifalar</span>
                  <b>{agentTasks.filter((t) => ["queued", "running"].includes(t.status)).length} ta</b>
                </div>
                <div className="agentDetailBox">
                  <span>Audit eventlari</span>
                  <b>{agentEvents.length} ta</b>
                </div>
              </div>

              {/* Description */}
              <div>
                <b style={{ fontSize: 12, color: "#cbd5e1" }}>Vazifasi va majburiyati:</b>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: "6px 0 0", lineHeight: 1.5 }}>
                  {selectedConfig.descriptionUz}
                </p>
              </div>

              {/* Capabilities */}
              <div>
                <b style={{ fontSize: 12, color: "#cbd5e1" }}>Qobiliyatlari (Ruxsat etilgan tool’lar):</b>
                <div className="agentCapabilitiesPills">
                  {selectedAgentData?.capabilities?.length ? (
                    selectedAgentData.capabilities.map((cap) => (
                      <span key={cap} className="capabilityPill">
                        ✓ {cap}
                      </span>
                    ))
                  ) : (
                    <span className="capabilityPill">Standart tizim vositalari</span>
                  )}
                </div>
              </div>

              {/* Quick Task Dispatch for this agent */}
              {onCreateTask && (
                <div
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <b style={{ fontSize: 13, color: "#fff", display: "block", marginBottom: 10 }}>
                    ⚡ Agentga bevosita vazifa topshirish:
                  </b>

                  <div style={{ display: "grid", gap: 10 }}>
                    <select
                      value={modalTool}
                      onChange={(e) => setModalTool(e.target.value)}
                      style={{
                        background: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#fff",
                        padding: 10,
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                    >
                      <option value="catalog_check">Katalog & ombor tekshiruvi (catalog_check)</option>
                      <option value="order_lookup">Buyurtma holatini ko‘rish (order_lookup)</option>
                      <option value="payment_status">To‘lov va kvitansiya tekshiruvi (payment_status)</option>
                      <option value="chat_inspect">Mijoz chatini tahlil qilish (chat_inspect)</option>
                      <option value="security_audit">Xavfsizlik va server auditi (security_audit)</option>
                    </select>

                    {(modalTool === "order_lookup" || modalTool === "payment_status" || modalTool === "chat_inspect") && (
                      <input
                        type="text"
                        value={modalInput}
                        onChange={(e) => setModalInput(e.target.value)}
                        placeholder={modalTool === "chat_inspect" ? "Telegram ID yoki telefon raqami" : "Buyurtma ID yoki raqami (masalan: 102)"}
                        style={{
                          background: "#1e293b",
                          border: "1px solid rgba(255,255,255,0.15)",
                          color: "#fff",
                          padding: 10,
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                      />
                    )}

                    <button
                      type="button"
                      className="proPrimary miniBtn"
                      onClick={handleCreateTaskFromModal}
                      disabled={isSubmittingTask}
                      style={{ padding: "10px 14px", fontWeight: 700 }}
                    >
                      {isSubmittingTask ? "Yuborilmoqda…" : "Vazifani navbatga qo‘shish ✓"}
                    </button>
                  </div>
                </div>
              )}

              {/* Recent Tasks for this Agent */}
              <div>
                <b style={{ fontSize: 12, color: "#cbd5e1" }}>Oxirgi vazifalar:</b>
                {agentTasks.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: 12, margin: "6px 0 0" }}>Hozircha vazifalar yo‘q</p>
                ) : (
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {agentTasks.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 10,
                          fontSize: 11,
                        }}
                      >
                        <code>{t.command.length > 35 ? t.command.slice(0, 35) + "…" : t.command}</code>
                        <span style={{ color: t.status === "completed" ? "#10b981" : t.status === "queued" ? "#f59e0b" : "#38bdf8" }}>
                          ● {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="agentModalFooter">
              <button
                type="button"
                className="mgmtBtn"
                onClick={() => setModalOpen(false)}
                style={{ padding: "8px 16px" }}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
