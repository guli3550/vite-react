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
        last = new Error(
          res.status >= 500
            ? "Server vaqtincha ishlamayapti. Birozdan so‘ng qayta urinib ko‘ring."
            : "Serverdan noto‘g‘ri javob keldi."
        );
        continue;
      }
      let json: T;
      try {
        json = JSON.parse(text) as T;
      } catch {
        last = new Error("Server bilan bog‘lanishda xatolik yuz berdi.");
        continue;
      }
      if (!res.ok || !json.success) throw new Error(json.message || "So‘rov bajarilmadi.");
      return json;
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (
        last.message.includes("fetch") ||
        last.message.includes("Failed") ||
        last.message === "Serverdan noto‘g‘ri javob keldi." ||
        last.message.includes("Server vaqtincha")
      )
        continue;
      throw last;
    }
  }
  throw last || new Error("Server bilan bog‘lanish imkoni bo‘lmadi.");
}

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = "signin",
  forceGate = false,
  customTitle,
  customSubtitle,
}) => {
  const [view, setView] = useState<AuthView>(
    initialTab === "signup" ? "signup" : initialTab === "otp" ? "choice" : "signin"
  );
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);

  const googleConfigured = Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccess(null);
    setOtp("");
    setTimer(0);
    setView(initialTab === "signup" ? "signup" : initialTab === "otp" ? "choice" : "signin");
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!timer) return;
    const id = window.setInterval(() => setTimer((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  if (!isOpen) return null;

  const resetMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const go = (next: AuthView) => {
    resetMessages();
    setView(next);
  };

  const finish = async (data: any, fallbackProvider: "email" = "email") => {
    const session = data?.session || data;
    const token = session?.access_token || data?.access_token;
    const user = data?.user || session?.user;
    if (!token || !user?.id) throw new Error("Sessiya yaratilmadi. Qaytadan urinib ko‘ring.");

    // Preserve custom avatar if previously set
    const savedCustomAvatar = localStorage.getItem("guli_custom_avatar") || localStorage.getItem("guli_avatar_url");

    const authUser: AuthUser = {
      id: user.id,
      email: user.email || email,
      full_name: user.user_metadata?.full_name || fullName.trim() || (user.email || email).split("@")[0],
      phone: user.user_metadata?.phone || phone.trim() || null,
      avatar_url: savedCustomAvatar || user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      provider: user.app_metadata?.provider === "google" ? "google" : fallbackProvider,
      created_at: user.created_at,
    };

    localStorage.setItem("guli_access_token", token);
    localStorage.setItem("guli_auth_user", JSON.stringify(authUser));
    localStorage.setItem("guli_email", authUser.email || "");
    if (authUser.full_name) localStorage.setItem("guli_first_name", authUser.full_name);
    if (authUser.phone) localStorage.setItem("guli_phone", authUser.phone);

    await syncCustomerProfile(user, token, {
      full_name: authUser.full_name || "",
      phone: authUser.phone || "",
      avatar_url: authUser.avatar_url || undefined,
      auth_provider: authUser.provider || fallbackProvider,
    });

    onSuccess(authUser, token);
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const clean = email.trim().toLowerCase();
    if (!emailOk(clean)) {
      setError("Iltimos, haqiqiy email manzilingizni kiriting.");
      return;
    }
    setLoading(true);
    try {
      await callAuthApi("/api/auth/email/start", { email: clean });
      setEmail(clean);
      setOtp("");
      setTimer(60);
      setView("otp_verify");
      setSuccess(`6 xonali tasdiqlash kodi ${clean} pochtasiga yuborildi.`);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Tasdiqlash kodi yuborilmadi.";
      setError(
        /email|smtp|confirmation|send/i.test(m)
          ? "Tasdiqlash kodi yuborilmadi. Email/SMTP sozlamasini tekshiring."
          : m
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!/^\d{6}$/.test(otp)) {
      setError("6 xonali kodni to‘liq kiriting.");
      return;
    }
    setLoading(true);
    try {
      const r = await callAuthApi("/api/auth/email/verify", { email: email.trim().toLowerCase(), token: otp });
      await finish(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tasdiqlash kodi noto‘g‘ri yoki muddati o‘tgan.");
    } finally {
      setLoading(false);
    }
  };

  const signup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const clean = email.trim().toLowerCase();
    if (!emailOk(clean)) {
      setError("Email manzilini to‘g‘ri kiriting.");
      return;
    }
    if (password.length < 6) {
      setError("Parol kamida 6 ta belgidan iborat bo‘lsin.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Parollar bir-biriga mos kelmadi.");
      return;
    }
    setLoading(true);
    try {
      const r = await callAuthApi("/api/auth/password/signup", {
        email: clean,
        password,
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      if (r.data?.session || r.data?.access_token) {
        await finish(r.data);
        return;
      }
      setEmail(clean);
      setOtp("");
      setTimer(60);
      setView("signup_otp");
      setSuccess(`Hisobingiz yaratildi. ${clean} pochtasiga tasdiqlash kodi yuborildi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ro‘yxatdan o‘tishda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const verifySignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!/^\d{6}$/.test(otp)) {
      setError("6 xonali kodni to‘liq kiriting.");
      return;
    }
    setLoading(true);
    try {
      const r = await callAuthApi("/api/auth/email/verify", { email: email.trim().toLowerCase(), token: otp });
      await finish(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tasdiqlash kodi noto‘g‘ri yoki muddati o‘tgan.");
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const clean = email.trim().toLowerCase();
    if (!emailOk(clean) || !password) {
      setError("Email va parolni to‘liq kiriting.");
      return;
    }
    setLoading(true);
    try {
      const r = await callAuthApi("/api/auth/password/login", { email: clean, password });
      await finish(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Email yoki parol noto‘g‘ri.");
    } finally {
      setLoading(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    const clean = forgotEmail.trim().toLowerCase();
    if (!emailOk(clean)) {
      setError("Iltimos, to‘g‘ri email manzilini kiriting.");
      return;
    }
    setLoading(true);
    try {
      await callAuthApi("/api/auth/password/reset-start", { email: clean });
      setForgotEmail(clean);
      setForgotToken("");
      setTimer(60);
      setView("forgot_verify");
      setSuccess(`Tiklash kodi ${clean} pochtasiga yuborildi.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tiklash kodi yuborilmadi.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!/^\d{6}$/.test(forgotToken)) {
      setError("6 xonali tiklash kodini kiriting.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Yangi parol kamida 6 ta belgidan iborat bo‘lsin.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Yangi parollar bir-biriga mos kelmadi.");
      return;
    }
    setLoading(true);
    try {
      await callAuthApi("/api/auth/password/reset-verify", {
        email: forgotEmail.trim().toLowerCase(),
        token: forgotToken,
        password: newPassword,
      });
      setEmail(forgotEmail);
      setPassword(newPassword);
      setSuccess("Parol muvaffaqiyatli yangilandi. Endi kirishingiz mumkin.");
      setTimeout(() => go("signin"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parolni yangilashda xatolik yuz berdi.");
    } finally {
      setLoading(false);
    }
  };

  const google = () => {
    resetMessages();
    if (!googleConfigured) {
      setError("Google orqali kirish hali to‘liq sozlanmagan. Iltimos, email orqali kiring.");
      return;
    }
    window.location.href = `${BACKEND_API_URL}/api/auth/google`;
  };

  const title =
    customTitle ||
    (view === "signin"
      ? "Tizimga kirish"
      : view === "signup"
      ? "Ro‘yxatdan o‘tish"
      : view === "forgot_request" || view === "forgot_verify"
      ? "Parolni tiklash"
      : view === "otp_verify" || view === "signup_otp"
      ? "Emailni tasdiqlash"
      : "GULI Shaxsiy hisobi");

  const subtitle =
    customSubtitle ||
    (view === "signup"
      ? "Buyurtmalar va keshbekingizni saqlash uchun yangi hisob oching"
      : view === "signin"
      ? "Email va parolingiz bilan profilingizga kiring"
      : view === "choice"
      ? "Xavfsiz va qulay usulda davom eting"
      : "Xavfsiz autentifikatsiya");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        overflowY: "auto",
      }}
      onClick={(e) => {
        if (!forceGate && e.target === e.currentTarget) onClose?.();
      }}
    >
      {/* Modern Card Container */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "var(--bg-card, #ffffff)",
          color: "var(--text-main, #0f172a)",
          borderRadius: "28px",
          padding: "28px 24px",
          boxShadow: "0 25px 60px -15px rgba(225, 29, 72, 0.25), 0 10px 30px rgba(0, 0, 0, 0.2)",
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
          border: "1px solid var(--border-color, rgba(225, 29, 72, 0.15))",
          boxSizing: "border-box",
        }}
      >
        {/* Close button */}
        {!forceGate && onClose && (
          <button
            onClick={onClose}
            aria-label="Yopish"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--bg-card-sub, #f1f5f9)",
              border: "1px solid var(--border-color, transparent)",
              fontSize: 14,
              color: "var(--text-muted, #64748b)",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              transition: "all 0.15s",
            }}
          >
            ✕
          </button>
        )}

        {/* Brand Icon & Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              minWidth: 56,
              minHeight: 56,
              maxWidth: 56,
              maxHeight: 56,
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              overflow: "hidden",
              margin: "0 auto 12px",
              boxShadow: "0 8px 24px rgba(225, 29, 72, 0.28)",
              border: "2.5px solid var(--bg-card, #ffffff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(225, 29, 72, 0.12)",
              flexShrink: 0,
            }}
          >
            <img
              src="/guli_logo.jpg"
              alt="GULI Logo"
              style={{
                width: "100%",
                height: "100%",
                minWidth: "100%",
                minHeight: "100%",
                aspectRatio: "1 / 1",
                objectFit: "cover",
                borderRadius: "50%",
                display: "block",
              }}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = "none";
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<span style="font-size: 22px; font-weight: 900; color: #be185d;">G</span>';
                }
              }}
            />
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800, color: "var(--text-main, #0f172a)" }}>
            {title}
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, #64748b)", lineHeight: 1.4 }}>
            {subtitle}
          </p>
        </div>

        {/* Switch Tabs (Kirish / Ro'yxatdan o'tish) */}
        {(view === "signin" || view === "signup" || view === "choice") && (
          <div
            style={{
              display: "flex",
              background: "var(--bg-input, #f8fafc)",
              padding: 4,
              borderRadius: 14,
              border: "1px solid var(--border-color, #e2e8f0)",
              marginBottom: 20,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => go("signin")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 11,
                border: "none",
                background: view === "signin" ? "var(--bg-card, #ffffff)" : "transparent",
                color: view === "signin" ? "#e11d48" : "var(--text-muted, #64748b)",
                fontWeight: view === "signin" ? 700 : 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: view === "signin" ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              🔑 Kirish
            </button>
            <button
              type="button"
              onClick={() => go("signup")}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: 11,
                border: "none",
                background: view === "signup" ? "var(--bg-card, #ffffff)" : "transparent",
                color: view === "signup" ? "#e11d48" : "var(--text-muted, #64748b)",
                fontWeight: view === "signup" ? 700 : 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: view === "signup" ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              ✨ Ro‘yxatdan o‘tish
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {error && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#15803d",
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>✓</span>
            <span>{success}</span>
          </div>
        )}

        {/* 1. SIGN IN VIEW */}
        {view === "signin" && (
          <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 6 }}>
                Email pochta
              </label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: 12, fontSize: 14, color: "var(--text-muted, #94a3b8)" }}>✉️</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="masalan: user@gmail.com"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 12px 11px 36px",
                    borderRadius: 12,
                    border: "1px solid var(--border-input, #cbd5e1)",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "var(--bg-input, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)" }}>Parol</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    go("forgot_request");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#e11d48",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Unutdingizmi?
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: 12, fontSize: 14, color: "var(--text-muted, #94a3b8)" }}>🔒</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Parolingizni kiriting"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 38px 11px 36px",
                    borderRadius: 12,
                    border: "1px solid var(--border-input, #cbd5e1)",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "var(--bg-input, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: 10,
                    background: "none",
                    border: "none",
                    color: "var(--text-muted, #94a3b8)",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {showPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {loading ? "Kirilmoqda…" : "Tizimga kirish"}
            </button>

            {/* Google or alternatives */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0", color: "var(--text-muted, #94a3b8)", fontSize: 11 }}>
              <span style={{ flex: 1, height: 1, background: "var(--border-color, #e2e8f0)" }} />
              yoki
              <span style={{ flex: 1, height: 1, background: "var(--border-color, #e2e8f0)" }} />
            </div>

            <button
              type="button"
              onClick={google}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 12,
                border: "1px solid var(--border-color, #e2e8f0)",
                background: "var(--bg-card-sub, #ffffff)",
                color: "var(--text-main, #334155)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span>🌐</span> Google orqali kirish
            </button>

            <button
              type="button"
              onClick={() => go("choice")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted, #64748b)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Email kod (OTP) orqali parolsiz kirish →
            </button>
          </form>
        )}

        {/* 2. SIGN UP VIEW */}
        {view === "signup" && (
          <form onSubmit={signup} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 5 }}>
                Ism va familiyangiz
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="masalan: Malika Karimova"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 5 }}>
                Telefon raqamingiz (ixtiyoriy)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 5 }}>
                Email pochta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 5 }}>
                  Parol
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kamida 6 belgi"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border-input, #cbd5e1)",
                    fontSize: 12,
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "var(--bg-input, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 5 }}>
                  Takrorlang
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Parolni takrorlang"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border-input, #cbd5e1)",
                    fontSize: 12,
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "var(--bg-input, #f8fafc)",
                    color: "var(--text-main, #0f172a)",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                opacity: loading ? 0.7 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {loading ? "Yaratilmoqda…" : "✨ Ro‘yxatdan o‘tish"}
            </button>

            <div style={{ textAlign: "center", marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>Hisobingiz bormi? </span>
              <button
                type="button"
                onClick={() => go("signin")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#e11d48",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Kirish
              </button>
            </div>
          </form>
        )}

        {/* 3. OTP VERIFY (Email kod tasdiqlash) */}
        {(view === "otp_verify" || view === "signup_otp") && (
          <form onSubmit={view === "otp_verify" ? verifyOtp : verifySignup} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "var(--bg-card-sub, #f8fafc)", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border-color, #e2e8f0)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted, #64748b)" }}>Yuborilgan manzil:</span>
              <b style={{ display: "block", fontSize: 13, color: "var(--text-main, #0f172a)" }}>{email}</b>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 6 }}>
                6 xonali tasdiqlash kodi
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  border: "2px solid #e11d48",
                  fontSize: 18,
                  fontWeight: 800,
                  textAlign: "center",
                  letterSpacing: "6px",
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #ffffff)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Tekshirilmoqda…" : "Kodni tasdiqlash"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <button
                type="button"
                disabled={timer > 0 || loading}
                onClick={sendOtp}
                style={{
                  background: "none",
                  border: "none",
                  color: timer > 0 ? "var(--text-muted, #94a3b8)" : "#e11d48",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: timer > 0 ? "default" : "pointer",
                }}
              >
                {timer ? `Qayta yuborish (${timer}s)` : "Kodni qayta yuborish"}
              </button>

              <button
                type="button"
                onClick={() => go("signin")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted, #64748b)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ← Orqaga
              </button>
            </div>
          </form>
        )}

        {/* 4. CHOICE / OTP REQUEST */}
        {view === "choice" && (
          <form onSubmit={sendOtp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 6 }}>
                Email pochtangiz:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
                required
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Yuborilmoqda…" : "Emailga kod yuborish"}
            </button>

            <button
              type="button"
              onClick={() => go("signin")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted, #64748b)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              ← Parol orqali kirish
            </button>
          </form>
        )}

        {/* 5. FORGOT PASSWORD */}
        {view === "forgot_request" && (
          <form onSubmit={sendReset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 6 }}>
                Email pochtangizni kiriting:
              </label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="user@gmail.com"
                required
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Yuborilmoqda…" : "Tiklash kodini yuborish"}
            </button>

            <button
              type="button"
              onClick={() => go("signin")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted, #64748b)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              ← Kirishga qaytish
            </button>
          </form>
        )}

        {/* 6. FORGOT VERIFY */}
        {view === "forgot_verify" && (
          <form onSubmit={resetPassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 4 }}>
                6 xonali tiklash kodi
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={forgotToken}
                onChange={(e) => setForgotToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 14,
                  textAlign: "center",
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 4 }}>
                Yangi parol
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Kamida 6 belgi"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-main, #334155)", marginBottom: 4 }}>
                Yangi parolni takrorlang
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Parolni takrorlang"
                required
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-input, #cbd5e1)",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                  backgroundColor: "var(--bg-input, #f8fafc)",
                  color: "var(--text-main, #0f172a)",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "12px",
                borderRadius: 14,
                border: "none",
                background: "linear-gradient(135deg, #e11d48, #be123c)",
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(225, 29, 72, 0.35)",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Yangilanmoqda…" : "Parolni saqlash"}
            </button>

            <button
              type="button"
              onClick={() => go("signin")}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted, #64748b)",
                fontSize: 12,
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              ← Kirishga qaytish
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
