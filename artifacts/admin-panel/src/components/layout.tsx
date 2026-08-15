import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  LayoutDashboard, Users, CheckSquare, Wallet2, ShieldCheck,
  Activity, LogOut, Menu, X, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/users", label: "Users", icon: Users },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/withdrawals", label: "Withdrawals", icon: Wallet2 },
  { to: "/kyc", label: "KYC", icon: ShieldCheck },
];

function NavItem({ to, label, Icon }: { to: string; label: string; Icon: typeof LayoutDashboard }) {
  const [loc] = useLocation();
  const active = to === "/" ? loc === "/" : loc.startsWith(to);
  return (
    <Link href={to}>
      <a className={clsx(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
          : "text-slate-400 hover:text-white hover:bg-slate-800"
      )}>
        <Icon className="w-4 h-4 shrink-0" />
        {label}
        {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
      </a>
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="TaskEarn Pro" className="w-8 h-8 rounded-lg object-cover shrink-0" />
          <div>
            <p className="text-sm font-bold text-white">TaskEarn Pro</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => <NavItem key={to} to={to} label={label} Icon={Icon} />)}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-800/60 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.name?.charAt(0) ?? "A"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#0a0f1e" }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-slate-800" style={{ background: "#0d1424" }}>
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-56 h-full border-r border-slate-800 flex flex-col" style={{ background: "#0d1424" }}>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-slate-800 flex items-center px-4 gap-3 shrink-0" style={{ background: "#0d1424" }}>
          <button onClick={() => setOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="text-sm text-slate-400">Admin Control Panel</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
