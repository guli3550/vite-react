import { useState } from "react";

type Workflow = {
  id: string;
  workflow_type: string;
  status: string;
  context?: Record<string, unknown>;
  created_at: string;
  finished_at?: string;
  error?: string;
};

type Props = {
  api: string;
  token: string;
  notify: (message: string) => void;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function AgentWorkflowPanel({ api, token, notify }: Props) {
  const [orderNumber, setOrderNumber] = useState("");
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);

  const startWorkflow = async (presetValue?: string) => {
    const value = (presetValue !== undefined ? presetValue : orderNumber).trim();
    if (!value) return notify("Buyurtma raqami yoki ID kiriting (masalan: 1024)");
    setLoading(true);
    try {
      const input = UUID_RE.test(value) ? { order_id: value } : { order_number: value };
      const response = await fetch(`${api}/api/admin/agents/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ workflow_type: "order_payment_status", input }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) {
        throw new Error(json.message || "Workflow yaratilmadi");
      }
      setWorkflow(json.data?.workflow || null);
      if (!presetValue) setOrderNumber("");
      notify("Order → Payment zanjirli workflow ishga tushirildi ✓");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Workflow ishga tushmadi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--line)",
        borderRadius: 18,
        padding: 20,
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#2563eb",
              background: "rgba(37, 99, 235, 0.08)",
              padding: "3px 8px",
              borderRadius: 999,
              display: "inline-block",
            }}
          >
            ⚡ MULTI-AGENT HANDOFF
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>
            Zanjirli pipeline
          </span>
        </div>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          Order → Payment pipeline
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
          Orchestrator buyurtmani avval Order Agent’ga, natijadan so‘ng Payment Agent’ga uzatadi.
        </p>
      </div>

      {/* Visual Pipeline Flow Diagram */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          borderRadius: 12,
          background: "#f8fafc",
          border: "1px solid var(--line)",
          overflowX: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#ffffff",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 11,
            fontWeight: 700,
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          <span>📦</span>
          <span>1. Order Agent</span>
        </div>

        <span style={{ color: "#2563eb", fontWeight: 800, fontSize: 13 }}>➔</span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#ffffff",
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            fontSize: 11,
            fontWeight: 700,
            color: "#0f172a",
            whiteSpace: "nowrap",
          }}
        >
          <span>💳</span>
          <span>2. Payment Agent</span>
        </div>

        <span style={{ color: "#10b981", fontWeight: 800, fontSize: 13 }}>➔</span>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(16, 185, 129, 0.08)",
            padding: "6px 9px",
            borderRadius: 8,
            border: "1px solid #a7f3d0",
            fontSize: 10,
            fontWeight: 700,
            color: "#047857",
            whiteSpace: "nowrap",
          }}
        >
          <span>✓</span>
          <span>Natija</span>
        </div>
      </div>

      {/* Quick Presets Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Tezkor buyurtma:</span>
        {["1024", "1025", "1026"].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => {
              setOrderNumber(num);
              startWorkflow(num);
            }}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px dashed #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            #{num} bilan sinash
          </button>
        ))}
      </div>

      {/* Input & Action Row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Buyurtma raqami yoki UUID (masalan: 1024)"
          style={{
            flex: 1,
            padding: "9px 12px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "#f8fafc",
            fontSize: 12,
            outline: "none",
            color: "#0f172a",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") startWorkflow();
          }}
        />
        <button
          type="button"
          onClick={() => startWorkflow()}
          disabled={loading}
          style={{
            padding: "9px 16px",
            borderRadius: 10,
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 3px 12px rgba(37, 99, 235, 0.25)",
            transition: "all 0.15s ease",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Yaratilmoqda…" : "▶ Workflow boshlash"}
        </button>
      </div>

      {/* Result Status Drawer */}
      {workflow && (
        <div
          style={{
            marginTop: 4,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            fontSize: 11,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>⚡</span>
              <b style={{ color: "#1e3a8a" }}>Workflow holati:</b>
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: workflow.status === "completed" ? "#dcfce7" : "#fef3c7",
                  color: workflow.status === "completed" ? "#15803d" : "#92400e",
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                {workflow.status}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setWorkflow(null)}
              style={{
                border: "none",
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              ✕ Yopish
            </button>
          </div>

          <div style={{ color: "#334155", lineHeight: 1.5 }}>
            <div>ID: <code style={{ fontSize: 10 }}>{workflow.id}</code></div>
            <div>Boshlangan: {new Date(workflow.created_at).toLocaleTimeString("uz-UZ")}</div>
            {workflow.error && (
              <div style={{ color: "#dc2626", marginTop: 4, fontWeight: 600 }}>
                Xatolik: {workflow.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
