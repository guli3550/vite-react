import { useState, useRef, useMemo } from "react";
import { AGENT_CONFIGS } from "./agentOffice3d/types";

export type AgentTask = {
  id: string;
  agent_id: string;
  command: string;
  status: string;
  created_at: string;
  finished_at?: string;
  error?: string;
  result?: unknown;
};

export type AgentEvent = {
  id: string;
  task_id: string;
  agent_id: string;
  event_type: string;
  message?: string;
  created_at: string;
};

interface AgentTaskLentaProps {
  tasks: AgentTask[];
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  onRunTask: (id: string) => Promise<void>;
  onStopTask: (id: string) => Promise<void>;
  onRetryTask: (task: AgentTask) => Promise<void>;
  runningId: string;
  events?: AgentEvent[];
}

export function AgentTaskLenta({
  tasks,
  selectedTaskId,
  onSelectTask,
  onRunTask,
  onStopTask,
  onRetryTask,
  runningId,
  events = [],
}: AgentTaskLentaProps) {
  const [viewMode, setViewMode] = useState<"lenta" | "table">("lenta");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const lentaRef = useRef<HTMLDivElement>(null);

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );

  const selectedTaskEvents = useMemo(
    () => (selectedTaskId ? events.filter((e) => e.task_id === selectedTaskId) : []),
    [events, selectedTaskId]
  );

  const scrollLenta = (direction: "left" | "right") => {
    if (!lentaRef.current) return;
    const amount = direction === "left" ? -340 : 340;
    lentaRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const parseCommand = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      return {
        type: parsed.type || raw,
        input: parsed.input || null,
      };
    } catch {
      return { type: raw, input: null };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "queued":
        return { label: "Kutilmoqda", bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" };
      case "running":
        return { label: "Bajarilmoqda", bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#f59e0b" };
      case "completed":
        return { label: "Bajarildi ✓", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", dot: "#10b981" };
      case "failed":
        return { label: "Xatolik ✗", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", dot: "#ef4444" };
      case "paused":
        return { label: "Pauzada", bg: "#f8fafc", color: "#475569", border: "#cbd5e1", dot: "#94a3b8" };
      default:
        return { label: status, bg: "#f1f5f9", color: "#475569", border: "#e2e8f0", dot: "#94a3b8" };
    }
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: "16px 18px",
        borderRadius: 18,
        border: "1px solid var(--line)",
        background: "#ffffff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header with Title and Mode Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Task queue (Vazifalar oqimi)
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: "#475569",
              }}
            >
              {tasks.length} ta
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
            5 soniyada avtomatik yangilanadi. Taskni tanlab natija va audit eventlarini ko‘rish mumkin.
          </p>
        </div>

        {/* View mode toggle & Scroll buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: 3,
              borderRadius: 10,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("lenta")}
              style={{
                padding: "5px 11px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "lenta" ? "#fff" : "transparent",
                color: viewMode === "lenta" ? "#0f172a" : "#64748b",
                fontWeight: viewMode === "lenta" ? 700 : 500,
                fontSize: 11,
                cursor: "pointer",
                boxShadow: viewMode === "lenta" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              🌊 Lenta (Oqim)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              style={{
                padding: "5px 11px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "table" ? "#fff" : "transparent",
                color: viewMode === "table" ? "#0f172a" : "#64748b",
                fontWeight: viewMode === "table" ? 700 : 500,
                fontSize: 11,
                cursor: "pointer",
                boxShadow: viewMode === "table" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              📋 Jadval
            </button>
          </div>

          {viewMode === "lenta" && tasks.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => scrollLenta("left")}
                title="Chapga surish"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "#334155",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => scrollLenta("right")}
                title="O‘ngga surish"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "#334155",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 10,
          scrollbarWidth: "none",
        }}
      >
        {[
          { id: "all", label: "Barchasi", count: tasks.length },
          { id: "queued", label: "Navbatda", count: tasks.filter((t) => t.status === "queued").length },
          { id: "running", label: "Bajarilmoqda", count: tasks.filter((t) => t.status === "running").length },
          { id: "completed", label: "Bajarildi", count: tasks.filter((t) => t.status === "completed").length },
          { id: "failed", label: "Xatolik", count: tasks.filter((t) => t.status === "failed").length },
        ].map((f) => {
          const active = statusFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: active ? "1px solid #e11d48" : "1px solid var(--line)",
                background: active ? "rgba(225, 29, 72, 0.08)" : "#f8fafc",
                color: active ? "#e11d48" : "#475569",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>{f.label}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 999,
                  background: active ? "#e11d48" : "#e2e8f0",
                  color: active ? "#fff" : "#64748b",
                  fontWeight: 700,
                }}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* CONTENT: EMPTY STATE */}
      {filteredTasks.length === 0 ? (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: 14,
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          <span>📭</span> Ushbu holatda birorta task topilmadi.
        </div>
      ) : viewMode === "lenta" ? (
        /* LENTA (HORIZONTAL SCROLL RIBBON) VIEW */
        <div
          ref={lentaRef}
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            padding: "4px 2px 14px",
            scrollbarWidth: "thin",
            scrollSnapType: "x mandatory",
          }}
        >
          {filteredTasks.map((task) => {
            const cfg = AGENT_CONFIGS[task.agent_id];
            const badge = getStatusBadge(task.status);
            const cmd = parseCommand(task.command);
            const isSelected = selectedTaskId === task.id;
            const isRunning = runningId === task.id || task.status === "running";

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(isSelected ? "" : task.id)}
                style={{
                  flexShrink: 0,
                  width: 300,
                  scrollSnapAlign: "start",
                  borderRadius: 14,
                  border: isSelected ? "2px solid #e11d48" : "1px solid var(--line)",
                  background: isSelected ? "rgba(225, 29, 72, 0.02)" : "#fff",
                  boxShadow: isSelected
                    ? "0 8px 24px rgba(225, 29, 72, 0.12)"
                    : "0 2px 8px rgba(0,0,0,0.03)",
                  padding: "14px 15px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                <div>
                  {/* Top Bar: Agent & Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{cfg?.icon || "🤖"}</span>
                      <div>
                        <b style={{ fontSize: 13, color: "#0f172a", display: "block", lineHeight: 1.2 }}>
                          {cfg?.nameUz || task.agent_id}
                        </b>
                        <small style={{ fontSize: 10, color: "var(--muted)" }}>
                          ID: {task.id.slice(0, 8)}…
                        </small>
                      </div>
                    </div>

                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: badge.dot,
                          display: "inline-block",
                        }}
                      />
                      {badge.label}
                    </span>
                  </div>

                  {/* Tool info */}
                  <div style={{ margin: "12px 0 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>Tool:</span>
                      <code
                        style={{
                          fontSize: 11,
                          padding: "2px 7px",
                          borderRadius: 6,
                          background: "#f1f5f9",
                          color: "#0f172a",
                          fontWeight: 600,
                        }}
                      >
                        {cmd.type}
                      </code>
                    </div>

                    {cmd.input && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#475569",
                          background: "#f8fafc",
                          padding: "5px 8px",
                          borderRadius: 6,
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cmd.input.order_number
                          ? `Buyurtma: #${cmd.input.order_number}`
                          : cmd.input.telegram_id
                          ? `Telegram: ${cmd.input.telegram_id}`
                          : JSON.stringify(cmd.input)}
                      </div>
                    )}
                  </div>

                  {/* Time info */}
                  <div style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 10px" }}>
                    🕒 {new Date(task.created_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    {" · "}
                    {new Date(task.created_at).toLocaleDateString("uz-UZ", { month: "short", day: "numeric" })}
                  </div>
                </div>

                {/* Bottom Action Buttons Bar (Carefully separated, NO OVERLAP) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: "1px solid var(--line)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", gap: 6, flexWrap: "nowrap", alignItems: "center" }}>
                    {task.status === "queued" && (
                      <>
                        <button
                          type="button"
                          className="proPrimary miniBtn"
                          style={{
                            fontSize: 11,
                            padding: "6px 11px",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                            borderRadius: 8,
                          }}
                          onClick={() => onRunTask(task.id)}
                          disabled={isRunning}
                        >
                          {isRunning ? "Ishlamoqda…" : "▶ Ishga tushirish"}
                        </button>
                        <button
                          type="button"
                          className="mgmtBtn"
                          style={{
                            fontSize: 11,
                            padding: "6px 9px",
                            whiteSpace: "nowrap",
                            color: "#dc2626",
                            borderRadius: 8,
                          }}
                          onClick={() => onStopTask(task.id)}
                        >
                          ■ To‘xtatish
                        </button>
                      </>
                    )}

                    {task.status === "running" && (
                      <>
                        <span style={{ fontSize: 11, color: "#b45309", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ animation: "spin 1s linear infinite" }}>⚡</span> Bajarilmoqda…
                        </span>
                        <button
                          type="button"
                          className="mgmtBtn"
                          style={{
                            fontSize: 11,
                            padding: "6px 9px",
                            whiteSpace: "nowrap",
                            color: "#dc2626",
                            borderRadius: 8,
                          }}
                          onClick={() => onStopTask(task.id)}
                        >
                          ■ To‘xtatish
                        </button>
                      </>
                    )}

                    {["completed", "failed", "cancelled"].includes(task.status) && (
                      <button
                        type="button"
                        className="mgmtBtn"
                        style={{
                          fontSize: 11,
                          padding: "6px 11px",
                          whiteSpace: "nowrap",
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                        onClick={() => onRetryTask(task)}
                      >
                        ↻ Qayta urinish
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: isSelected ? "#e11d48" : "var(--muted)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "4px 6px",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => onSelectTask(isSelected ? "" : task.id)}
                  >
                    {isSelected ? "Yopish ▴" : "Batafsil ▾"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT TABLE VIEW (WITH MAX-HEIGHT AND INTERNAL SCROLL) */
        <div
          className="tableWrap"
          style={{
            maxHeight: 360,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid var(--line)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, background: "#f8fafc", zIndex: 2 }}>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Agent</th>
                <th style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Tool</th>
                <th style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Status</th>
                <th style={{ textAlign: "left", padding: "10px 12px", whiteSpace: "nowrap" }}>Sana</th>
                <th style={{ textAlign: "right", padding: "10px 12px", whiteSpace: "nowrap", minWidth: 190 }}>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.slice(0, 30).map((task) => {
                const cfg = AGENT_CONFIGS[task.agent_id];
                const badge = getStatusBadge(task.status);
                const cmd = parseCommand(task.command);
                const isSelected = selectedTaskId === task.id;
                const isRunning = runningId === task.id;

                return (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(isSelected ? "" : task.id)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid var(--line)",
                      background: isSelected ? "rgba(225, 29, 72, 0.05)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <b>{cfg?.icon || "🤖"} {cfg?.nameUz || task.agent_id}</b>
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <code style={{ fontSize: 11, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>
                        {cmd.type}
                      </code>
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          fontWeight: 700,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 11 }}>
                      {new Date(task.created_at).toLocaleString("uz-UZ")}
                    </td>
                    <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        {task.status === "queued" ? (
                          <>
                            <button
                              type="button"
                              className="proPrimary miniBtn"
                              style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap" }}
                              onClick={() => onRunTask(task.id)}
                              disabled={isRunning}
                            >
                              {isRunning ? "Ishlamoqda…" : "▶ Ishga tushirish"}
                            </button>
                            <button
                              type="button"
                              className="mgmtBtn"
                              style={{ fontSize: 11, padding: "5px 9px", whiteSpace: "nowrap", color: "#dc2626" }}
                              onClick={() => onStopTask(task.id)}
                            >
                              To‘xtatish
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="mgmtBtn"
                            style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap" }}
                            onClick={() => onRetryTask(task)}
                          >
                            ↻ Retry
                          </button>
                        )}
                        <button
                          type="button"
                          className="mgmtBtn"
                          style={{
                            fontSize: 11,
                            padding: "5px 8px",
                            whiteSpace: "nowrap",
                            color: isSelected ? "#e11d48" : "inherit",
                          }}
                          onClick={() => onSelectTask(isSelected ? "" : task.id)}
                        >
                          {isSelected ? "Yopish" : "Batafsil →"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SELECTED TASK DETAIL ACCORDION DRAWER */}
      {selectedTask && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #e11d48",
            background: "#fff9fa",
            boxShadow: "0 6px 20px rgba(225, 29, 72, 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>🔍</span>
              <div>
                <b style={{ fontSize: 13, color: "#0f172a" }}>Task tafsilotlari</b>
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 6 }}>
                  {selectedTask.agent_id} · {selectedTask.status} · ID: {selectedTask.id}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="mgmtBtn"
              style={{ fontSize: 11, padding: "4px 10px" }}
              onClick={() => onSelectTask("")}
            >
              ✕ Yopish
            </button>
          </div>

          <pre
            style={{
              margin: 0,
              padding: 12,
              borderRadius: 10,
              background: "#0f172a",
              color: "#f8fafc",
              fontSize: 11,
              fontFamily: "monospace",
              maxHeight: 180,
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {JSON.stringify(
              {
                id: selectedTask.id,
                agent: selectedTask.agent_id,
                status: selectedTask.status,
                command: (() => {
                  try {
                    return JSON.parse(selectedTask.command);
                  } catch {
                    return selectedTask.command;
                  }
                })(),
                result: selectedTask.result || null,
                error: selectedTask.error || null,
                created_at: selectedTask.created_at,
                finished_at: selectedTask.finished_at || null,
              },
              null,
              2
            )}
          </pre>

          {/* Task-specific audit events */}
          <div style={{ marginTop: 12 }}>
            <b style={{ fontSize: 12, color: "#0f172a" }}>Ushbu task bo‘yicha audit hodisalari:</b>
            {selectedTaskEvents.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--muted)", margin: "4px 0 0" }}>
                Hodisa yozuvlari topilmadi.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                {selectedTaskEvents.map((evt) => (
                  <div
                    key={evt.id}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "#fff",
                      fontSize: 11,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <b style={{ color: "#0f172a" }}>{evt.event_type}</b>
                      <span style={{ color: "var(--muted)", marginLeft: 6 }}>{evt.message || ""}</span>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>
                      {new Date(evt.created_at).toLocaleTimeString("uz-UZ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AgentAuditLentaProps {
  events: AgentEvent[];
}

export function AgentAuditLenta({ events }: AgentAuditLentaProps) {
  const [viewMode, setViewMode] = useState<"lenta" | "list">("lenta");
  const [filter, setFilter] = useState<string>("all");
  const lentaRef = useRef<HTMLDivElement>(null);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "errors") {
      return events.filter(
        (e) =>
          e.event_type.includes("failed") ||
          e.event_type.includes("error") ||
          (e.message && e.message.toLowerCase().includes("xato"))
      );
    }
    if (filter === "completed") {
      return events.filter((e) => e.event_type.includes("completed") || e.event_type.includes("finish"));
    }
    return events;
  }, [events, filter]);

  const scrollLenta = (direction: "left" | "right") => {
    if (!lentaRef.current) return;
    const amount = direction === "left" ? -300 : 300;
    lentaRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const getEventBadge = (type: string) => {
    if (type.includes("failed") || type.includes("error")) {
      return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", icon: "✗" };
    }
    if (type.includes("completed") || type.includes("finished")) {
      return { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0", icon: "✓" };
    }
    if (type.includes("started") || type.includes("running")) {
      return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", icon: "⚡" };
    }
    if (type.includes("security") || type.includes("audit")) {
      return { bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff", icon: "🛡️" };
    }
    return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", icon: "ℹ" };
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: "16px 18px",
        borderRadius: 18,
        border: "1px solid var(--line)",
        background: "#ffffff",
        boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
      }}
    >
      {/* Header with Title and Mode Switcher */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Audit timeline (Audit va xavfsizlik lentasi)
            </h3>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#f1f5f9",
                color: "#475569",
              }}
            >
              {events.length} ta event
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
            Agent harakatlarining append-only eventlari.
          </p>
        </div>

        {/* View mode toggle & Scroll buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "flex",
              background: "#f1f5f9",
              padding: 3,
              borderRadius: 10,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("lenta")}
              style={{
                padding: "5px 11px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "lenta" ? "#fff" : "transparent",
                color: viewMode === "lenta" ? "#0f172a" : "#64748b",
                fontWeight: viewMode === "lenta" ? 700 : 500,
                fontSize: 11,
                cursor: "pointer",
                boxShadow: viewMode === "lenta" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              🌊 Lenta (Oqim)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                padding: "5px 11px",
                borderRadius: 8,
                border: "none",
                background: viewMode === "list" ? "#fff" : "transparent",
                color: viewMode === "list" ? "#0f172a" : "#64748b",
                fontWeight: viewMode === "list" ? 700 : 500,
                fontSize: 11,
                cursor: "pointer",
                boxShadow: viewMode === "list" ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.15s",
              }}
            >
              📜 Ro‘yxat
            </button>
          </div>

          {viewMode === "lenta" && events.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => scrollLenta("left")}
                title="Chapga surish"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "#334155",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => scrollLenta("right")}
                title="O‘ngga surish"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "#334155",
                  fontSize: 13,
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 8,
          marginBottom: 10,
          scrollbarWidth: "none",
        }}
      >
        {[
          { id: "all", label: "Barchasi", count: events.length },
          { id: "completed", label: "Muvaffaqiyatli", count: events.filter((e) => e.event_type.includes("completed") || e.event_type.includes("finish")).length },
          { id: "errors", label: "Xatoliklar", count: events.filter((e) => e.event_type.includes("failed") || e.event_type.includes("error")).length },
        ].map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: active ? "1px solid #7e22ce" : "1px solid var(--line)",
                background: active ? "rgba(126, 34, 206, 0.08)" : "#f8fafc",
                color: active ? "#7e22ce" : "#475569",
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>{f.label}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 999,
                  background: active ? "#7e22ce" : "#e2e8f0",
                  color: active ? "#fff" : "#64748b",
                  fontWeight: 700,
                }}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* CONTENT: EMPTY STATE */}
      {filteredEvents.length === 0 ? (
        <div
          style={{
            padding: "24px 16px",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: 14,
            color: "var(--muted)",
            fontSize: 13,
          }}
        >
          <span>🛡️</span> Audit eventlari mavjud emas.
        </div>
      ) : viewMode === "lenta" ? (
        /* AUDIT LENTA (HORIZONTAL SCROLL RIBBON) VIEW */
        <div
          ref={lentaRef}
          style={{
            display: "flex",
            gap: 12,
            overflowX: "auto",
            padding: "4px 2px 14px",
            scrollbarWidth: "thin",
            scrollSnapType: "x mandatory",
          }}
        >
          {filteredEvents.map((evt) => {
            const cfg = AGENT_CONFIGS[evt.agent_id];
            const badge = getEventBadge(evt.event_type);

            return (
              <div
                key={evt.id}
                style={{
                  flexShrink: 0,
                  width: 270,
                  scrollSnapAlign: "start",
                  borderRadius: 14,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  {/* Top Bar: Agent & Type badge */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{cfg?.icon || "🛡️"}</span>
                      <b style={{ fontSize: 12, color: "#0f172a" }}>
                        {cfg?.nameUz || evt.agent_id}
                      </b>
                    </div>

                    <span
                      style={{
                        padding: "2px 7px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 700,
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{badge.icon}</span>
                      {evt.event_type}
                    </span>
                  </div>

                  {/* Event Message */}
                  <p
                    style={{
                      margin: "6px 0 10px",
                      fontSize: 11,
                      color: "#334155",
                      lineHeight: 1.4,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {evt.message || "Tizim auditi hodisasi muvaffaqiyatli qayd etildi."}
                  </p>
                </div>

                {/* Footer: Task ID & Time */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid var(--line)",
                    paddingTop: 8,
                    marginTop: 4,
                    fontSize: 10,
                    color: "var(--muted)",
                  }}
                >
                  <span>Task: #{evt.task_id?.slice(0, 6)}</span>
                  <span>
                    {new Date(evt.created_at).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {new Date(evt.created_at).toLocaleDateString("uz-UZ", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT LIST VIEW WITH FIXED MAX HEIGHT */
        <div
          style={{
            maxHeight: 300,
            overflowY: "auto",
            display: "grid",
            gap: 8,
            paddingRight: 4,
          }}
        >
          {filteredEvents.slice(0, 40).map((evt) => {
            const cfg = AGENT_CONFIGS[evt.agent_id];
            const badge = getEventBadge(evt.event_type);

            return (
              <div
                key={evt.id}
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                  background: "#f8fafc",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg?.icon || "🛡️"}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 12, color: "#0f172a" }}>{cfg?.nameUz || evt.agent_id}</b>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 999,
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {evt.event_type}
                      </span>
                    </div>
                    <small
                      style={{
                        display: "block",
                        color: "#475569",
                        fontSize: 11,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {evt.message || "Tizim tekshiruvi amalga oshirildi"}
                    </small>
                  </div>
                </div>

                <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {new Date(evt.created_at).toLocaleString("uz-UZ", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
