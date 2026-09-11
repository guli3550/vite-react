import { useMemo, useState } from "react";

type Agent = { id: string; name: string; role: string; capabilities: string[]; status: "working" | "idle" };
type AgentTask = { id: string; agent_id: string; status: string; created_at: string };
type AgentEvent = { id: string; task_id: string; agent_id: string; event_type: string; created_at: string };

const FALLBACK_AGENTS = [
  ["orchestrator", "Orchestrator", "Boshqaruv"], ["sales", "Sales", "Savdo"], ["order", "Order", "Buyurtmalar"],
  ["payment", "Payment", "To‘lovlar"], ["support", "Support", "Qo‘llab-quvvatlash"], ["security", "Security", "Xavfsizlik"],
];

export function AgentOffice3D({ agents, tasks, events }: { agents: Agent[]; tasks: AgentTask[]; events: AgentEvent[] }) {
  const [selected, setSelected] = useState("orchestrator");
  const list = useMemo(() => FALLBACK_AGENTS.map(([id, name, role]) => agents.find((a) => a.id === id) || ({ id, name, role, capabilities: [], status: "idle" as const })), [agents]);
  const active = list.find((a) => a.id === selected) || list[0];
  const status = (id: string) => list.find((a) => a.id === id)?.status === "working" ? "working" : "idle";
  const taskCount = (id: string) => tasks.filter((t) => t.agent_id === id && ["queued", "running"].includes(t.status)).length;
  const eventCount = (id: string) => events.filter((e) => e.agent_id === id).length;
  const tone = (id: string) => status(id) === "working" ? "#35a56b" : "#b7a4aa";

  return <section className="proPanel" style={{ overflow: "hidden" }}>
    <div className="panelHead">
      <div><span className="proEyebrow">LIVE AI OFFICE · 3D CONTROL ROOM</span><h2>GULI Agent Office</h2><p>Orchestrator markazda, 5 ta specialist agent atrofida. Holat va tasklar real-time polling orqali yangilanadi.</p></div>
      <span className="statusPill">● LIVE · 5s</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "stretch" }}>
      <div style={{ position: "relative", minHeight: 410, borderRadius: 22, border: "1px solid var(--line)", background: "radial-gradient(circle at 50% 42%, #fff 0, #fbf0f3 42%, #efe1e5 100%)", perspective: 1100, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "12% 8% 8%", transform: "rotateX(55deg) rotateZ(0deg)", transformStyle: "preserve-3d", border: "1px solid #e2cfd5", borderRadius: 24, background: "linear-gradient(145deg, rgba(255,255,255,.9),rgba(239,222,227,.72))", boxShadow: "0 28px 55px rgba(73,37,48,.18)" }} />
        <div style={{ position: "absolute", left: "50%", top: "49%", transform: "translate(-50%,-50%) translateZ(80px)", width: 116, height: 116, borderRadius: 28, display: "grid", placeItems: "center", background: "linear-gradient(145deg,#fff,#f3d8df)", border: "2px solid #d9a9b5", boxShadow: "0 20px 35px rgba(86,44,57,.25), inset 0 2px 0 #fff", cursor: "pointer" }} onClick={() => setSelected("orchestrator")}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 34 }}>🎯</div><b>ORCHESTRATOR</b><small style={{ display: "block", color: tone("orchestrator"), marginTop: 4 }}>{status("orchestrator") === "working" ? "● WORKING" : "● IDLE"}</small></div>
        </div>
        {list.filter((a) => a.id !== "orchestrator").map((agent, index) => {
          const positions = [["50%","9%"],["82%","27%"],["82%","69%"],["50%","86%"],["18%","48%"]];
          const [top,left] = positions[index] || positions[0];
          return <button key={agent.id} type="button" onClick={() => setSelected(agent.id)} style={{ position: "absolute", top, left, transform: "translate(-50%,-50%) translateZ(35px)", width: 112, minHeight: 82, borderRadius: 18, border: selected === agent.id ? "2px solid #c9687f" : "1px solid #ddcbd0", background: "rgba(255,255,255,.95)", boxShadow: "0 16px 28px rgba(70,37,48,.17)", cursor: "pointer", padding: 10, textAlign: "left" }}>
            <span style={{ display: "block", fontSize: 21 }}>{agent.id === "sales" ? "🛍️" : agent.id === "order" ? "📦" : agent.id === "payment" ? "💳" : agent.id === "support" ? "💬" : "🛡️"}</span><b style={{ display: "block", fontSize: 12 }}>{agent.name}</b><small style={{ display: "block", color: tone(agent.id), marginTop: 3 }}>{status(agent.id) === "working" ? "● Working" : "● Idle"} · {taskCount(agent.id)} task</small>
          </button>;
        })}
        <div style={{ position: "absolute", left: "50%", bottom: 13, transform: "translateX(-50%)", padding: "7px 12px", borderRadius: 999, background: "rgba(37,29,33,.88)", color: "#fff", fontSize: 10, letterSpacing: ".08em" }}>SECURE INTERNAL AGENT NETWORK</div>
      </div>
      <aside style={{ border: "1px solid var(--line)", borderRadius: 18, padding: 16, background: "#fff" }}>
        <span className="proEyebrow">SELECTED AGENT</span><h3 style={{ margin: "6px 0 4px" }}>{active.name}</h3><p style={{ color: "var(--muted)", fontSize: 12, marginTop: 0 }}>{active.role}</p>
        <div className="detailGrid" style={{ marginTop: 14 }}><div><small>Holat</small><b style={{ display: "block", color: tone(active.id), marginTop: 4 }}>{status(active.id) === "working" ? "Working" : "Idle"}</b></div><div><small>Faol task</small><b style={{ display: "block", marginTop: 4 }}>{taskCount(active.id)}</b></div><div><small>Audit event</small><b style={{ display: "block", marginTop: 4 }}>{eventCount(active.id)}</b></div><div><small>Agent ID</small><b style={{ display: "block", marginTop: 4, fontSize: 11 }}>{active.id}</b></div></div>
        <div style={{ marginTop: 14 }}><b style={{ fontSize: 12 }}>Capabilities</b>{active.capabilities.length ? <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: 11 }}>{active.capabilities.join(" · ")}</p> : <p style={{ color: "var(--muted)", fontSize: 11 }}>Agent metadata API orqali kelganda ko‘rsatiladi.</p>}</div>
        <div style={{ marginTop: 18, padding: 11, borderRadius: 13, background: "#fbf4f5", fontSize: 11, lineHeight: 1.5 }}><b>Safety boundary</b><br />Faqat ichki, ruxsat etilgan deterministic tool’lar. Mijozga avtonom AI javoblari hozircha yoqilmagan.</div>
      </aside>
    </div>
  </section>;
}
