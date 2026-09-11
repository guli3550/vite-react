import { useState } from "react";

type Workflow = { id: string; workflow_type: string; status: string; context?: Record<string, unknown>; created_at: string; finished_at?: string; error?: string };

type Props = { api: string; token: string; notify: (message: string) => void };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AgentWorkflowPanel({ api, token, notify }: Props) {
  const [orderNumber, setOrderNumber] = useState("");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);

  const startWorkflow = async () => {
    const value = orderNumber.trim();
    if (!value) return notify("Order number yoki ID kiriting");
    setLoading(true);
    try {
      const input = UUID_RE.test(value) ? { order_id: value } : { order_number: value };
      const response = await fetch(`${api}/api/admin/agents/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflow_type: "order_payment_status", input })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) throw new Error(json.message || "Workflow yaratilmadi");
      setWorkflow(json.data?.workflow || null);
      setOrderNumber("");
      notify("Order → Payment workflow navbatga qo‘yildi ✓");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Workflow ishga tushmadi");
    } finally { setLoading(false); }
  };

  return <section className="extensionCard" style={{ marginTop: 16, display: "block" }}>
    <div className="panelHead"><div><span className="proEyebrow">MULTI-AGENT HANDOFF</span><h3>Order → Payment</h3><p>Orchestrator buyurtmani avval Order Agent’ga, muvaffaqiyatli natijadan keyin Payment Agent’ga uzatadi.</p></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 12 }}>
      <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Order number / ID" />
      <button type="button" className="proPrimary miniBtn" onClick={startWorkflow} disabled={loading}>{loading ? "Yaratilmoqda…" : "▶ Workflow boshlash"}</button>
    </div>
    {workflow && <div style={{ marginTop: 14, padding: 12, border: "1px solid var(--line)", borderRadius: 12 }}>
      <b>Workflow: {workflow.workflow_type}</b><span className="statusPill" style={{ marginLeft: 8 }}>{workflow.status}</span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}><span className="statusPill">1. Order Agent</span><span>→</span><span className="statusPill">2. Payment Agent</span></div>
      <small style={{ display: "block", marginTop: 10 }}>ID: {workflow.id} · {new Date(workflow.created_at).toLocaleString("uz-UZ")}</small>
      {workflow.error && <small style={{ display: "block", marginTop: 6 }}>Xato: {workflow.error}</small>}
    </div>}
  </section>;
}
