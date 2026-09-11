const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim().replace(/^['"]|['"]$/g, "");
const ROUTES = Object.freeze({
  sales: { agentId: "sales", tool: "catalog_check", words: ["mahsulot", "tovar", "catalog", "katalog", "narx", "stock", "ombor"] },
  order: { agentId: "order", tool: "order_lookup", words: ["buyurtma", "zakaz", "order", "yetkaz", "dostavka"] },
  payment: { agentId: "payment", tool: "payment_status", words: ["to'lov", "tolov", "payment", "humo", "uzcard", "chek", "kvitansiya"] },
  support: { agentId: "support", tool: "chat_inspect", words: ["chat", "mijoz", "telegram", "xabar", "operator", "support"] },
  security: { agentId: "security", tool: "security_audit", words: ["audit", "xavfsizlik", "security", "risk", "tekshiruv"] },
});
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
function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyAdminToken(token)) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
  next();
}
function clean(value) { return String(value == null ? "" : value).trim(); }
function routeTask(text, explicitTool) {
  const tool = clean(explicitTool);
  const byTool = Object.values(ROUTES).find((r) => r.tool === tool);
  if (byTool) return { ...byTool, reason: `explicit:${tool}` };
  const normalized = clean(text).toLocaleLowerCase("uz-UZ");
  if (!normalized) return null;
  const scores = Object.entries(ROUTES).map(([route, config]) => ({ route, config, score: config.words.reduce((n, word) => n + (normalized.includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  if (!scores[0] || scores[0].score === 0 || (scores[1] && scores[0].score === scores[1].score)) return null;
  return { ...scores[0].config, reason: `keyword:${scores[0].route}` };
}
function buildInput(tool, text) {
  const value = clean(text);
  if (tool === "security_audit" || tool === "catalog_check") return {};
  const uuid = value.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
  const order = value.match(/(?:buyurtma|order|zakaz)?\s*#?([0-9]{3,})/i)?.[1];
  const telegram = value.match(/(?:telegram|tg|id)\s*[:#]?\s*(-?[0-9]{5,})/i)?.[1];
  if (tool === "chat_inspect") return telegram ? { telegram_id: telegram } : {};
  return uuid ? { order_id: uuid } : order ? { order_number: order } : {};
}
async function emit(taskId, agentId, eventType, message, metadata = {}) {
  try { await supabase.from("agent_events").insert({ task_id: taskId, agent_id: agentId, event_type: eventType, message, metadata, created_by: "orchestrator" }); }
  catch (error) { console.error("Orchestrator event error:", error); }
}

install("post", "/api/admin/agents/dispatch", auth, async (req, res) => {
  try {
    const text = clean(req.body?.task);
    const routed = routeTask(text, req.body?.tool);
    if (!routed) return res.status(400).json({ success: false, message: "Vazifa yo‘nalishi aniq emas. Toolni tanlang yoki Sales/Order/Payment/Support/Security kalit so‘zidan foydalaning." });
    const input = buildInput(routed.tool, text);
    if (["order_lookup", "payment_status"].includes(routed.tool) && !input.order_number && !input.order_id) return res.status(400).json({ success: false, message: "Buyurtma raqami yoki ID kerak." });
    if (routed.tool === "chat_inspect" && !input.telegram_id) return res.status(400).json({ success: false, message: "Chat inspect uchun Telegram ID kerak." });
    const command = JSON.stringify({ type: routed.tool, input });
    const { data, error } = await supabase.from("agent_tasks").insert({ agent_id: routed.agentId, command, status: "queued", created_by: "orchestrator" }).select("*").single();
    if (error) throw error;
    await emit(data.id, routed.agentId, "task_created", `Orchestrator taskni ${routed.agentId} agentga taqsimladi`, { routing_reason: routed.reason, tool: routed.tool });
    res.status(201).json({ success: true, data, routing: { agentId: routed.agentId, tool: routed.tool, reason: routed.reason }, execution: "automatic" });
  } catch (error) { console.error("Orchestrator dispatch error:", error); res.status(500).json({ success: false, message: "Task taqsimlanmadi" }); }
});

async function changeTask(req, res, action) {
  try {
    const id = clean(req.params.id);
    const target = action === "pause" ? "paused" : "queued";
    const allowed = action === "pause" ? ["queued"] : ["paused"];
    const eventType = action === "pause" ? "task_paused" : "task_resumed";
    const message = action === "pause" ? "Task admin tomonidan pauzaga qo‘yildi" : "Task admin tomonidan davom ettirildi";
    const { data, error } = await supabase.from("agent_tasks").update({ status: target }).eq("id", id).in("status", allowed).select("*").maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ success: false, message: action === "pause" ? "Faqat queued task pauzalanadi" : "Faqat paused task davom ettiriladi" });
    await emit(data.id, data.agent_id, eventType, message);
    res.json({ success: true, data });
  } catch (error) { console.error(`Orchestrator ${action} error:`, error); res.status(500).json({ success: false, message: "Task holati o‘zgartirilmadi" }); }
}
install("post", "/api/admin/agents/tasks/:id/pause", auth, (req, res) => changeTask(req, res, "pause"));
install("post", "/api/admin/agents/tasks/:id/resume", auth, (req, res) => changeTask(req, res, "resume"));

let workerBusy = false;
async function processNextTask() {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const { data: queued, error } = await supabase.from("agent_tasks").select("id,agent_id,created_at").eq("status", "queued").order("created_at", { ascending: true }).limit(1);
    if (error) throw error;
    const task = queued?.[0];
    if (!task) return;
    const { executeTask } = require("./agentExecutorPatch");
    const result = await executeTask(task.id, "orchestrator-worker");
    if (result.ok) console.log(`Orchestrator completed task ${task.id} via ${task.agent_id}`);
    else if (!result.conflict) console.warn(`Orchestrator task ${task.id} did not complete: ${result.message}`);
  } catch (error) { console.error("Orchestrator worker error:", error); }
  finally { workerBusy = false; }
}
const workerTimer = setInterval(processNextTask, 2000);
if (workerTimer.unref) workerTimer.unref();

module.exports = { routeTask, processNextTask };
