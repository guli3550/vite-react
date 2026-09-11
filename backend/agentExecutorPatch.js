const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { install } = require("./routeRegistry");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || "").trim().replace(/^['"]|['"]$/g, "");
const ALLOWED_TOOLS = new Set(["catalog_check", "order_lookup", "payment_status", "chat_inspect", "security_audit"]);

function clean(value) { return String(value == null ? "" : value).trim(); }
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
async function emit(taskId, agentId, eventType, message, metadata = {}) {
  try {
    const { error } = await supabase.from("agent_events").insert({ task_id: taskId, agent_id: agentId, event_type: eventType, message, metadata, created_by: "agent-executor" });
    if (error && !/relation .* does not exist|schema cache/i.test(error.message || "")) console.error("Agent executor event error:", error);
  } catch (error) { console.error("Agent executor event exception:", error); }
}
function parseCommand(command) {
  try {
    const parsed = JSON.parse(command);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const type = clean(parsed.type);
    if (!ALLOWED_TOOLS.has(type)) return null;
    const input = parsed.input && typeof parsed.input === "object" && !Array.isArray(parsed.input) ? parsed.input : {};
    return { type, input };
  } catch { return null; }
}
async function runCatalogCheck() {
  const { data, error } = await supabase.from("products").select("id,active,stock").limit(1000);
  if (error) throw error;
  const rows = data || []; const active = rows.filter((r) => r.active !== false);
  return { total: rows.length, active: active.length, low_stock: active.filter((r) => Number(r.stock || 0) > 0 && Number(r.stock || 0) <= 3).length, out_of_stock: active.filter((r) => Number(r.stock || 0) <= 0).length };
}
function requireIdentifier(input, keys) { for (const key of keys) { const value = clean(input?.[key]); if (value) return value.slice(0, 120); } throw new Error("Aniq identifikator talab qilinadi"); }
async function runOrderLookup(input) {
  const value = requireIdentifier(input, ["order_id", "order_number"]);
  let query = supabase.from("orders").select("id,order_number,status,created_at,total_amount,payment_status").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(value) ? query.eq("id", value) : query.eq("order_number", value);
  const { data, error } = await query.maybeSingle(); if (error) throw error; return data || null;
}
async function runPaymentStatus(input) {
  const value = requireIdentifier(input, ["order_id", "order_number"]);
  let query = supabase.from("orders").select("id,order_number,status,payment_status,payment_method,created_at").limit(1);
  query = /^[0-9a-f-]{36}$/i.test(value) ? query.eq("id", value) : query.eq("order_number", value);
  const { data, error } = await query.maybeSingle(); if (error) throw error; return data || null;
}
async function runChatInspect(input) {
  const value = requireIdentifier(input, ["user_id", "telegram_id", "phone"]);
  const isPhone = /\D/.test(value) && /\d/.test(value) && value.length >= 7;
  let query = supabase.from("chat_messages").select("id,sender,message,created_at,telegram_user_id,phone").order("created_at", { ascending: false }).limit(20);
  query = isPhone ? query.eq("phone", value) : query.eq("telegram_user_id", value);
  const { data, error } = await query; if (error) throw error; return { count: (data || []).length, messages: data || [] };
}
async function runSecurityAudit() {
  return { checks: { admin_secret_configured: Boolean(clean(process.env.ADMIN_SECRET)), supabase_url_configured: Boolean(clean(process.env.SUPABASE_URL)), supabase_secret_configured: Boolean(clean(process.env.SUPABASE_SECRET_KEY)), telegram_token_configured: Boolean(clean(process.env.TELEGRAM_BOT_TOKEN)) }, secrets_exposed: false, note: "Only configuration presence is reported; secret values are never returned." };
}
const RUNNERS = { catalog_check: runCatalogCheck, order_lookup: runOrderLookup, payment_status: runPaymentStatus, chat_inspect: runChatInspect, security_audit: runSecurityAudit };

async function executeTask(taskId, actor = "agent-executor") {
  const { data: task, error: loadError } = await supabase.from("agent_tasks").select("*").eq("id", taskId).maybeSingle();
  if (loadError) throw loadError;
  if (!task) return { ok: false, conflict: false, message: "Task topilmadi" };
  if (task.status !== "queued") return { ok: false, conflict: true, message: `Task holati ${task.status}` };
  const parsed = parseCommand(task.command);
  if (!parsed) {
    await emit(task.id, task.agent_id, "security_blocked", "Noma'lum yoki ruxsatsiz agent tool", { allowed_tools: [...ALLOWED_TOOLS] });
    await supabase.from("agent_tasks").update({ status: "failed", finished_at: new Date().toISOString(), error: "Tool allowlist tomonidan bloklandi" }).eq("id", task.id).eq("status", "queued");
    return { ok: false, conflict: false, blocked: true, message: "Bu buyruq xavfsizlik siyosati bo'yicha bloklandi" };
  }
  const { data: claimed, error: claimError } = await supabase.from("agent_tasks").update({ status: "running", started_at: new Date().toISOString(), error: null }).eq("id", task.id).eq("status", "queued").select("*").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { ok: false, conflict: true, message: "Task boshqa jarayon tomonidan ishga tushirilgan" };
  await emit(task.id, task.agent_id, "task_started", `Tool ${parsed.type} ishga tushdi`, { tool: parsed.type, actor });
  await emit(task.id, task.agent_id, "tool_called", `Tool ${parsed.type} chaqirildi`, { tool: parsed.type, actor });
  try {
    const result = await RUNNERS[parsed.type](parsed.input);
    const { data: completed, error: completeError } = await supabase.from("agent_tasks").update({ status: "completed", finished_at: new Date().toISOString(), result }).eq("id", task.id).eq("status", "running").select("*").maybeSingle();
    if (completeError) throw completeError;
    await emit(task.id, task.agent_id, "task_completed", `Tool ${parsed.type} muvaffaqiyatli yakunlandi`, { tool: parsed.type, actor });
    return { ok: true, data: completed };
  } catch (error) {
    const message = String(error.message || "Tool execution error").slice(0, 1000);
    await supabase.from("agent_tasks").update({ status: "failed", finished_at: new Date().toISOString(), error: message }).eq("id", task.id).eq("status", "running");
    await emit(task.id, task.agent_id, "task_failed", `Tool ${parsed.type} xato bilan tugadi`, { tool: parsed.type, error: message.slice(0, 500), actor });
    return { ok: false, conflict: false, message: "Agent tool bajarilmadi" };
  }
}

install("post", "/api/admin/agents/tasks/:id/run", async (req, res, next) => {
  const header = req.headers.authorization || ""; const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!verifyAdminToken(token)) return res.status(401).json({ success: false, message: "Admin sessiyasi yaroqsiz yoki tugagan" });
  return next();
}, async (req, res) => {
  try {
    const result = await executeTask(req.params.id, "admin");
    if (result.ok) return res.json({ success: true, data: result.data });
    return res.status(result.blocked ? 403 : result.conflict ? 409 : 500).json({ success: false, message: result.message });
  } catch (error) { console.error("Agent executor error:", error); return res.status(500).json({ success: false, message: "Agent executor xatosi" }); }
});
module.exports = { ALLOWED_TOOLS, parseCommand, executeTask };
