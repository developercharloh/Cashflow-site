import { useEffect, useState } from "react";
import { get, patch } from "@/api";
import { Search, Shield, ShieldOff, ChevronDown, ChevronUp, X, RefreshCw } from "lucide-react";

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
  isAdmin: boolean;
  kycStatus?: string;
}

const LEVEL_COLOR: Record<number, string> = {
  1: "text-slate-300", 2: "text-blue-300", 3: "text-purple-300", 4: "text-yellow-300",
};
const KYC_COLOR: Record<string, string> = {
  approved: "bg-green-900/40 text-green-400 border-green-800/50",
  pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
  rejected: "bg-red-900/40 text-red-400 border-red-800/50",
  none: "bg-slate-800 text-slate-400 border-slate-700",
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [banning, setBanning] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "banned" | "admin">("all");

  const load = () => {
    setLoading(true);
    get<AdminUser[]>("/admin/users")
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggleBan = async (u: AdminUser) => {
    setBanning(u.id);
    try {
      await patch(`/admin/users/${u.id}/ban`, { banned: !u.isBanned });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, isBanned: !x.isBanned } : x));
    } catch (e) { alert((e as Error).message); }
    setBanning(null);
  };

  const n = (v: unknown) => Number(v) || 0;

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchesSearch = (u.name ?? "").toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q);
    const matchesFilter = filter === "all" || (filter === "banned" && u.isBanned) || (filter === "admin" && u.isAdmin);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-sm text-slate-400">{users.length} total accounts</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {(["all", "banned", "admin"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs rounded-xl border transition-colors ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"}`}
          >
            {f === "all" ? "All" : f === "banned" ? "Banned" : "Admins"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 text-sm py-10">Loading users…</div>
      ) : (
        <div className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3">User</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Level</th>
                <th className="text-left text-xs text-slate-500 font-medium px-4 py-3 hidden lg:table-cell">KYC</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3">Balance</th>
                <th className="text-right text-xs text-slate-500 font-medium px-4 py-3 hidden md:table-cell">Earned</th>
                <th className="text-center text-xs text-slate-500 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <>
                  <tr key={u.id} className={`border-b border-slate-800/50 transition-colors cursor-pointer ${expanded === u.id ? "bg-slate-800/40" : "hover:bg-slate-800/20"}`}>
                    <td className="px-4 py-3" onClick={() => setExpanded(expanded === u.id ? null : u.id)}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(u.name ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-xs font-semibold flex items-center gap-1.5">
                            {u.name}
                            {u.isAdmin && <span className="text-[9px] bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700/50">Admin</span>}
                            {u.isBanned && <span className="text-[9px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded border border-red-700/50">Banned</span>}
                          </p>
                          <p className="text-slate-500 text-[10px]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`text-xs font-semibold ${LEVEL_COLOR[u.level] ?? "text-slate-300"}`}>{u.levelName ?? "Explorer"}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${KYC_COLOR[u.kycStatus ?? "none"] ?? KYC_COLOR.none}`}>
                        {u.kycStatus ?? "none"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-white font-semibold">${n(u.balance).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-xs text-green-400 hidden md:table-cell">${n(u.totalEarned).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => toggleBan(u)}
                          disabled={banning === u.id || u.isAdmin}
                          title={u.isBanned ? "Unban user" : "Ban user"}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${u.isBanned ? "bg-green-900/40 hover:bg-green-900/70 text-green-400" : "bg-red-900/40 hover:bg-red-900/70 text-red-400"}`}
                        >
                          {u.isBanned ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setExpanded(expanded === u.id ? null : u.id)} className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-400 transition-colors">
                          {expanded === u.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === u.id && (
                    <tr key={`${u.id}-detail`} className="bg-slate-800/30">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          {[
                            { label: "User ID", val: `#${u.id}` },
                            { label: "Member Since", val: new Date(u.createdAt).toLocaleDateString() },
                            { label: "Balance", val: `$${n(u.balance).toFixed(4)}` },
                            { label: "Total Earned", val: `$${n(u.totalEarned).toFixed(4)}` },
                            { label: "Level", val: `${u.levelName ?? "Explorer"} (${u.level})` },
                            { label: "KYC Status", val: u.kycStatus ?? "none" },
                            { label: "Admin", val: u.isAdmin ? "Yes" : "No" },
                            { label: "Status", val: u.isBanned ? "Banned" : "Active" },
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-slate-800/60 rounded-xl p-2.5">
                              <p className="text-slate-500">{label}</p>
                              <p className="text-white font-semibold mt-0.5">{val}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
