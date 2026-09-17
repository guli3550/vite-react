import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "../../lib/apiOrigin";
import { MetricCard } from "./AdminUIComponents";
import { AgentOffice3D } from "./AgentOffice3D";
import { AgentOrchestratorPanel } from "./AgentOrchestratorPanel";
import { AgentWorkflowPanel } from "./AgentWorkflowPanel";
import { AgentTaskLenta, AgentAuditLenta, AgentTask, AgentEvent } from "./AgentLentaViews";

const API = getApiBaseUrl();
type Agent = { id: string; name: string; role: string; capabilities: string[]; status: "working" | "idle" };

export function AdminExtensionsTab({ notify }: { notify: (m: string) => void }) {
  const [sheetsSync, setSheetsSync] = useState(true), [telegramWebhook, setTelegramWebhook] = useState(true), [smsGateway, setSmsGateway] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]), [tasks, setTasks] = useState<AgentTask[]>([]), [events, setEvents] = useState<AgentEvent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false), [runningId, setRunningId] = useState(""), [selectedTaskId, setSelectedTaskId] = useState("");
  const token = sessionStorage.getItem("guli_admin_token") || "";
  const request = useCallback(async (path: string, options: RequestInit = {}) => { const response = await fetch(`${API}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) } }); const json = await response.json().catch(() => ({})); if (!response.ok || json.success === false) throw new Error(json.message || "Server xatosi"); return json; }, [token]);
  const loadAgents = useCallback(async (silent = false) => { if (!token) return; if (!silent) setLoadingAgents(true); try { const data = await request("/api/admin/agents"); setAgents(data.data || []); setTasks(data.tasks || []); setEvents(data.events || []); } catch (error) { if (!silent) notify(error instanceof Error ? error.message : "Agentlar yuklanmadi"); } finally { if (!silent) setLoadingAgents(false); } }, [notify, request, token]);
  useEffect(() => { loadAgents(); const timer = window.setInterval(() => loadAgents(true), 5000); return () => window.clearInterval(timer); }, [loadAgents]);
  const runTask = async (id: string) => { setRunningId(id); try { const result = await request(`/api/admin/agents/tasks/${id}/run`, { method: "POST" }); setTasks((current) => current.map((task) => task.id === id ? result.data : task)); notify("Agent task bajarildi ✓"); await loadAgents(true); } catch (error) { notify(error instanceof Error ? error.message : "Agent task bajarilmadi"); } finally { setRunningId(""); } };
  const stopTask = async (id: string) => { try { const result = await request(`/api/admin/agents/tasks/${id}/stop`, { method: "POST" }); setTasks((current) => current.map((task) => task.id === id ? result.data : task)); notify("Agent task to‘xtatildi"); await loadAgents(true); } catch (error) { notify(error instanceof Error ? error.message : "Task to‘xtatilmadi"); } };
  const retryTask = async (task: AgentTask) => { try { const result = await request("/api/admin/agents/tasks", { method: "POST", body: JSON.stringify({ agent_id: task.agent_id, command: task.command }) }); setTasks((current) => [result.data, ...current]); notify("Task yangi urinish sifatida navbatga qo‘yildi ✓"); await loadAgents(true); } catch (error) { notify(error instanceof Error ? error.message : "Retry yaratilmadi"); } };
  return <div className="dash">
    <div className="metricGrid"><MetricCard label="AI Agentlar" value={`${agents.length || 6} ta`} icon="🤖" tone="rose" /><MetricCard label="Ishlayapti" value={`${agents.filter((a) => a.status === "working").length} ta`} icon="⚡" /><MetricCard label="Navbatdagi tasklar" value={`${tasks.filter((t) => t.status === "queued").length} ta`} icon="📋" /><MetricCard label="Audit eventlar" value={`${events.length} ta`} icon="🛡️" /></div>
    <AgentOffice3D
      agents={agents}
      tasks={tasks}
      events={events}
      onRunTask={runTask}
      onStopTask={stopTask}
      onRetryTask={retryTask}
      onCreateTask={async (agentId, toolName, idVal) => {
        const input: Record<string, string> = {};
        if (idVal?.trim()) {
          if (toolName === "chat_inspect") input.telegram_id = idVal.trim();
          else input.order_number = idVal.trim();
        }
        try {
          const result = await request("/api/admin/agents/tasks", {
            method: "POST",
            body: JSON.stringify({
              agent_id: agentId,
              command: JSON.stringify({ type: toolName, input }),
            }),
          });
          setTasks((current) => [result.data, ...current]);
          notify("Agent task navbatga qo‘yildi ✓");
          await loadAgents(true);
        } catch (error) {
          notify(error instanceof Error ? error.message : "Task yaratilmadi");
        }
      }}
      onRefresh={() => loadAgents()}
    />
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
      <AgentOrchestratorPanel api={API} token={token} tasks={tasks} onChanged={() => loadAgents(true)} notify={notify} />
      <AgentWorkflowPanel api={API} token={token} notify={notify} />
    </div>
    <section className="proPanel">
      <div className="panelHead">
        <div>
          <span className="proEyebrow">GULI AI OPERATIONS CENTER</span>
          <h2>Agentlar vazifalari va audit monitoringi</h2>
          <p>Navbatdagi amallar va tizim xavfsizlik auditining append-only oqimlari (Lenta).</p>
        </div>
        <button type="button" className="mgmtBtn" onClick={() => loadAgents()} disabled={loadingAgents}>
          {loadingAgents ? "Yuklanmoqda…" : "↻ Yangilash"}
        </button>
      </div>

      <AgentTaskLenta
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onSelectTask={setSelectedTaskId}
        onRunTask={runTask}
        onStopTask={stopTask}
        onRetryTask={retryTask}
        runningId={runningId}
        events={events}
      />

      <AgentAuditLenta events={events} />
    </section>
    <section className="proPanel"><div className="panelHead"><div><span className="proEyebrow">EXTRA MODULES & INTEGRATIONS</span><h2>Qo‘shimcha Modullar va Tizim Servislari</h2></div></div><div className="extensionsList">
      <div className="extensionCard"><div className="extInfo"><span className="extIcon">📊</span><div><b>Google Sheets Avto-Sinxronizatsiya</b><p>Buyurtmalar va mijozlar ma'lumotlarini real-vaqtda Google Sheets jadvaliga uzatadi.</p></div></div><button type="button" className={sheetsSync ? "proPrimary miniBtn" : "mgmtBtn"} onClick={() => { setSheetsSync(!sheetsSync); notify(sheetsSync ? "Google Sheets pauzaga qo'yildi" : "Google Sheets faollashtirildi ✓"); }}>{sheetsSync ? "Faol ✓" : "Yoqish"}</button></div>
      <div className="extensionCard"><div className="extInfo"><span className="extIcon">✈️</span><div><b>Telegram Webhook Bot Engine</b><p>Telegram Bot orqali keladigan buyurtmalarni admin panel bilan sinxronlaydi.</p></div><button type="button" className={telegramWebhook ? "proPrimary miniBtn" : "mgmtBtn"} onClick={() => { setTelegramWebhook(!telegramWebhook); notify(telegramWebhook ? "Webhook to'xtatildi" : "Webhook qayta yoqildi ✓"); }}>{telegramWebhook ? "Faol ✓" : "Yoqish"}</button></div></div>
      <div className="extensionCard"><div className="extInfo"><span className="extIcon">💬</span><div><b>SMS Bildirishnomalar Gateway</b><p>Buyurtma holati o'zgarganda mijoz telefoniga SMS xabarnoma yuborish.</p></div></div><button type="button" className={smsGateway ? "proPrimary miniBtn" : "mgmtBtn"} onClick={() => { setSmsGateway(!smsGateway); notify(smsGateway ? "SMS gateway o'chirildi" : "SMS gateway faollashtirildi ✓"); }}>{smsGateway ? "Faol ✓" : "Yoqish"}</button></div>
    </div></section>
  </div>;
}
