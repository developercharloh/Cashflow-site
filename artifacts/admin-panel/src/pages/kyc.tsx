import { useEffect, useState } from "react";
import { get, put } from "@/api";
import { RefreshCw, CheckCircle, XCircle, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

interface KYCSub {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  fullName: string;
  dateOfBirth: string;
  country: string;
  phone: string;
  nationalId: string;
  documentType: string;
  status: string;
  faceMatchScore: number | null;
  rejectionReason: string | null;
  diditSessionId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
  approved: "bg-green-900/40 text-green-400 border-green-800/50",
  rejected: "bg-red-900/40 text-red-400 border-red-800/50",
};

export default function KYC() {
  const [items, setItems] = useState<KYCSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const load = () => {
    setLoading(true);
    get<KYCSub[]>("/kyc/admin/submissions")
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const action = async (id: number, act: "approve" | "reject" | "resubmit", rejectionReason?: string) => {
    setActing(id);
    try {
      await put(`/kyc/admin/submissions/${id}/review`, { action: act, rejectionReason });
      setItems(prev => prev.map(s => s.id === id ? {
        ...s,
        status: act === "approve" ? "approved" : act === "reject" ? "rejected" : "pending",
        rejectionReason: rejectionReason ?? s.rejectionReason,
      } : s));
      setRejectModal(null); setReason("");
    } catch (e) { alert((e as Error).message); }
    setActing(null);
  };

  const visible = items.filter(s => filter === "all" || s.status === filter);
  const pending = items.filter(s => s.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">KYC Verification</h1>
          <p className="text-sm text-slate-400">{pending} pending · {items.length} total submissions</p>
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
          {visible.map(s => (
            <div key={s.id} className="rounded-2xl border border-slate-800 overflow-hidden" style={{ background: "#111827" }}>
              <div className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {s.userName?.charAt(0) ?? "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-white">{s.fullName}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLES[s.status] ?? ""}`}>{s.status}</span>
                    {s.faceMatchScore != null && (
                      <span className="text-[10px] bg-blue-900/40 text-blue-300 border-blue-800/50 px-1.5 py-0.5 rounded border">
                        {(s.faceMatchScore * 100).toFixed(1)}% match
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{s.userEmail} · {s.country} · {s.documentType}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</p>
                </div>
                {s.status === "pending" && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => action(s.id, "approve")} disabled={acting === s.id}
                      title="Approve" className="p-1.5 rounded-lg bg-green-900/40 hover:bg-green-900/70 text-green-400 disabled:opacity-40 transition-colors">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => action(s.id, "resubmit")} disabled={acting === s.id}
                      title="Request Resubmit" className="p-1.5 rounded-lg bg-yellow-900/40 hover:bg-yellow-900/70 text-yellow-400 disabled:opacity-40 transition-colors">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setRejectModal(rejectModal === s.id ? null : s.id)} disabled={acting === s.id}
                      title="Reject" className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 disabled:opacity-40 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="p-1.5 text-slate-500 hover:text-white shrink-0">
                  {expanded === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {rejectModal === s.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-2">
                  <p className="text-xs text-slate-400">Rejection reason (required)</p>
                  <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. ID not clear, expired document"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500" />
                  <div className="flex gap-2">
                    <button onClick={() => { setRejectModal(null); setReason(""); }} className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancel</button>
                    <button onClick={() => action(s.id, "reject", reason)} disabled={!reason.trim() || acting === s.id}
                      className="flex-1 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl transition-colors">
                      {acting === s.id ? "Rejecting…" : "Confirm Reject"}
                    </button>
                  </div>
                </div>
              )}

              {expanded === s.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {[
                      { l: "Full Legal Name", v: s.fullName },
                      { l: "Date of Birth", v: s.dateOfBirth },
                      { l: "Country", v: s.country },
                      { l: "Phone", v: s.phone },
                      { l: "National ID", v: s.nationalId },
                      { l: "Document Type", v: s.documentType },
                      { l: "Face Match %", v: s.faceMatchScore != null ? `${(s.faceMatchScore * 100).toFixed(2)}%` : "Pending" },
                      { l: "Didit Session", v: s.diditSessionId ?? "—" },
                      { l: "Submitted", v: new Date(s.createdAt).toLocaleString() },
                      { l: "Reviewed", v: s.reviewedAt ? new Date(s.reviewedAt).toLocaleString() : "—" },
                      ...(s.rejectionReason ? [{ l: "Rejection Reason", v: s.rejectionReason }] : []),
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
          {visible.length === 0 && <div className="text-center text-slate-500 text-sm py-10">No {filter === "all" ? "" : filter} KYC submissions</div>}
        </div>
      )}
    </div>
  );
}
