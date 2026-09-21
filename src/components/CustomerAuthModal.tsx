import React, { useEffect, useRef, useState } from "react";
import type { Language } from "../utils/translations";
import { getApiBaseUrl } from "../lib/apiOrigin";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";

export interface AuthUser {
  id: string;
  username?: string | null;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  provider?: "telegram";
  created_at?: string;
  telegram_id?: number | null;
  telegram_username?: string | null;
  telegram_photo_url?: string | null;
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
const API = getApiBaseUrl();

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
  isOpen, onClose, onSuccess, language = "uz", initialTab = "signin", forceGate = false, customTitle, customSubtitle,
}) => {
  const [status, setStatus] = useState<Status>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const popupRef = useRef<Window | null>(null);
  const exchangeInFlightRef = useRef(false);

  const clearPolling = () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => () => { clearPolling(); try { popupRef.current?.close(); } catch {} }, []);
  useEffect(() => {
    if (!isOpen) { clearPolling(); exchangeInFlightRef.current = false; return; }
    setStatus("idle"); setError(null); setSuccess(null); setLoading(false); exchangeInFlightRef.current = false;
  }, [isOpen, initialTab]);

  const completeLogin = (data: any) => {
    const rawUsername = String(data?.user?.telegram_username || data?.user?.username || "").trim().replace(/^@+/, "");
    const user: AuthUser = {
      id: String(data?.user?.id || ""),
      phone: data?.user?.phone_number || null,
      username: rawUsername || null,
      full_name: data?.user?.full_name || null,
      avatar_url: data?.user?.telegram_photo_url || data?.user?.avatar_url || null,
      provider: "telegram",
      telegram_id: data?.user?.telegram_id ?? null,
      telegram_username: rawUsername || null,
      telegram_photo_url: data?.user?.telegram_photo_url || null,
      created_at: data?.user?.created_at,
    };
    if (!user.id || !data?.access_token) throw new Error("Auth javobi to‘liq emas.");
    localStorage.setItem("guli_access_token", data.access_token);
    if (data.refresh_token) localStorage.setItem("guli_refresh_token", data.refresh_token);
    localStorage.setItem("guli_auth_user", JSON.stringify(user));
    setSuccess("✅ Muvaffaqiyatli kirdingiz! GULI hisobingiz ochilmoqda...");
    setStatus("idle");
    try { popupRef.current?.close(); } catch {}
    if (Capacitor.isNativePlatform()) { try { await Browser.close(); } catch {} }
    onSuccess(user, data.access_token);
    window.setTimeout(() => window.location.reload(), 450);
  };

  const exchangeSession = async (sessionId: string, ticket: string) => {
    if (exchangeInFlightRef.current) return;
    exchangeInFlightRef.current = true;
    clearPolling();
    setStatus("ready");
    setError(null);
    setSuccess("🔐 Telegram tasdig‘i olindi. Hisobingizga xavfsiz kirilmoqda...");
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const exchanged = await api("/api/v1/auth/exchange", { method: "POST", body: JSON.stringify({ session_id: sessionId, exchange_ticket: ticket }) });
        completeLogin(exchanged);
        exchangeInFlightRef.current = false;
        return;
      } catch (e) {
        lastError = e;
        if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, attempt * 700));
      }
    }
    exchangeInFlightRef.current = false;
    const message = lastError instanceof Error ? lastError.message : "Avtomatik login bajarilmadi.";
    setStatus("idle"); setSuccess(null); setError(`Telegram tasdig‘i olindi, lekin login yakunlanmadi: ${message}`);
  };

  const start = async () => {
    if (loading || status === "waiting" || status === "ready" || exchangeInFlightRef.current) return;
    setLoading(true); setError(null); setSuccess(null); clearPolling(); exchangeInFlightRef.current = false;
    let popup: Window | null = null;
    try { popup = window.open("about:blank", "_blank"); } catch {}
    popupRef.current = popup;
    try {
      const r = await api("/api/v1/auth/init-session", { method: "POST", body: JSON.stringify({}) });
      const id = r?.session_id; const ticket = r?.exchange_ticket; const url = r?.telegram_url || r?.deep_link;
      if (!id || !ticket || !url) throw new Error("Telegram ulanish sessiyasi to‘liq yaratilmadi.");
      if (Capacitor.isNativePlatform()) {
        try {
          await Browser.open({ url, presentationStyle: "popover" });
        } catch {
          window.location.href = url;
        }
      } else if (popup && !popup.closed) {
        try { popup.location.href = url; } catch { window.location.href = url; }
      } else window.location.href = url;
      setLoading(false); setStatus("waiting"); setSuccess(null); setError(null);
      let elapsed = 0;
      pollRef.current = window.setInterval(async () => {
        if (exchangeInFlightRef.current) return;
        elapsed += 1200;
        if (elapsed > 300000) { clearPolling(); setStatus("idle"); setError("Sessiya muddati tugadi. Qaytadan boshlang."); return; }
        try {
          const s = await api(`/api/v1/auth/check-status/${encodeURIComponent(id)}`, { method: "GET" });
          const state = String(s?.status || "").toUpperCase();
          if (state === "EXPIRED") { clearPolling(); setStatus("idle"); setError("Sessiya muddati tugadi. Qaytadan boshlang."); return; }
          if (state === "READY") await exchangeSession(id, ticket);
          else if (state === "VERIFIED") { clearPolling(); setStatus("idle"); setSuccess(null); setError("Auth sessiyasi allaqachon ishlatilgan. Xavfsizlik sababli yangi Telegram login sessiyasini boshlang."); }
        } catch (e) {
          const message = e instanceof Error ? e.message : "Auth status tekshiruvida xatolik.";
          if (/sessiya topilmadi|session topilmadi/i.test(message)) setError(message);
        }
      }, 1200);
    } catch (e) {
      try { popup?.close(); } catch {}
      popupRef.current = null; setLoading(false); setStatus("idle"); setError(e instanceof Error ? e.message : "Telegram orqali ulanishda xatolik.");
    }
  };

  if (!isOpen) return null;
  const isRu = language === "ru";
  const isEn = language === "en";

  const defaultTitle = isRu
    ? "Вход через Telegram"
    : isEn
    ? "Sign in with Telegram"
    : "Telegram orqali kirish";

  const defaultSubtitle = isRu
    ? "Ваш номер телефона будет безопасно подтвержден через Telegram. Вводить OTP вручную не требуется."
    : isEn
    ? "Your phone number will be securely verified via Telegram. No manual OTP entry required."
    : "Telefon raqamingiz Telegram orqali xavfsiz tasdiqlanadi. OTP kodni qo‘lda kiritish shart emas.";

  const title = customTitle || defaultTitle;
  const subtitle = customSubtitle || defaultSubtitle;
  const waiting = status === "waiting" || status === "ready";

  const buttonText = loading
    ? (isRu ? "⏳ Открытие Telegram…" : isEn ? "⏳ Opening Telegram…" : "⏳ Telegram ochilmoqda…")
    : status === "ready"
    ? (isRu ? "🔐 Подтверждено…" : isEn ? "🔐 Verified…" : "🔐 Tasdiqlandi…")
    : status === "waiting"
    ? (isRu ? "📲 Ожидание подтверждения в Telegram…" : isEn ? "📲 Waiting for Telegram verification…" : "📲 Telegram tasdig‘i kutilmoqda…")
    : defaultTitle;

  return (
    <div style={{position:"fixed",inset:0,zIndex:999999,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(15,23,42,.72)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}} onClick={e=>{if(!forceGate&&e.target===e.currentTarget)onClose?.();}}>
      <div style={{width:"100%",maxWidth:420,borderRadius:24,padding:24,background:"var(--bg-card,#fff)",color:"var(--text-main,#1e293b)",boxShadow:"0 24px 80px rgba(0,0,0,.35)",border:"1px solid var(--border-color,rgba(0,0,0,.08))"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{width:64,height:64,margin:"0 auto 14px auto",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",boxShadow:"0 8px 24px rgba(34,158,217,0.38)"}}>
            <svg width="64" height="64" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="120" cy="120" r="120" fill="url(#tg_auth_modal_grad)"/><path d="M183.9 61.2L35.6 118.4C25.4 122.5 25.5 128.2 33.8 130.8L71.9 142.7L160.1 87C164.3 84.4 168.1 85.9 164.9 88.7L93.5 153.2L90.7 195.4C94.8 195.4 96.6 193.5 98.9 191.3L120.5 170.3L165.4 203.4C173.7 208 179.6 205.6 181.7 195.7L211.1 57.5C214.1 45.4 206.5 40 183.9 61.2Z" fill="white"/><defs><linearGradient id="tg_auth_modal_grad" x1="120" y1="0" x2="120" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#2AABEE"/><stop offset="1" stopColor="#229ED9"/></linearGradient></defs></svg>
          </div>
          <h2 style={{margin:0,fontSize:22,fontWeight:800,color:"var(--text-main,#1e293b)"}}>{title}</h2>
          <p style={{margin:"8px 0 0",color:"var(--text-muted,#64748b)",lineHeight:1.45,fontSize:13.5}}>{subtitle}</p>
        </div>
        {error && <div style={{padding:12,borderRadius:12,marginBottom:14,background:"rgba(220,38,38,.10)",color:"#b91c1c",fontSize:14}}>{error}</div>}
        {success && <div style={{padding:12,borderRadius:12,marginBottom:14,background:"rgba(34,197,94,.10)",color:"#15803d",fontSize:14}}>{success}</div>}
        <button type="button" onClick={start} disabled={loading||waiting} style={{width:"100%",padding:"15px 18px",border:0,borderRadius:14,cursor:loading?"wait":"pointer",fontSize:15,fontWeight:800,background:"#229ED9",color:"white",display:"flex",alignItems:"center",justifyContent:"center",gap:10,boxShadow:"0 4px 14px rgba(34,158,217,0.35)",opacity:loading||waiting?.7:1}}>
          <svg width="20" height="20" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
            <path d="M183.9 61.2L35.6 118.4C25.4 122.5 25.5 128.2 33.8 130.8L71.9 142.7L160.1 87C164.3 84.4 168.1 85.9 164.9 88.7L93.5 153.2L90.7 195.4C94.8 195.4 96.6 193.5 98.9 191.3L120.5 170.3L165.4 203.4C173.7 208 179.6 205.6 181.7 195.7L211.1 57.5C214.1 45.4 206.5 40 183.9 61.2Z" fill="white"/>
          </svg>
          <span>{buttonText}</span>
        </button>
        {waiting && (
          <div style={{marginTop:14,padding:12,borderRadius:12,background:"var(--bg-card-sub,rgba(100,116,139,.08))",color:"var(--text-main)",fontSize:13,lineHeight:1.5}}>
            {isRu ? (
              <>В Telegram нажмите кнопку <b>Start</b>, затем <b>Отправить мой номер телефона</b>. Браузер автоматически завершит вход.</>
            ) : isEn ? (
              <>In Telegram, click <b>Start</b>, then click <b>Share Phone Number</b>. Browser will automatically complete sign-in.</>
            ) : (
              <>Telegramda <b>Start</b> tugmasini bosing, keyin <b>Telefon raqamimni yuborish</b> tugmasini bosing. Brauzer tasdiqdan keyin avtomatik kiradi.</>
            )}
          </div>
        )}
        {!forceGate && onClose && (
          <button type="button" onClick={onClose} style={{width:"100%",marginTop:10,padding:11,border:0,background:"transparent",color:"var(--text-muted,#64748b)",cursor:"pointer",opacity:.8,fontSize:13.5,fontWeight:600}}>
            {isRu ? "Закрыть" : isEn ? "Close" : "Yopish"}
          </button>
        )}
      </div>
    </div>
  );
};
