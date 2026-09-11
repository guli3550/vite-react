const { createClient } = require("@supabase/supabase-js");
const { executeTask } = require("./agentExecutorPatch");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const POLL_MS = Math.max(2000, Number(process.env.AGENT_WORKER_POLL_MS || 3000));
const MAX_PER_TICK = Math.max(1, Math.min(3, Number(process.env.AGENT_WORKER_BATCH || 1)));
let busy = false;

async function claimNextTask() {
  const { data: candidates, error } = await supabase
    .from("agent_tasks")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(MAX_PER_TICK);
  if (error) throw error;
  for (const candidate of candidates || []) {
    const { data: claimed, error: claimError } = await supabase
      .from("agent_tasks")
      .update({ status: "running", started_at: new Date().toISOString(), error: null })
      .eq("id", candidate.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) continue;

    // executeTask normally claims queued -> running itself. The worker pre-claim above
    // is intentionally avoided; revert the claim so executeTask remains the single
    // atomic state transition owner.
    await supabase.from("agent_tasks").update({ status: "queued", started_at: null }).eq("id", candidate.id).eq("status", "running");
    return candidate.id;
  }
  return null;
}

async function tick() {
  if (busy) return;
  busy = true;
  try {
    const taskId = await claimNextTask();
    if (taskId) await executeTask(taskId, "worker");
  } catch (error) {
    if (!/relation .* does not exist|schema cache/i.test(error?.message || "")) console.error("Agent worker error:", error);
  } finally {
    busy = false;
  }
}

const timer = setInterval(tick, POLL_MS);
if (typeof timer.unref === "function") timer.unref();
setTimeout(tick, 1000).unref?.();

module.exports = { tick };
