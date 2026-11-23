import { ReactNode, useEffect, useState } from "react";
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

function NavItem({ to, label, Icon, onNavigate }: { to: string; label: string; Icon: typeof LayoutDashboard; onNavigate?: () => void }) {
  const [loc] = useLocation();
  const active = to === "/" ? loc === "/" : loc.startsWith(to);
  return (
    <Link href={to}>
      <a onClick={onNavigate} className={clsx(
        "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-900/10"
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

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/lipwatasks-mark.svg" alt="" aria-hidden="true" className="w-9 h-9 rounded-xl object-cover shrink-0" />
          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-white">Lipwa Tasks</p>
            <p className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-[.16em]">Operations</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">Workspace</div>
      <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
        {NAV.map(({ to, label, icon: Icon }) => <NavItem key={to} to={to} label={label} Icon={Icon} onNavigate={() => setOpen(false)} />)}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/60 mb-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
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
    <div className="admin-theme flex min-h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[248px] shrink-0 border-r border-slate-800 bg-white">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <button aria-label="Close navigation" className="absolute inset-0 bg-slate-950/45" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-[min(288px,calc(100vw-40px))] flex-col border-r border-slate-800 bg-white shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[62px] shrink-0 items-center gap-3 border-b border-slate-800 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen((value) => !value)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden">
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
            <span className="hidden sm:block font-medium">Lipwa Tasks</span>
            <ChevronRight className="hidden h-3.5 w-3.5 sm:block" />
            <span className="truncate font-semibold text-slate-300">Admin workspace</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-emerald-600" />
            <span className="hidden sm:block text-xs font-semibold text-slate-400">Secure workspace</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800">{user?.name?.charAt(0) ?? "A"}</span>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-5 lg:p-7 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
