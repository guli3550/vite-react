import { useState } from "react";
import "./AgentOrchestratorPanel.css";

type AgentTask = {
  id: string;
  agent_id: string;
  command: string;
  status: string;
  created_at: string;
};

const ROUTES = [
  { id: "sales", tool: "catalog_check", icon: "🛍️", title: "Sales", label: "Katalog", prompt: "Katalogdagi mahsulot qoldig‘ini tekshir" },
  { id: "order", tool: "order_lookup", icon: "📦", title: "Order", label: "Buyurtma", prompt: "1024-sonli buyurtma holatini tekshir" },
  { id: "payment", tool: "payment_status", icon: "💳", title: "Payment", label: "To‘lov / chek", prompt: "1024-sonli buyurtmaning to‘lov holatini tekshir" },
  { id: "support", tool: "chat_inspect", icon: "💬", title: "Support", label: "Chat / mijoz", prompt: "Telegramdagi oxirgi mijoz murojaatini tekshir" },
  { id: "security", tool: "security_audit", icon: "🛡️", title: "Security", label: "Audit / xavfsizlik", prompt: "Tizim xavfsizlik loglari va auditini tekshir" },
] as const;

const QUICK_PROMPTS = [
  { label: "💳 1024-to‘lov holati", prompt: "1024-sonli buyurtmaning to‘lov holatini tekshir", tool: "payment_status" },
  { label: "📦 1024-buyurtma statusi", prompt: "1024-sonli buyurtma ma'lumotlarini qidir", tool: "order_lookup" },
  { label: "🛍️ Katalog qoldiqlari", prompt: "Katalogdagi faol mahsulotlar va qoldiqlarni tekshir", tool: "catalog_check" },
  { label: "🛡️ Xavfsizlik auditi", prompt: "Oxirgi 24 soatlik xavfsizlik hodisalarini tekshir", tool: "security_audit" },
];

export function AgentOrchestratorPanel({
  api,
  token,
  tasks,
  onChanged,
  notify,
}: {
  api: string;
  token: string;
  tasks: AgentTask[];
  onChanged: () => void;
  notify: (message: string) => void;
}) {
  const [taskText, setTaskText] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${api}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new Error(json.message || "Server xatosi");
    }
    return json;
  };

  const handleSelectRoute = (route: typeof ROUTES[number]) => {
    if (selectedTool === route.tool) {
      // Toggle off to auto
      setSelectedTool("");
    } else {
      setSelectedTool(route.tool);
      if (!taskText.trim()) {
        setTaskText(route.prompt);
      }
    }
  };

  const dispatch = async () => {
    if (!taskText.trim() && !selectedTool) {
      return notify("Task tavsifini yozing yoki yo‘nalishni tanlang");
    }
    setBusy(true);
    try {
      const result = await request("/api/admin/agents/dispatch", {
        method: "POST",
        body: JSON.stringify({
          task: taskText.trim(),
          tool: selectedTool,
        }),
      });
      notify(`Orchestrator → ${result.routing.agentId} → ${result.routing.tool} ✓`);
      setTaskText("");
      setSelectedTool("");
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Task taqsimlanmadi");
    } finally {
      setBusy(false);
    }
  };

  const control = async (id: string, action: "pause" | "resume" | "stop") => {
    try {
      await request(`/api/admin/agents/tasks/${id}/${action}`, { method: "POST" });
      notify(
        action === "pause"
          ? "Task pauzaga qo‘yildi ⏸"
          : action === "resume"
          ? "Task davom ettirildi ▶"
          : "Task to‘xtatildi ■"
      );
      onChanged();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Task boshqarilmadi");
    }
  };

  // Only active / queued / paused tasks for instant control
  const activeTasks = tasks.filter((t) => ["queued", "paused", "running"].includes(t.status));

  return (
    <div className="agentOrchestratorCard">
      {/* Top Header */}
      <div className="orchHeader">
        <div>
          <div className="orchBadgeRow">
            <span className="orchBadge">🎯 SMART ORCHESTRATOR</span>
            <span className="orchSubBadge">Auto Routing & Dispatch</span>
          </div>
          <h3 className="orchTitle">Agentga vazifa taqsimlash</h3>
          <p className="orchSubtitle">
            Matndan kelib chiqib tegishli agent avtomatik aniqlanadi yoki quyidagi yo‘nalishni tanlang.
          </p>
        </div>
      </div>

      {/* Modern Compact Route Ribbon (5 Route Chips) */}
      <div className="orchRouteRibbon">
        <button
          type="button"
          className={`orchRoutePill ${selectedTool === "" ? "active" : ""}`}
          onClick={() => setSelectedTool("")}
          title="Matnga qarab avtomatik aniqlash"
        >
          <span className="orchRouteIcon">⚡</span>
          <div className="orchRouteInfo">
            <b>Avto routing</b>
            <small>Orchestrator</small>
          </div>
        </button>

        {ROUTES.map((r) => {
          const isSelected = selectedTool === r.tool;
          return (
            <button
              type="button"
              key={r.id}
              className={`orchRoutePill ${isSelected ? "active" : ""}`}
              onClick={() => handleSelectRoute(r)}
            >
              <span className="orchRouteIcon">{r.icon}</span>
              <div className="orchRouteInfo">
                <b>{r.title}</b>
                <small>{r.label}</small>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Prompt Suggestions */}
      <div className="orchQuickPrompts">
        <span className="quickPromptsLabel">Namunalar:</span>
        <div className="quickPromptsScroll">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              className="quickPromptChip"
              onClick={() => {
                setTaskText(p.prompt);
                setSelectedTool(p.tool);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box and Actions */}
      <div className="orchInputBox">
        <textarea
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          placeholder="Masalan: 1024-sonli buyurtmaning to‘lov holatini tekshir…"
          rows={2}
          className="orchTextarea"
        />

        <div className="orchActionBar">
          <div className="orchToolSelectWrap">
            <span className="toolSelectIcon">🛠️</span>
            <select
              value={selectedTool}
              onChange={(e) => setSelectedTool(e.target.value)}
              className="orchSelect"
            >
              <option value="">⚡ Avtomatik routing</option>
              <option value="catalog_check">🛍️ Sales · catalog check</option>
              <option value="order_lookup">📦 Order · lookup</option>
              <option value="payment_status">💳 Payment · status</option>
              <option value="chat_inspect">💬 Support · chat inspect</option>
              <option value="security_audit">🛡️ Security · audit</option>
            </select>
          </div>

          <div className="orchActionBtns">
            {taskText && (
              <button
                type="button"
                className="orchClearBtn"
                onClick={() => setTaskText("")}
                title="Matnni tozalash"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              className="orchSubmitBtn"
              onClick={dispatch}
              disabled={busy}
            >
              {busy ? "Taqsimlanmoqda…" : "🎯 Taqsimlash"}
            </button>
          </div>
        </div>
      </div>

      {/* Active Tasks & Control Section (Replaces raw text legend with interactive manager) */}
      <div className="orchControlSection">
        <div className="orchControlHeader">
          <div className="controlHeaderLeft">
            <span className="controlDot" />
            <b>Faol vazifalar boshqaruvi</b>
            <span className="taskCountBadge">{activeTasks.length} ta navbatda</span>
          </div>
          {activeTasks.length > 0 && (
            <div className="controlQuickLegend">
              <span>⏸ Pauza</span>
              <span>▶ Davom</span>
              <span>■ To‘xtatish</span>
            </div>
          )}
        </div>

        {activeTasks.length === 0 ? (
          <div className="orchEmptyState">
            <span>✓</span> Barcha agentlar erkin — yangi vazifa berishingiz mumkin.
          </div>
        ) : (
          <div className="orchActiveList">
            {activeTasks.slice(0, 5).map((item) => {
              let parsedType = item.command;
              try {
                parsedType = JSON.parse(item.command).type || item.command;
              } catch {
                // keep as is
              }

              return (
                <div className="orchActiveItem" key={item.id}>
                  <div className="activeItemInfo">
                    <div className="itemTitleRow">
                      <b className="agentName">{item.agent_id}</b>
                      <span className={`orchStatusPill status-${item.status}`}>
                        {item.status === "queued" && "Kutilmoqda"}
                        {item.status === "paused" && "Pauzada"}
                        {item.status === "running" && "Bajarilmoqda"}
                      </span>
                    </div>
                    <span className="cmdPreview">{parsedType}</span>
                  </div>

                  <div className="itemControlBtns">
                    {item.status === "queued" && (
                      <button
                        type="button"
                        className="controlBtn pause"
                        onClick={() => control(item.id, "pause")}
                        title="Vazifani pauzaga qo‘yish"
                      >
                        ⏸ Pauza
                      </button>
                    )}
                    {item.status === "paused" && (
                      <button
                        type="button"
                        className="controlBtn resume"
                        onClick={() => control(item.id, "resume")}
                        title="Vazifani davom ettirish"
                      >
                        ▶ Davom
                      </button>
                    )}
                    {item.status !== "running" && (
                      <button
                        type="button"
                        className="controlBtn stop"
                        onClick={() => control(item.id, "stop")}
                        title="Vazifani to‘xtatish"
                      >
                        ■ To‘xtatish
                      </button>
                    )}
                    {item.status === "running" && (
                      <span className="runningIndicator">
                        <span className="runningSpin">⚡</span> Jarayonda
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
