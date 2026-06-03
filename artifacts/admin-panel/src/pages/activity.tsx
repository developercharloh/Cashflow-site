import { useEffect, useState } from "react";
import { get } from "@/api";
import { RefreshCw, Users, Wallet2, CheckSquare, TrendingUp, Star } from "lucide-react";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  balance: number;
  totalEarned: number;
  level: number;
  levelName: string;
  createdAt: string;
  isBanned: boolean;
}

interface Analytics {
  totalUsers: number;
  totalTasks: number;
  totalEarningsPaid: number;
  pendingWithdrawals: number;
  revenueThisMonth: number;
  newUsersThisMonth: number;
  totalWithdrawals: number;
  activeUsers: number;
}

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const levelLabel = (l: number) => ["", "Explorer", "Builder", "Professional", "Elite"][l] ?? "Explorer";
const LEVEL_COLOR: Record<number, string> = { 1: "text-slate-300", 2: "text-blue-300", 3: "text-purple-300", 4: "text-yellow-300" };

export default function Activity() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = () => {
    setLoading(true);
    Promise.all([
      get<AdminUser[]>("/admin/users"),
      get<Analytics>("/admin/analytics"),
    ]).then(([u, a]) => {
      setUsers([...u].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setAnalytics(a);
      setLastRefresh(new Date());
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const topEarners = [...users].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 5);
  const recent = users.slice(0, 20);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Activity Monitor</h1>
          <p className="text-sm text-slate-400">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: <Users className="w-4 h-4 text-blue-400" />, label: "Total Users", value: analytics.totalUsers, color: "bg-blue-900/40" },
            { icon: <CheckSquare className="w-4 h-4 text-green-400" />, label: "Active Users", value: analytics.activeUsers, color: "bg-green-900/40" },
            { icon: <TrendingUp className="w-4 h-4 text-yellow-400" />, label: "Paid Out", value: `$${analytics.totalEarningsPaid.toFixed(2)}`, color: "bg-yellow-900/40" },
            { icon: <Wallet2 className="w-4 h-4 text-orange-400" />, label: "Pending W/D", value: analytics.pendingWithdrawals, color: "bg-orange-900/40" },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className="rounded-2xl border border-slate-800 p-4" style={{ background: "#111827" }}>
              <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center mb-2.5`}>{icon}</div>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Sign-ups */}
        <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <p className="text-sm font-bold text-white">Recent Sign-ups</p>
          </div>
          <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
            {recent.map(u => (
              <div key={u.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-800/30 transition-colors">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                    {u.name}
                    {u.isBanned && <span className="text-[9px] text-red-400">Banned</span>}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[10px] font-semibold ${LEVEL_COLOR[u.level] ?? "text-slate-300"}`}>{levelLabel(u.level)}</p>
                  <p className="text-[10px] text-slate-500">{timeAgo(u.createdAt)}</p>
                </div>
              </div>
            ))}
            {recent.length === 0 && !loading && <p className="text-center text-slate-500 text-xs py-6">No users yet</p>}
          </div>
        </div>

        {/* Top Earners */}
        <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <p className="text-sm font-bold text-white">Top Earners</p>
          </div>
          <div className="divide-y divide-slate-800/50">
            {topEarners.map((u, i) => (
              <div key={u.id} className="flex items-center gap-2.5 px-4 py-3 hover:bg-slate-800/30 transition-colors">
                <div className="w-6 text-center text-xs font-bold text-slate-500">#{i + 1}</div>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-600 to-orange-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{u.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-green-400">${u.totalEarned.toFixed(2)}</p>
                  <p className={`text-[10px] font-semibold ${LEVEL_COLOR[u.level] ?? "text-slate-300"}`}>{levelLabel(u.level)}</p>
                </div>
              </div>
            ))}
            {topEarners.length === 0 && !loading && <p className="text-center text-slate-500 text-xs py-6">No data yet</p>}
          </div>
        </div>
      </div>

      {/* User level distribution */}
      {analytics && (
        <div className="rounded-2xl border border-slate-800 p-4" style={{ background: "#111827" }}>
          <p className="text-sm font-bold text-white mb-3">New Users This Month</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (analytics.newUsersThisMonth / Math.max(analytics.totalUsers, 1)) * 100)}%` }} />
            </div>
            <span className="text-sm font-bold text-white shrink-0">{analytics.newUsersThisMonth}</span>
            <span className="text-xs text-slate-400 shrink-0">of {analytics.totalUsers} total</span>
          </div>
        </div>
      )}
    </div>
  );
}
