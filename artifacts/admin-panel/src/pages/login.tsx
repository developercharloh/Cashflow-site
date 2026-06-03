import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, Zap } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const [, setLoc] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) { setLoc("/"); return null; }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLoc("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#030712" }}>

      {/* ── Left panel – branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12"
        style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e1065 50%,#0f172a 100%)" }}>

        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: "radial-gradient(circle,#6366f1,transparent)", animation: "pulse 4s ease-in-out infinite" }} />
          <div className="absolute top-1/2 -right-20 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: "radial-gradient(circle,#3b82f6,transparent)", animation: "pulse 6s ease-in-out infinite 1s" }} />
          <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full opacity-10 blur-3xl"
            style={{ background: "radial-gradient(circle,#8b5cf6,transparent)", animation: "pulse 5s ease-in-out infinite 2s" }} />
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}>
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg tracking-tight">TaskEarn Pro</p>
            <p className="text-indigo-300/70 text-[11px] uppercase tracking-widest font-medium">Control Center</p>
          </div>
        </div>

        {/* Center hero */}
        <div className="relative space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-300 border border-indigo-500/30"
              style={{ background: "rgba(99,102,241,0.1)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Secure Admin Access
            </div>
            <h2 className="text-5xl font-extrabold text-white leading-tight tracking-tight">
              Complete<br />
              <span style={{ background: "linear-gradient(90deg,#818cf8,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Platform Control
              </span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed max-w-sm">
              Manage users, tasks, withdrawals, KYC verification and monitor all platform activity from one powerful dashboard.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Live Users", value: "∞" },
              { label: "Full Control", value: "100%" },
              { label: "Real-time", value: "24/7" },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-2xl p-4 border border-white/5"
                style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(8px)" }}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              "User banning, KYC approval & full account control",
              "Real-time withdrawal management & approvals",
              "Task creation, editing & completion monitoring",
            ].map(f => (
              <div key={f} className="flex items-start gap-2.5">
                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: "rgba(99,102,241,0.2)" }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                </div>
                <p className="text-sm text-slate-400">{f}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-slate-600">© 2025 TaskEarn Pro · All rights reserved</p>
      </div>

      {/* ── Right panel – form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative"
        style={{ background: "#030712" }}>

        {/* Top-right glow */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle,#6366f1,transparent)" }} />

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}>
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <p className="text-white font-bold">TaskEarn Pro Admin</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.2),rgba(59,130,246,0.2))", border: "1px solid rgba(99,102,241,0.3)" }}>
              <ShieldCheck className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1.5">Sign in to access the admin dashboard</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm text-red-300 border border-red-500/20"
              style={{ background: "rgba(239,68,68,0.08)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
              {error}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 rounded-xl outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(99,102,241,0.6)"; e.currentTarget.style.background = "rgba(99,102,241,0.06)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                <input
                  type={showPw ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm text-white placeholder-slate-600 rounded-xl outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                  onFocus={e => { e.currentTarget.style.border = "1px solid rgba(99,102,241,0.6)"; e.currentTarget.style.background = "rgba(99,102,241,0.06)"; }}
                  onBlur={e => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              className="relative w-full py-3 rounded-xl text-sm font-bold text-white mt-2 overflow-hidden transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#6366f1,#3b82f6)" }}
            >
              <span className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(135deg,#4f46e5,#2563eb)" }} />
              <span className="relative flex items-center justify-center gap-2">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : <><ShieldCheck className="w-4 h-4" /> Sign In to Dashboard</>
                }
              </span>
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs text-slate-600">Secured with AES-256 encryption · Admin only</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.15; }
          50% { transform: scale(1.15); opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
