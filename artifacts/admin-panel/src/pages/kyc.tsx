import { useEffect, useState } from "react";
import { cleanupKycUploads, get, getBlob, getKycUploadCleanupHistory, put, type KycUploadCleanupRun } from "../api";
import type { KycUploadCleanupResponse } from "@workspace/api-client-react";
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Upload, Camera, ZoomIn, Loader2, FileImage, Trash2, ShieldCheck } from "lucide-react";

interface KYCSub {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  fullName: string;
  dateOfBirth: string;
  country: string;
  nationality: string | null;
  phone: string;
  phoneNumber?: string;
  nationalId: string;
  documentType: string | null;
  submissionMethod: string;
  frontIdPath: string | null;
  backIdPath: string | null;
  selfieImagePath: string | null;
  faceMatchScore: number | null;
  rejectionReason: string | null;
  diditSessionId: string | null;
  kycStatus: string;
  createdAt: string;
  submittedAt?: string;
  reviewedAt: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  pending:        "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
  pending_review: "bg-orange-900/40 text-orange-400 border-orange-800/50",
  approved:       "bg-green-900/40 text-green-400 border-green-800/50",
  rejected:       "bg-red-900/40 text-red-400 border-red-800/50",
  resubmit_required: "bg-purple-900/40 text-purple-400 border-purple-800/50",
};
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  alien_id: "Alien ID card",
  national_id: "National ID",
  passport: "Passport",
  driving_license: "Driving License",
};

function getCleanupErrorMessage(_error: unknown): string {
  return "The cleanup request failed. Please try again.";
}

function ImageModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Private identity document" onClick={onClose}>
      <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <img src={src} alt="ID Document" className="w-full rounded-2xl object-contain max-h-[80vh]" />
        <button onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-black transition-colors text-lg font-bold">
          ×
        </button>
      </div>
    </div>
  );
}

export default function KYC() {
  const [items, setItems] = useState<KYCSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending_review" | "approved" | "rejected">("pending_review");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [loadingDocument, setLoadingDocument] = useState<string | null>(null);
  const [cleanupReport, setCleanupReport] = useState<KycUploadCleanupResponse | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState<"preview" | "delete" | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [cleanupHistory, setCleanupHistory] = useState<KycUploadCleanupRun[]>([]);
  const [cleanupHistoryLoading, setCleanupHistoryLoading] = useState(true);
  const [cleanupHistoryError, setCleanupHistoryError] = useState<string | null>(null);

  useEffect(() => () => {
    if (lightbox?.startsWith("blob:")) URL.revokeObjectURL(lightbox);
  }, [lightbox]);

  const load = () => {
    setLoading(true);
    get<KYCSub[]>("/kyc/admin/submissions")
      .then(setItems).catch(console.error).finally(() => setLoading(false));
  };

  const loadCleanupHistory = () => {
    setCleanupHistoryLoading(true);
    setCleanupHistoryError(null);
    getKycUploadCleanupHistory()
      .then(setCleanupHistory)
      .catch(() => setCleanupHistoryError("Cleanup history could not be loaded. Please try again."))
      .finally(() => setCleanupHistoryLoading(false));
  };

  useEffect(load, []);
  useEffect(loadCleanupHistory, []);

  const openDocument = async (id: number, side: "front" | "back" | "selfie") => {
    const key = `${id}:${side}`;
    setLoadingDocument(key);
    try {
      const blob = await getBlob(`/kyc/admin/submissions/${id}/document/${side}`);
      setLightbox(URL.createObjectURL(blob));
    } catch (error) {
      alert(error instanceof Error ? error.message : "The document could not be opened.");
    } finally {
      setLoadingDocument(null);
    }
  };

  const action = async (id: number, act: "approve" | "reject" | "resubmit", rejectionReason?: string) => {
    setActing(id);
    try {
      await put(`/kyc/admin/submissions/${id}/review`, { action: act, rejectionReason });
      setItems(prev => prev.map(s => s.id === id ? {
        ...s,
        kycStatus: act === "approve" ? "approved" : act === "reject" ? "rejected" : "resubmit_required",
        rejectionReason: rejectionReason ?? s.rejectionReason,
      } : s));
      setRejectModal(null); setReason("");
    } catch (e) { alert((e as Error).message); }
    setActing(null);
  };

  const previewCleanup = async () => {
    setCleanupBusy("preview");
    setCleanupError(null);
    setCleanupReport(null);
    setConfirmCleanup(false);
    try {
      setCleanupReport(await cleanupKycUploads(true));
      loadCleanupHistory();
    } catch (error) {
      setCleanupError(getCleanupErrorMessage(error));
    } finally {
      setCleanupBusy(null);
    }
  };

  const runCleanup = async () => {
    if (!confirmCleanup || !cleanupReport?.dryRun || cleanupReport.eligible === 0) return;
    setCleanupBusy("delete");
    setCleanupError(null);
    try {
      setCleanupReport(await cleanupKycUploads(false));
      setConfirmCleanup(false);
      loadCleanupHistory();
    } catch (error) {
      setCleanupError(getCleanupErrorMessage(error));
    } finally {
      setCleanupBusy(null);
    }
  };

  const pendingCount = items.filter(s => s.kycStatus === "pending_review").length;
  const visible = items.filter(s =>
    filter === "all" || s.kycStatus === filter ||
    (filter === "pending_review" && s.kycStatus === "pending")
  );

  return (
    <div className="space-y-4">
      {lightbox && <ImageModal src={lightbox} onClose={() => setLightbox(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">KYC Verification</h1>
          <p className="text-sm text-slate-400">{pendingCount} pending · {items.length} total submissions</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-4" aria-labelledby="kyc-cleanup-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-xl bg-blue-900/40 p-2 text-blue-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 id="kyc-cleanup-title" className="text-sm font-bold text-white">Abandoned upload cleanup</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                Preview privately stored KYC uploads older than 24 hours. Files still referenced by a submission are protected.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={previewCleanup}
            disabled={cleanupBusy !== null}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cleanupBusy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {cleanupBusy === "preview" ? "Previewing…" : "Preview cleanup"}
          </button>
        </div>

        {cleanupError && (
          <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/40 px-3 py-2 text-xs text-red-200">
            Cleanup failed: {cleanupError}
          </div>
        )}

        {cleanupReport && (
          <div className="space-y-3 border-t border-slate-800 pt-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Eligible to delete", value: cleanupReport.eligible },
                { label: "Referenced and protected", value: cleanupReport.referenced },
                { label: "Older than cutoff", value: cleanupReport.olderThanCutoff },
                { label: "Uploads scanned", value: cleanupReport.scanned },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-slate-800/70 p-3">
                  <p className="text-[10px] text-slate-400">{label}</p>
                  <p className="mt-1 text-lg font-bold text-white">{value.toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                {cleanupReport.dryRun ? "Preview cutoff" : "Deletion cutoff"}: {new Date(cleanupReport.cutoff).toLocaleString()}
                {" · "}{cleanupReport.pages} page{cleanupReport.pages === 1 ? "" : "s"} scanned
              </span>
              {cleanupReport.hasMore && (
                <span className="text-amber-300">Scan limit reached; more uploads may remain.</span>
              )}
            </div>

            {!cleanupReport.dryRun && (
              <div role="status" className="rounded-xl border border-green-800/70 bg-green-950/30 px-3 py-2 text-xs text-green-200">
                Cleanup finished: {cleanupReport.deleted.toLocaleString()} upload{cleanupReport.deleted === 1 ? "" : "s"} deleted.
              </div>
            )}

            {cleanupReport.dryRun && cleanupReport.eligible > 0 && !confirmCleanup && (
              <button
                type="button"
                onClick={() => setConfirmCleanup(true)}
                disabled={cleanupBusy !== null}
                className="flex items-center gap-2 rounded-xl border border-red-800/70 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-950/60 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Review deletion of {cleanupReport.eligible.toLocaleString()} uploads
              </button>
            )}

            {cleanupReport.dryRun && confirmCleanup && (
              <div className="space-y-3 rounded-xl border border-amber-800/70 bg-amber-950/20 p-3">
                <p className="text-xs leading-5 text-amber-100">
                  This will permanently delete eligible unreferenced uploads. The server will scan again when you confirm, so the final counts can change.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmCleanup(false)}
                    disabled={cleanupBusy !== null}
                    className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={runCleanup}
                    disabled={cleanupBusy !== null}
                    className="flex items-center gap-2 rounded-xl bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cleanupBusy === "delete" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {cleanupBusy === "delete" ? "Deleting…" : `Confirm and delete ${cleanupReport.eligible.toLocaleString()} uploads`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-3" aria-labelledby="kyc-cleanup-history-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="kyc-cleanup-history-title" className="text-sm font-bold text-white">Cleanup history</h2>
            <p className="mt-1 text-xs text-slate-400">Recent previews and deletions. Object paths are not recorded here.</p>
          </div>
          <button
            type="button"
            onClick={loadCleanupHistory}
            disabled={cleanupHistoryLoading}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {cleanupHistoryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
        {cleanupHistoryError && <p role="alert" className="text-xs text-red-300">{cleanupHistoryError}</p>}
        {cleanupHistoryLoading ? (
          <p className="py-4 text-center text-xs text-slate-400">Loading cleanup history…</p>
        ) : cleanupHistory.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No cleanup runs recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {cleanupHistory.map((run) => (
              <article key={run.id} className="rounded-xl border border-slate-800 bg-slate-800/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">
                    {run.mode === "preview" ? "Preview" : "Deletion"} · {new Date(run.ranAt).toLocaleString()}
                  </p>
                  <span className="text-[10px] text-slate-400">Administrator #{run.adminId}</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">Cutoff: {new Date(run.cutoff).toLocaleString()}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Scanned", value: run.scanned },
                    { label: "Older than cutoff", value: run.olderThanCutoff },
                    { label: "Referenced", value: run.referenced },
                    { label: run.mode === "preview" ? "Eligible" : "Deleted", value: run.mode === "preview" ? run.eligible : run.deleted },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-slate-900/70 px-2.5 py-2">
                      <p className="text-[10px] text-slate-500">{label}</p>
                      <p className="text-xs font-semibold text-slate-200">{value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">
                  {run.pages} page{run.pages === 1 ? "" : "s"} scanned
                  {run.hasMore ? " · Scan limit reached; more uploads may remain." : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="flex gap-2 flex-wrap">
        {([
          { key: "pending_review", label: "Pending" },
          { key: "all",            label: "All" },
          { key: "approved",       label: "Approved" },
          { key: "rejected",       label: "Rejected" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`px-3 py-2 text-xs rounded-xl border transition-colors capitalize ${filter === key ? "bg-blue-600 text-white border-blue-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"}`}>
            {label}{key === "pending_review" && pendingCount > 0 ? ` (${pendingCount})` : ""}
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
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${STATUS_STYLES[s.kycStatus] ?? ""}`}>
                      {s.kycStatus.replace("_", " ")}
                    </span>
                    {/* Method badge */}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium flex items-center gap-0.5 ${
                      s.submissionMethod === "manual_upload"
                        ? "bg-purple-900/40 text-purple-300 border-purple-800/50"
                        : "bg-blue-900/40 text-blue-300 border-blue-800/50"
                    }`}>
                      {s.submissionMethod === "manual_upload"
                        ? <><Upload className="w-2.5 h-2.5" /> Upload</>
                        : <><Camera className="w-2.5 h-2.5" /> Live</>}
                    </span>
                    {s.faceMatchScore != null && (
                      <span className="text-[10px] bg-blue-900/40 text-blue-300 border-blue-800/50 px-1.5 py-0.5 rounded border">
                        {(s.faceMatchScore * 100).toFixed(1)}% match
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {s.userEmail} · {s.nationality ?? "Nationality not provided"} · {DOCUMENT_TYPE_LABELS[s.documentType ?? ""] ?? s.documentType ?? "ID"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-slate-500">
                    {new Date(s.submittedAt ?? s.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {(s.kycStatus === "pending_review" || s.kycStatus === "pending") && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => action(s.id, "approve")} disabled={acting === s.id}
                      title="Approve" className="p-1.5 rounded-lg bg-green-900/40 hover:bg-green-900/70 text-green-400 disabled:opacity-40 transition-colors">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setRejectModal(rejectModal === s.id ? null : s.id); setReason(""); }} disabled={acting === s.id}
                      title="Reject" className="p-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/70 text-red-400 disabled:opacity-40 transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="p-1.5 text-slate-500 hover:text-white shrink-0">
                  {expanded === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Rejection reason form */}
              {rejectModal === s.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-2">
                  <p className="text-xs text-slate-400">Decision reason <span className="text-red-400">(required for rejection or update request — shown to user)</span></p>
                  <textarea value={reason} onChange={e => setReason(e.target.value.slice(0, 500))}
                    placeholder="Explain what needs to be corrected. The worker will see this message."
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => { setRejectModal(null); setReason(""); }}
                      className="flex-1 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl">Cancel</button>
                    <button onClick={() => action(s.id, "reject", reason)} disabled={!reason.trim() || acting === s.id}
                      className="flex-1 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl transition-colors">
                      {acting === s.id ? "Rejecting…" : "Confirm Reject"}
                    </button>
                    <button onClick={() => action(s.id, "resubmit", reason)} disabled={!reason.trim() || acting === s.id}
                      className="flex-1 py-1.5 text-xs text-yellow-200 bg-yellow-900/60 hover:bg-yellow-900 disabled:opacity-60 rounded-xl transition-colors">
                      {acting === s.id ? "Sending…" : "Request Update"}
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded details */}
              {expanded === s.id && (
                <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3">
                  {/* Uploaded ID photos (manual submissions) */}
                  {s.submissionMethod === "manual_upload" && (s.frontIdPath || s.backIdPath || s.selfieImagePath) && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-300">Private identity documents</p>
                      <div className="grid grid-cols-2 gap-2">
                        {s.frontIdPath && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-500">Front</p>
                            <button type="button" disabled={loadingDocument === `${s.id}:front`} onClick={() => openDocument(s.id, "front")}
                              className="flex h-28 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50">
                              {loadingDocument === `${s.id}:front` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileImage className="h-4 w-4" /><ZoomIn className="h-4 w-4" /></>}
                              View front image
                            </button>
                          </div>
                        )}
                        {s.backIdPath && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-500">Back</p>
                            <button type="button" disabled={loadingDocument === `${s.id}:back`} onClick={() => openDocument(s.id, "back")}
                              className="flex h-28 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50">
                              {loadingDocument === `${s.id}:back` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileImage className="h-4 w-4" /><ZoomIn className="h-4 w-4" /></>}
                              View back image
                            </button>
                          </div>
                        )}
                        {s.selfieImagePath && (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-500">Selfie</p>
                            <button type="button" disabled={loadingDocument === `${s.id}:selfie`} onClick={() => openDocument(s.id, "selfie")}
                              className="flex h-28 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-50">
                              {loadingDocument === `${s.id}:selfie` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><FileImage className="h-4 w-4" /><ZoomIn className="h-4 w-4" /></>}
                              View selfie image
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detail fields */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                    {[
                      { l: "Full Legal Name",   v: s.fullName },
                      { l: "Date of Birth",     v: s.dateOfBirth },
                      { l: "Country",           v: s.country },
                      { l: "Nationality",       v: s.nationality ?? "—" },
                      { l: "Phone",             v: s.phoneNumber ?? s.phone ?? "—" },
                      { l: "Document Number",   v: s.nationalId },
                      { l: "Document Type",     v: DOCUMENT_TYPE_LABELS[s.documentType ?? ""] ?? s.documentType ?? "—" },
                      { l: "Method",            v: s.submissionMethod === "manual_upload" ? "Identity document upload" : "Legacy submission" },
                      { l: "Face Match %",      v: s.faceMatchScore != null ? `${(s.faceMatchScore * 100).toFixed(2)}%` : "—" },
                      { l: "Didit Session",     v: s.diditSessionId ?? "—" },
                      { l: "Submitted",         v: new Date(s.submittedAt ?? s.createdAt).toLocaleString() },
                      { l: "Reviewed",          v: s.reviewedAt ? new Date(s.reviewedAt).toLocaleString() : "—" },
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
          {visible.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-10">No {filter === "all" ? "" : filter} KYC submissions</div>
          )}
        </div>
      )}
    </div>
  );
}
