import { useState, useEffect, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const [, setLoc] = useLocation();
  const [username, setUsername] = useState("");
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
      await login(username, password);
      // Navigation handled by the useEffect watching `user`
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login min-h-screen flex items-center justify-center p-4">
      {/* Background orbs */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-15%", left: "-10%", width: "50vw", height: "50vw",
          borderRadius: "50%", background: "radial-gradient(circle,rgba(44,116,94,0.11),transparent 70%)",
          animation: "floatA 8s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-5%", width: "40vw", height: "40vw",
          borderRadius: "50%", background: "radial-gradient(circle,rgba(91,135,105,0.09),transparent 70%)",
          animation: "floatB 10s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%", width: "30vw", height: "30vw",
          borderRadius: "50%", background: "radial-gradient(circle,rgba(164,143,91,0.07),transparent 70%)",
          animation: "floatA 12s ease-in-out infinite 2s",
        }} />
        {/* Dot grid */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.035 }}>
          <defs>
            <pattern id="dots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#2c745e" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Card */}
      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: "400px",
          borderRadius: "24px", padding: "36px 32px 28px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 22px 60px rgba(35,58,49,0.09)",
      }} className="admin-login-card">
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ display: "inline-flex", marginBottom: "12px" }}>
            <img src="/lipwatasks-mark.svg" alt="Lipwa Tasks" style={{ width: "84px", height: "84px", borderRadius: "20px", objectFit: "cover", boxShadow: "0 8px 24px rgba(35,58,49,0.14)" }} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#213a34", letterSpacing: "-0.3px", marginBottom: "2px" }}>
            Lipwa Tasks
          </h1>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#4a806b", letterSpacing: "3px", textTransform: "uppercase" }}>Admin Login</p>
        </div>

        {/* Shield icon row */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "#e7f1e8",
            border: "1px solid #d2e4d4",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck style={{ width: "22px", height: "22px", color: "#2c745e" }} />
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#213a34", marginBottom: "6px" }}>Welcome back</h2>
          <p style={{ fontSize: "13px", color: "#748079" }}>Sign in to manage Lipwa Tasks</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            marginBottom: "16px", padding: "10px 14px", borderRadius: "12px",
            background: "#fbefed", border: "1px solid #efd6d3",
            color: "#a94442", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ad4b46", flexShrink: 0, display: "inline-block" }} />
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Username field */}
          <div className="admin-login-field" style={{
            borderRadius: "16px", padding: "14px 16px",
            display: "flex", alignItems: "center", gap: "12px",
          }}
          >
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "#e7f1e8", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2c745e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#849087", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Username</p>
              <input
                type="text" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                aria-label="Username"
                data-testid="admin-username"
                className="admin-login-input"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: "14px", color: "#213a34", fontFamily: "inherit",
                }}
              />
            </div>
          </div>

          {/* Password field */}
          <div className="admin-login-field" style={{
            borderRadius: "16px", padding: "14px 16px",
            display: "flex", alignItems: "center", gap: "12px",
          }}
          >
            <div style={{
              width: "36px", height: "36px", borderRadius: "10px",
              background: "#e7f1e8", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2c745e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "10px", fontWeight: 700, color: "#849087", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Password</p>
              <input
                type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                aria-label="Password"
                data-testid="admin-password"
                className="admin-login-input"
                style={{
                  width: "100%", background: "transparent", border: "none", outline: "none",
                  fontSize: "14px", color: "#213a34", fontFamily: "inherit",
                }}
              />
            </div>
            <button type="button" aria-label={showPw ? "Hide password" : "Show password"} data-testid="toggle-admin-password" onClick={() => setShowPw(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#748079", flexShrink: 0 }}>
              {showPw ? <EyeOff style={{ width: "16px", height: "16px" }} /> : <Eye style={{ width: "16px", height: "16px" }} />}
            </button>
          </div>

          {/* Remember me + Forgot Password */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                data-testid="remember-admin-login"
                style={{ width: "15px", height: "15px", accentColor: "#2c745e", cursor: "pointer" }} />
              <span style={{ fontSize: "13px", color: "#748079" }}>Remember me</span>
            </label>
            <button type="button" data-testid="forgot-admin-password" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#2c745e", fontWeight: 600 }}>
              Forgot Password?
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit" disabled={loading}
            className={`admin-login-primary${loading ? " is-loading" : ""}`}
            data-testid="admin-login-submit"
            style={{
              width: "100%", padding: "15px", borderRadius: "16px", border: "none",
              color: "#fff", fontWeight: 800, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              letterSpacing: "0.3px",
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
          <div style={{ flex: 1, height: "1px", background: "#e4dece" }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#9aa49c", letterSpacing: "2px" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "#e4dece" }} />
        </div>

        {/* Secure admin access card */}
        <div style={{
          borderRadius: "16px", padding: "14px 16px",
          background: "#f1f6ef",
          border: "1px solid #dfe9dc",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "12px",
            background: "#e4efe5",
            border: "1px solid #d6e5d7",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ShieldCheck style={{ width: "20px", height: "20px", color: "#2c745e" }} />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#213a34", marginBottom: "2px" }}>Secure admin access</p>
            <p style={{ fontSize: "11px", color: "#748079", lineHeight: 1.4 }}>Your data is protected with secure sign-in.</p>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#53685d", marginBottom: "2px" }}>
            Lipwa Tasks
          </p>
          <p style={{ fontSize: "11px", color: "#9aa49c" }}>© 2026 All rights reserved.</p>
          <div style={{ marginTop: "8px", display: "flex", justifyContent: "center" }}>
            <ShieldCheck style={{ width: "14px", height: "14px", color: "#b1bbb2" }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-30px) scale(1.08)} }
        @keyframes floatB { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(20px) scale(0.95)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        input::placeholder { color: #98a29a; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #fffefa inset !important; -webkit-text-fill-color: #213a34 !important; }
      `}</style>
    </div>
  );
}
