const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");
const { verifyAdminToken, requireAdmin } = require("./adminAuth");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const requireAgentAdmin = requireAdmin;

const AGENTS = Object.freeze([
  { id: "orchestrator", name: "GULI Orchestrator", role: "orchestrator", capabilities: ["plan", "dispatch", "inspect"] },
  { id: "sales", name: "Sales Agent", role: "sales", capabilities: ["products", "catalog", "recommendations"] },
  { id: "order", name: "Order Agent", role: "order", capabilities: ["orders", "order_status"] },
  { id: "payment", name: "Payment Agent", role: "payment", capabilities: ["payment_status", "receipt_review"] },
  { id: "support", name: "Support Agent", role: "support", capabilities: ["chat", "handoff"] },
  { id: "security", name: "Security Agent", role: "security", capabilities: ["audit", "risk_review"] }
]);

async function emitEvent({ taskId = null, agentId, eventType, message = null, metadata = {}, createdBy = "system" }) {
  try {
    const { error } = await supabase.from("agent_events").insert({ task_id: taskId, agent_id: agentId, event_type: eventType, message, metadata, created_by: createdBy });
    if (error && !/relation .* does not exist|schema cache/i.test(error.message || "")) console.error("Agent event write error:", error);
  } catch (error) { console.error("Agent event exception:", error); }
}
function dataOrEmpty(data, error) { return !error ? (data || []) : []; }

install("get", "/api/admin/agents", requireAgentAdmin, async (req, res) => {
  try {
    const { data: tasks, error } = await supabase.from("agent_tasks").select("id,agent_id,command,status,created_by,created_at,started_at,finished_at,result,error").order("created_at", { ascending: false }).limit(100);
    if (error && !/relation .* does not exist|schema cache/i.test(error.message || "")) throw error;
    const taskRows = dataOrEmpty(tasks, error);
    const active = new Set(taskRows.filter((t) => ["queued", "running"].includes(t.status)).map((t) => t.agent_id));
    const taskIds = taskRows.map((task) => task.id); let eventRows = [];
    if (taskIds.length) {
      const { data: events, error: eventError } = await supabase.from("agent_events").select("id,task_id,agent_id,event_type,message,metadata,created_by,created_at").in("task_id", taskIds).order("created_at", { ascending: false }).limit(300);
      if (eventError && !/relation .* does not exist|schema cache/i.test(eventError.message || "")) throw eventError;
      eventRows = dataOrEmpty(events, eventError);
    }
    res.json({ success: true, data: AGENTS.map((agent) => ({ ...agent, status: active.has(agent.id) ? "working" : "idle" })), tasks: taskRows, events: eventRows, persistence: !error });
  } catch (error) { console.error("Agent registry error:", error); res.status(500).json({ success: false, message: "Agent registry yuklanmadi" }); }
});

install("post", "/api/admin/agents/tasks", requireAgentAdmin, async (req, res) => {
  try {
    const agentId = String(req.body?.agent_id || "").trim();
    const command = String(req.body?.command || "").trim();
    if (!AGENTS.some((agent) => agent.id === agentId)) return res.status(400).json({ success: false, message: "Noma'lum agent" });
    if (!command || command.length > 2000) return res.status(400).json({ success: false, message: "Task buyrug'i noto'g'ri" });
    const row = { agent_id: agentId, command, status: "queued", created_by: "admin", created_at: new Date().toISOString() };
    const { data, error } = await supabase.from("agent_tasks").insert(row).select("*").single();
    if (error) throw error;
    await emitEvent({ taskId: data.id, agentId, eventType: "task_created", message: "Agent task queued", metadata: { commandLength: command.length }, createdBy: "admin" });
    res.status(201).json({ success: true, data });
  } catch (error) { console.error("Agent task create error:", error); res.status(500).json({ success: false, message: "Agent task yaratilmadi" }); }
});

install("post", "/api/admin/agents/tasks/:id/stop", requireAgentAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from("agent_tasks").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", req.params.id).in("status", ["queued", "paused"]).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ success: false, message: "Ishlayotgan taskni majburan to'xtatish xavfsiz emas; faqat queued yoki paused task bekor qilinadi" });
    await emitEvent({ taskId: data.id, agentId: data.agent_id, eventType: "task_cancelled", message: "Agent task cancelled by admin", metadata: { control: "stop" }, createdBy: "admin" });
    res.json({ success: true, data });
  } catch (error) { console.error("Agent task stop error:", error); res.status(500).json({ success: false, message: "Agent task bekor qilinmadi" }); }
});

module.exports = { AGENTS, verifyAdminToken, requireAgentAdmin, emitEvent };
