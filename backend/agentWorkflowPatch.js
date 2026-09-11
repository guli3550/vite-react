const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim().replace(/^['\"]|['\"]$/g, "");

function safeEqual(a, b) { const left = Buffer.from(String(a || "")); const right = Buffer.from(String(b || "")); return left.length === right.length && crypto.timingSafeEqual(left, right); }
function verifyAdminToken(token) {
  try {
    if (!ADMIN_SECRET || !token) return false;
    const [body, signature] = String(token).split(".");
    if (!body || !signature) return false;
    const expected = crypto.createHmac("sha256", ADMIN_SECRET).update(body).digest("base64url");
    if (!safeEqual(signature, expected)) return false;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return payload.role === "admin" && Number(payload.exp) > Date.now();
  } catch { return false; }
}
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyAdminToken(token)) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
  next();
}
async function emitEvent({ taskId = null, agentId, eventType, message, metadata = {}, createdBy = "orchestrator" }) {
  const { error } = await supabase.from("agent_events").insert({ task_id: taskId, agent_id: agentId, event_type: eventType, message, metadata, created_by: createdBy });
  if (error && !/relation .* does not exist|schema cache/i.test(error.message || "")) throw error;
}
function cleanInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const orderId = String(input.order_id || "").trim();
  const orderNumber = String(input.order_number || "").trim();
  if (!orderId && !orderNumber) return null;
  return { ...(orderId ? { order_id: orderId.slice(0, 120) } : {}), ...(orderNumber ? { order_number: orderNumber.slice(0, 120) } : {}) };
}

install("post", "/api/admin/agents/workflows", requireAdmin, async (req, res) => {
  try {
    const workflowType = String(req.body?.workflow_type || "").trim();
    if (workflowType !== "order_payment_status") return res.status(400).json({ success: false, message: "Noma'lum workflow" });
    const context = cleanInput(req.body?.input);
    if (!context) return res.status(400).json({ success: false, message: "Order ID yoki order number kerak" });
    const { data: workflow, error: workflowError } = await supabase.from("agent_workflows").insert({ workflow_type: workflowType, context, status: "running", created_by: "admin" }).select("*").single();
    if (workflowError) throw workflowError;
    const command = JSON.stringify({ type: "order_lookup", input: context });
    const { data: task, error: taskError } = await supabase.from("agent_tasks").insert({ agent_id: "order", command, status: "queued", created_by: "orchestrator", workflow_id: workflow.id, workflow_step: 0 }).select("*").single();
    if (taskError) throw taskError;
    await emitEvent({ taskId: task.id, agentId: "order", eventType: "task_created", message: "Workflow 1-qadam: Order Agent", metadata: { workflow_id: workflow.id, workflow_type: workflowType, workflow_step: 0 } });
    res.status(201).json({ success: true, data: { workflow, task, chain: ["Order Agent → order_lookup", "Payment Agent → payment_status"] } });
  } catch (error) {
    console.error("Agent workflow create error:", error);
    res.status(500).json({ success: false, message: "Agent workflow yaratilmadi" });
  }
});

async function advanceWorkflow(taskId) {
  const { data: task, error } = await supabase.from("agent_tasks").select("id,agent_id,status,result,error,workflow_id,workflow_step").eq("id", taskId).maybeSingle();
  if (error || !task?.workflow_id || task.workflow_step == null) return { advanced: false };
  const { data: workflow, error: workflowError } = await supabase.from("agent_workflows").select("*").eq("id", task.workflow_id).maybeSingle();
  if (workflowError || !workflow || workflow.status !== "running") return { advanced: false };

  if (task.status === "failed" || task.status === "cancelled") {
    const { data: failedWorkflow } = await supabase.from("agent_workflows").update({ status: "failed", finished_at: new Date().toISOString(), error: task.error || "Workflow step failed" }).eq("id", workflow.id).eq("status", "running").select("id").maybeSingle();
    if (failedWorkflow) await emitEvent({ taskId: task.id, agentId: task.agent_id, eventType: "task_failed", message: "Workflow keyingi qadamga o'tmadi", metadata: { workflow_id: workflow.id, workflow_step: task.workflow_step, handoff: "blocked" } });
    return { advanced: false, failed: Boolean(failedWorkflow) };
  }
  if (task.status !== "completed") return { advanced: false };

  if (task.workflow_step === 0 && workflow.workflow_type === "order_payment_status") {
    const { data: existingNext, error: existingError } = await supabase.from("agent_tasks").select("id,status").eq("workflow_id", workflow.id).eq("workflow_step", 1).limit(1).maybeSingle();
    if (existingError) throw existingError;
    if (existingNext) return { advanced: false, duplicate: true, nextTaskId: existingNext.id };
    const command = JSON.stringify({ type: "payment_status", input: workflow.context });
    const { data: nextTask, error: nextError } = await supabase.from("agent_tasks").insert({ agent_id: "payment", command, status: "queued", created_by: "orchestrator", workflow_id: workflow.id, workflow_step: 1 }).select("*").single();
    if (nextError) throw nextError;
    await emitEvent({ taskId: nextTask.id, agentId: "payment", eventType: "task_created", message: "Orchestrator handoff: Payment Agent", metadata: { workflow_id: workflow.id, from_task_id: task.id, workflow_step: 1, handoff: "order_to_payment" } });
    return { advanced: true, nextTask };
  }
  if (task.workflow_step === 1 && workflow.workflow_type === "order_payment_status") {
    const { data: completedWorkflow } = await supabase.from("agent_workflows").update({ status: "completed", finished_at: new Date().toISOString(), result: { final_task_id: task.id, payment_result: task.result || null } }).eq("id", workflow.id).eq("status", "running").select("id").maybeSingle();
    if (completedWorkflow) await emitEvent({ taskId: task.id, agentId: task.agent_id, eventType: "task_completed", message: "Multi-agent workflow yakunlandi", metadata: { workflow_id: workflow.id, workflow_type: workflow.workflow_type, handoff: "completed" } });
    return { advanced: false, completed: Boolean(completedWorkflow) };
  }
  return { advanced: false };
}

module.exports = { advanceWorkflow };
