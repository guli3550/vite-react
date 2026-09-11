const { createClient } = require("@supabase/supabase-js");
const { executeTask } = require("./agentExecutorPatch");
const { advanceWorkflow } = require("./agentWorkflowPatch");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
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
