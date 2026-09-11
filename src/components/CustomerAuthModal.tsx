import React, { useState, useEffect } from "react";
import { getSupabase, syncCustomerProfile, loadSupabaseConfigAsync } from "../lib/supabaseClient";
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

type AuthView = "choice" | "otp_verify" | "set_password" | "signin" | "forgot_request" | "forgot_verify";

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialTab = "otp",
  forceGate = false,
  customTitle,
  customSubtitle,
}) => {
  const [view, setView] = useState<AuthView>("choice");

  // Form fields
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP Verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotToken, setForgotToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Verified user holder for optional password set
  const [verifiedUser, setVerifiedUser] = useState<{ user: AuthUser; token: string } | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Ensure Supabase client config is loaded
  useEffect(() => {
    loadSupabaseConfigAsync();
  }, []);

  // Clean legacy plain text credentials if present
  useEffect(() => {
    localStorage.removeItem("guli_registered_users");
  }, []);

  // Timer countdown
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setOtpCode("");
      setOtpTimer(0);
      setVerifiedUser(null);
      if (initialTab === "signin") {
        setView("signin");
      } else {
        setView("choice");
      }
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // 1. Google OAuth (Real Supabase Auth)
  const handleGoogleAuth = async () => {
    setError(null);
    setGoogleLoading(true);

    try {
      const client = getSupabase();
      if (client) {
        const { error: oauthErr } = await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (oauthErr) throw oauthErr;
        return;
      }

      // Fallback via backend OAuth redirect
      window.location.href = "/api/auth/google";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google orqali kirishda xatolik yuz berdi.";
      setError(message);
      setGoogleLoading(false);
    }
  };

  // 2. Email OTP Request (Real 6-digit code via Supabase + Resend SMTP)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Iltimos, haqiqiy email manzilingizni kiriting.");
      return;
    }

    setLoading(true);

    try {
      const client = getSupabase();
      if (client) {
        const { error: otpErr } = await client.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: true },
        });
        if (otpErr) throw otpErr;
      } else {
        const res = await fetch("/api/auth/email/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.message || "Tasdiqlash kodi yuborilmadi.");
        }
      }

      setView("otp_verify");
      setOtpTimer(60);
      setSuccessMsg(`✓ 6 xonali tasdiqlash kodi ${cleanEmail} pochtasiga yuborildi. Pochtangizni tekshiring.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Emailga kod yuborishda xatolik yuz berdi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Email OTP Verify (Real verification via Supabase Auth)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = otpCode.trim().replace(/\s+/g, "");

    if (!cleanCode || cleanCode.length < 6) {
      setError("Iltimos, pochtangizga kelgan 6 xonali tasdiqlash kodini to'liq kiriting.");
      return;
    }

    setLoading(true);

    try {
      const client = getSupabase();
      let sessionData = null;
      let userData = null;

      if (client) {
        let verifyRes = await client.auth.verifyOtp({
          email: cleanEmail,
          token: cleanCode,
          type: "email",
        });

        if (verifyRes.error) {
          verifyRes = await client.auth.verifyOtp({
            email: cleanEmail,
            token: cleanCode,
            type: "signup",
          });
        }

        if (verifyRes.error || !verifyRes.data?.session) {
          throw new Error(verifyRes.error?.message || "Tasdiqlash kodi noto'g'ri yoki muddati tugagan.");
        }

        sessionData = verifyRes.data.session;
        userData = verifyRes.data.user;
      } else {
        const res = await fetch("/api/auth/email/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, token: cleanCode }),
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data?.session) {
          throw new Error(json.message || "Tasdiqlash kodi noto'g'ri yoki muddati tugagan.");
        }

        sessionData = json.data.session;
        userData = json.data.user;
      }

      if (!sessionData?.access_token || !userData) {
        throw new Error("Sessiya yaratilmadi. Qaytadan urinib ko'ring.");
      }

      const token = sessionData.access_token;
      const authUserData: AuthUser = {
        id: userData.id,
        email: cleanEmail,
        full_name: userData.user_metadata?.full_name || fullName.trim() || cleanEmail.split("@")[0],
        phone: userData.user_metadata?.phone || phone.trim() || null,
        avatar_url: userData.user_metadata?.avatar_url || null,
        provider: "email",
        created_at: userData.created_at || new Date().toISOString(),
      };

      // Real storage & backend sync
      localStorage.setItem("guli_access_token", token);
      localStorage.setItem("guli_auth_user", JSON.stringify(authUserData));
      if (authUserData.full_name) localStorage.setItem("guli_first_name", authUserData.full_name);
      if (authUserData.email) localStorage.setItem("guli_email", authUserData.email);

      await syncCustomerProfile(userData, token, {
        full_name: authUserData.full_name || "",
        phone: authUserData.phone || "",
        auth_provider: "email",
      });

      setVerifiedUser({ user: authUserData, token });
      setSuccessMsg("✓ Email muvaffaqiyatli tasdiqlandi! Istasangiz parol o'rnatishingiz mumkin.");
      setView("set_password");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tasdiqlash kodi noto'g'ri.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 4. Set Password (Optional or post-verification password creation)
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedUser) return;
    setError(null);

    if (password.length < 8) {
      setError("Parol kamida 8 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Parollar bir-biriga mos kelmadi.");
      return;
    }

    setLoading(true);

    try {
      const client = getSupabase();
      if (client) {
        const { error: updateErr } = await client.auth.updateUser({
          password,
          data: {
            full_name: fullName.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        });
        if (updateErr) throw updateErr;
      }

      const updatedUser: AuthUser = {
        ...verifiedUser.user,
        full_name: fullName.trim() || verifiedUser.user.full_name,
        phone: phone.trim() || verifiedUser.user.phone,
      };

      await syncCustomerProfile(
        { id: updatedUser.id, email: updatedUser.email } as any,
        verifiedUser.token,
        {
          full_name: updatedUser.full_name || "",
          phone: updatedUser.phone || "",
        }
      );

      setSuccessMsg("✓ Parolingiz muvaffaqiyatli o'rnatildi!");
      setTimeout(() => {
        onSuccess(updatedUser, verifiedUser.token);
      }, 700);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Parolni saqlashda xatolik yuz berdi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Email Password Sign In (Real Supabase Auth)
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Iltimos, haqiqiy email manzilingizni kiriting.");
      return;
    }

    if (!password) {
      setError("Iltimos, parolingizni kiriting.");
      return;
    }

    setLoading(true);

    try {
      const client = getSupabase();
      let sessionData = null;
      let userData = null;

      if (client) {
        const { data, error: signInErr } = await client.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (signInErr || !data.session) {
          throw new Error(signInErr?.message || "Email yoki parol noto'g'ri.");
        }
        sessionData = data.session;
        userData = data.user;
      } else {
        const res = await fetch("/api/auth/password/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });
        const json = await res.json();
        if (!res.ok || !json.success || !json.data?.session) {
          throw new Error(json.message || "Email yoki parol noto'g'ri.");
        }
        sessionData = json.data.session;
        userData = json.data.user;
      }

      const token = sessionData.access_token;
      const authUserData: AuthUser = {
        id: userData.id,
        email: cleanEmail,
        full_name: userData.user_metadata?.full_name || cleanEmail.split("@")[0],
        phone: userData.user_metadata?.phone || null,
        avatar_url: userData.user_metadata?.avatar_url || null,
        provider: "email",
        created_at: userData.created_at || new Date().toISOString(),
      };

      localStorage.setItem("guli_access_token", token);
      localStorage.setItem("guli_auth_user", JSON.stringify(authUserData));
      if (authUserData.full_name) localStorage.setItem("guli_first_name", authUserData.full_name);
      if (authUserData.email) localStorage.setItem("guli_email", authUserData.email);

      await syncCustomerProfile(userData, token);

      setSuccessMsg("✓ Xush kelibsiz! Tizimga kirdingiz.");
      setTimeout(() => {
        onSuccess(authUserData, token);
      }, 600);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Kirishda xatolik yuz berdi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 6. Forgot Password - Request Recovery Code
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Iltimos, to'g'ri email manzilini kiriting.");
      return;
    }

    setLoading(true);

    try {
      const client = getSupabase();
      if (client) {
        const { error: resetErr } = await client.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (resetErr) throw resetErr;
      } else {
        const res = await fetch("/api/auth/password/reset-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Parolni tiklash so'rovi qabul qilinmadi.");
      }

      setView("forgot_verify");
      setSuccessMsg(`✓ ${cleanEmail} pochtasiga parolni tiklash kodi yuborildi.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Tiklash kodini yuborishda xatolik yuz berdi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // 7. Forgot Password - Verify Recovery OTP and Set New Password
  const handleResetPasswordVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = forgotEmail.trim().toLowerCase();
    const cleanToken = forgotToken.trim().replace(/\s+/g, "");

    if (!cleanToken || cleanToken.length < 6) {
      setError("Iltimos, pochtangizga borgan 6 xonali tiklash kodini to'liq kiriting.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Yangi parol kamida 8 ta belgidan iborat bo'lishi kerak.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("Yangi parollar bir-biriga mos kelmadi.");
      return;
    }

    setLoading(true);

    try {
      const client = getSupabase();
      if (client) {
        const verifyRes = await client.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: "recovery",
        });
        if (verifyRes.error) throw verifyRes.error;

        const { error: updateErr } = await client.auth.updateUser({ password: newPassword });
        if (updateErr) throw updateErr;
      } else {
        const res = await fetch("/api/auth/password/reset-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            token: cleanToken,
            password: newPassword,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message || "Parolni yangilashda xatolik.");
      }

      setSuccessMsg("✓ Parolingiz muvaffaqiyatli yangilandi! Endi yangi parol bilan kirishingiz mumkin.");
      setTimeout(() => {
        setEmail(cleanEmail);
        setPassword(newPassword);
        setView("signin");
      }, 1200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Parolni yangilashda xatolik yuz berdi.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modalBackdrop"
      id="customer-auth-modal-backdrop"
      onClick={(e) => {
        if (!forceGate && e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        backdropFilter: "blur(8px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        id="customer-auth-modal-card"
        style={{
          width: "100%",
          maxWidth: "420px",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          padding: "28px 24px",
          boxShadow: "0 20px 60px -15px rgba(0, 0, 0, 0.3)",
          position: "relative",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        {/* Close button if not forced gate */}
        {!forceGate && onClose && (
          <button
            id="auth-modal-close-btn"
            onClick={onClose}
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              background: "none",
              border: "none",
              fontSize: "22px",
              color: "#64748b",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "50%",
              lineHeight: 1,
            }}
            aria-label="Yopish"
          >
            ✕
          </button>
        )}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              margin: "0 auto 12px",
              boxShadow: "0 8px 16px -4px rgba(79, 70, 229, 0.4)",
            }}
          >
            🔒
          </div>
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: "20px",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.3px",
            }}
          >
            {customTitle || (view === "signin" ? "Tizimga kirish" : view === "otp_verify" ? "Emailni tasdiqlash" : view === "set_password" ? "Parol yaratish" : view === "forgot_request" || view === "forgot_verify" ? "Parolni tiklash" : "GULI hisobingiz")}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            {customSubtitle || (view === "choice" ? "Buyurtmalar va profilingizni barcha qurilmalarda saqlash uchun kiring" : view === "otp_verify" ? `${email} pochtasiga yuborilgan 6 xonali kodni kiriting` : view === "signin" ? "Email va parolingiz bilan davom eting" : "Xavfsiz autentifikatsiya")}
          </p>
        </div>

        {/* Status Alerts */}
        {error && (
          <div
            id="auth-error-alert"
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "16px",
              lineHeight: 1.4,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div
            id="auth-success-alert"
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#16a34a",
              fontSize: "13px",
              fontWeight: 500,
              marginBottom: "16px",
              lineHeight: 1.4,
            }}
          >
            {successMsg}
          </div>
        )}

        {/* VIEW 1: AUTH CHOICE (Google + Email OTP) */}
        {view === "choice" && (
          <div>
            {/* Real Google Button */}
            <button
              id="google-auth-btn"
              type="button"
              disabled={googleLoading || loading}
              onClick={handleGoogleAuth}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                color: "#1e293b",
                fontSize: "14px",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{googleLoading ? "Google ulanmoqda..." : "Google orqali davom etish"}</span>
            </button>

            {/* Clean Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                margin: "20px 0",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
              <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>yoki</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }} />
            </div>

            {/* Email OTP Form */}
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="auth-email-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Email pochtangiz:
                </label>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="masalan: user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                id="auth-email-continue-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                {loading ? "Tasdiqlash kodi yuborilmoqda..." : "Davom etish"}
              </button>
            </form>

            {/* Switch to Password Login */}
            <div style={{ textAlign: "center", marginTop: "18px" }}>
              <button
                id="switch-to-signin-btn"
                type="button"
                onClick={() => {
                  setError(null);
                  setSuccessMsg(null);
                  setView("signin");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#4f46e5",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Parol orqali kirish
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: OTP VERIFICATION */}
        {view === "otp_verify" && (
          <div>
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: "16px", textAlign: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{email}</span>
                <p style={{ margin: "4px 0 12px", fontSize: "12px", color: "#64748b" }}>
                  Emailingizga yuborilgan 6 xonali tasdiqlash kodini kiriting
                </p>
                <input
                  id="auth-otp-code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  placeholder="· · · · · ·"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    maxWidth: "200px",
                    margin: "0 auto",
                    padding: "12px",
                    textAlign: "center",
                    fontSize: "24px",
                    letterSpacing: "6px",
                    fontWeight: 800,
                    borderRadius: "14px",
                    border: "2px solid #6366f1",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                id="auth-otp-verify-btn"
                type="submit"
                disabled={loading || otpCode.length < 6}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: otpCode.length < 6 ? 0.7 : 1,
                  marginBottom: "12px",
                }}
              >
                {loading ? "Tasdiqlanmoqda..." : "Kodni tasdiqlash"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                <button
                  type="button"
                  disabled={otpTimer > 0 || loading}
                  onClick={handleSendOtp}
                  style={{
                    background: "none",
                    border: "none",
                    color: otpTimer > 0 ? "#94a3b8" : "#4f46e5",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: otpTimer > 0 ? "default" : "pointer",
                  }}
                >
                  {otpTimer > 0 ? `Kodni qayta yuborish (${otpTimer}s)` : "Kodni qayta yuborish"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setView("choice");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ← Boshqa email
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 3: SET PASSWORD AFTER OTP VERIFICATION */}
        {view === "set_password" && verifiedUser && (
          <div>
            <form onSubmit={handleSetPassword}>
              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="set-name-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Ism va familiyangiz:
                </label>
                <input
                  id="set-name-input"
                  type="text"
                  placeholder="Ismingiz (masalan: Lola Karimova)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="set-phone-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Telefon raqamingiz (ixtiyoriy):
                </label>
                <input
                  id="set-phone-input"
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="set-password-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Yangi parol (kamida 8 belgi):
                </label>
                <input
                  id="set-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="confirm-password-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Parolni takrorlang:
                </label>
                <input
                  id="confirm-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="checkbox"
                  id="show-pass-check"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <label htmlFor="show-pass-check" style={{ fontSize: "13px", color: "#64748b", cursor: "pointer" }}>
                  Parolni ko'rsatish
                </label>
              </div>

              <button
                id="save-password-continue-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: "10px",
                }}
              >
                {loading ? "Saqlanmoqda..." : "Parolni saqlash va davom etish"}
              </button>

              <button
                id="skip-password-btn"
                type="button"
                onClick={() => {
                  onSuccess(verifiedUser.user, verifiedUser.token);
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc",
                  color: "#64748b",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                O'tkazib yuborish
              </button>
            </form>
          </div>
        )}

        {/* VIEW 4: EMAIL + PASSWORD LOGIN */}
        {view === "signin" && (
          <div>
            <form onSubmit={handlePasswordSignIn}>
              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="signin-email-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Email:
                </label>
                <input
                  id="signin-email-input"
                  type="email"
                  required
                  placeholder="user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label
                    htmlFor="signin-password-input"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#334155",
                    }}
                  >
                    Parol:
                  </label>
                  <button
                    id="forgot-password-link"
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setForgotEmail(email);
                      setView("forgot_request");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4f46e5",
                      fontSize: "12px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Parolni unutdingizmi?
                  </button>
                </div>
                <input
                  id="signin-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                id="signin-submit-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: "14px",
                }}
              >
                {loading ? "Kirilmoqda..." : "Kirish"}
              </button>

              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setView("choice");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ← OTP orqali davom etish
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 5: FORGOT PASSWORD REQUEST */}
        {view === "forgot_request" && (
          <div>
            <form onSubmit={handleSendResetCode}>
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="forgot-email-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Email manzilingiz:
                </label>
                <input
                  id="forgot-email-input"
                  type="email"
                  required
                  placeholder="user@gmail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                id="send-reset-code-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: "12px",
                }}
              >
                {loading ? "Kod yuborilmoqda..." : "Tiklash kodini yuborish"}
              </button>

              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setView("signin")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ← Kirishga qaytish
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW 6: FORGOT PASSWORD VERIFY & NEW PASSWORD */}
        {view === "forgot_verify" && (
          <div>
            <form onSubmit={handleResetPasswordVerify}>
              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="forgot-token-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  6 xonali tiklash kodi:
                </label>
                <input
                  id="forgot-token-input"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="· · · · · ·"
                  value={forgotToken}
                  onChange={(e) => setForgotToken(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "18px",
                    letterSpacing: "4px",
                    textAlign: "center",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label
                  htmlFor="new-pass-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Yangi parol (kamida 8 belgi):
                </label>
                <input
                  id="new-pass-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="confirm-new-pass-input"
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: "6px",
                  }}
                >
                  Yangi parolni takrorlang:
                </label>
                <input
                  id="confirm-new-pass-input"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <button
                id="reset-pass-verify-btn"
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: "14px",
                  border: "none",
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: "12px",
                }}
              >
                {loading ? "Parol yangilanmoqda..." : "Parolni yangilash"}
              </button>

              <div style={{ textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setView("signin")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#64748b",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  ← Kirishga qaytish
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
