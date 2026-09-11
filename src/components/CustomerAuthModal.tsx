import React, { useEffect, useState } from "react";
import { BACKEND_API_URL, syncCustomerProfile } from "../lib/supabaseClient";
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

type AuthView = "choice" | "otp_verify" | "signin" | "signup" | "signup_otp" | "forgot_request" | "forgot_verify";
type ApiResult = { success: boolean; message?: string; data?: any };

async function callAuthApi<T extends ApiResult = ApiResult>(path: string, body: Record<string, unknown>): Promise<T> {
  const urls = [`${BACKEND_API_URL}${path}`, path];
  let last: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
      const type = res.headers.get("content-type") || "";
      const text = await res.text();
      if (!type.includes("application/json")) {
        last = new Error(res.status >= 500 ? "Server vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring." : "Serverdan noto‘g‘ri javob keldi.");
        continue;
      }
      let json: T;
      try { json = JSON.parse(text) as T; } catch { last = new Error("Server bilan bog‘lanishda xatolik yuz berdi."); continue; }
      if (!res.ok || !json.success) throw new Error(json.message || "So‘rov bajarilmadi.");
      return json;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (last.message.includes("fetch") || last.message.includes("Failed") || last.message === "Serverdan noto‘g‘ri javob keldi." || last.message.includes("Server vaqtincha")) continue;
      throw last;
    }
  }
  throw last || new Error("Server bilan bog‘lanish imkoni bo‘lmadi.");
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { width: "100%", padding: 13, borderRadius: 14, border: "none", background: "#4f46e5", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const linkStyle: React.CSSProperties = { background: "none", border: "none", color: "#4f46e5", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" };

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({ isOpen, onClose, onSuccess, initialTab = "otp", forceGate = false, customTitle, customSubtitle }) => {
  const [view, setView] = useState<AuthView>(initialTab === "signin" ? "signin" : initialTab === "signup" ? "signup" : "choice");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const googleConfigured = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());

  useEffect(() => {
    if (!isOpen) return;
    setError(null); setSuccess(null); setOtp(""); setTimer(0);
    setView(initialTab === "signin" ? "signin" : initialTab === "signup" ? "signup" : "choice");
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setTimer(v => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  if (!isOpen) return null;
  const resetMessages = () => { setError(null); setSuccess(null); };
  const go = (next: AuthView) => { resetMessages(); setView(next); };

  const finish = async (data: any, fallbackProvider: "email" = "email") => {
    const session = data?.session || data;
    const token = session?.access_token || data?.access_token;
    const user = data?.user || session?.user;
    if (!token || !user?.id) throw new Error("Sessiya yaratilmadi. Qaytadan urinib ko‘ring.");
    const authUser: AuthUser = {
      id: user.id,
      email: user.email || email,
      full_name: user.user_metadata?.full_name || fullName.trim() || (user.email || email).split("@")[0],
      phone: user.user_metadata?.phone || phone.trim() || null,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      provider: user.app_metadata?.provider === "google" ? "google" : fallbackProvider,
      created_at: user.created_at,
    };
    localStorage.setItem("guli_access_token", token);
    localStorage.setItem("guli_auth_user", JSON.stringify(authUser));
    localStorage.setItem("guli_email", authUser.email || "");
    await syncCustomerProfile(user, token, { full_name: authUser.full_name || "", phone: authUser.phone || "", auth_provider: authUser.provider || fallbackProvider });
    onSuccess(authUser, token);
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    const clean = email.trim().toLowerCase();
    if (!emailOk(clean)) { setError("Iltimos, haqiqiy email manzilingizni kiriting."); return; }
    setLoading(true);
    try {
      await callAuthApi("/api/auth/email/start", { email: clean });
      setEmail(clean); setTimer(60); setView("otp_verify");
      setSuccess(`6 xonali kod ${clean} pochtasiga yuborildi.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Tasdiqlash kodi yuborilmadi.";
      setError(/email|smtp|confirmation|send/i.test(m) ? "Tasdiqlash kodi yuborilmadi. Email/SMTP xizmati sozlamasini tekshirish kerak." : m);
    } finally { setLoading(false); }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    if (!/^\d{6}$/.test(otp)) { setError("6 xonali kodni to‘liq kiriting."); return; }
    setLoading(true);
    try { const r = await callAuthApi("/api/auth/email/verify", { email: email.trim().toLowerCase(), token: otp }); await finish(r.data); }
    catch (e) { setError(e instanceof Error ? e.message : "Tasdiqlash kodi noto‘g‘ri yoki muddati o‘tgan."); }
    finally { setLoading(false); }
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    const clean = email.trim().toLowerCase();
    if (!emailOk(clean)) { setError("Email manzilini to‘g‘ri kiriting."); return; }
    if (password.length < 8) { setError("Parol kamida 8 ta belgidan iborat bo‘lsin."); return; }
    if (password !== confirmPassword) { setError("Parollar bir-biriga mos kelmadi."); return; }
    setLoading(true);
    try {
      const r = await callAuthApi("/api/auth/password/signup", { email: clean, password, full_name: fullName.trim(), phone: phone.trim() });
      if (r.data?.session || r.data?.access_token) { await finish(r.data); return; }
      setEmail(clean); setTimer(60); setView("signup_otp");
      setSuccess(`Hisob yaratildi. ${clean} pochtasiga tasdiqlash kodi yuborildi.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Ro‘yxatdan o‘tishda xatolik yuz berdi."); }
    finally { setLoading(false); }
  };

  const verifySignup = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    if (!/^\d{6}$/.test(otp)) { setError("6 xonali kodni to‘liq kiriting."); return; }
    setLoading(true);
    try { const r = await callAuthApi("/api/auth/email/verify", { email: email.trim().toLowerCase(), token: otp }); await finish(r.data); }
    catch (e) { setError(e instanceof Error ? e.message : "Tasdiqlash kodi noto‘g‘ri yoki muddati o‘tgan."); }
    finally { setLoading(false); }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    const clean = email.trim().toLowerCase();
    if (!emailOk(clean) || !password) { setError("Email va parolni to‘liq kiriting."); return; }
    setLoading(true);
    try { const r = await callAuthApi("/api/auth/password/login", { email: clean, password }); await finish(r.data); }
    catch (e) { setError(e instanceof Error ? e.message : "Email yoki parol noto‘g‘ri."); }
    finally { setLoading(false); }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    const clean = forgotEmail.trim().toLowerCase();
    if (!emailOk(clean)) { setError("Iltimos, to‘g‘ri email manzilini kiriting."); return; }
    setLoading(true);
    try { await callAuthApi("/api/auth/password/reset-start", { email: clean }); setForgotEmail(clean); setTimer(60); setView("forgot_verify"); setSuccess(`Tiklash kodi ${clean} pochtasiga yuborildi.`); }
    catch (e) { setError(e instanceof Error ? e.message : "Tiklash kodi yuborilmadi. Email/SMTP xizmati sozlamasini tekshiring."); }
    finally { setLoading(false); }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); resetMessages();
    if (!/^\d{6}$/.test(forgotToken)) { setError("6 xonali tiklash kodini kiriting."); return; }
    if (newPassword.length < 8) { setError("Yangi parol kamida 8 ta belgidan iborat bo‘lsin."); return; }
    if (newPassword !== confirmNewPassword) { setError("Yangi parollar bir-biriga mos kelmadi."); return; }
    setLoading(true);
    try { await callAuthApi("/api/auth/password/reset-verify", { email: forgotEmail.trim().toLowerCase(), token: forgotToken, password: newPassword }); setEmail(forgotEmail); setPassword(newPassword); setSuccess("Parol muvaffaqiyatli yangilandi. Endi kirishingiz mumkin."); setTimeout(() => go("signin"), 700); }
    catch (e) { setError(e instanceof Error ? e.message : "Parolni yangilashda xatolik yuz berdi."); }
    finally { setLoading(false); }
  };

  const google = () => {
    resetMessages();
    if (!googleConfigured) { setError("Google orqali kirish hali sozlanmagan. Google OAuth Client ID va Supabase Google provider konfiguratsiyasi kerak."); return; }
    window.location.href = `${BACKEND_API_URL}/api/auth/google`;
  };

  const title = customTitle || (view === "signin" ? "Tizimga kirish" : view === "signup" ? "Ro‘yxatdan o‘tish" : view === "forgot_request" || view === "forgot_verify" ? "Parolni tiklash" : view === "otp_verify" || view === "signup_otp" ? "Emailni tasdiqlash" : "GULI hisobingiz");
  const subtitle = customSubtitle || (view === "choice" ? "Buyurtmalar va profilingizni barcha qurilmalarda saqlash uchun kiring" : view === "signup" ? "Yangi GULI hisobini yarating" : view === "signin" ? "Email va parolingiz bilan davom eting" : "Xavfsiz autentifikatsiya");
  const Field = ({ label, value, onChange, type = "text", placeholder, required = true }: any) => <div style={{ marginBottom: 13 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{label}</label><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} style={inputStyle} /></div>;

  return <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.7)", backdropFilter: "blur(8px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (!forceGate && e.target === e.currentTarget) onClose?.(); }}>
    <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "28px 24px", boxShadow: "0 20px 60px -15px rgba(0,0,0,.3)", position: "relative", maxHeight: "92vh", overflowY: "auto" }}>
      {!forceGate && onClose && <button onClick={onClose} aria-label="Yopish" style={{ position: "absolute", top: 18, right: 18, background: "none", border: 0, fontSize: 22, color: "#64748b", cursor: "pointer" }}>✕</button>}
      <div style={{ textAlign: "center", marginBottom: 20 }}><div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🔒</div><h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{title}</h3><p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>{subtitle}</p></div>
      {error && <div style={{ padding: "12px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
      {success && <div style={{ padding: "12px 14px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", fontSize: 13, marginBottom: 16 }}>✓ {success}</div>}

      {view === "choice" && <>
        <button type="button" onClick={google} disabled={!googleConfigured || loading} style={{ ...buttonStyle, background: "#fff", color: "#1e293b", border: "1px solid #e2e8f0", marginBottom: 12, opacity: googleConfigured ? 1 : .65 }}>{googleConfigured ? "🌐  Google orqali davom etish" : "🌐  Google orqali kirish (sozlanmoqda)"}</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0" }}><div style={{ flex: 1, height: 1, background: "#e2e8f0" }}/><span style={{ fontSize: 12, color: "#94a3b8" }}>YOKI</span><div style={{ flex: 1, height: 1, background: "#e2e8f0" }}/></div>
        <form onSubmit={sendOtp}><Field label="Email pochtangiz:" value={email} onChange={setEmail} type="email" placeholder="user@gmail.com"/><button type="submit" disabled={loading} style={buttonStyle}>{loading ? "Kod yuborilmoqda..." : "Davom etish"}</button></form>
        <div style={{ textAlign: "center", marginTop: 15 }}><button type="button" onClick={() => go("signup")} style={linkStyle}>Ro‘yxatdan o‘tish</button><span style={{ color: "#cbd5e1", margin: "0 9px" }}>•</span><button type="button" onClick={() => go("signin")} style={linkStyle}>Parol orqali kirish</button></div>
      </>}

      {(view === "otp_verify" || view === "signup_otp") && <form onSubmit={view === "otp_verify" ? verifyOtp : verifySignup}><div style={{ textAlign: "center", marginBottom: 14 }}><b>{email}</b><p style={{ fontSize: 12, color: "#64748b" }}>Emailingizga yuborilgan 6 xonali kodni kiriting</p></div><Field label="6 xonali kod:" value={otp} onChange={(v: string) => setOtp(v.replace(/\D/g, "").slice(0, 6))} placeholder="123456"/><button type="submit" disabled={loading || otp.length !== 6} style={buttonStyle}>{loading ? "Tekshirilmoqda..." : "Kodni tasdiqlash"}</button><div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}><button type="button" disabled={timer > 0 || loading} onClick={() => sendOtp({ preventDefault() {} } as React.FormEvent)} style={linkStyle}>{timer ? `Qayta yuborish (${timer}s)` : "Kodni qayta yuborish"}</button><button type="button" onClick={() => go(view === "signup_otp" ? "signup" : "choice")} style={{ ...linkStyle, color: "#64748b", textDecoration: "none" }}>← Orqaga</button></div></form>}

      {view === "signup" && <form onSubmit={signup}><Field label="Ism va familiya:" value={fullName} onChange={setFullName} placeholder="Ism Familiya"/><Field label="Telefon:" value={phone} onChange={setPhone} type="tel" placeholder="+998 90 123 45 67" required={false}/><Field label="Email:" value={email} onChange={setEmail} type="email" placeholder="user@gmail.com"/><Field label="Parol:" value={password} onChange={setPassword} type="password" placeholder="Kamida 8 belgi"/><Field label="Parolni takrorlang:" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="••••••••"/><button type="submit" disabled={loading} style={buttonStyle}>{loading ? "Hisob yaratilmoqda..." : "Ro‘yxatdan o‘tish"}</button><div style={{ textAlign: "center", marginTop: 14 }}><button type="button" onClick={() => go("signin")} style={linkStyle}>Hisobingiz bormi? Kirish</button></div></form>}

      {view === "signin" && <form onSubmit={signIn}><Field label="Email:" value={email} onChange={setEmail} type="email" placeholder="user@gmail.com"/><Field label="Parol:" value={password} onChange={setPassword} type="password" placeholder="••••••••"/><div style={{ textAlign: "right", marginBottom: 12 }}><button type="button" onClick={() => { setForgotEmail(email); go("forgot_request"); }} style={linkStyle}>Parolni unutdingizmi?</button></div><button type="submit" disabled={loading} style={buttonStyle}>{loading ? "Kirilmoqda..." : "Kirish"}</button><div style={{ textAlign: "center", marginTop: 14 }}><button type="button" onClick={() => go("signup")} style={linkStyle}>Hisobingiz yo‘qmi? Ro‘yxatdan o‘tish</button></div><div style={{ textAlign: "center", marginTop: 10 }}><button type="button" onClick={() => go("choice")} style={{ ...linkStyle, color: "#64748b", textDecoration: "none" }}>← Boshqa usul</button></div></form>}

      {view === "forgot_request" && <form onSubmit={sendReset}><Field label="Email manzilingiz:" value={forgotEmail} onChange={setForgotEmail} type="email" placeholder="user@gmail.com"/><button type="submit" disabled={loading} style={buttonStyle}>{loading ? "Kod yuborilmoqda..." : "Tiklash kodini yuborish"}</button><div style={{ textAlign: "center", marginTop: 14 }}><button type="button" onClick={() => go("signin")} style={{ ...linkStyle, color: "#64748b", textDecoration: "none" }}>← Kirishga qaytish</button></div></form>}

      {view === "forgot_verify" && <form onSubmit={resetPassword}><Field label="6 xonali tiklash kodi:" value={forgotToken} onChange={(v: string) => setForgotToken(v.replace(/\D/g, "").slice(0, 6))} placeholder="123456"/><Field label="Yangi parol:" value={newPassword} onChange={setNewPassword} type="password" placeholder="Kamida 8 belgi"/><Field label="Yangi parolni takrorlang:" value={confirmNewPassword} onChange={setConfirmNewPassword} type="password" placeholder="••••••••"/><button type="submit" disabled={loading} style={buttonStyle}>{loading ? "Parol yangilanmoqda..." : "Parolni yangilash"}</button><div style={{ textAlign: "center", marginTop: 14 }}><button type="button" onClick={() => go("signin")} style={{ ...linkStyle, color: "#64748b", textDecoration: "none" }}>← Kirishga qaytish</button></div></form>}
    </div>
  </div>;
};
