import { useEffect, useMemo, useState } from "react";
import { get, post, patch, del } from "@/api";
import {
  Activity, AudioLines, BadgeCheck, BookOpen, CheckCircle2, ChevronDown,
  ChevronRight, Clock3, Coins, ExternalLink, FileSpreadsheet, FileText, Filter,
  ListFilter, LoaderCircle, Plus, RefreshCw, Search, ShieldCheck, Sparkles,
  Wallet2, X,
} from "lucide-react";
import { TaskLibraryPanel, type TaskLibraryTemplate } from "@/components/task-library-panel";
import { TaskWorkReviewPanel, type TaskWorkSubmission } from "@/components/task-work-review-panel";

const CATEGORIES = ["Academic Writing", "Data Entry", "Transcription", "AI Training"] as const;
type Category = (typeof CATEGORIES)[number];
type Tab = "library" | "queue" | "listings" | "review" | "sources";

interface Task {
  id: number;
  title: string;
  description: string;
  instructions: string;
  category: Category;
  reward: number;
  fundingBudget: number;
  maxCompletions: number;
  estimatedMinutes: number;
  difficulty: string;
  minLevel: number;
  isActive: boolean;
  completionCount: number;
  createdAt: string;
}

interface TaskFeedSource {
  id: number;
  name: string;
  feedUrl: string;
  licenseName: string;
  licenseUrl: string;
  allowedCategories: Category[];
  isActive: boolean;
  lastSyncedAt: string | null;
  lastSyncStatus: "never" | "success" | "warning" | "failed";
  lastSyncMessage: string | null;
  createdAt: string;
}

interface TaskImport {
  id: number;
  sourceId: number;
  externalId: string;
  title: string;
  description: string;
  instructions: string;
  category: Category;
  estimatedMinutes: number;
  sourceUrl: string;
  sourceNameSnapshot: string;
  licenseNameSnapshot: string;
  licenseUrlSnapshot: string;
  status: "pending" | "published" | "skipped";
  publishedTaskId: number | null;
  sourceActive: boolean;
  createdAt: string;
}

interface SourceForm {
  name: string;
  feedUrl: string;
  licenseName: string;
  licenseUrl: string;
  allowedCategories: Category[];
  reuseRightsConfirmed: boolean;
}

const EMPTY_SOURCE: SourceForm = {
  name: "",
  feedUrl: "",
  licenseName: "",
  licenseUrl: "",
  allowedCategories: [],
  reuseRightsConfirmed: false,
};

const CATEGORY_ICON: Record<Category, typeof BookOpen> = {
  "Academic Writing": BookOpen,
  "Data Entry": FileSpreadsheet,
  Transcription: AudioLines,
  "AI Training": Sparkles,
};

function n(value: unknown) {
  return Number(value) || 0;
}

function money(value: unknown) {
  return `$${n(value).toFixed(2)}`;
}

function when(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong.";
  try {
    const parsed = JSON.parse(error.message) as { error?: string; message?: string };
    return parsed.error ?? parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

function Metric({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof FileText;
  tone: "green" | "amber" | "blue" | "rose";
}) {
  const tones = {
    green: "bg-green-900/40 text-green-400",
    amber: "bg-yellow-900/40 text-yellow-400",
    blue: "bg-blue-900/40 text-blue-400",
    rose: "bg-red-900/40 text-red-400",
  };
  return (
    <div className="rounded-2xl border border-slate-800 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-semibold text-slate-400">{label}</span>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight text-white">{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function Modal({ children, onClose, title, wide = false }: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0" aria-label="Close dialog" onClick={onClose} />
      <section className={`relative flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-slate-800 bg-white shadow-2xl sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-xl"}`}>
        {children}
      </section>
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workSubmissions, setWorkSubmissions] = useState<TaskWorkSubmission[]>([]);
  const [libraryTemplates, setLibraryTemplates] = useState<TaskLibraryTemplate[]>([]);
  const [sources, setSources] = useState<TaskFeedSource[]>([]);
  const [pendingImports, setPendingImports] = useState<TaskImport[]>([]);
  const [publishedImports, setPublishedImports] = useState<TaskImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");
  const [tab, setTab] = useState<Tab>("library");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [sourceModal, setSourceModal] = useState(false);
  const [sourceForm, setSourceForm] = useState<SourceForm>(EMPTY_SOURCE);
  const [savingSource, setSavingSource] = useState(false);
  const [syncingSource, setSyncingSource] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<TaskImport | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [reward, setReward] = useState("1.00");
  const [budget, setBudget] = useState("10.00");
  const [cap, setCap] = useState("10");
  const [minLevel, setMinLevel] = useState("4");
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editReward, setEditReward] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [editCap, setEditCap] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [acting, setActing] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [taskRows, submissionRows, templateRows, sourceRows, pendingRows, publishedRows] = await Promise.all([
        get<Task[]>("/admin/tasks"),
        get<TaskWorkSubmission[]>("/admin/task-submissions?status=all"),
        get<TaskLibraryTemplate[]>("/admin/task-library"),
        get<TaskFeedSource[]>("/admin/task-sources"),
        get<TaskImport[]>("/admin/task-imports?status=pending"),
        get<TaskImport[]>("/admin/task-imports?status=published"),
      ]);
      setTasks(taskRows);
      setWorkSubmissions(submissionRows);
      setLibraryTemplates(templateRows);
      setSources(sourceRows);
      setPendingImports(pendingRows);
      setPublishedImports(publishedRows);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const activeTasks = tasks.filter((task) => task.isActive);
  const pendingWork = workSubmissions.filter((item) => item.status === "submitted").length;
  const approvedWork = workSubmissions.filter((item) => item.status === "approved").length;
  const fundedTotal = activeTasks.reduce((sum, task) => sum + n(task.fundingBudget), 0);
  const visibleTasks = useMemo(() => tasks.filter((task) =>
    (categoryFilter === "All categories" || task.category === categoryFilter) &&
    `${task.title} ${task.category}`.toLowerCase().includes(search.toLowerCase()),
  ), [tasks, categoryFilter, search]);

  const openReview = (item: TaskImport) => {
    setReviewing(item);
    setModalError("");
    setReward("1.00");
    setCap("10");
    setBudget("10.00");
    setMinLevel("4");
    setConfirmPublish(false);
  };

  const closeReview = () => {
    setReviewing(null);
    setConfirmPublish(false);
    setModalError("");
  };

  const createSource = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingSource(true);
    setModalError("");
    setError("");
    try {
      await post<TaskFeedSource>("/admin/task-sources", sourceForm);
      setSourceForm(EMPTY_SOURCE);
      setSourceModal(false);
      setNotice("Licensed task feed connected. Sync it to review available listings.");
      await load();
    } catch (saveError) {
      setModalError(errorMessage(saveError));
    } finally {
      setSavingSource(false);
    }
  };

  const toggleCategory = (category: Category) => {
    setSourceForm((current) => ({
      ...current,
      allowedCategories: current.allowedCategories.includes(category)
        ? current.allowedCategories.filter((item) => item !== category)
        : [...current.allowedCategories, category],
    }));
  };

  const syncSource = async (source: TaskFeedSource) => {
    setSyncingSource(source.id);
    setError("");
    setNotice("");
    try {
      const result = await post<{ imported: number; duplicates: number; skippedUnsupported: number; skippedInvalid: number }>(`/admin/task-sources/${source.id}/sync`);
      setNotice(`Feed synced: ${result.imported} new tasks, ${result.duplicates} duplicates, ${result.skippedUnsupported} outside selected categories, ${result.skippedInvalid} invalid.`);
      await load();
    } catch (syncError) {
      setError(errorMessage(syncError));
      await load();
    } finally {
      setSyncingSource(null);
    }
  };

  const toggleSource = async (source: TaskFeedSource) => {
    setActing(source.id);
    setError("");
    try {
      await patch(`/admin/task-sources/${source.id}`, { isActive: !source.isActive });
      await load();
      setNotice(source.isActive ? "Task feed paused. Its imported items can no longer be published." : "Task feed enabled.");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setActing(null);
    }
  };

  const skipImport = async (item: TaskImport) => {
    if (!window.confirm(`Dismiss “${item.title}” from the review queue?`)) return;
    setActing(item.id);
    setError("");
    try {
      await post(`/admin/task-imports/${item.id}/skip`);
      setPendingImports((current) => current.filter((row) => row.id !== item.id));
      setNotice("Imported task dismissed.");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setActing(null);
    }
  };

  const publishImport = async () => {
    if (!reviewing) return;
    setPublishing(true);
    setModalError("");
    try {
      await post(`/admin/task-imports/${reviewing.id}/publish`, {
        reward: Number(reward),
        fundingBudget: Number(budget),
        maxCompletions: Number(cap),
        minLevel: Number(minLevel),
      });
      setNotice(`“${reviewing.title}” is now available in the worker app.`);
      closeReview();
      await load();
    } catch (publishError) {
      setModalError(errorMessage(publishError));
    } finally {
      setPublishing(false);
    }
  };

  const openEdit = (task: Task) => {
    setModalError("");
    setEditing(task);
    setEditReward(String(task.reward));
    setEditBudget(String(task.fundingBudget));
    setEditCap(String(task.maxCompletions));
    setEditLevel(String(task.minLevel));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setModalError("");
    try {
      const updated = await patch<Task>(`/admin/tasks/${editing.id}`, {
        reward: Number(editReward),
        fundingBudget: Number(editBudget),
        maxCompletions: Number(editCap),
        minLevel: Number(editLevel),
      });
      setTasks((current) => current.map((task) => task.id === updated.id ? updated : task));
      setEditing(null);
      setNotice("Task budget and worker level updated.");
    } catch (saveError) {
      setModalError(errorMessage(saveError));
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleTask = async (task: Task) => {
    setActing(task.id);
    setError("");
    try {
      const updated = await patch<Task>(`/admin/tasks/${task.id}`, { isActive: !task.isActive });
      setTasks((current) => current.map((row) => row.id === updated.id ? updated : row));
      setNotice(updated.isActive ? "Task is live in the worker app." : "Task paused in the worker app.");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setActing(null);
    }
  };

  const deactivateTask = async (task: Task) => {
    if (!window.confirm(`Pause “${task.title}” and remove it from the worker app?`)) return;
    setActing(task.id);
    setError("");
    try {
      await del(`/admin/tasks/${task.id}`);
      setTasks((current) => current.map((row) => row.id === task.id ? { ...row, isActive: false } : row));
      setNotice("Task paused. Its record and source history remain available to admins.");
    } catch (actionError) {
      setError(errorMessage(actionError));
    } finally {
      setActing(null);
    }
  };

  const rewardValue = Number(reward);
  const budgetValue = Number(budget);
  const capValue = Number(cap);
  const minLevelValue = Number(minLevel);
  const requiredFunding = rewardValue * capValue;
  const publishValid = Number.isFinite(rewardValue) && rewardValue > 0 &&
    Number.isFinite(budgetValue) && budgetValue >= requiredFunding &&
    Number.isInteger(capValue) && capValue >= 1 && capValue <= 500 &&
    Number.isInteger(minLevelValue) && minLevelValue >= 1 && minLevelValue <= 7;
  const editRequiredBudget = Number(editReward) * Number(editCap);
  const editValid = Number(editReward) > 0 && Number(editCap) >= 1 && Number(editCap) <= 500 &&
    Number(editLevel) >= 1 && Number(editLevel) <= 7 &&
    Number(editBudget) >= editRequiredBudget;

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: "queue", label: "Review queue", count: pendingImports.length },
    { id: "listings", label: "Live tasks", count: tasks.length },
    { id: "completions", label: "Completions", count: completions.length },
    { id: "sources", label: "Licensed feeds", count: sources.length },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-green-900/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-green-400">
            <ShieldCheck className="h-3 w-3" /> Admin workspace
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Tasks &amp; work</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">Review licensed listings, set platform-funded budgets, and publish approved tasks to the worker app.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button onClick={() => void load()} disabled={loading} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-white px-4 py-2.5 text-xs font-semibold text-slate-400 shadow-sm transition hover:bg-slate-800 disabled:opacity-60 sm:flex-none">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => { setModalError(""); setSourceForm(EMPTY_SOURCE); setSourceModal(true); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 sm:flex-none">
            <Plus className="h-4 w-4" /> Connect feed
          </button>
        </div>
      </div>

      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X className="h-4 w-4" /></button>
      </div>}
      {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X className="h-4 w-4" /></button>
      </div>}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric label="Live listings" value={activeTasks.length.toLocaleString()} detail="Visible in the worker app" icon={FileText} tone="green" />
        <Metric label="Awaiting review" value={pendingImports.length.toLocaleString()} detail="Imported from licensed feeds" icon={Clock3} tone="amber" />
        <Metric label="Completed work" value={approvedCompletions.toLocaleString()} detail="Approved worker submissions" icon={CheckCircle2} tone="blue" />
        <Metric label="Active task budgets" value={money(fundedTotal)} detail="Configured platform-funded caps" icon={Coins} tone="rose" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-white shadow-sm">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-800 px-3 sm:px-5" role="tablist" aria-label="Task management sections">
          {tabs.map(({ id, label, count }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`relative flex shrink-0 items-center gap-2 px-3 py-4 text-xs font-bold transition ${tab === id ? "text-green-400" : "text-slate-400 hover:text-slate-300"}`}>
              {label}<span className={`rounded-md px-1.5 py-0.5 text-[10px] ${tab === id ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>{count}</span>
              {tab === id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-green-400" />}
            </button>
          ))}
        </div>

        {tab === "queue" && <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-sm font-bold text-white">Imported tasks for review</h2><p className="mt-1 text-xs text-slate-400">Nothing is published until you confirm the source rights and task budget.</p></div>
            <button onClick={() => setTab("sources")} className="text-xs font-bold text-green-400 hover:text-green-300">Manage task feeds <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></button>
          </div>
          {loading ? <LoadingState /> : pendingImports.length === 0 ? (
            <EmptyState
              icon={ListFilter}
              title={sources.length ? "No imported tasks need review" : "No licensed feed connected"}
              detail={sources.length ? "Sync an enabled feed to bring eligible listings into this review queue." : "Connect a public feed that you have permission to reuse. Lipwa Tasks does not scrape or copy listings from other sites."}
              actionLabel={sources.length ? "Open licensed feeds" : "Connect a licensed feed"}
              onAction={() => {
                if (sources.length) setTab("sources");
                else { setModalError(""); setSourceForm(EMPTY_SOURCE); setSourceModal(true); }
              }}
            />
          ) : (
            <div className="space-y-3">
              {pendingImports.map((item) => <ImportCard key={item.id} item={item} disabled={!item.sourceActive} acting={acting === item.id} onReview={() => openReview(item)} onSkip={() => void skipImport(item)} />)}
            </div>
          )}
        </div>}

        {tab === "listings" && <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-sm font-bold text-white">Worker app listings</h2><p className="mt-1 text-xs text-slate-400">Manage the platform-funded tasks currently available to workers.</p></div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-700 bg-white px-3 py-2 sm:w-64">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full min-w-0 bg-transparent text-xs text-slate-300 outline-none" placeholder="Search task or category" />
              </label>
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full appearance-none rounded-xl border border-slate-700 bg-white py-2 pl-9 pr-8 text-xs text-slate-400 outline-none sm:w-48">
                  <option>All categories</option>{CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </div>
          {loading ? <LoadingState /> : visibleTasks.length ? <div className="grid gap-3 lg:grid-cols-2">
            {visibleTasks.map((task) => <TaskCard key={task.id} task={task} acting={acting === task.id} onEdit={() => openEdit(task)} onToggle={() => void toggleTask(task)} onPause={() => void deactivateTask(task)} />)}
          </div> : <EmptyState icon={FileText} title="No worker listings found" detail="Publish an approved task feed item to make the first listing." actionLabel="Review queue" onAction={() => setTab("queue")} />}
        </div>}

        {tab === "completions" && <div className="p-4 sm:p-5">
          <div className="mb-4"><h2 className="text-sm font-bold text-white">Worker submissions</h2><p className="mt-1 text-xs text-slate-400">Track work sent in by users. Review and approve completed submissions in Activity.</p></div>
          {loading ? <LoadingState /> : completions.length ? <div className="space-y-2">
            {completions.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800 bg-white p-3.5 sm:p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-900/40 text-xs font-bold text-green-400">{item.userName?.charAt(0)?.toUpperCase() ?? "U"}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-white">{item.taskTitle}</p><p className="mt-1 truncate text-[11px] text-slate-400">{item.userName} · {item.userEmail}</p></div>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${item.status === "completed" || item.status === "approved" ? "border-green-200 bg-green-50 text-green-700" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>{item.status}</span>
              <span className="text-xs font-bold text-green-400">{money(item.reward)}</span>
              <span className="w-full text-[10px] text-slate-500 sm:w-auto">Started {when(item.startedAt)}{item.completedAt ? ` · Submitted ${when(item.completedAt)}` : ""}</span>
            </div>)}
          </div> : <EmptyState icon={CheckCircle2} title="No task submissions yet" detail="Worker submissions will appear here as people complete published listings." />}
        </div>}

        {tab === "sources" && <div className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-sm font-bold text-white">Licensed public feeds</h2><p className="mt-1 text-xs text-slate-400">Only connect sources whose terms permit this paid reuse.</p></div>
            <button onClick={() => { setModalError(""); setSourceForm(EMPTY_SOURCE); setSourceModal(true); }} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"><Plus className="h-3.5 w-3.5" /> Add licensed feed</button>
          </div>
          {loading ? <LoadingState /> : sources.length ? <div className="space-y-3">
            {sources.map((source) => <SourceCard key={source.id} source={source} syncing={syncingSource === source.id} acting={acting === source.id} onSync={() => void syncSource(source)} onToggle={() => void toggleSource(source)} />)}
          </div> : <EmptyState icon={ShieldCheck} title="No task feed connected" detail="There is no default provider or sample feed. Add a public JSON feed and its reuse terms before importing any task." actionLabel="Connect licensed feed" onAction={() => setSourceModal(true)} />}
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-800/60 p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-300"><FileText className="h-4 w-4 text-green-400" /> Feed format required</p>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-400">A connected URL must return a public HTTPS JSON document using <code className="rounded bg-white px-1 py-0.5 text-[10px]">lipwa-task-feed/v1</code>. Each item needs an ID, title, description, detailed instructions, one approved category, estimated minutes, and its source URL. Feeds are synced manually; no scraping or automatic republication.</p>
          </div>
        </div>}
      </section>

      <p className="flex items-start gap-2 px-1 text-[11px] leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-400" /> Listings are platform-funded, capped by the budget set here, and reviewed before worker earnings are approved. No client charge or escrow is created.</p>

      {sourceModal && <Modal title="Connect a licensed task feed" onClose={() => { setSourceModal(false); setModalError(""); }} wide>
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-green-400">Licensed source setup</p><h2 className="mt-1 text-lg font-extrabold text-white">Connect task feed</h2><p className="mt-1 text-xs text-slate-400">Only a public feed that you have rights to reuse. No API keys or logged-in accounts.</p></div>
          <button onClick={() => setSourceModal(false)} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={(event) => void createSource(event)} className="lipwa-scroll space-y-4 overflow-y-auto p-5 sm:p-6">
          {modalError && <InlineError message={modalError} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Source name" required value={sourceForm.name} placeholder="Provider or feed name" onChange={(value) => setSourceForm((current) => ({ ...current, name: value }))} />
            <TextField label="License or terms name" required value={sourceForm.licenseName} placeholder="Name of the reuse license" onChange={(value) => setSourceForm((current) => ({ ...current, licenseName: value }))} />
            <TextField label="Public HTTPS JSON feed URL" required type="url" value={sourceForm.feedUrl} placeholder="https://provider.example/tasks.json" onChange={(value) => setSourceForm((current) => ({ ...current, feedUrl: value }))} />
            <TextField label="Public license or terms URL" required type="url" value={sourceForm.licenseUrl} placeholder="https://provider.example/terms" onChange={(value) => setSourceForm((current) => ({ ...current, licenseUrl: value }))} />
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-bold text-slate-300">Categories allowed from this feed</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICON[category];
              const checked = sourceForm.allowedCategories.includes(category);
              return <label key={category} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-xs font-semibold transition ${checked ? "border-green-300 bg-green-50 text-green-800" : "border-slate-800 bg-white text-slate-400 hover:bg-slate-800"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleCategory(category)} className="accent-green-700" />
                <Icon className="h-4 w-4" />{category}
              </label>;
            })}</div>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-800/60 p-3.5">
            <input type="checkbox" checked={sourceForm.reuseRightsConfirmed} onChange={(event) => setSourceForm((current) => ({ ...current, reuseRightsConfirmed: event.target.checked }))} className="mt-0.5 accent-green-700" />
            <span><span className="block text-xs font-bold text-slate-300">I verified that these terms allow Lipwa Tasks to reuse and pay for these listings.</span><span className="mt-1 block text-[11px] leading-5 text-slate-500">This records your confirmation. It does not replace checking the provider’s current license or obtaining permission.</span></span>
          </label>
          <details className="rounded-xl border border-slate-800 bg-slate-800/60 p-3.5">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">Show the required feed structure</summary>
            <pre className="lipwa-scroll mt-3 overflow-x-auto rounded-lg bg-white p-3 text-[10px] leading-5 text-slate-400">{`{
  "format": "lipwa-task-feed/v1",
  "tasks": [{
    "id": "provider-task-id",
    "title": "Task title",
    "description": "Short task overview",
    "instructions": "Detailed worker instructions, at least 50 characters...",
    "category": "Data Entry",
    "estimatedMinutes": 15,
    "taskUrl": "https://provider.example/task/123"
  }]
}`}</pre>
          </details>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row">
            <button type="button" onClick={() => setSourceModal(false)} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={savingSource || !sourceForm.reuseRightsConfirmed || sourceForm.allowedCategories.length === 0} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              {savingSource ? "Connecting…" : "Save licensed feed"}
            </button>
          </div>
        </form>
      </Modal>}

      {reviewing && <Modal title={`Review ${reviewing.title}`} onClose={closeReview} wide>
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-green-400">{confirmPublish ? "Final confirmation" : "Task intake review"}</p><h2 className="mt-1 text-lg font-extrabold text-white">{confirmPublish ? "Publish to the worker app?" : "Set the funded task scope"}</h2><p className="mt-1 text-xs text-slate-400">{confirmPublish ? "Workers will see this listing after you confirm." : "Review source, task details, reward, budget, and completion cap."}</p></div>
          <button onClick={closeReview} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="lipwa-scroll space-y-4 overflow-y-auto p-5 sm:p-6">
          {modalError && <InlineError message={modalError} />}
          <div className="rounded-xl border border-slate-800 bg-slate-800/60 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-green-900/40 px-2 py-1 text-[10px] font-bold text-green-400">{reviewing.category}</span>
              <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400">~{reviewing.estimatedMinutes} min</span>
              {!reviewing.sourceActive && <span className="rounded-md bg-red-900/40 px-2 py-1 text-[10px] font-bold text-red-400">Source paused</span>}
            </div>
            <h3 className="text-sm font-extrabold text-white">{reviewing.title}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{reviewing.description}</p>
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] font-bold text-green-400">Read worker instructions</summary>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{reviewing.instructions}</p>
            </details>
            <div className="mt-4 grid gap-2 border-t border-slate-800 pt-3 text-[11px] sm:grid-cols-2">
              <p className="break-all"><span className="text-slate-500">Source: </span><a href={reviewing.sourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-green-400 hover:underline">{reviewing.sourceNameSnapshot} <ExternalLink className="inline h-3 w-3" /></a></p>
              <p className="break-all"><span className="text-slate-500">Reuse terms: </span><a href={reviewing.licenseUrlSnapshot} target="_blank" rel="noreferrer" className="font-semibold text-green-400 hover:underline">{reviewing.licenseNameSnapshot} <ExternalLink className="inline h-3 w-3" /></a></p>
            </div>
          </div>

          {!confirmPublish ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField label="Reward per worker" prefix="$" value={reward} min="0.01" step="0.01" onChange={setReward} />
              <NumberField label="Total platform budget" prefix="$" value={budget} min="0.01" step="0.01" onChange={setBudget} />
              <NumberField label="Maximum completions" value={cap} min="1" max="500" step="1" suffix="workers" onChange={(value) => { setCap(value); if (Number(reward) > 0) setBudget((Number(reward) * Number(value)).toFixed(2)); }} />
              <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Minimum worker level</span><select value={minLevel} onChange={(event) => setMinLevel(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2.5 text-xs font-semibold text-slate-300">{[1, 2, 3, 4, 5, 6, 7].map((level) => <option key={level} value={level}>Level {level}+</option>)}</select></label>
            </div>
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${budgetValue >= requiredFunding ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div><p className="text-xs font-bold text-slate-300">Maximum funded commitment</p><p className="mt-1 text-[11px] text-slate-500">{capValue || 0} workers × {money(rewardValue)} each · task difficulty is set to Hard</p></div>
              <div className="text-right"><p className="text-lg font-extrabold text-white">{money(requiredFunding)}</p><p className="text-[10px] text-slate-500">Budget entered: {money(budgetValue)}</p></div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-white p-4">
              <p className="flex items-center gap-2 text-xs font-bold text-slate-300"><BadgeCheck className="h-4 w-4 text-green-400" />Worker listing preview</p>
              <p className="mt-3 text-sm font-bold text-white">{reviewing.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">{reviewing.description}</p>
              <p className="mt-3 text-[11px] text-slate-500">{reviewing.category} · Hard · Level {minLevelValue}+ · {money(rewardValue)} reward · Admin-reviewed</p>
            </div>
          </> : <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-green-800"><ShieldCheck className="h-4 w-4" />Confirm this platform-funded listing</p>
            <p className="mt-2 text-xs leading-5 text-green-800/80">Publishing will expose this task to eligible workers, with a maximum payout of <strong>{money(requiredFunding)}</strong> across <strong>{capValue}</strong> completions. No funds are moved at publish time; worker submissions remain subject to admin review.</p>
          </div>}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-800 px-5 py-4 sm:flex-row sm:px-6">
          {!confirmPublish ? <>
            <button onClick={closeReview} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800">Cancel</button>
            <button onClick={() => setConfirmPublish(true)} disabled={!publishValid || !reviewing.sourceActive} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Review &amp; continue</button>
          </> : <>
            <button onClick={() => setConfirmPublish(false)} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800">Back to budget</button>
            <button onClick={() => void publishImport()} disabled={publishing} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{publishing ? "Publishing…" : "Confirm publish"}</button>
          </>}
        </div>
      </Modal>}

      {editing && <Modal title={`Edit ${editing.title}`} onClose={() => setEditing(null)}>
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-green-400">Manage live task</p><h2 className="mt-1 text-lg font-extrabold text-white">Edit funded scope</h2><p className="mt-1 text-xs text-slate-400">{editing.title}</p></div>
          <button onClick={() => setEditing(null)} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-5">
          {modalError && <InlineError message={modalError} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField label="Reward per worker" prefix="$" value={editReward} min="0.01" step="0.01" onChange={setEditReward} />
            <NumberField label="Total platform budget" prefix="$" value={editBudget} min="0.01" step="0.01" onChange={setEditBudget} />
            <NumberField label="Maximum completions" value={editCap} min="1" max="500" step="1" suffix="workers" onChange={setEditCap} />
            <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">Minimum worker level</span><select value={editLevel} onChange={(event) => setEditLevel(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2.5 text-xs text-slate-300">{[1, 2, 3, 4, 5, 6, 7].map((level) => <option key={level} value={level}>Level {level}+</option>)}</select></label>
          </div>
          <p className={`rounded-lg px-3 py-2 text-xs ${editValid ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>Required funding: {money(editRequiredBudget)} · Available budget: {money(editBudget)}</p>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-800 pt-4 sm:flex-row">
            <button onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-slate-700 bg-white py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-800">Cancel</button>
            <button onClick={() => void saveEdit()} disabled={!editValid || savingEdit} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50">{savingEdit ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </Modal>}
    </div>
  );
}

function ImportCard({ item, disabled, acting, onReview, onSkip }: {
  item: TaskImport;
  disabled: boolean;
  acting: boolean;
  onReview: () => void;
  onSkip: () => void;
}) {
  const Icon = CATEGORY_ICON[item.category];
  return (
    <article className="rounded-2xl border border-slate-800 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-900/40 text-green-400"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-white">{item.title}</h3><span className="rounded-md bg-green-900/40 px-2 py-1 text-[10px] font-semibold text-green-400">{item.category}</span>{disabled && <span className="rounded-md bg-red-900/40 px-2 py-1 text-[10px] font-semibold text-red-400">Source paused</span>}</div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
            <span>{item.sourceNameSnapshot}</span><span>{item.licenseNameSnapshot}</span><span>~{item.estimatedMinutes} min</span><span>Imported {when(item.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:justify-end">
        <button onClick={onSkip} disabled={acting} className="rounded-xl border border-slate-700 bg-white px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50">Dismiss</button>
        <button onClick={onReview} disabled={disabled || acting} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Review &amp; set budget <ChevronRight className="ml-1 inline h-3.5 w-3.5" /></button>
      </div>
    </article>
  );
}

function TaskCard({ task, acting, onEdit, onToggle, onPause }: {
  task: Task;
  acting: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onPause: () => void;
}) {
  const Icon = CATEGORY_ICON[task.category] ?? FileText;
  return (
    <article className="rounded-2xl border border-slate-800 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-900/40 text-green-400"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold leading-5 text-white">{task.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5"><span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400">{task.category}</span><span className="rounded-md bg-green-900/40 px-2 py-1 text-[10px] font-semibold text-green-400">Hard</span><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${task.isActive ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>{task.isActive ? "Live" : "Paused"}</span></div>
        </div>
        <button onClick={onEdit} className="rounded-lg border border-slate-700 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:bg-slate-800">Edit budget</button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-800 pt-3 sm:grid-cols-4">
        <MiniStat label="Reward / worker" value={money(task.reward)} />
        <MiniStat label="Budget cap" value={money(task.fundingBudget)} />
        <MiniStat label="Completions" value={`${task.completionCount} / ${task.maxCompletions}`} />
        <MiniStat label="Minimum level" value={`Level ${task.minLevel}+`} />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button onClick={onToggle} disabled={acting} className="rounded-lg border border-slate-700 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50">{task.isActive ? "Pause listing" : "Resume listing"}</button>
        {task.isActive && <button onClick={onPause} disabled={acting} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">Remove from app</button>}
      </div>
    </article>
  );
}

function SourceCard({ source, syncing, acting, onSync, onToggle }: {
  source: TaskFeedSource;
  syncing: boolean;
  acting: boolean;
  onSync: () => void;
  onToggle: () => void;
}) {
  const statusStyle: Record<TaskFeedSource["lastSyncStatus"], string> = {
    never: "bg-slate-800 text-slate-500",
    success: "bg-green-900/40 text-green-400",
    warning: "bg-yellow-900/40 text-yellow-400",
    failed: "bg-red-900/40 text-red-400",
  };
  return (
    <article className="rounded-2xl border border-slate-800 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-900/40 text-green-400"><ShieldCheck className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-white">{source.name}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${source.isActive ? "bg-green-900/40 text-green-400" : "bg-slate-800 text-slate-500"}`}>{source.isActive ? "Enabled" : "Paused"}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${statusStyle[source.lastSyncStatus]}`}>{source.lastSyncStatus}</span></div>
          <p className="mt-1 truncate text-[11px] text-slate-500">{new URL(source.feedUrl).host} · synced {when(source.lastSyncedAt)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{source.allowedCategories.map((category) => <span key={category} className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-400">{category}</span>)}</div>
          <p className="mt-2 text-[11px] text-slate-400">Reuse terms: <a href={source.licenseUrl} target="_blank" rel="noreferrer" className="font-semibold text-green-400 hover:underline">{source.licenseName} <ExternalLink className="inline h-3 w-3" /></a></p>
          {source.lastSyncMessage && <p className="mt-1 text-[10px] leading-4 text-slate-500">{source.lastSyncMessage}</p>}
        </div>
      </div>
      <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:justify-end">
        <button onClick={onToggle} disabled={acting} className="rounded-xl border border-slate-700 bg-white px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-50">{source.isActive ? "Pause feed" : "Enable feed"}</button>
        <button onClick={onSync} disabled={!source.isActive || syncing || acting} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{syncing ? <><LoaderCircle className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />Syncing…</> : <><Activity className="mr-1.5 inline h-3.5 w-3.5" />Sync now</>}</button>
      </div>
    </article>
  );
}

function TextField({ label, value, placeholder, required = false, type = "text", onChange }: {
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  type?: string;
  onChange: (value: string) => void;
}) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">{label}</span><input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-slate-700 bg-white px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-green-400" /></label>;
}

function NumberField({ label, value, min, max, step, prefix, suffix, onChange }: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  step?: string;
  prefix?: string;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-[11px] font-semibold text-slate-400">{label}</span><span className="flex items-center rounded-xl border border-slate-700 bg-white px-3 py-2.5 focus-within:border-green-400">{prefix && <span className="mr-1.5 text-xs text-slate-500">{prefix}</span>}<input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-300 outline-none" />{suffix && <span className="ml-2 shrink-0 text-[10px] text-slate-500">{suffix}</span>}</span></label>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-800/60 p-2.5"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-xs font-bold text-slate-300">{value}</p></div>;
}

function LoadingState() {
  return <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Loading task data…</div>;
}

function InlineError({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{message}</p>;
}

function EmptyState({ icon: Icon, title, detail, actionLabel, onAction }: {
  icon: typeof Wallet2;
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/60 px-5 py-10 text-center">
    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-green-900/40 text-green-400"><Icon className="h-5 w-5" /></span>
    <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
    <p className="mx-auto mt-1.5 max-w-lg text-xs leading-5 text-slate-400">{detail}</p>
    {actionLabel && onAction && <button onClick={onAction} className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700">{actionLabel}</button>}
  </div>;
}
