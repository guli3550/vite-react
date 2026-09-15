import React, { useEffect, useRef, useState } from "react";
import type { Language } from "../utils/translations";

export interface AuthUser {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  provider?: "google" | "email" | "telegram";
  created_at?: string;
}

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: AuthUser, token?: string) => void;
  language: Language;
  initialTab?: "signin" | "signup" | "otp";
  forceGate?: boolean;
  customTitle?: string;
  customSubtitle?: string;
}

type Status = "idle" | "waiting" | "otp";
const API = (import.meta.env.VITE_API_URL || "https://guli-lingerie-api.onrender.com").replace(/\/$/, "");

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { throw new Error("Serverdan noto‘g‘ri javob keldi."); }
  if (!response.ok || json?.success === false) throw new Error(json?.message || "So‘rov bajarilmadi.");
  return json;
}

function saveSession(data: any, onSuccess: CustomerAuthModalProps["onSuccess"]) {
  const user = data?.user;
  const token = data?.access_token;
  if (!user?.id || !token) throw new Error("Sessiya yaratilmadi. Qaytadan urinib ko‘ring.");
  const authUser: AuthUser = {
    id: user.id,
    full_name: user.full_name || user.user_metadata?.full_name || null,
    phone: user.phone || user.user_metadata?.phone || null,
    avatar_url: user.avatar_url || user.user_metadata?.avatar_url || localStorage.getItem("guli_custom_avatar") || null,
    provider: "telegram",
    created_at: user.created_at,
  };
  localStorage.setItem("guli_access_token", token);
  if (data?.refresh_token) localStorage.setItem("guli_refresh_token", data.refresh_token);
  localStorage.setItem("guli_auth_user", JSON.stringify(authUser));
  localStorage.setItem("guli_phone", authUser.phone || "");
  localStorage.removeItem("guli_email");
  onSuccess(authUser, token);
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen, onClose, onSuccess, language: _language, initialTab = "signin", forceGate = false, customTitle, customSubtitle,
}) => {
  const [status, setStatus] = useState<Status>("idle");
  const [sessionId, setSessionId] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const pollRef = useRef<number | null>(null);

  useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);
  useEffect(() => {
    if (!isOpen) return;
    setStatus("idle"); setSessionId(""); setTelegramUrl(""); setOtp(""); setError(null); setSuccess(null); setSeconds(0);
  }, [isOpen, initialTab]);
  useEffect(() => {
    if (!seconds) return;
    const t = window.setInterval(() => setSeconds(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [seconds]);

  const start = async () => {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const r = await api("/api/v1/auth/init-session", { method: "POST", body: JSON.stringify({}) });
      const id = r?.data?.session_id;
      const url = r?.data?.telegram_url || r?.data?.deep_link;
      if (!id || !url) throw new Error("Telegram ulanish havolasi yaratilmadi.");
      setSessionId(id); setTelegramUrl(url); setStatus("waiting"); setSeconds(300);
      window.open(url, "_blank", "noopener,noreferrer");
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = window.setInterval(async () => {
        try {
          const s = await api(`/api/v1/auth/check-status/${encodeURIComponent(id)}`, { method: "GET" });
          const state = String(s?.data?.status || s?.status || "").toUpperCase();
          if (state === "EXPIRED") {
            if (pollRef.current) window.clearInterval(pollRef.current);
            setStatus("idle"); setError("Sessiya muddati tugadi. Qaytadan boshlang.");
          }
        } catch { /* keep polling through temporary network failures */ }
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Telegram orqali ulanishda xatolik.");
    } finally { setLoading(false); }
  };

  if (!isOpen) return null;
  const title = customTitle || "Telegram orqali kirish";
  const subtitle = customSubtitle || "Telefon raqamingiz Telegram orqali xavfsiz tasdiqlanadi. OTP kodni qo‘lda kiritish shart emas.";

  return (
    <div style={{position:"fixed",inset:0,zIndex:999999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(15,23,42,.68)",backdropFilter:"blur(10px)"}} onClick={e=>{if(!forceGate&&e.target===e.currentTarget)onClose?.();}}>
      <div style={{width:"100%",maxWidth:420,borderRadius:24,padding:24,background:"var(--bg-card,#fff)",boxShadow:"0 24px 80px rgba(0,0,0,.25)"}}>
        <div style={{textAlign:"center",marginBottom:22}}><div style={{fontSize:42,marginBottom:8}}>📱</div><h2 style={{margin:0,fontSize:24,fontWeight:800}}>{title}</h2><p style={{margin:"8px 0 0",opacity:.7,lineHeight:1.45}}>{subtitle}</p></div>
        {error && <div style={{padding:12,borderRadius:12,marginBottom:14,background:"rgba(220,38,38,.10)",color:"#b91c1c",fontSize:14}}>{error}</div>}
        {success && <div style={{padding:12,borderRadius:12,marginBottom:14,background:"rgba(22,163,74,.10)",color:"#15803d",fontSize:14}}>{success}</div>}
        <button type="button" onClick={start} disabled={loading||status==="waiting"} style={{width:"100%",padding:"15px 18px",border:0,borderRadius:14,cursor:loading?"wait":"pointer",fontSize:16,fontWeight:800,background:"#229ED9",color:"white",opacity:loading||status==="waiting"?.7:1}}>{loading?"Ulanilmoqda…":status==="waiting"?"📲 Telegram tasdig‘i kutilmoqda…":"📱 Telegram orqali kirish"}</button>
        {status==="waiting" && <div style={{marginTop:14,padding:12,borderRadius:12,background:"rgba(100,116,139,.08)",fontSize:13,lineHeight:1.5}}>Telegramda <b>Telefon raqamimni yuborish</b> tugmasini bosing. Brauzer tasdiqdan keyin avtomatik kiradi.</div>}
        {!forceGate && onClose && <button type="button" onClick={onClose} style={{width:"100%",marginTop:10,padding:11,border:0,background:"transparent",cursor:"pointer",opacity:.6}}>Yopish</button>}
      </div>
    </div>
  );
};
