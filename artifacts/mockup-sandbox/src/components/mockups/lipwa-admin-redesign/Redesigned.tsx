import "./_group.css";
import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, BadgeCheck, BookOpen, Check,
  CheckCircle2, CheckSquare, ChevronDown, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, Coins, FileText, Filter, LayoutDashboard,
  ListFilter, LogOut, Menu, MoreHorizontal, Search, ShieldCheck,
  SlidersHorizontal, Sparkles, Users, Wallet2, X,
} from "lucide-react";

type Category = "Academic Writing" | "Data Entry" | "Transcription" | "AI Training";
type Task = {
  title: string; category: Category; reward: number; difficulty: string;
  level: number; completions: number; cap: number; status: "Active" | "Paused";
  source: string; initials: string; age: string;
};

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Activity", icon: Activity },
  { label: "Users", icon: Users },
  { label: "Tasks", icon: CheckSquare },
  { label: "Withdrawals", icon: Wallet2 },
  { label: "KYC", icon: ShieldCheck },
];

const seedTasks: Task[] = [
  { title: "Evaluate short-form research summaries", category: "Academic Writing", reward: 2.4, difficulty: "Expert", level: 4, completions: 18, cap: 40, status: "Active", source: "Academic source feed · sample", initials: "AR", age: "12 min ago" },
  { title: "Normalize product catalog attributes", category: "Data Entry", reward: 1.2, difficulty: "Expert", level: 3, completions: 63, cap: 120, status: "Active", source: "Catalog source feed · sample", initials: "PC", age: "38 min ago" },
  { title: "Transcribe and label interview excerpts", category: "Transcription", reward: 3.75, difficulty: "Expert", level: 4, completions: 9, cap: 24, status: "Active", source: "Audio source feed · sample", initials: "AS", age: "1 hr ago" },
  { title: "Compare generated answers for accuracy", category: "AI Training", reward: 1.85, difficulty: "Expert", level: 3, completions: 41, cap: 80, status: "Paused", source: "Evaluation source feed · sample", initials: "EA", age: "2 hrs ago" },
  { title: "Review citations in literature notes", category: "Academic Writing", reward: 2.1, difficulty: "Expert", level: 4, completions: 27, cap: 50, status: "Active", source: "Academic source feed · sample", initials: "RN", age: "Yesterday" },
];

const sourceItems = [
  { title: "Evaluate short-form research summaries", category: "Academic Writing" as Category, source: "Academic source feed · sample", attribution: "Attribution record: source item AF-1048 · sample", description: "Assess factual accuracy, evidence quality, and clarity in concise research summaries. Expert-level review; all submissions reviewed by an administrator.", minutes: 18 },
  { title: "Normalize product catalog attributes", category: "Data Entry" as Category, source: "Catalog source feed · sample", attribution: "Attribution record: source item CF-2281 · sample", description: "Standardize product attributes against the provided taxonomy and flag ambiguous records for review.", minutes: 12 },
  { title: "Transcribe and label interview excerpts", category: "Transcription" as Category, source: "Audio source feed · sample", attribution: "Attribution record: source item AF-5904 · sample", description: "Transcribe short interview segments and apply the supplied speaker and topic labels.", minutes: 25 },
  { title: "Compare generated answers for accuracy", category: "AI Training" as Category, source: "Evaluation source feed · sample", attribution: "Attribution record: source item EF-7720 · sample", description: "Compare two responses for correctness, completeness, and adherence to the task instructions.", minutes: 14 },
];

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function Redesigned() {
  const [activeNav, setActiveNav] = useState("Tasks");
  const [tab, setTab] = useState<"tasks" | "completions">("tasks");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [statusFilter, setStatusFilter] = useState("All status");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(0);
  const [reward, setReward] = useState("2.40");
  const [budget, setBudget] = useState("96");
  const [cap, setCap] = useState("40");
  const [attributionChecked, setAttributionChecked] = useState(true);
  const [dialog, setDialog] = useState<"preview" | "publish" | null>(null);
  const [notice, setNotice] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const source = sourceItems[selectedSource];
  const rewardValue = Number(reward) || 0;
  const budgetValue = Number(budget) || 0;
  const capValue = Number(cap) || 0;
  const fundedCapacity = rewardValue > 0 ? Math.floor(budgetValue / rewardValue) : 0;
  const effectiveCap = Math.min(capValue, fundedCapacity);
  const totalCommitment = rewardValue * effectiveCap;
  const filteredTasks = useMemo(() => seedTasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.category} ${task.source}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "All categories" || task.category === categoryFilter;
    const matchesStatus = statusFilter === "All status" || task.status === statusFilter;
    return matchesQuery && matchesCategory && matchesStatus;
  }), [query, categoryFilter, statusFilter]);

  const openIntake = () => {
    setSelectedSource(0);
    setReward("2.40");
    setBudget("96");
    setCap("40");
    setAttributionChecked(true);
    setNotice("");
    setDrawerOpen(true);
  };

  const publish = () => {
    setDialog(null);
    setDrawerOpen(false);
    setNotice("Published in this preview only. No backend changes were made.");
  };

  return (
    <div className="min-h-[100dvh] overflow-hidden text-[#24332f]" style={{ background: "#f4f6f2", fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap'); .lipwa-display{font-family:'Manrope',sans-serif} .lipwa-scroll::-webkit-scrollbar{width:6px;height:6px}.lipwa-scroll::-webkit-scrollbar-thumb{background:#d4ddd5;border-radius:9px} .lipwa-pop{animation:lipwa-in .18s ease-out both}@keyframes lipwa-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div className="flex min-h-[100dvh]">
        <aside className="hidden w-[230px] shrink-0 flex-col border-r border-[#e2e8e1] bg-[#fbfcfa] lg:flex">
          <div className="flex h-[76px] items-center gap-3 border-b border-[#e9eee8] px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-[#17483d] text-sm font-extrabold tracking-tight text-[#eff8eb]">L</div>
            <div><p className="lipwa-display text-[15px] font-extrabold tracking-[-.04em] text-[#1e332e]">Lipwa Tasks</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.16em] text-[#89958d]">Operations</p></div>
          </div>
          <div className="px-4 pt-6">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#a0aaa2]">Workspace</p>
            <nav className="space-y-1">
              {navigation.map(({ label, icon: Icon }) => {
                const active = activeNav === label;
                return <button key={label} onClick={() => setActiveNav(label)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-[11px] text-left text-[13px] font-semibold transition-all ${active ? "bg-[#eaf2e8] text-[#17483d]" : "text-[#738078] hover:bg-[#f3f6f2] hover:text-[#30463e]"}`}>
                  <Icon className={`h-[17px] w-[17px] ${active ? "text-[#246653]" : "text-[#93a097]"}`} />
                  <span>{label}</span>
                  {label === "Withdrawals" && <span className="ml-auto rounded-full bg-[#f8eee0] px-1.5 py-0.5 text-[10px] font-bold text-[#99642c]">4</span>}
                  {active && <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#5f8875]" />}
                </button>;
              })}
            </nav>
          </div>
          <div className="mt-auto p-4">
            <div className="mb-3 rounded-2xl border border-[#e6ece4] bg-[#f6f8f4] p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#456056]"><ShieldCheck className="h-4 w-4 text-[#4b8068]" /> Admin review enabled</div>
              <p className="mt-2 text-[11px] leading-[1.55] text-[#89968c]">Expert work is reviewed before it is approved.</p>
            </div>
            <button onClick={() => setNotice("Administrator profile is represented as preview-only UI.")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-[#f3f6f2]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcebe2] text-[11px] font-bold text-[#315e4b]">AM</span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[#34463e]">Amina Mwangi</span><span className="block text-[10px] text-[#95a098]">Administrator</span></span>
              <MoreHorizontal className="h-4 w-4 text-[#a6b0a8]" />
            </button>
          </div>
        </aside>

        {menuOpen && <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="absolute inset-0 bg-[#1b2924]/30" />
          <aside className="relative flex h-full w-[260px] flex-col border-r border-[#e2e8e1] bg-[#fbfcfa] shadow-2xl">
            <div className="flex h-[68px] items-center justify-between border-b border-[#e9eee8] px-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#17483d] font-bold text-white">L</span><span className="lipwa-display font-extrabold text-[#1e332e]">Lipwa Tasks</span></div><button onClick={() => setMenuOpen(false)}><X className="h-5 w-5 text-[#738078]" /></button></div>
            <nav className="space-y-1 p-4">{navigation.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setActiveNav(label); setMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${activeNav === label ? "bg-[#eaf2e8] text-[#17483d]" : "text-[#738078]"}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
            <div className="mt-auto border-t border-[#e9eee8] p-4"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcebe2] text-[11px] font-bold text-[#315e4b]">AM</span><div><p className="text-xs font-bold">Amina Mwangi</p><p className="text-[10px] text-[#95a098]">Administrator</p></div></div></div>
          </aside>
        </div>}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[62px] shrink-0 items-center border-b border-[#e3e9e1] bg-[#fbfcfa]/95 px-4 sm:px-7">
            <button onClick={() => setMenuOpen(true)} className="mr-3 rounded-lg p-2 text-[#60756b] hover:bg-[#eff4ed] lg:hidden" aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
            <div className="flex items-center gap-2 text-[12px] text-[#98a39b]"><span className="hidden sm:block">Operations</span><ChevronRight className="hidden h-3.5 w-3.5 sm:block" /><span className="font-semibold text-[#3b5147]">{activeNav}</span></div>
            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden items-center gap-2 rounded-full border border-[#deeadf] bg-[#f2f8f1] px-2.5 py-1.5 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#559875]" /><span className="text-[10px] font-semibold text-[#52775f]">Workspace ready</span></div>
              <button aria-label="Help" onClick={() => setNotice("Help content is represented locally in this admin preview.")} className="rounded-lg p-2 text-[#8a988f] hover:bg-[#eff4ed]"><CircleHelp className="h-[17px] w-[17px]" /></button>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4eee6] text-[10px] font-bold text-[#41634e]">AM</span>
            </div>
          </header>

          <main className="lipwa-scroll flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-6 sm:px-7 sm:pt-8">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2"><span className="rounded-md bg-[#e7f0e5] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[#48715a]">Admin workspace</span><span className="text-[10px] text-[#9aa59c]">•</span><span className="text-[10px] font-medium text-[#89958d]">Preview data only</span></div>
                  <h1 className="lipwa-display text-[27px] font-extrabold leading-tight tracking-[-.055em] text-[#20332d] sm:text-[30px]">{activeNav}</h1>
                  <p className="mt-1.5 max-w-xl text-[13px] leading-5 text-[#77857c]">{activeNav === "Tasks" ? "Review platform-funded listings, completions, and worker rewards." : `A quick view of ${activeNav.toLowerCase()} for the Lipwa Tasks operations team.`}</p>
                </div>
                {activeNav === "Tasks" && <div className="flex w-full gap-2 sm:w-auto">
                  <button onClick={() => { setRefreshCount((value) => value + 1); setNotice("Preview data refreshed locally."); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#dfe6de] bg-[#fbfcfa] px-3.5 py-2.5 text-[12px] font-semibold text-[#617269] shadow-[0_1px_2px_rgba(25,50,35,.03)] transition hover:bg-white sm:flex-none"><Activity className="h-3.5 w-3.5" />Refresh</button>
                  <button onClick={openIntake} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e5545] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_3px_8px_rgba(28,73,57,.16)] transition hover:bg-[#17493b] sm:flex-none"><span className="text-[17px] leading-none">+</span> New task</button>
                </div>}
              </div>

              {notice && <div className="lipwa-pop mb-4 flex items-center justify-between rounded-xl border border-[#d6e7d8] bg-[#f0f7ef] px-4 py-3 text-[12px] font-medium text-[#456d50]"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice"><X className="h-4 w-4" /></button></div>}

              {activeNav === "Tasks" ? <>
                <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <Metric label="Active listings" value="12" detail="+2 this week" icon={FileText} tone="mint" />
                  <Metric label="In review" value="08" detail="Needs admin decision" icon={ClipboardCheck} tone="sand" />
                  <Metric label="Completions today" value="146" detail="+18% vs. yesterday" icon={CheckCircle2} tone="blue" />
                  <Metric label="Rewards assigned" value="$428.60" detail="Across active listings" icon={Coins} tone="rose" />
                </section>

                <section className="mb-5 overflow-hidden rounded-2xl border border-[#e2e9e1] bg-[#fbfcfa] shadow-[0_3px_12px_rgba(32,58,43,.035)]">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9eee8] px-4 py-3.5 sm:px-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#edf4ea] text-[#528063]"><Sparkles className="h-4 w-4" /></div>
                      <div><h2 className="text-[13px] font-bold text-[#31463c]">Create a funded listing</h2><p className="mt-0.5 text-[10px] text-[#89968d]">From an approved source feed to a reviewed worker listing</p></div>
                    </div>
                    <span className="rounded-full border border-[#e4eae2] bg-[#f7f9f5] px-2.5 py-1 text-[9px] font-semibold text-[#78867c]">No source connected</span>
                  </div>
                  <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr_1.1fr]">
                    <div className="border-b border-[#e9eee8] px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r">
                      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.11em] text-[#9aa49c]">01 · Choose source</p>
                      <div className="flex items-center gap-3 rounded-xl border border-[#e4eae2] bg-white p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf3ea] text-[#50755a]"><BookOpen className="h-4 w-4" /></div>
                        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#394a41]">Approved source feed</p><p className="mt-0.5 text-[10px] text-[#96a198]">Academic Writing · sample record</p></div>
                        <button onClick={openIntake} className="shrink-0 rounded-lg border border-[#dfe7dd] px-2.5 py-1.5 text-[10px] font-semibold text-[#4e705a] hover:bg-[#f3f7f1]">Select</button>
                      </div>
                      <p className="mt-2.5 flex items-start gap-1.5 text-[10px] leading-4 text-[#99a39b]"><CircleHelp className="mt-0.5 h-3 w-3 shrink-0" />Sample feed records only. No provider connection is represented.</p>
                    </div>
                    <div className="border-b border-[#e9eee8] px-4 py-4 sm:px-5 lg:border-b-0 lg:border-r">
                      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.11em] text-[#9aa49c]">02 · Verify attribution</p>
                      <div className="flex items-start gap-2.5 rounded-xl bg-[#f4f7f2] p-3">
                        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5f8a68]" />
                        <div><p className="text-[11px] font-semibold text-[#46594d]">Source attribution required</p><p className="mt-1 text-[10px] leading-4 text-[#87948a]">Confirm source record and permission before publication.</p></div>
                      </div>
                      <button onClick={openIntake} className="mt-2.5 flex items-center gap-1.5 text-[10px] font-bold text-[#49745a] hover:text-[#22563e]">Review source record <ChevronRight className="h-3 w-3" /></button>
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
                      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.11em] text-[#9aa49c]">03 · Set funded scope</p><p className="text-[11px] font-semibold text-[#46594d]">Reward · budget · completion cap</p><p className="mt-1 text-[10px] text-[#87948a]">Per-worker reward is platform funded.</p></div>
                      <button onClick={openIntake} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#e8f1e7] px-3 py-2 text-[10px] font-bold text-[#356248] hover:bg-[#dcebdc]">Configure <ChevronRight className="h-3 w-3" /></button>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-[#e2e9e1] bg-[#fbfcfa] shadow-[0_3px_12px_rgba(32,58,43,.035)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9eee8] px-4 py-4 sm:px-5">
                    <div className="flex gap-5">
                      <button onClick={() => setTab("tasks")} className={`relative py-1 text-[12px] font-bold transition ${tab === "tasks" ? "text-[#265b47]" : "text-[#98a29a] hover:text-[#56675d]"}`}>Listings <span className={`ml-1 rounded-md px-1.5 py-0.5 text-[9px] ${tab === "tasks" ? "bg-[#eaf2e8] text-[#4e7659]" : "bg-[#f1f4ef] text-[#89968b]"}`}>12</span>{tab === "tasks" && <span className="absolute -bottom-[17px] left-0 right-0 h-[2px] rounded-full bg-[#387256]" />}</button>
                      <button onClick={() => setTab("completions")} className={`relative py-1 text-[12px] font-bold transition ${tab === "completions" ? "text-[#265b47]" : "text-[#98a29a] hover:text-[#56675d]"}`}>Completions <span className={`ml-1 rounded-md px-1.5 py-0.5 text-[9px] ${tab === "completions" ? "bg-[#eaf2e8] text-[#4e7659]" : "bg-[#f1f4ef] text-[#89968b]"}`}>24</span>{tab === "completions" && <span className="absolute -bottom-[17px] left-0 right-0 h-[2px] rounded-full bg-[#387256]" />}</button>
                    </div>
                    <span className="rounded-md bg-[#f3f6f1] px-2 py-1 text-[9px] font-semibold tracking-wide text-[#7d8a80]">SAMPLE DATA</span>
                  </div>
                  <div className="flex flex-col gap-2.5 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e4eae2] bg-white px-3 py-2.5 focus-within:border-[#a8c2aa]">
                      <Search className="h-3.5 w-3.5 shrink-0 text-[#9aa59c]" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search task title or source…" className="w-full min-w-0 bg-transparent text-[11px] text-[#3e5046] outline-none placeholder:text-[#a4aea6]" />
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 sm:flex-none"><ListFilter className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#909e93]" /><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full appearance-none rounded-xl border border-[#e4eae2] bg-white py-2.5 pl-8 pr-7 text-[10px] font-semibold text-[#67756c] outline-none sm:w-[160px]"><option>All categories</option>{["Academic Writing", "Data Entry", "Transcription", "AI Training"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#9aa59c]" /></div>
                      <div className="relative flex-1 sm:flex-none"><Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#909e93]" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none rounded-xl border border-[#e4eae2] bg-white py-2.5 pl-8 pr-7 text-[10px] font-semibold text-[#67756c] outline-none sm:w-[130px]"><option>All status</option><option>Active</option><option>Paused</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#9aa59c]" /></div>
                    </div>
                  </div>
                  {tab === "tasks" ? <div className="lipwa-scroll overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left">
                      <thead><tr className="border-y border-[#edf0eb] bg-[#f8faf7] text-[9px] font-bold uppercase tracking-[.1em] text-[#9aa49c]"><th className="px-5 py-3">Task / source</th><th className="px-3 py-3">Category</th><th className="px-3 py-3">Reward</th><th className="px-3 py-3">Level</th><th className="px-3 py-3">Completions</th><th className="px-3 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
                      <tbody>{filteredTasks.map((task) => <tr key={task.title} onClick={() => setSelectedTask(task)} className={`cursor-pointer border-b border-[#edf0eb] transition hover:bg-[#f6f9f5] ${selectedTask?.title === task.title ? "bg-[#f1f7f0]" : ""}`}>
                        <td className="px-5 py-3.5"><p className="max-w-[310px] truncate text-[11px] font-bold text-[#3a4b41]">{task.title}</p><p className="mt-1 text-[9px] text-[#9aa49c]">{task.source} <span className="mx-1">·</span> {task.age}</p></td>
                        <td className="px-3 py-3"><span className="whitespace-nowrap rounded-md bg-[#f1f5ef] px-2 py-1 text-[9px] font-semibold text-[#6a7d70]">{task.category}</span></td>
                        <td className="px-3 py-3"><span className="text-[11px] font-bold text-[#3d624b]">{money(task.reward)}</span><span className="block text-[9px] text-[#a0aaa1]">per worker</span></td>
                        <td className="px-3 py-3"><span className="rounded-md border border-[#e5eae3] px-2 py-1 text-[9px] font-semibold text-[#718077]">L{task.level}+ · {task.difficulty}</span></td>
                        <td className="px-3 py-3"><span className="text-[11px] font-semibold text-[#596a60]">{task.completions}</span><span className="text-[9px] text-[#a0aaa1]"> / {task.cap}</span></td>
                        <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-bold ${task.status === "Active" ? "bg-[#edf6ec] text-[#56805c]" : "bg-[#f5f2e9] text-[#9a8051]"}`}><span className={`h-1.5 w-1.5 rounded-full ${task.status === "Active" ? "bg-[#73a37a]" : "bg-[#c5a569]"}`} />{task.status}</span></td>
                        <td className="px-4 py-3 text-right"><button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }} aria-label={`Open ${task.title}`} className="rounded-lg p-1.5 text-[#9aa69d] hover:bg-[#ebf2e9] hover:text-[#4b7456]"><ChevronRight className="h-4 w-4" /></button></td>
                      </tr>)}</tbody>
                    </table>
                    {filteredTasks.length === 0 && <div className="px-6 py-12 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#eff4ed] text-[#7c9780]"><Search className="h-4 w-4" /></div><p className="text-[12px] font-bold text-[#52645a]">No matching listings</p><p className="mt-1 text-[10px] text-[#99a39b]">Try a different title or filter.</p><button onClick={() => { setQuery(""); setCategoryFilter("All categories"); setStatusFilter("All status"); }} className="mt-3 text-[10px] font-bold text-[#4b795a]">Clear filters</button></div>}
                    <div className="flex items-center justify-between px-5 py-3"><p className="text-[9px] text-[#9aa49c]">Showing {filteredTasks.length} sample listings <span className="mx-1">·</span> Updated just now {refreshCount > 0 ? `(${refreshCount} local refresh${refreshCount > 1 ? "es" : ""})` : ""}</p><button onClick={() => setNotice("All visible records are clearly marked sample preview data.")} className="flex items-center gap-1 text-[9px] font-semibold text-[#738378]"><SlidersHorizontal className="h-3 w-3" /> View settings</button></div>
                  </div> : <div className="divide-y divide-[#edf0eb]">
                    {[
                      { person: "Njeri W.", task: "Evaluate short-form research summaries", status: "Needs review", amount: "$2.40", when: "4 min ago", initials: "NW" },
                      { person: "Kelvin M.", task: "Normalize product catalog attributes", status: "Approved", amount: "$1.20", when: "18 min ago", initials: "KM" },
                      { person: "Faith A.", task: "Transcribe and label interview excerpts", status: "Needs review", amount: "$3.75", when: "32 min ago", initials: "FA" },
                    ].map((item) => <div key={item.person} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#edf2ea] text-[9px] font-bold text-[#607a66]">{item.initials}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-[#46574c]">{item.person} <span className="ml-1 font-normal text-[#a0aaa2]">· sample</span></p><p className="mt-0.5 truncate text-[10px] text-[#89968d]">{item.task}</p></div><span className="text-[11px] font-bold text-[#3d624b]">{item.amount}</span><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.status === "Approved" ? "bg-[#edf6ec] text-[#56805c]" : "bg-[#faf3e7] text-[#9c7440]"}`}>{item.status}</span><span className="hidden w-20 text-right text-[9px] text-[#a1aaa2] sm:block">{item.when}</span></div>)}
                    <div className="px-5 py-3 text-[9px] text-[#9aa49c]">Completion records are sample preview data only.</div>
                  </div>}
                </section>

                {selectedTask && <div className="lipwa-pop fixed inset-0 z-40 flex justify-end">
                  <button aria-label="Close listing details" className="absolute inset-0 bg-[#1b2924]/25" onClick={() => setSelectedTask(null)} />
                  <aside className="relative flex h-full w-full max-w-[430px] flex-col border-l border-[#e1e9df] bg-[#fbfcfa] shadow-2xl">
                    <div className="flex items-start justify-between border-b border-[#e8eee6] px-5 py-5"><div><span className="rounded-md bg-[#edf4eb] px-2 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#5e7d60]">Sample listing</span><h3 className="lipwa-display mt-3 text-[17px] font-extrabold leading-snug tracking-[-.03em] text-[#31443a]">{selectedTask.title}</h3></div><button onClick={() => setSelectedTask(null)} className="rounded-lg p-2 text-[#8b998f] hover:bg-[#eff4ed]"><X className="h-4 w-4" /></button></div>
                    <div className="lipwa-scroll flex-1 space-y-4 overflow-y-auto p-5">
                      <div className="grid grid-cols-2 gap-2"><Detail label="Category" value={selectedTask.category} /><Detail label="Per-worker reward" value={money(selectedTask.reward)} /><Detail label="Completions" value={`${selectedTask.completions} / ${selectedTask.cap}`} /><Detail label="Worker level" value={`Level ${selectedTask.level}+`} /></div>
                      <div className="rounded-xl border border-[#e6ece4] bg-white p-4"><p className="text-[10px] font-bold text-[#54685b]">Source attribution</p><p className="mt-2 text-[11px] leading-5 text-[#78877d]">{selectedTask.source}. Sample record; attribution remains subject to admin verification.</p></div>
                      <div className="rounded-xl bg-[#f3f7f1] p-4"><div className="flex items-center gap-2 text-[11px] font-bold text-[#58715c]"><ShieldCheck className="h-4 w-4" />Expert-level, admin-reviewed</div><p className="mt-2 text-[10px] leading-4 text-[#89968c]">Submissions are reviewed by an administrator before approval.</p></div>
                    </div>
                    <div className="border-t border-[#e8eee6] p-5"><button onClick={() => { setSelectedTask(null); openIntake(); }} className="w-full rounded-xl bg-[#1e5545] py-3 text-[11px] font-bold text-white hover:bg-[#17493b]">Create from source feed</button><p className="mt-2 text-center text-[9px] text-[#9aa49c]">Actions in this mockup are local only.</p></div>
                  </aside>
                </div>}
              </> : <section className="rounded-2xl border border-[#e2e9e1] bg-[#fbfcfa] p-6 shadow-[0_3px_12px_rgba(32,58,43,.035)]">
                <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4ea] text-[#5b8063]">{navigation.find((item) => item.label === activeNav)?.icon && (() => { const Icon = navigation.find((item) => item.label === activeNav)!.icon; return <Icon className="h-5 w-5" />; })()}</div><div><h2 className="text-[15px] font-bold text-[#34473c]">{activeNav} overview</h2><p className="mt-1 text-[11px] text-[#8d998f]">This route is represented in the local admin mockup.</p></div></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Awaiting attention" value={activeNav === "KYC" ? "06" : activeNav === "Withdrawals" ? "04" : "08"} detail="Sample queue" icon={Clock3} tone="sand" /><Metric label="Reviewed today" value="23" detail="Preview data" icon={BadgeCheck} tone="mint" /><Metric label="Recent change" value="Just now" detail="Local mockup state" icon={Activity} tone="blue" /></div>
                <p className="mt-5 rounded-xl border border-[#e9eee7] bg-[#f8faf6] p-4 text-[11px] leading-5 text-[#7d8b81]">Navigation is interactive for visual demonstration. Account, withdrawal, KYC, and activity records shown here are sample preview data, not live user records.</p>
              </section>}
              <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] text-[#a1aaa2]"><span>Lipwa Tasks · Operations workspace</span><span className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Worker submissions are admin reviewed</span></footer>
            </div>
          </main>
        </div>
      </div>

      {drawerOpen && <div className="fixed inset-0 z-50 flex justify-end">
        <button aria-label="Close task intake" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-[#1c2b25]/35" />
        <aside className="lipwa-pop relative flex h-full w-full max-w-[560px] flex-col bg-[#fbfcfa] shadow-2xl">
          <div className="flex items-start justify-between border-b border-[#e6ece4] px-5 py-4 sm:px-7">
            <div><p className="text-[9px] font-bold uppercase tracking-[.15em] text-[#779079]">Task intake · local preview</p><h2 className="lipwa-display mt-1 text-[19px] font-extrabold tracking-[-.04em] text-[#2d4036]">New funded listing</h2><p className="mt-1 text-[10px] text-[#8c998f]">Choose a sample source and set its worker-funded scope.</p></div>
            <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-2 text-[#8b998f] hover:bg-[#eff4ed]"><X className="h-4 w-4" /></button>
          </div>
          <div className="lipwa-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
            <Step number="1" title="Select approved source feed" caption="Source records below are illustrative preview data. No provider is connected." />
            <div className="grid gap-2">{sourceItems.map((item, index) => <button key={item.title} onClick={() => setSelectedSource(index)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${selectedSource === index ? "border-[#abc6ac] bg-[#f1f7ef] ring-1 ring-[#d7e7d4]" : "border-[#e4eae2] bg-white hover:border-[#ccd9cb]"}`}>
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selectedSource === index ? "border-[#4d805f] bg-[#4d805f] text-white" : "border-[#cfd8cf] bg-white"}`}>{selectedSource === index && <Check className="h-2.5 w-2.5" />}</span>
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold text-[#43564a]">{item.title}</span><span className="mt-1 block text-[9px] text-[#91a096]">{item.category} <span className="mx-1">·</span>{item.source}</span></span>
            </button>)}</div>
            <div className="rounded-xl border border-[#e7ece5] bg-[#f8faf6] p-3.5"><div className="flex items-center gap-2 text-[10px] font-bold text-[#627565]"><FileText className="h-3.5 w-3.5" />Selected sample source record</div><p className="mt-1.5 text-[10px] font-semibold text-[#596c5d]">{source.attribution}</p><p className="mt-1 text-[10px] leading-4 text-[#8d998f]">{source.description}</p></div>
            <Step number="2" title="Verify attribution" caption="Explicit confirmation is required before preview and publication." />
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#e6ece4] bg-white p-3.5">
              <input type="checkbox" checked={attributionChecked} onChange={(e) => setAttributionChecked(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[#397151]" />
              <span><span className="block text-[10px] font-bold text-[#53675a]">I verified the source attribution for this sample listing.</span><span className="mt-1 block text-[9px] leading-4 text-[#929e94]">The source ID and permitted use should be confirmed by an administrator before real publication.</span></span>
            </label>
            <Step number="3" title="Fund the worker listing" caption="Set reward per worker, a total funding budget, and a maximum completion count." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reward per worker" prefix="$" value={reward} onChange={setReward} suffix="USD" />
              <Field label="Total funding budget" prefix="$" value={budget} onChange={setBudget} suffix="USD" />
              <Field label="Completion cap" value={cap} onChange={setCap} suffix="workers" />
              <div className="rounded-xl border border-[#e1e9df] bg-[#f5f8f3] p-3"><p className="text-[9px] font-semibold text-[#8a978d]">Estimated capacity</p><p className="mt-1 text-[17px] font-extrabold tracking-tight text-[#426349]">{fundedCapacity}<span className="ml-1 text-[10px] font-semibold">workers</span></p><p className="text-[9px] text-[#97a197]">Budget ÷ reward</p></div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[#eff5ed] px-3.5 py-3"><span><span className="block text-[10px] font-bold text-[#536b57]">Maximum planned funding</span><span className="mt-0.5 block text-[9px] text-[#8a998c]">Lower of cap and budget-funded capacity</span></span><span className="text-[16px] font-extrabold tracking-tight text-[#315c42]">{money(totalCommitment)}</span></div>
            <p className="flex gap-1.5 text-[9px] leading-4 text-[#95a096]"><CircleHelp className="mt-0.5 h-3 w-3 shrink-0" />This is the platform-funded task budget. It is not escrow or a client charge.</p>
            <div className="rounded-xl border border-[#e4eae2] bg-white p-3.5">
              <div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold text-[#596b5e]">Listing guardrails</span><ShieldCheck className="h-4 w-4 text-[#67866b]" /></div>
              <div className="flex flex-wrap gap-1.5"><span className="rounded-md bg-[#f1f5ef] px-2 py-1 text-[9px] font-semibold text-[#708074]">{source.category}</span><span className="rounded-md bg-[#f1f5ef] px-2 py-1 text-[9px] font-semibold text-[#708074]">Expert-level</span><span className="rounded-md bg-[#f1f5ef] px-2 py-1 text-[9px] font-semibold text-[#708074]">Admin-reviewed</span><span className="rounded-md bg-[#f1f5ef] px-2 py-1 text-[9px] font-semibold text-[#708074]">~{source.minutes} min</span></div>
            </div>
          </div>
          <div className="border-t border-[#e6ece4] bg-[#fbfcfa] px-5 py-4 sm:px-7">
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button onClick={() => setDrawerOpen(false)} className="flex-1 rounded-xl border border-[#e0e7de] bg-white py-3 text-[11px] font-bold text-[#718076] hover:bg-[#f7f9f5]">Cancel</button>
              <button onClick={() => setDialog("preview")} disabled={!attributionChecked || rewardValue <= 0 || budgetValue <= 0 || capValue <= 0} className="flex-1 rounded-xl bg-[#1e5545] py-3 text-[11px] font-bold text-white hover:bg-[#17493b] disabled:cursor-not-allowed disabled:opacity-40">Preview worker listing</button>
            </div>
            <p className="mt-2 text-center text-[9px] text-[#a1aaa2]">Nothing is saved or published to a backend in this preview.</p>
          </div>
        </aside>
      </div>}

      {dialog && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1c2b25]/40 p-4">
        <div className="lipwa-pop w-full max-w-[440px] overflow-hidden rounded-2xl border border-[#e1e9df] bg-[#fbfcfa] shadow-[0_22px_60px_rgba(20,44,32,.25)]">
          <div className="flex items-start justify-between border-b border-[#e8eee6] px-5 py-4"><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#7f947f]">{dialog === "preview" ? "Worker listing preview" : "Final confirmation"}</p><h3 className="lipwa-display mt-1 text-[16px] font-extrabold tracking-[-.03em] text-[#31443a]">{dialog === "preview" ? "Review before publishing" : "Publish this sample listing?"}</h3></div><button onClick={() => setDialog(null)} className="rounded-lg p-1.5 text-[#8b998f] hover:bg-[#eff4ed]"><X className="h-4 w-4" /></button></div>
          <div className="p-5">
            <div className="rounded-xl border border-[#e7ece5] bg-white p-4">
              <div className="mb-2 flex items-center justify-between"><span className="rounded-md bg-[#edf4eb] px-2 py-1 text-[9px] font-bold text-[#658064]">{source.category}</span><span className="text-[9px] font-semibold text-[#a0aaa2]">SAMPLE PREVIEW</span></div>
              <h4 className="text-[13px] font-bold leading-5 text-[#405248]">{source.title}</h4>
              <p className="mt-2 text-[10px] leading-[1.6] text-[#7f8d82]">{source.description}</p>
              <div className="my-3 h-px bg-[#edf0eb]" />
              <div className="grid grid-cols-2 gap-y-2 text-[10px]"><span className="text-[#94a096]">Per-worker reward</span><strong className="text-right text-[#47674d]">{money(rewardValue)}</strong><span className="text-[#94a096]">Completion cap</span><strong className="text-right text-[#53665a]">{effectiveCap} workers</strong><span className="text-[#94a096]">Max. funding budget</span><strong className="text-right text-[#47674d]">{money(totalCommitment)}</strong><span className="text-[#94a096]">Task standard</span><strong className="text-right text-[#53665a]">Expert · admin-reviewed</strong></div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f4f7f2] p-3 text-[9px] leading-4 text-[#77887a]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#6e8d6d]" />Attribution: {source.attribution}. Confirm source permissions before publishing a real task.</div>
            <p className="mt-3 text-center text-[9px] text-[#a0aaa2]">Local mockup only — no backend action or money movement.</p>
            <div className="mt-4 flex gap-2">
              {dialog === "preview" ? <><button onClick={() => setDialog(null)} className="flex-1 rounded-xl border border-[#e0e7de] bg-white py-2.5 text-[10px] font-bold text-[#718076] hover:bg-[#f7f9f5]">Back to edit</button><button onClick={() => setDialog("publish")} className="flex-1 rounded-xl bg-[#1e5545] py-2.5 text-[10px] font-bold text-white hover:bg-[#17493b]">Continue to publish</button></> : <><button onClick={() => setDialog("preview")} className="flex-1 rounded-xl border border-[#e0e7de] bg-white py-2.5 text-[10px] font-bold text-[#718076] hover:bg-[#f7f9f5]">Not yet</button><button onClick={publish} className="flex-1 rounded-xl bg-[#1e5545] py-2.5 text-[10px] font-bold text-white hover:bg-[#17493b]">Confirm publish</button></>}
            </div>
          </div>
        </div>
      </div>}
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: typeof FileText; tone: "mint" | "sand" | "blue" | "rose" }) {
  const colors = {
    mint: "bg-[#edf5eb] text-[#5a8262]",
    sand: "bg-[#f7f1e6] text-[#a5834b]",
    blue: "bg-[#edf3f1] text-[#66847b]",
    rose: "bg-[#f7efec] text-[#a27a68]",
  };
  return <div className="rounded-2xl border border-[#e2e9e1] bg-[#fbfcfa] px-3.5 py-3.5 shadow-[0_2px_7px_rgba(32,58,43,.025)] sm:px-4">
    <div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold text-[#86938a]">{label}</span><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${colors[tone]}`}><Icon className="h-3.5 w-3.5" /></span></div>
    <p className="lipwa-display mt-2 text-[22px] font-extrabold tracking-[-.055em] text-[#2d4136] sm:text-[24px]">{value}</p>
    <p className="mt-1 truncate text-[9px] font-medium text-[#9ba59c]">{detail}</p>
  </div>;
}

function Step({ number, title, caption }: { number: string; title: string; caption: string }) {
  return <div className="flex items-start gap-2.5"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8f0e6] text-[9px] font-extrabold text-[#4e7658]">{number}</span><div><p className="text-[11px] font-bold text-[#45594b]">{title}</p><p className="mt-0.5 text-[9px] leading-4 text-[#929f95]">{caption}</p></div></div>;
}

function Field({ label, value, onChange, prefix, suffix }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix: string }) {
  return <label className="block min-w-0"><span className="mb-1.5 block truncate text-[9px] font-semibold text-[#7d8b80]">{label}</span><span className="flex items-center rounded-xl border border-[#e1e8df] bg-white px-2.5 py-2.5 focus-within:border-[#adc7ad]">{prefix && <span className="mr-1 text-[10px] text-[#9aa59b]">{prefix}</span>}<input type="number" min="0" step={suffix === "USD" ? "0.01" : "1"} value={value} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent text-[12px] font-bold text-[#425649] outline-none" /><span className="ml-1 shrink-0 text-[9px] text-[#a0aaa1]">{suffix}</span></span></label>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#e7ece5] bg-white p-3"><p className="text-[9px] font-semibold text-[#9aa49c]">{label}</p><p className="mt-1 text-[11px] font-bold leading-4 text-[#53675a]">{value}</p></div>;
}
