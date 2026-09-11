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
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const type = res.headers.get("content-type") || "";
      const text = await res.text();
      if (!type.includes("application/json")) {
        last = new Error(res.status >= 500 ? "Server vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring." : "Serverdan noto‘g‘ri javob keldi.");
        continue;
      }
      let json: T;
      try { json = JSON.parse(text) as T; }
      catch { last = new Error("Server bilan bog‘lanishda xatolik yuz berdi."); continue; }
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
const secondaryButtonStyle: React.CSSProperties = { ...buttonStyle, background: "#f1f5f9", color: "#334155" };
const linkStyle: React.CSSProperties = { background: "none", border: "none", color: "#4f46e5", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "underline" };

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}

const Field: React.FC<FieldProps> = ({ label, value, onChange, type = "text", placeholder, required = true, inputMode }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      inputMode={inputMode}
      autoComplete={type === "password" ? "new-password" : type === "email" ? "email" : type === "tel" ? "tel" : "on"}
      style={inputStyle}
    />
  </div>
);

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({ isOpen, onClose, onSuccess, language: _language, initialTab = "otp", forceGate = false, customTitle, customSubtitle }) => {
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
      setEmail(clean); setOtp(""); setTimer(60); setView("otp_verify");
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
      setEmail(clean); setOtp(""); setTimer(60); setView("signup_otp");
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
    try { await callAuthApi("/api/auth/password/reset-start", { email: clean }); setForgotEmail(clean); setForgotToken(""); setTimer(60); setView("forgot_verify"); setSuccess(`Tiklash kodi ${clean} pochtasiga yuborildi.`); }
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

  const otpForm = (submit: (e: React.FormEvent) => void, emailValue: string, back: AuthView = "choice") => (
    <form onSubmit={submit}>
      <div style={{ marginBottom: 13 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Email</label>
        <input value={emailValue} readOnly style={{ ...inputStyle, background: "#f8fafc" }} />
      </div>
      <Field label="6 xonali kod:" value={otp} onChange={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" />
      <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>{loading ? "Tekshirilmoqda..." : "Kodni tasdiqlash"}</button>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <button type="button" disabled={timer > 0 || loading} onClick={sendOtp} style={{ ...linkStyle, opacity: timer > 0 ? .55 : 1 }}>{timer ? `Qayta yuborish (${timer}s)` : "Kodni qayta yuborish"}</button>
        <button type="button" onClick={() => go(back)} style={{ ...linkStyle, color: "#64748b", textDecoration: "none" }}>← Orqaga</button>
      </div>
    </form>
  );

  const title = customTitle || (view === "signin" ? "Tizimga kirish" : view === "signup" ? "Ro‘yxatdan o‘tish" : view === "forgot_request" || view === "forgot_verify" ? "Parolni tiklash" : view === "otp_verify" || view === "signup_otp" ? "Emailni tasdiqlash" : "GULI hisobingiz");
  const subtitle = customSubtitle || (view === "choice" ? "Buyurtmalar va profilingizni barcha qurilmalarda saqlash uchun kiring" : view === "signup" ? "Yangi GULI hisobini yarating" : view === "signin" ? "Email va parolingiz bilan davom eting" : "Xavfsiz autentifikatsiya");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.7)", backdropFilter: "blur(8px)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={(e) => { if (!forceGate && e.target === e.currentTarget) onClose?.(); }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 24, padding: "28px 24px", boxShadow: "0 20px 60px -15px rgba(0,0,0,.3)", position: "relative", maxHeight: "92vh", overflowY: "auto" }}>
        {!forceGate && onClose && <button onClick={onClose} aria-label="Yopish" style={{ position: "absolute", top: 18, right: 18, background: "none", border: 0, fontSize: 22, color: "#64748b", cursor: "pointer" }}>✕</button>}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🔒</div>
          <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{title}</h3>
          <p style={{ margin: 0, fontSize: 14, color: "#64748b", lineHeight: 1.5 }}>{subtitle}</p>
        </div>
        {error && <div style={{ padding: 11, borderRadius: 12, background: "#fef2f2", color: "#b91c1c", fontSize: 13, marginBottom: 14 }}>{error}</div>}
        {success && <div style={{ padding: 11, borderRadius: 12, background: "#f0fdf4", color: "#15803d", fontSize: 13, marginBottom: 14 }}>{success}</div>}

        {view === "choice" && <>
          <form onSubmit={sendOtp}>
            <Field label="Email pochtangiz:" value={email} onChange={setEmail} type="email" placeholder="user@gmail.com" />
            <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>{loading ? "Kod yuborilmoqda..." : "Email orqali davom etish"}</button>
          </form>
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0", color: "#94a3b8", fontSize: 12 }}><span style={{ flex: 1, height: 1, background: "#e2e8f0" }} />yoki<span style={{ flex: 1, height: 1, background: "#e2e8f0" }} /></div>
          <button type="button" style={secondaryButtonStyle} onClick={() => go("signin")}>Email va parol bilan kirish</button>
          <button type="button" style={{ ...secondaryButtonStyle, marginTop: 10 }} onClick={() => go("signup")}>Ro‘yxatdan o‘tish</button>
          <button type="button" style={{ ...secondaryButtonStyle, marginTop: 10, opacity: googleConfigured ? 1 : .65 }} onClick={google}>{googleConfigured ? "Google bilan davom etish" : "Google orqali kirish (sozlanmoqda)"}</button>
        </>}

        {view === "signin" && <form onSubmit={signIn}>
          <Field label="Email:" value={email} onChange={setEmail} type="email" placeholder="user@gmail.com" />
          <Field label="Parol:" value={password} onChange={setPassword} type="password" placeholder="Parolingiz" />
          <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>{loading ? "Kirilmoqda..." : "Kirish"}</button>
          <div style={{ textAlign: "center", marginTop: 12 }}><button type="button" style={linkStyle} onClick={() => { setForgotEmail(email); go("forgot_request"); }}>Parolni unutdingizmi?</button></div>
          <div style={{ textAlign: "center", marginTop: 8 }}><button type="button" style={linkStyle} onClick={() => go("signup")}>Ro‘yxatdan o‘tish</button></div>
          <div style={{ textAlign: "center", marginTop: 8 }}><button type="button" style={{ ...linkStyle, color: "#64748b", textDecoration: "none" }} onClick={() => go("choice")}>← Boshqa usul</button></div>
        </form>}

        {view === "signup" && <form onSubmit={signup}>
          <Field label="Ism va familiya:" value={fullName} onChange={setFullName} placeholder="Ism Familiya" />
          <Field label="Telefon:" value={phone} onChange={setPhone} type="tel" placeholder="+998 90 123 45 67" required={false} />
          <Field label="Email:" value={email} onChange={setEmail} type="email" placeholder="user@gmail.com" />
          <Field label="Parol:" value={password} onChange={setPassword} type="password" placeholder="Kamida 8 belgi" />
          <Field label="Parolni takrorlang:" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Parolni takrorlang" />
          <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>{loading ? "Yaratilmoqda..." : "Hisob yaratish"}</button>
          <div style={{ textAlign: "center", marginTop: 12 }}><button type="button" style={linkStyle} onClick={() => go("signin")}>Hisobingiz bormi? Kirish</button></div>
        </form>}

        {view === "otp_verify" && otpForm(verifyOtp, email, "choice")}
        {view === "signup_otp" && otpForm(verifySignup, email, "signup")}

        {view === "forgot_request" && <form onSubmit={sendReset}>
          <Field label="Email:" value={forgotEmail} onChange={setForgotEmail} type="email" placeholder="user@gmail.com" />
          <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>{loading ? "Yuborilmoqda..." : "Tiklash kodini yuborish"}</button>
          <div style={{ textAlign: "center", marginTop: 12 }}><button type="button" style={linkStyle} onClick={() => go("signin")}>← Kirishga qaytish</button></div>
        </form>}

        {view === "forgot_verify" && <form onSubmit={resetPassword}>
          <div style={{ marginBottom: 13 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}>Email</label><input value={forgotEmail} readOnly style={{ ...inputStyle, background: "#f8fafc" }} /></div>
          <Field label="6 xonali kod:" value={forgotToken} onChange={(v) => setForgotToken(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="123456" />
          <Field label="Yangi parol:" value={newPassword} onChange={setNewPassword} type="password" placeholder="Kamida 8 belgi" />
          <Field label="Yangi parolni takrorlang:" value={confirmNewPassword} onChange={setConfirmNewPassword} type="password" placeholder="Parolni takrorlang" />
          <button type="submit" disabled={loading} style={{ ...buttonStyle, opacity: loading ? .65 : 1 }}>{loading ? "Yangilanmoqda..." : "Parolni yangilash"}</button>
        </form>}
      </div>
    </div>
  );
};