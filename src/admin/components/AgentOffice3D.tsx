import { useMemo, useState } from "react";

type Agent = { id: string; name: string; role: string; capabilities: string[]; status: "working" | "idle" };
type AgentTask = { id: string; agent_id: string; status: string; created_at: string };
type AgentEvent = { id: string; task_id: string; agent_id: string; event_type: string; message?: string; created_at: string };

const FALLBACK_AGENTS = [["orchestrator","Orchestrator","Boshqaruv"],["sales","Sales","Savdo"],["order","Order","Buyurtmalar"],["payment","Payment","To‘lovlar"],["support","Support","Qo‘llab-quvvatlash"],["security","Security","Xavfsizlik"]];
const ICONS: Record<string,string> = { sales:"🛍️", order:"📦", payment:"💳", support:"💬", security:"🛡️", orchestrator:"🎯" };

export function AgentOffice3D({ agents, tasks, events }: { agents: Agent[]; tasks: AgentTask[]; events: AgentEvent[] }) {
  const [selected, setSelected] = useState("orchestrator");
  const list = useMemo(() => FALLBACK_AGENTS.map(([id,name,role]) => agents.find(a=>a.id===id) || ({id,name,role,capabilities:[],status:"idle" as const})), [agents]);
  const active = list.find(a=>a.id===selected) || list[0];
  const activeTasks = (id:string) => tasks.filter(t=>t.agent_id===id && ["queued","running"].includes(t.status));
  const agentEvents = (id:string) => events.filter(e=>e.agent_id===id).sort((a,b)=>+new Date(b.created_at)-+new Date(a.created_at));
  const status = (id:string) => activeTasks(id).some(t=>t.status==="running") || list.find(a=>a.id===id)?.status==="working" ? "working" : "idle";
  const tone = (id:string) => status(id)==="working" ? "#35a56b" : "#b7a4aa";
  const latest = agentEvents(active.id)[0];
  const eventLabel = latest?.event_type === "tool_called" ? "Tool ishlayapti" : latest?.event_type === "task_completed" ? "Task yakunlandi" : latest?.event_type === "task_failed" ? "Xatolik" : latest?.event_type === "task_paused" ? "Pauzada" : latest?.event_type === "task_resumed" ? "Davom etdi" : status(active.id)==="working" ? "Ish jarayoni" : "Kutilmoqda";

  return <section className="proPanel" style={{overflow:"hidden"}}>
    <div className="panelHead"><div><span className="proEyebrow">LIVE AI OFFICE · 3D CONTROL ROOM</span><h2>GULI Agent Office</h2><p>Agent holati task registry va audit eventlaridan olinadi. UI 5 soniyada yangilanadi.</p></div><span className="statusPill">● LIVE · 5s</span></div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 300px",gap:16,alignItems:"stretch"}}>
      <div style={{position:"relative",minHeight:410,borderRadius:22,border:"1px solid var(--line)",background:"radial-gradient(circle at 50% 42%, #fff 0, #fbf0f3 42%, #efe1e5 100%)",perspective:1100,overflow:"hidden"}}>
        <div style={{position:"absolute",inset:"12% 8% 8%",transform:"rotateX(55deg)",transformStyle:"preserve-3d",border:"1px solid #e2cfd5",borderRadius:24,background:"linear-gradient(145deg,rgba(255,255,255,.9),rgba(239,222,227,.72))",boxShadow:"0 28px 55px rgba(73,37,48,.18)"}} />
        <div style={{position:"absolute",left:"50%",top:"49%",transform:"translate(-50%,-50%) translateZ(80px)",width:116,height:116,borderRadius:28,display:"grid",placeItems:"center",background:"linear-gradient(145deg,#fff,#f3d8df)",border:"2px solid #d9a9b5",boxShadow:"0 20px 35px rgba(86,44,57,.25),inset 0 2px 0 #fff",cursor:"pointer"}} onClick={()=>setSelected("orchestrator")}><div style={{textAlign:"center"}}><div style={{fontSize:34}}>🎯</div><b>ORCHESTRATOR</b><small style={{display:"block",color:tone("orchestrator"),marginTop:4}}>{status("orchestrator")==="working"?"● WORKING":"● IDLE"}</small></div></div>
        {list.filter(a=>a.id!=="orchestrator").map((agent,index)=>{const positions=[["9%","50%"],["27%","82%"],["69%","82%"],["86%","50%"],["48%","18%"]];const [top,left]=positions[index]||positions[0];return <button key={agent.id} type="button" onClick={()=>setSelected(agent.id)} style={{position:"absolute",top,left,transform:"translate(-50%,-50%) translateZ(35px)",width:118,minHeight:86,borderRadius:18,border:selected===agent.id?"2px solid #c9687f":"1px solid #ddcbd0",background:"rgba(255,255,255,.95)",boxShadow:"0 16px 28px rgba(70,37,48,.17)",cursor:"pointer",padding:10,textAlign:"left"}}><span style={{display:"block",fontSize:21}}>{ICONS[agent.id]}</span><b style={{display:"block",fontSize:12}}>{agent.name}</b><small style={{display:"block",color:tone(agent.id),marginTop:3}}>{status(agent.id)==="working"?"● Working":"● Idle"} · {activeTasks(agent.id).length} task</small></button>})}
        <div style={{position:"absolute",left:"50%",bottom:13,transform:"translateX(-50%)",padding:"7px 12px",borderRadius:999,background:"rgba(37,29,33,.88)",color:"#fff",fontSize:10,letterSpacing:".08em"}}>SECURE INTERNAL AGENT NETWORK</div>
      </div>
      <aside style={{border:"1px solid var(--line)",borderRadius:18,padding:16,background:"#fff"}}><span className="proEyebrow">SELECTED AGENT</span><h3 style={{margin:"6px 0 4px"}}>{active.name}</h3><p style={{color:"var(--muted)",fontSize:12,marginTop:0}}>{active.role}</p><div className="detailGrid" style={{marginTop:14}}><div><small>Holat</small><b style={{display:"block",color:tone(active.id),marginTop:4}}>{status(active.id)==="working"?"Working":"Idle"}</b></div><div><small>Faol task</small><b style={{display:"block",marginTop:4}}>{activeTasks(active.id).length}</b></div><div><small>Audit event</small><b style={{display:"block",marginTop:4}}>{agentEvents(active.id).length}</b></div><div><small>Activity</small><b style={{display:"block",marginTop:4,fontSize:11}}>{eventLabel}</b></div></div><div style={{marginTop:14}}><b style={{fontSize:12}}>Oxirgi activity</b><p style={{color:"var(--muted)",lineHeight:1.5,fontSize:11}}>{latest?.message || "Hali activity mavjud emas."}</p>{latest&&<small>{new Date(latest.created_at).toLocaleString("uz-UZ")}</small>}</div><div style={{marginTop:14}}><b style={{fontSize:12}}>Capabilities</b>{active.capabilities.length?<p style={{color:"var(--muted)",lineHeight:1.6,fontSize:11}}>{active.capabilities.join(" · ")}</p>:<p style={{color:"var(--muted)",fontSize:11}}>Agent metadata API orqali kelganda ko‘rsatiladi.</p>}</div><div style={{marginTop:18,padding:11,borderRadius:13,background:"#fbf4f5",fontSize:11,lineHeight:1.5}}><b>Safety boundary</b><br/>Faqat ichki, ruxsat etilgan deterministic tool’lar. Mijozga avtonom AI javoblari yoqilmagan.</div></aside>
    </div>
  </section>;
}
