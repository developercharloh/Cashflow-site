import { useEffect, useState } from "react";
import { get, patch } from "@/api";
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Withdrawal {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  amount: number;
  method: string;
  phone?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  status: string;
  createdAt: string;
  processedAt?: string;
  notes?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
  approved: "bg-green-900/40 text-green-400 border-green-800/50",
  rejected: "bg-red-900/40 text-red-400 border-red-800/50",
};

export default function Withdrawals() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    get<Withdrawal[]>("/admin/withdrawals")
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const approve = async (id: number) => {
    setActing(id);
    try {
      await patch(`/admin/withdrawals/${id}/approve`);
      setItems(prev => prev.map(w => w.id === id ? { ...w, status: "approved" } : w));
    } catch (e) { alert((e as Error).message); }
    setActing(null);
  };

  const reject = async (id: number, reason: string) => {
    setActing(id);
    try {
      await patch(`/admin/withdrawals/${id}/reject`, { reason });
      setItems(prev => prev.map(w => w.id === id ? { ...w, status: "rejected", notes: reason } : w));
      setRejectId(null); setRejectReason("");
    } catch (e) { alert((e as Error).message); }
    setActing(null);
  };

  const visible = items.filter(w => filter === "all" || w.status === filter);
  const pending = items.filter(w => w.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Withdrawals</h1>
          <p className="text-sm text-slate-400">{pending} pending • {items.length} total</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {(["pending", "all", "approved", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs rounded-xl border transition-colors capitalize ${filter === f ? "bg-blue-600 text-white border-blue-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"}`}>
            {f}{f === "pending" && pending > 0 ? ` (${pending})` : ""}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center text-slate-400 text-sm py-10">Loading…</div> : (
        <div className="space-y-2">
          {visible.map(w => (
            <div key={w.id} className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
              <div className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {w.userName?.charAt(0) ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white">{w.userName}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLES[w.status] ?? ""}`}>{w.status}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{w.userEmail} · {w.method}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-white">${w.amount.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</p>
                </div>
                {w.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => approve(w.id)} disabled={acting === w.id}
                      className="p-1.5 rounded-lg bg-green-900/40 hover:bg-green-900/70 text-green-400 disabled:opacity-40 transition-colors" title="Approve">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => setRejectId(rejectId === w.id ? null : w.id)} disabled={acting === w.id}
                      className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 disabled:opacity-40 transition-colors" title="Reject">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button onClick={() => setExpanded(expanded === w.id ? null : w.id)} className="p-1.5 text-slate-500 hover:text-white shrink-0">
                  {expanded === w.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {rejectId === w.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-2">
                  <p className="text-xs text-slate-400">Rejection reason (optional)</p>
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Suspicious activity"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500" />
                  <div className="flex gap-2">
                    <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancel</button>
                    <button onClick={() => reject(w.id, rejectReason)} disabled={acting === w.id}
                      className="flex-1 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl transition-colors">
                      {acting === w.id ? "Rejecting…" : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              )}

              {expanded === w.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {[
                      { l: "ID", v: `#${w.id}` },
                      { l: "Method", v: w.method },
                      { l: "Phone", v: w.phone ?? "—" },
                      { l: "Bank Code", v: w.bankCode ?? "—" },
                      { l: "Account", v: w.accountNumber ?? "—" },
                      { l: "Account Name", v: w.accountName ?? "—" },
                      { l: "Amount", v: `$${w.amount.toFixed(4)}` },
                      { l: "Status", v: w.status },
                      { l: "Processed", v: w.processedAt ? new Date(w.processedAt).toLocaleString() : "—" },
                      ...(w.notes ? [{ l: "Notes", v: w.notes }] : []),
                    ].map(({ l, v }) => (
                      <div key={l} className="bg-slate-800/60 rounded-xl p-2.5">
                        <p className="text-[10px] text-slate-500">{l}</p>
                        <p className="text-xs text-white font-medium mt-0.5 break-all">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {visible.length === 0 && <div className="text-center text-slate-500 text-sm py-10">No {filter === "all" ? "" : filter} withdrawals</div>}
        </div>
      )}
    </div>
  );
}
