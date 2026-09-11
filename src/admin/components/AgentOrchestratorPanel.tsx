import { useState } from "react";

type AgentTask = { id: string; agent_id: string; command: string; status: string; created_at: string };

const ROUTES = [
  ["sales", "🛍️", "Catalog / mahsulot"],
  ["order", "📦", "Buyurtma / yetkazish"],
  ["payment", "💳", "To‘lov / chek"],
  ["support", "💬", "Chat / mijoz"],
  ["security", "🛡️", "Audit / xavfsizlik"],
] as const;

export function AgentOrchestratorPanel({ api, token, tasks, onChanged, notify }: { api: string; token: string; tasks: AgentTask[]; onChanged: () => void; notify: (message: string) => void }) {
  const [task, setTask] = useState("");
  const [tool, setTool] = useState("");
  const [busy, setBusy] = useState(false);

  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${api}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) throw new Error(json.message || "Server xatosi");
    return json;
  };

  const dispatch = async () => {
    if (!task.trim() && !tool) return notify("Task tavsifi yoki tayyor yo‘nalishni tanlang");
    setBusy(true);
    try {
      const result = await request("/api/admin/agents/dispatch", { method: "POST", body: JSON.stringify({ task: task.trim(), tool }) });
      notify(`Orchestrator → ${result.routing.agentId} → ${result.routing.tool} ✓`);
      setTask(""); setTool(""); onChanged();
    } catch (error) { notify(error instanceof Error ? error.message : "Task taqsimlanmadi"); }
    finally { setBusy(false); }
  };

  const control = async (id: string, action: "pause" | "resume" | "stop") => {
    try { await request(`/api/admin/agents/tasks/${id}/${action}`, { method: "POST" }); notify(action === "pause" ? "Task pauzaga qo‘yildi" : action === "resume" ? "Task davom ettirildi" : "Task to‘xtatildi"); onChanged(); }
    catch (error) { notify(error instanceof Error ? error.message : "Task boshqarilmadi"); }
  };

  return <div className="agentOrchestrator">
    <div className="orchestratorHero">
      <div className="orchestratorCore"><span>🎯</span><b>ORCHESTRATOR</b><small>routing + control</small></div>
      <div className="orchestratorLine" />
      <div className="routeNodes">{ROUTES.map(([id, icon, label]) => <button type="button" key={id} className={`routeNode route-${id}`} onClick={() => setTool(id === "sales" ? "catalog_check" : id === "order" ? "order_lookup" : id === "payment" ? "payment_status" : id === "support" ? "chat_inspect" : "security_audit")}><span>{icon}</span><b>{id}</b><small>{label}</small></button>)}</div>
    </div>

    <div className="orchestratorForm">
      <div><span className="proEyebrow">SMART DISPATCH</span><h3>Vazifani yozing — Orchestrator agentni o‘zi tanlaydi</h3><p>Routing hozir deterministic: mahsulot → Sales, buyurtma → Order, to‘lov → Payment, chat → Support, audit → Security.</p></div>
      <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Masalan: 1024-sonli buyurtmaning to‘lov holatini tekshir…" rows={3} />
      <div className="orchestratorActions"><select value={tool} onChange={(e) => setTool(e.target.value)}><option value="">Avtomatik routing</option><option value="catalog_check">Sales · catalog check</option><option value="order_lookup">Order · lookup</option><option value="payment_status">Payment · status</option><option value="chat_inspect">Support · chat inspect</option><option value="security_audit">Security · audit</option></select><button type="button" className="proPrimary" onClick={dispatch} disabled={busy}>{busy ? "Taqsimlanmoqda…" : "🎯 Taqsimlash"}</button></div>
    </div>

    <div className="controlLegend"><b>Task control</b><span>⏸ Pause — faqat queued taskni xavfsiz pauzalaydi</span><span>▶ Resume — pauzadagi taskni queue'ga qaytaradi</span><span>■ Stop — queued/paused taskni bekor qiladi</span></div>
    <div className="orchestratorQueue">{tasks.filter((t) => ["queued", "paused", "running"].includes(t.status)).slice(0, 8).map((item) => <div className="orchestratorTask" key={item.id}><div><b>{item.agent_id}</b><span>{item.status}</span><small>{item.command}</small></div><div className="taskControls">{item.status === "queued" && <button type="button" onClick={() => control(item.id, "pause")}>⏸</button>}{item.status === "paused" && <button type="button" onClick={() => control(item.id, "resume")}>▶</button>}{item.status !== "running" && <button type="button" onClick={() => control(item.id, "stop")}>■</button>}</div></div>)}</div>
  </div>;
}
