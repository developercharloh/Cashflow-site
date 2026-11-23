import { useEffect, useMemo, useState } from "react";
import {
  AudioLines, CheckCircle2, Clock3, FileText, LoaderCircle,
  ShieldCheck, Upload, X,
} from "lucide-react";
import { get, patch } from "@/api";

export interface TaskWorkSubmission {
  id: number;
  taskId: number;
  taskTitle: string;
  reward: number;
  taskDescription: string;
  taskInstructions: string | null;
  taskAssetUrl: string | null;
  reviewGuide: string | null;
  status: "submitted" | "approved" | "rejected";
  textSubmission: string | null;
  attachmentName: string | null;
  attachmentPath: string | null;
  reviewNote: string | null;
  submittedAt: string;
  userId: number;
  userName: string;
  userEmail: string;
}

type ReviewDecision = "approved" | "rejected";
type Filter = "submitted" | "all" | "approved" | "rejected";

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Could not save the review.";
  try {
    const parsed = JSON.parse(error.message) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString();
}

export function TaskWorkReviewPanel({
  submissions,
  loading,
  onRefresh,
  onReviewed,
}: {
  submissions: TaskWorkSubmission[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  onReviewed: (message: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("submitted");
  const [selected, setSelected] = useState<TaskWorkSubmission | null>(null);
  const [decision, setDecision] = useState<ReviewDecision>("approved");
  const [note, setNote] = useState("Meets the task requirements.");
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => submissions.filter((item) => filter === "all" || item.status === filter), [submissions, filter]);
  const counts = {
    submitted: submissions.filter((item) => item.status === "submitted").length,
    approved: submissions.filter((item) => item.status === "approved").length,
    rejected: submissions.filter((item) => item.status === "rejected").length,
  };

  useEffect(() => () => {
    if (fileUrl) URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  const openReview = (item: TaskWorkSubmission) => {
    setSelected(item);
    setDecision("approved");
    setNote("Meets the task requirements.");
    setError("");
    setFileUrl("");
  };

  const closeReview = () => {
    if (saving) return;
    setSelected(null);
    setError("");
    setFileUrl("");
  };

  const loadFile = async () => {
    if (!selected?.attachmentPath) return;
    setLoadingFile(true);
    setError("");
    try {
      const token = localStorage.getItem("token") ?? "";
      const response = await fetch(`/api/storage/task-submissions/${selected.id}/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`File request failed (${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      setFileUrl(url);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoadingFile(false);
    }
  };

  const submitReview = async () => {
    if (!selected || note.trim().length < 3) {
      setError("Add a short review note before saving.");
      return;
    }
    if (decision === "approved" && !window.confirm(`Approve this work and credit $${selected.reward.toFixed(2)} to ${selected.userName}'s wallet?`)) return;
    setSaving(true);
    setError("");
    try {
      await patch(`/admin/task-submissions/${selected.id}/review`, { decision, note: note.trim() });
      const message = decision === "approved"
        ? `Work approved. $${selected.reward.toFixed(2)} was credited to ${selected.userName}.`
        : `Work rejected. Feedback was sent to ${selected.userName}.`;
      setSelected(null);
      setFileUrl("");
      onReviewed(message);
      await onRefresh();
    } catch (reviewError) {
      setError(errorMessage(reviewError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">Submitted work review</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              Review the worker’s response against the saved admin guide. Approval credits the task reward to the worker’s wallet.
            </p>
          </div>
          <button type="button" onClick={() => void onRefresh()} className="rounded-xl border border-slate-700 bg-white px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">
            Refresh submissions
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter work submissions">
          {([
            ["submitted", `Needs review (${counts.submitted})`],
            ["all", `All work (${submissions.length})`],
            ["approved", `Approved (${counts.approved})`],
            ["rejected", `Rejected (${counts.rejected})`],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-semibold ${filter === value ? "border-green-300 bg-green-50 text-green-800" : "border-slate-700 bg-white text-slate-400 hover:bg-slate-800"}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading submitted work…</div>
        ) : visible.length ? (
          <div className="space-y-3">
            {visible.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-800 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-900/40 text-sm font-bold text-green-400">{item.userName?.charAt(0)?.toUpperCase() || "U"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{item.taskTitle}</h3>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "approved" ? "bg-green-100 text-green-800" : item.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{item.status}</span>
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-400">{item.userName} · {item.userEmail}</p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{dateLabel(item.submittedAt)}</span>
                      <span>Reward: ${item.reward.toFixed(2)}</span>
                      {item.attachmentName && <span className="inline-flex items-center gap-1"><Upload className="h-3.5 w-3.5" />File attached</span>}
                    </p>
                    {item.reviewNote && <p className="mt-2 rounded-lg bg-slate-800/60 px-3 py-2 text-xs text-slate-400">Review note: {item.reviewNote}</p>}
                  </div>
                  <button type="button" onClick={() => openReview(item)} className="shrink-0 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">
                    {item.status === "submitted" ? "Review work" : "View review"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/60 px-5 py-10 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-green-400" />
            <h3 className="mt-3 text-sm font-bold text-white">{filter === "submitted" ? "No work waiting for review" : "No submissions in this filter"}</h3>
            <p className="mt-1.5 text-xs text-slate-400">Worker submissions will appear here after they submit a published task.</p>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Review ${selected.taskTitle}`}>
          <button type="button" className="absolute inset-0" aria-label="Close review" onClick={closeReview} />
          <section className="relative flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-green-400">Work review · {selected.status}</p>
                <h2 className="mt-1 text-lg font-extrabold text-white">{selected.taskTitle}</h2>
                <p className="mt-1 text-xs text-slate-400">{selected.userName} · {selected.userEmail} · ${selected.reward.toFixed(2)} reward</p>
              </div>
              <button type="button" onClick={closeReview} aria-label="Close review" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>

            <div className="lipwa-scroll space-y-4 overflow-y-auto p-5 sm:p-6">
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</p>}
              <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4">
                <h3 className="text-xs font-bold text-slate-300">Task brief</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{selected.taskDescription}</p>
                {selected.taskInstructions && <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] font-bold text-green-400">Worker instructions</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{selected.taskInstructions}</p>
                </details>}
                {selected.taskAssetUrl && (
                  <div className="mt-4 rounded-lg border border-slate-700 bg-white p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><AudioLines className="h-4 w-4 text-green-400" />Reference audio</p>
                    <audio controls preload="none" src={selected.taskAssetUrl} className="w-full" aria-label={`Reference audio for ${selected.taskTitle}`}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-white p-4">
                <h3 className="text-xs font-bold text-slate-300">Worker submission</h3>
                {selected.textSubmission ? (
                  <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-400">{selected.textSubmission}</p>
                ) : <p className="mt-2 text-xs italic text-slate-500">No written response was provided.</p>}
                {selected.attachmentName && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!fileUrl ? (
                      <button type="button" onClick={() => void loadFile()} disabled={loadingFile} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-white px-3 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-60">
                        {loadingFile ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                        {loadingFile ? "Loading file…" : `Load ${selected.attachmentName}`}
                      </button>
                    ) : (
                      <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800">
                        <FileText className="h-3.5 w-3.5" />Open {selected.attachmentName}
                      </a>
                    )}
                  </div>
                )}
              </div>

              {selected.reviewGuide ? (
                <details open className="rounded-xl border border-amber-300/40 bg-amber-50/5 p-4">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-bold text-amber-300"><ShieldCheck className="h-4 w-4" />Admin-only answer key and review guide</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-300">{selected.reviewGuide}</p>
                </details>
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-800/60 p-3 text-[11px] leading-5 text-slate-400">This task has no separate answer key. Review the response against the task instructions and the source terms.</p>
              )}

              {selected.status === "submitted" && (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-800/60 p-4">
                  <fieldset>
                    <legend className="mb-2 text-xs font-bold text-slate-300">Decision</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-semibold ${decision === "approved" ? "border-green-300 bg-green-50 text-green-800" : "border-slate-700 bg-white text-slate-400"}`}>
                        <input type="radio" name="review-decision" checked={decision === "approved"} onChange={() => { setDecision("approved"); setNote("Meets the task requirements."); }} />
                        Approve and credit reward
                      </label>
                      <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs font-semibold ${decision === "rejected" ? "border-red-300 bg-red-50 text-red-800" : "border-slate-700 bg-white text-slate-400"}`}>
                        <input type="radio" name="review-decision" checked={decision === "rejected"} onChange={() => { setDecision("rejected"); setNote(""); }} />
                        Reject and send feedback
                      </label>
                    </div>
                  </fieldset>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">{decision === "approved" ? "Approval note" : "Actionable feedback"}</span>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2.5 text-xs leading-5 text-slate-300 outline-none focus:border-green-400" placeholder="Explain the decision to the worker." />
                  </label>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:px-6">
              <button type="button" onClick={closeReview} disabled={saving} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-50">Close</button>
              {selected.status === "submitted" && (
                <button type="button" onClick={() => void submitReview()} disabled={saving || note.trim().length < 3} className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white disabled:opacity-50 ${decision === "approved" ? "bg-green-700 hover:bg-green-800" : "bg-red-600 hover:bg-red-700"}`}>
                  {saving ? <><LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Saving review…</> : decision === "approved" ? `Approve and credit $${selected.reward.toFixed(2)}` : "Reject and notify worker"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
