import { useGetDashboardStats } from "@workspace/api-client-react";
import { AlertCircle, ArrowRight, AudioLines, BookOpenCheck, Clock3, FileSpreadsheet, Landmark, Sparkles, WalletCards, CandlestickChart } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const currency = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading, isError, refetch } = useGetDashboardStats();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const workCategories = [
    { title: "Academic Writing", icon: BookOpenCheck },
    { title: "Data Entry", icon: FileSpreadsheet },
    { title: "Transcription", icon: AudioLines },
    { title: "AI Training", icon: Sparkles },
  ];

  return (
    <div className="px-4 pb-10 pt-8 sm:px-7 sm:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Lipwa Tasks home</p><h1 data-testid="text-worker-greeting" className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">Welcome, {firstName}.</h1><p className="mt-2 text-sm text-muted-foreground">Work areas, account tools, and what is coming next.</p></div>
        <Link href="/tasks" data-testid="link-home-work" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Explore work <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2" aria-label="Wallet overview">
        <Link href="/wallet" data-testid="link-home-balance" className="rounded-2xl bg-[#183b32] p-5 text-[#f5f3e9] transition-transform hover:-translate-y-0.5 sm:p-6">
          <div className="flex items-center justify-between"><span className="text-sm text-[#b9cec3]">Available balance</span><WalletCards className="h-5 w-5 text-[#a6c6b7]" /></div>
          {isLoading ? <div className="mt-5 h-9 w-36 animate-pulse rounded bg-white/10" aria-label="Loading balance" /> : isError ? <p className="mt-4 text-sm text-[#e2c4a8]">Balance unavailable.</p> : <p data-testid="text-home-balance" className="mt-4 font-mono text-3xl">{currency(stats?.balance ?? 0)}</p>}
          <p className="mt-4 border-t border-white/15 pt-3 text-xs text-[#b9cec3]">Open your wallet <ArrowRight className="ml-1 inline h-3 w-3" /></p>
        </Link>
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Pending amount</span><Clock3 className="h-5 w-5 text-primary" /></div>
          {isLoading ? <div className="mt-5 h-9 w-36 animate-pulse rounded bg-muted" aria-label="Loading pending amount" /> : isError ? <p className="mt-4 text-sm text-muted-foreground">Pending amount unavailable.</p> : <p data-testid="text-home-pending" className="mt-4 font-mono text-3xl">{currency(stats?.pendingEarnings ?? 0)}</p>}
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">Recorded in your account</p>
        </div>
      </section>
      {isError && <div role="alert" className="mt-3 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"><span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Wallet summary could not be loaded.</span><button data-testid="button-retry-home-stats" onClick={() => void refetch()} className="font-semibold text-primary underline underline-offset-4">Try again</button></div>}

      <section className="mt-9" aria-labelledby="home-work-title">
        <div className="flex items-end justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Work</p><h2 id="home-work-title" className="mt-2 font-serif text-2xl">Four illustrative freelance areas</h2></div><Link href="/tasks" data-testid="link-home-all-work" className="text-sm font-semibold text-primary hover:underline">View work areas</Link></div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{workCategories.map(({ title, icon: Icon }) => <Link key={title} href="/tasks" data-testid={`link-home-category-${title.toLowerCase().replaceAll(" ", "-")}`} className="rounded-xl border border-border bg-card p-4 transition-transform hover:-translate-y-0.5"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 text-sm font-semibold">{title}</p><p className="mt-1 text-[10px] text-muted-foreground">Illustrative category</p></Link>)}</div>
        <p data-testid="status-home-no-listings" className="mt-3 text-xs leading-5 text-muted-foreground">No client-funded freelance listings are available yet. Real paid work appears only after a client posts and funds it.</p>
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Other LipwaTasks features">
        <Link href="/quiz" data-testid="link-home-simple-quiz" className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-[#e9eee8] p-5 transition-transform hover:-translate-y-0.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card text-primary"><Sparkles className="h-5 w-5" /></div>
          <div className="flex-1"><p className="font-mono text-[9px] uppercase tracking-[.17em] text-primary">{user?.quizCompleted ? "Completed" : "Platform-funded feature"}</p><h2 className="mt-1 font-serif text-xl">Simple Quiz</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{user?.quizCompleted ? "This one-time quiz has been completed on your account." : "One-time $1–$5 platform-funded quiz reward based on results; separate from client work."}</p></div><ArrowRight className="h-4 w-4 text-primary" />
        </Link>
        <Link href="/wallet" data-testid="link-home-wallet" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><WalletCards className="h-5 w-5" /></div>
          <div className="flex-1"><p className="font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">Account</p><h2 className="mt-1 font-serif text-xl">Wallet</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">View your balance and wallet activity.</p></div><ArrowRight className="h-4 w-4 text-primary" />
        </Link>
        <Link href="/loans" data-testid="link-home-soft-loans" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Landmark className="h-5 w-5" /></div>
          <div className="flex-1"><p className="font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">Coming soon</p><h2 className="mt-1 font-serif text-xl">Soft Loans</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Not available yet.</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/forex" data-testid="link-home-forex" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><CandlestickChart className="h-5 w-5" /></div>
          <div className="flex-1"><p className="font-mono text-[9px] uppercase tracking-[.17em] text-muted-foreground">Coming soon</p><h2 className="mt-1 font-serif text-xl">Forex</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">No trading or deposits are available yet.</p></div><ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>
    </div>
  );
}
