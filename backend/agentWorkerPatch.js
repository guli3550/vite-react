const { createClient } = require("@supabase/supabase-js");
const { executeTask } = require("./agentExecutorPatch");
const { advanceWorkflow } = require("./agentWorkflowPatch");

function getSupabaseClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim().replace(/^['"]|['"]$/g, "");
  const key = String(
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_KEY ||
    ""
  ).trim().replace(/^['"]|['"]$/g, "");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = getSupabaseClient();
  }
  return _supabase;
}

const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error("Supabase is not configured (SUPABASE_URL or SUPABASE_SECRET_KEY missing)");
    }
    const val = client[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});
const POLL_MS = Math.max(2000, Number(process.env.AGENT_WORKER_POLL_MS || 3000));
const MAX_PER_TICK = Math.max(1, Math.min(3, Number(process.env.AGENT_WORKER_BATCH || 1)));
let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const { data: candidates, error } = await supabase.from("agent_tasks").select("id").eq("status", "queued").order("created_at", { ascending: true }).limit(MAX_PER_TICK);
    if (error) throw error;
    for (const candidate of candidates || []) {
      try {
        await executeTask(candidate.id, "worker");
        await advanceWorkflow(candidate.id);
      } catch (error) {
        console.error("Agent task/workflow execution error:", error);
      }
    }
  } catch (error) {
    if (!/relation .* does not exist|schema cache/i.test(error?.message || "")) console.error("Agent worker error:", error);
  } finally { busy = false; }
}
const timer = setInterval(tick, POLL_MS);
if (typeof timer.unref === "function") timer.unref();
setTimeout(() => tick(), 1000).unref?.();
module.exports = { tick };
