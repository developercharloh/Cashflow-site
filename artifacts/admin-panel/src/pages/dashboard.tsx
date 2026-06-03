import { useEffect, useState } from "react";
import { get } from "@/api";
import { Users, CheckSquare, Wallet2, TrendingUp, DollarSign, Clock, BarChart3, Star } from "lucide-react";

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

interface AdminUser {
  id: number;
  name: string;
  email: string;
  balance: number;
  totalEarned: number;
  level: number;
  createdAt: string;
  isBanned: boolean;
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 p-4" style={{ background: "#111827" }}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-blue-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([
      get<Analytics>("/admin/analytics"),
      get<AdminUser[]>("/admin/users"),
    ]).then(([a, u]) => {
      setAnalytics(a);
      setUsers(u.slice(0, 8));
    }).catch(e => setErr(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400 text-sm py-10 text-center">Loading analytics…</div>;
  if (err) return <div className="text-red-400 text-sm py-10 text-center">{err}</div>;
  if (!analytics) return null;

  const stats = [
    { icon: <Users className="w-4 h-4 text-blue-400" />, label: "Total Users", value: analytics.totalUsers.toLocaleString(), sub: `+${analytics.newUsersThisMonth} this month`, color: "bg-blue-900/40" },
    { icon: <CheckSquare className="w-4 h-4 text-green-400" />, label: "Total Tasks", value: analytics.totalTasks.toLocaleString(), color: "bg-green-900/40" },
    { icon: <TrendingUp className="w-4 h-4 text-yellow-400" />, label: "Total Paid Out", value: `$${analytics.totalEarningsPaid.toFixed(2)}`, color: "bg-yellow-900/40" },
    { icon: <Clock className="w-4 h-4 text-orange-400" />, label: "Pending Withdrawals", value: analytics.pendingWithdrawals, color: "bg-orange-900/40" },
    { icon: <DollarSign className="w-4 h-4 text-purple-400" />, label: "Revenue This Month", value: `$${analytics.revenueThisMonth.toFixed(2)}`, color: "bg-purple-900/40" },
    { icon: <Wallet2 className="w-4 h-4 text-red-400" />, label: "Total Withdrawals", value: analytics.totalWithdrawals, color: "bg-red-900/40" },
    { icon: <BarChart3 className="w-4 h-4 text-cyan-400" />, label: "Active Users", value: analytics.activeUsers, color: "bg-cyan-900/40" },
    { icon: <Star className="w-4 h-4 text-pink-400" />, label: "New Users (Month)", value: analytics.newUsersThisMonth, color: "bg-pink-900/40" },
  ];

  const levelLabel = (l: number) => ["", "Explorer", "Builder", "Professional", "Elite"][l] ?? "Explorer";
  const levelColor = (l: number) => [, "text-slate-300", "text-blue-300", "text-purple-300", "text-yellow-300"][l] ?? "text-slate-300";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">Platform overview &amp; live metrics</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
        <div className="px-4 py-3 border-b border-slate-800">
          <p className="text-sm font-bold text-white">Recent Users</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">User</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Level</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-2.5">Balance</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-2.5">Total Earned</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-2.5">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-medium text-xs">{u.name}</p>
                        <p className="text-slate-500 text-[10px]">{u.email}</p>
                      </div>
                      {u.isBanned && <span className="text-[10px] bg-red-900/40 text-red-400 px-1.5 py-0.5 rounded-full border border-red-800/50">Banned</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold ${levelColor(u.level)}`}>{levelLabel(u.level)}</span></td>
                  <td className="px-4 py-3 text-right text-xs text-white">${u.balance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-xs text-green-400">${u.totalEarned.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
