import { useMemo, useState } from "react";
import {
  AudioLines, BadgeCheck, BookOpen, CheckCircle2, ChevronRight, Clock3,
  FileSpreadsheet, FileText, LoaderCircle, Search, ShieldCheck,
  Sparkles, X,
} from "lucide-react";
import { post } from "../api";

const CATEGORIES = ["Academic Writing", "Data Entry", "Transcription", "AI Training"] as const;
type Category = (typeof CATEGORIES)[number];

export interface TaskLibraryTemplate {
  id: string;
  title: string;
  category: Category;
  description: string;
  instructions: string;
  reviewGuide: string;
  estimatedMinutes: number;
  assetUrl: string | null;
  difficulty: "hard";
  defaultMinLevel: number;
}

const CATEGORY_ICON: Record<Category, typeof BookOpen> = {
  "Academic Writing": BookOpen,
  "Data Entry": FileSpreadsheet,
  Transcription: AudioLines,
  "AI Training": Sparkles,
};

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Could not publish this task.";
  try {
    const parsed = JSON.parse(error.message) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

function currency(value: number) {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

export function TaskLibraryPanel({
  templates,
  loading,
  onRefresh,
  onPublished,
}: {
  templates: TaskLibraryTemplate[];
  loading: boolean;
  onRefresh: () => void | Promise<void>;
  onPublished: (title: string) => void;
}) {
  const [category, setCategory] = useState<Category | "All">("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TaskLibraryTemplate | null>(null);
  const [reward, setReward] = useState("1.00");
  const [budget, setBudget] = useState("10.00");
  const [cap, setCap] = useState("10");
  const [minLevel, setMinLevel] = useState("1");
  const [confirm, setConfirm] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const visible = useMemo(() => templates.filter((template) =>
    (category === "All" || template.category === category) &&
    `${template.title} ${template.category} ${template.description}`.toLowerCase().includes(search.toLowerCase()),
  ), [templates, category, search]);

  const rewardValue = Number(reward);
  const budgetValue = Number(budget);
  const capValue = Number(cap);
  const minLevelValue = Number(minLevel);
  const requiredFunding = rewardValue * capValue;
  const valid = Number.isFinite(rewardValue) && rewardValue > 0 && rewardValue <= 1_000 &&
    Number.isFinite(budgetValue) && budgetValue >= requiredFunding && budgetValue <= 10_000 &&
    Number.isInteger(capValue) && capValue >= 1 && capValue <= 500 &&
    Number.isInteger(minLevelValue) && minLevelValue >= 1 && minLevelValue <= 7;

  const open = (template: TaskLibraryTemplate) => {
    setSelected(template);
    setReward("1.00");
    setCap("10");
    setBudget("10.00");
    setMinLevel(String(template.defaultMinLevel));
    setConfirm(false);
    setError("");
  };

  const close = () => {
    if (publishing) return;
    setSelected(null);
    setConfirm(false);
    setError("");
  };

  const publish = async () => {
    if (!selected || !valid) return;
    setPublishing(true);
    setError("");
    try {
      await post(`/admin/task-library/${encodeURIComponent(selected.id)}/publish`, {
        reward: rewardValue,
        fundingBudget: budgetValue,
        maxCompletions: capValue,
        minLevel: minLevelValue,
      });
      const title = selected.title;
      setSelected(null);
      setConfirm(false);
      onPublished(title);
      await onRefresh();
    } catch (publishError) {
      setError(errorMessage(publishError));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-green-700">
              <BookOpen className="h-3.5 w-3.5" /> Lipwa originals <span className="h-px w-8 bg-green-200" />
              <span className="font-medium tracking-normal text-slate-500">{templates.length} ready to publish</span>
            </p>
            <h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">Original task library</h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-400">
              These original templates stay in the library after posting, so you can reuse them whenever the worker feed needs more work. Set a fresh reward budget and completion cap for each listing.
            </p>
          </div>
          <label className="flex w-full items-center gap-2.5 rounded-xl border border-slate-700 bg-white px-3.5 py-3 transition focus-within:border-green-400 focus-within:ring-2 focus-within:ring-green-100 xl:max-w-sm">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full min-w-0 bg-transparent text-xs text-slate-300 outline-none"
              placeholder="Find a task by title or category"
              aria-label="Search original tasks"
            />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>}
          </label>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-800 pb-3" aria-label="Filter task library">
          {(["All", ...CATEGORIES] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${category === item ? "border-green-300 bg-green-50 text-green-800 shadow-sm" : "border-transparent bg-transparent text-slate-500 hover:border-slate-700 hover:bg-white hover:text-slate-300"}`}
            >
              {item}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading task library">
            {[0, 1, 2, 3].map((item) => <div key={item} className="animate-pulse rounded-2xl border border-slate-800 bg-white p-5">
              <div className="h-3 w-1/3 rounded bg-slate-100" /><div className="mt-4 h-3 w-4/5 rounded bg-slate-100" />
              <div className="mt-2 h-3 w-full rounded bg-slate-100" /><div className="mt-6 h-8 w-28 rounded-lg bg-slate-100" />
            </div>)}
          </div>
        ) : visible.length ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {visible.map((template) => {
              const Icon = CATEGORY_ICON[template.category];
              return (
                <article key={template.id} className="group overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex min-h-full flex-col p-4 sm:p-5">
                    <div className="flex items-start gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-green-200 bg-green-50 text-green-700 transition group-hover:bg-green-100">
                        <Icon className="h-[19px] w-[19px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold leading-5 text-white">{template.title}</h3>
                          <span className="rounded-md bg-green-900/40 px-2 py-1 text-[10px] font-semibold text-green-400">{template.category}</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{template.description}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3.5">
                      <span className="rounded-md bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400">Level {template.defaultMinLevel}+</span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400"><Clock3 className="h-3 w-3" />{template.estimatedMinutes} min</span>
                      {template.assetUrl && <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700"><AudioLines className="h-3 w-3" />Audio source</span>}
                      <button
                        type="button"
                        onClick={() => open(template)}
                        className="ml-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2.5 text-[11px] font-bold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
                      >
                        Review &amp; configure <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/60 px-5 py-12 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-green-50"><FileText className="h-5 w-5 text-green-700" /></span>
            <h3 className="mt-3 text-sm font-bold text-white">No matching task templates</h3>
            <p className="mt-1.5 text-xs text-slate-400">Try a broader search or choose another category.</p>
            {(search || category !== "All") && <button type="button" onClick={() => { setSearch(""); setCategory("All"); }} className="mt-4 rounded-lg border border-slate-700 bg-white px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800">Clear filters</button>}
          </div>
        )}

        <p className="flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50/70 px-4 py-3 text-[11px] leading-5 text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
          <span><strong className="text-green-900">Platform-funded, admin-approved.</strong> The listed budget is a cap, not an escrow transfer. Wallet credit happens only after you approve a worker’s submission.</span>
        </p>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Review ${selected.title}`}>
          <button type="button" className="absolute inset-0" aria-label="Close dialog" onClick={close} />
          <section className="relative flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-green-700">{confirm ? "Final confirmation" : "Original Lipwa task"}</p>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-white">{confirm ? "Post this task to workers?" : "Review and set task budget"}</h2>
                <p className="mt-1 text-xs text-slate-400">{selected.title}</p>
              </div>
              <button type="button" onClick={close} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
            </div>

            <div className="lipwa-scroll space-y-4 overflow-y-auto p-5 sm:p-6">
              {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{error}</p>}
              <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4 sm:p-5">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-green-900/40 px-2 py-1 text-[10px] font-bold text-green-400">{selected.category}</span>
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400">Level {selected.defaultMinLevel}+</span>
                  <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400">~{selected.estimatedMinutes} min</span>
                </div>
                <p className="text-sm leading-6 text-slate-300">{selected.description}</p>
                {selected.assetUrl && (
                  <div className="mt-4 rounded-lg border border-slate-700 bg-white p-3">
                    <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><AudioLines className="h-4 w-4 text-green-400" />Worker audio preview</p>
                    <audio controls preload="none" src={selected.assetUrl} className="w-full" aria-label={`Audio preview for ${selected.title}`}>
                      Your browser does not support audio playback.
                    </audio>
                  </div>
                )}
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-bold text-green-700">Review worker instructions</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{selected.instructions}</p>
                </details>
                <details className="mt-3 rounded-lg border border-amber-300/30 bg-amber-50/5 p-3">
                  <summary className="cursor-pointer text-xs font-bold text-amber-300">Admin-only review guide</summary>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{selected.reviewGuide}</p>
                  <p className="mt-2 text-[10px] text-amber-200/70">This guide is saved for admin review and is not sent to workers.</p>
                </details>
              </div>

              {!confirm ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Reward per approved worker</span>
                      <span className="flex items-center rounded-xl border border-slate-700 bg-white px-3 py-2.5 focus-within:border-green-400">
                        <span className="mr-1.5 text-xs text-slate-500">$</span>
                        <input type="number" min="0.01" max="1000" step="0.01" value={reward} onChange={(event) => {
                          const next = event.target.value;
                          setReward(next);
                          if (Number(next) > 0 && Number(cap) > 0) setBudget((Number(next) * Number(cap)).toFixed(2));
                        }} className="w-full bg-transparent text-xs font-bold text-slate-300 outline-none" />
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Total platform budget</span>
                      <span className="flex items-center rounded-xl border border-slate-700 bg-white px-3 py-2.5 focus-within:border-green-400">
                        <span className="mr-1.5 text-xs text-slate-500">$</span>
                        <input type="number" min="0.01" max="10000" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} className="w-full bg-transparent text-xs font-bold text-slate-300 outline-none" />
                      </span>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Maximum completed workers</span>
                      <input type="number" min="1" max="500" step="1" value={cap} onChange={(event) => {
                        const next = event.target.value;
                        setCap(next);
                        if (Number(reward) > 0 && Number(next) > 0) setBudget((Number(reward) * Number(next)).toFixed(2));
                      }} className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2.5 text-xs font-bold text-slate-300 outline-none focus:border-green-400" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Minimum worker level</span>
                      <select value={minLevel} onChange={(event) => setMinLevel(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2.5 text-xs font-semibold text-slate-300">
                        {[1, 2, 3, 4, 5, 6, 7].map((level) => <option key={level} value={level}>Level {level}+</option>)}
                      </select>
                    </label>
                  </div>
                  <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${budgetValue >= requiredFunding ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                    <div>
                       <p className="text-xs font-bold text-slate-300">Maximum funded commitment</p>
                      <p className="mt-1 text-[11px] text-slate-500">{capValue || 0} approved workers × {currency(rewardValue)} each</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-white">{currency(requiredFunding)}</p>
                      <p className="text-[10px] text-slate-500">Budget entered: {currency(budgetValue)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-white p-4">
                    <p className="flex items-center gap-2 text-xs font-bold text-slate-300"><BadgeCheck className="h-4 w-4 text-green-400" />Worker listing preview</p>
                    <p className="mt-3 text-sm font-bold text-white">{selected.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{selected.description}</p>
                    <p className="mt-3 text-[11px] text-slate-500">{selected.category} · Level {minLevelValue}+ · {currency(rewardValue)} after approval · ~{selected.estimatedMinutes} min</p>
                  </div>
                  <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-[11px] leading-5 text-slate-400">
                    Posting sets a maximum budget and completion count; it does not move or reserve money. Rewards are credited only after you approve a worker’s submission.
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-green-800"><ShieldCheck className="h-4 w-4" />Confirm this task listing</p>
                  <p className="mt-2 text-xs leading-5 text-green-800/80">
                    Eligible workers can see this {selected.category} task at Level {minLevelValue}+. The maximum approved payout is <strong>{currency(requiredFunding)}</strong> across <strong>{capValue}</strong> completions.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:px-6">
              {!confirm ? (
                <>
                  <button type="button" onClick={close} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800">Cancel</button>
                  <button type="button" onClick={() => { setError(""); setConfirm(true); }} disabled={!valid} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                    Review &amp; continue
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => setConfirm(false)} disabled={publishing} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800">Back to budget</button>
                  <button type="button" onClick={() => void publish()} disabled={publishing} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">
                    {publishing ? <><LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Publishing…</> : <><CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />Confirm publish</>}
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
