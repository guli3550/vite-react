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
  telegram_id?: number | null;
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

type Status = "idle" | "waiting" | "ready";
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
  if (!response.ok || json?.success === false) throw new Error(json?.message || `So‘rov bajarilmadi (${response.status}).`);
  return json?.data ?? json;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen, onClose, onSuccess, language: _language, initialTab = "signin", forceGate = false, customTitle, customSubtitle,
}) => {
  const [status, setStatus] = useState<Status>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);

  const clearPolling = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => { clearPolling(); try { popupRef.current?.close(); } catch {} }, []);
  useEffect(() => {
    if (!isOpen) { clearPolling(); return; }
    setStatus("idle"); setError(null); setSuccess(null); setLoading(false);
  }, [isOpen, initialTab]);

  const completeLogin = (data: any) => {
    const user: AuthUser = {
      id: String(data?.user?.id || ""),
      phone: data?.user?.phone_number || null,
      full_name: data?.user?.full_name || null,
      provider: "telegram",
      telegram_id: data?.user?.telegram_id ?? null,
      created_at: data?.user?.created_at,
    };
    if (!user.id || !data?.access_token) throw new Error("Auth javobi to‘liq emas.");
    localStorage.setItem("guli_access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("guli_refresh_token", data.refresh_token);
    localStorage.setItem("guli_auth_user", JSON.stringify(user));
    setSuccess("✅ Muvaffaqiyatli kirdingiz! GULI hisobingiz ochilmoqda...");
    setStatus("idle");
    try { popupRef.current?.close(); } catch {}
    onSuccess(user, data.access_token);
    window.setTimeout(() => window.location.reload(), 450);
  };

  const start = async () => {
    if (loading || status === "waiting" || status === "ready") return;
    setLoading(true); setError(null); setSuccess(null); clearPolling();

    // Open synchronously from the user's click so Android Chrome does not block Telegram.
    let popup: Window | null = null;
    try { popup = window.open("about:blank", "_blank"); } catch {}
    popupRef.current = popup;

    try {
      const r = await api("/api/v1/auth/init-session", { method: "POST", body: JSON.stringify({}) });
      const id = r?.session_id;
      const ticket = r?.exchange_ticket;
      const url = r?.telegram_url || r?.deep_link;
      if (!id || !ticket || !url) throw new Error("Telegram ulanish sessiyasi to‘liq yaratilmadi.");

      if (popup && !popup.closed) {
        try { popup.location.href = url; } catch { window.location.href = url; }
      } else {
        // Popup was blocked: direct navigation still preserves the auth_<UUID> payload.
        window.location.href = url;
      }

      setLoading(false);
      setStatus("waiting");
      setSuccess(null);
      setError(null);

      let elapsed = 0;
      pollRef.current = window.setInterval(async () => {
        elapsed += 1200;
        if (elapsed > 300000) {
          clearPolling(); setStatus("idle"); setError("Sessiya muddati tugadi. Qaytadan boshlang."); return;
        }
        try {
          const s = await api(`/api/v1/auth/check-status/${encodeURIComponent(id)}`, { method: "GET" });
          const state = String(s?.status || "").toUpperCase();
          if (state === "EXPIRED") {
            clearPolling(); setStatus("idle"); setError("Sessiya muddati tugadi. Qaytadan boshlang."); return;
          }
          if (state === "READY") {
            setStatus("ready"); setError(null); setSuccess("🔐 Telegram tasdig‘i olindi. Hisobingizga xavfsiz kirilmoqda...");
            try {
              const exchanged = await api("/api/v1/auth/exchange", {
                method: "POST",
                body: JSON.stringify({ session_id: id, exchange_ticket: ticket }),
              });
              clearPolling();
              completeLogin(exchanged);
            } catch (e) {
              const message = e instanceof Error ? e.message : "Avtomatik login bajarilmadi.";
              if (/allaqachon|ishlatilgan/i.test(message)) {
                clearPolling(); setStatus("idle"); setError("Sessiya allaqachon ishlatilgan. Qaytadan login qiling.");
              }
            }
          } else if (state === "VERIFIED") {
            clearPolling();
            // Backend may have completed the session through another valid exchange.
            setSuccess("✅ Muvaffaqiyatli kirdingiz! GULI hisobingiz ochilmoqda...");
            window.setTimeout(() => window.location.reload(), 450);
          }
        } catch {
          // Keep polling through temporary network failures.
        }
      }, 1200);
    } catch (e) {
      try { popup?.close(); } catch {}
      popupRef.current = null;
      setLoading(false);
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Telegram orqali ulanishda xatolik.");
    }
  };

  if (!isOpen) return null;
  const title = customTitle || "Telegram orqali kirish";
  const subtitle = customSubtitle || "Telefon raqamingiz Telegram orqali xavfsiz tasdiqlanadi. OTP kodni qo‘lda kiritish shart emas.";
  const waiting = status === "waiting" || status === "ready";

  return (
    <div style={{position:"fixed",inset:0,zIndex:999999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(15,23,42,.68)",backdropFilter:"blur(10px)"}} onClick={e=>{if(!forceGate&&e.target===e.currentTarget)onClose?.();}}>
      <div style={{width:"100%",maxWidth:420,borderRadius:24,padding:24,background:"var(--bg-card,#fff)",boxShadow:"0 24px 80px rgba(0,0,0,.25)"}}>
        <div style={{textAlign:"center",marginBottom:22}}><div style={{fontSize:42,marginBottom:8}}>📱</div><h2 style={{margin:0,fontSize:24,fontWeight:800}}>{title}</h2><p style={{margin:"8px 0 0",opacity:.7,lineHeight:1.45}}>{subtitle}</p></div>
        {error && <div style={{padding:12,borderRadius:12,marginBottom:14,background:"rgba(220,38,38,.10)",color:"#b91c1c",fontSize:14}}>{error}</div>}
        {success && <div style={{padding:12,borderRadius:12,marginBottom:14,background:"rgba(22,163,74,.10)",color:"#15803d",fontSize:14}}>{success}</div>}
        <button type="button" onClick={start} disabled={loading||waiting} style={{width:"100%",padding:"15px 18px",border:0,borderRadius:14,cursor:loading?"wait":"pointer",fontSize:16,fontWeight:800,background:"#229ED9",color:"white",opacity:loading||waiting?.7:1}}>{loading?"⏳ Telegram ochilmoqda…":status==="ready"?"🔐 Tasdiqlandi…":status==="waiting"?"📲 Telegram tasdig‘i kutilmoqda…":"📱 Telegram orqali kirish"}</button>
        {waiting && <div style={{marginTop:14,padding:12,borderRadius:12,background:"rgba(100,116,139,.08)",fontSize:13,lineHeight:1.5}}>Telegramda <b>Start</b> tugmasini bosing, keyin <b>Telefon raqamimni yuborish</b> tugmasini bosing. Brauzer tasdiqdan keyin avtomatik kiradi.</div>}
        {!forceGate && onClose && <button type="button" onClick={onClose} style={{width:"100%",marginTop:10,padding:11,border:0,background:"transparent",cursor:"pointer",opacity:.6}}>Yopish</button>}
      </div>
    </div>
  );
};
