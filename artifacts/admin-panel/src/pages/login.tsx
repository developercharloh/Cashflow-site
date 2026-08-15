import { useState, useEffect, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const [, setLoc] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setLoc("/");
  }, [user, setLoc]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      // Navigation handled by the useEffect watching `user`
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{
      background: "linear-gradient(160deg,#0d0d2b 0%,#1a0a3c 40%,#0a1a3c 70%,#050d1f 100%)",
    }}>
      {/* Background orbs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-15%", left: "-10%", width: "50vw", height: "50vw",
          borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,0.18),transparent 70%)",
          animation: "floatA 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%", width: "40vw", height: "40vw",
          borderRadius: "50%", background: "radial-gradient(circle,rgba(59,130,246,0.15),transparent 70%)",
          animation: "floatB 10s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%", width: "30vw", height: "30vw",
          borderRadius: "50%", background: "radial-gradient(circle,rgba(168,85,247,0.1),transparent 70%)",
          animation: "floatA 12s ease-in-out infinite 2s",
        }} />
        {/* Dot grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }}>
          <defs>
            <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: "400px",
        borderRadius: "28px", padding: "36px 32px 28px",
        background: "rgba(15,12,40,0.75)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(139,92,246,0.18)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", marginBottom: "12px" }}>
            <img src="/logo.png" alt="TaskEarn Pro" style={{ width: "84px", height: "84px", borderRadius: "20px", objectFit: "cover", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px", marginBottom: "2px" }}>
            Task Earn <span style={{ background: "linear-gradient(90deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Pro</span>
          </h1>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(167,139,250,0.7)", letterSpacing: "3px", textTransform: "uppercase" }}>Admin Login</p>
        </div>

        {/* Shield icon row */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "rgba(139,92,246,0.12)",
            border: "1px solid rgba(139,92,246,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck style={{ width: "22px", height: "22px", color: "#a78bfa" }} />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", marginBottom: "6px" }}>Welcome Back! 👋</h2>
          <p style={{ fontSize: "13px", color: "rgba(148,163,184,0.8)" }}>Sign in to access your admin dashboard</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: "16px", padding: "10px 14px", borderRadius: "12px",
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444", flexShrink: 0, display: "inline-block" }} />
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Email field */}
          <div style={{
            borderRadius: "16px", padding: "14px 16px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", gap: "12px",
          }}
            onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(139,92,246,0.5)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(139,92,246,0.06)"; }}
            onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,0.08)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
          >
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(139,92,246,0.15)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(148,163,184,0.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Username</p>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Enter your username"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: "14px", color: "#fff", fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{
            borderRadius: "16px", padding: "14px 16px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", gap: "12px",
          }}
            onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(139,92,246,0.5)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(139,92,246,0.06)"; }}
            onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,0.08)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
          >
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "rgba(139,92,246,0.15)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(148,163,184,0.6)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Password</p>
              <input
                type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: "14px", color: "#fff", fontFamily: "inherit",
                }}
              />
            </div>
            <button type="button" onClick={() => setShowPw(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "rgba(148,163,184,0.5)", flexShrink: 0 }}>
              {showPw ? <EyeOff style={{ width: "16px", height: "16px" }} /> : <Eye style={{ width: "16px", height: "16px" }} />}
            </button>
          </div>

          {/* Remember me + Forgot Password */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                style={{ width: "15px", height: "15px", accentColor: "#a78bfa", cursor: "pointer" }} />
              <span style={{ fontSize: "13px", color: "rgba(148,163,184,0.7)" }}>Remember me</span>
            </label>
            <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#a78bfa", fontWeight: 600 }}>
              Forgot Password?
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit" disabled={loading}
            style={{
              width: "100%", padding: "15px", borderRadius: "16px", border: "none",
              background: loading ? "rgba(139,92,246,0.4)" : "linear-gradient(135deg,#7c3aed,#6366f1 50%,#3b82f6)",
              color: "#fff", fontWeight: 800, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              boxShadow: loading ? "none" : "0 8px 24px rgba(124,58,237,0.4)",
              transition: "opacity 0.2s", letterSpacing: "0.3px",
            }}
          >
            {loading ? (
              <><Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} /> Signing in…</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Login
              </>
            )}
          </button>
        </form>

        {/* OR divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(148,163,184,0.4)", letterSpacing: "2px" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Secure admin access card */}
        <div style={{
          borderRadius: "16px", padding: "14px 16px",
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.15)",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px",
            background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(59,130,246,0.2))",
            border: "1px solid rgba(139,92,246,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ShieldCheck style={{ width: "20px", height: "20px", color: "#a78bfa" }} />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>Secure Admin Access</p>
            <p style={{ fontSize: "11px", color: "rgba(148,163,184,0.6)", lineHeight: 1.4 }}>Your data is protected with enterprise-grade security.</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>
            Task Earn <span style={{ background: "linear-gradient(90deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Pro</span>
          </p>
          <p style={{ fontSize: "11px", color: "rgba(148,163,184,0.35)" }}>© 2026 All rights reserved.</p>
          <div style={{ marginTop: "8px", display: "flex", justifyContent: "center" }}>
            <ShieldCheck style={{ width: "14px", height: "14px", color: "rgba(148,163,184,0.25)" }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-30px) scale(1.08)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(20px) scale(0.95)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input::placeholder { color: rgba(148,163,184,0.35); }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px transparent inset !important; -webkit-text-fill-color: #fff !important; }
      `}</style>
    </div>
  );
}
