import "./_group.css";
import { useState } from "react";
import {
  Activity,
  CheckSquare,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  Wallet2,
  X,
} from "lucide-react";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Activity", icon: Activity },
  { label: "Users", icon: Users },
  { label: "Tasks", icon: CheckSquare },
  { label: "Withdrawals", icon: Wallet2 },
  { label: "KYC", icon: CheckSquare },
];

function Sidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-800 px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white">L</div>
          <div>
            <p className="text-sm font-bold text-white">LipwaTasks</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Admin Panel</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map(({ label, icon: Icon }) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium ${
              label === "Tasks" ? "bg-blue-600 text-white" : "text-slate-400"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
            {label === "Tasks" && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-slate-800/60 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">C</div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">Admin</p>
            <p className="truncate text-[10px] text-slate-400">admin@lipwatasks.site</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400">
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </div>
      </div>
    </div>
  );
}

export function Current() {
  const [open, setOpen] = useState(true);

  return (
    <div className="flex min-h-screen overflow-hidden bg-[#0a0f1e] text-slate-100">
      <aside className="hidden w-56 shrink-0 border-r border-slate-800 bg-[#0d1424] lg:flex lg:flex-col">
        <Sidebar />
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-56 flex-col border-r border-slate-800 bg-[#0d1424]">
            <Sidebar />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#0d1424] px-4">
          <button onClick={() => setOpen(true)} className="text-slate-400 lg:hidden" aria-label="Open navigation">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm text-slate-400">Admin Control Panel</span>
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            Live
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-white">Tasks</h1>
                <p className="text-sm text-slate-400">Manage tasks and completions</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-400">Refresh</button>
                <button className="rounded-xl bg-blue-600 px-3 py-2 text-xs text-white">+ New Task</button>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-xs text-white">Tasks (0)</button>
              <button className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-400">Completions (0)</button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    {["Title", "Category", "Reward", "Difficulty", "Level", "Completions", "Status"].map((item) => (
                      <th key={item} className="px-4 py-3 font-medium">{item}</th>
                    ))}
                  </tr>
                </thead>
                <tbody />
              </table>
              <div className="py-8 text-center text-sm text-slate-500">No tasks found</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
