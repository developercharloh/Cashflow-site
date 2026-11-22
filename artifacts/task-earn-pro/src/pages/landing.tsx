import { Link } from "wouter";
import { ArrowDown, ArrowRight, AudioLines, BookOpenCheck, Check, ClipboardList, FileSpreadsheet, Landmark, ShieldCheck, Sparkles, WalletCards, CandlestickChart } from "lucide-react";

const areas = [
  { icon: BookOpenCheck, number: "01", title: "Academic Writing", detail: "Ethical help with proofreading, citation formatting, and research organization—not ghostwriting graded work." },
  { icon: FileSpreadsheet, number: "02", title: "Data Entry", detail: "Careful information entry, spreadsheet cleanup, and organization." },
  { icon: AudioLines, number: "03", title: "Transcription", detail: "Audio-to-text work with clear language and formatting requirements." },
  { icon: Sparkles, number: "04", title: "AI Training", detail: "AI response evaluation and data labeling against project guidelines." },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 md:px-10">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Lipwa Tasks home" data-testid="link-brand-home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary font-serif text-xl text-primary-foreground">L</span>
            <span className="font-semibold tracking-tight">Lipwa Tasks</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Main navigation">
            <a data-testid="link-landing-work-nav" className="hover:text-foreground" href="#work">Work areas</a>
            <a data-testid="link-landing-features-nav" className="hover:text-foreground" href="#features">Other features</a>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" data-testid="link-login" className="hidden text-sm font-semibold hover:text-primary sm:block">Log in</Link>
            <Link href="/auth/register" data-testid="link-create-account" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Create account <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="marketplace-grid relative overflow-hidden border-b border-border/70">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 md:grid-cols-[1.15fr_.85fr] md:px-10 md:py-24 lg:py-28">
            <div className="relative z-10 max-w-3xl">
              <p className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-primary"><span className="h-2 w-2 rounded-full bg-primary" /> Practical work and useful tools</p>
              <h1 className="font-serif text-[3.5rem] leading-[.98] tracking-[-.045em] sm:text-6xl lg:text-[5.35rem]">Work with clarity.<br /><span className="text-primary">Start with Lipwa.</span></h1>
              <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">Explore academic support, data entry, transcription, and AI training ideas, alongside Simple Quiz and wallet tools. Soft Loans and Forex are coming soon.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/auth/register" data-testid="link-hero-register" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Join Lipwa Tasks <ArrowRight className="h-4 w-4" /></Link>
                <a data-testid="link-hero-work" href="#work" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card/70 px-6 font-semibold transition-colors hover:bg-muted">See work areas <ArrowDown className="h-4 w-4" /></a>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">Work-area examples are ideas only. No client-funded freelance listings are available yet.</p>
            </div>
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -right-5 -top-6 h-40 w-40 rounded-full border border-primary/20" />
              <div className="absolute -bottom-7 -left-8 h-48 w-48 rounded-full border border-primary/15" />
              <div className="relative rounded-[1.7rem] border border-border bg-card p-5 shadow-[0_24px_70px_-32px_hsl(205_29%_17%_/.28)] sm:p-7">
                <div className="flex items-center justify-between border-b border-border pb-5">
                  <div><span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Lipwa Tasks</span><h2 className="mt-2 font-serif text-2xl">A focused set of tools.</h2></div>
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><ShieldCheck className="h-5 w-5" /></div>
                </div>
                <div className="space-y-4 py-6">
                  {[
                    ["Work", "Four illustrative freelance areas"],
                    ["Simple Quiz", "A separate platform-funded feature"],
                    ["Wallet", "Your account balance and activity"],
                  ].map(([label, text], i) => <div key={label} className="flex items-center gap-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-primary/20 font-mono text-xs text-primary">0{i + 1}</span><div><p className="text-sm font-semibold">{label}</p><p className="text-sm text-muted-foreground">{text}</p></div><Check className="ml-auto h-4 w-4 text-primary" /></div>)}
                </div>
                <div className="rounded-xl bg-muted/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><ClipboardList className="h-4 w-4 text-primary" /> Simple Quiz reward</div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">One-time, platform-funded $1–$5 reward based on quiz results. Not a client job or client payment.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-5 pb-8 md:px-10"><div className="flex items-center gap-3 border-t border-border/70 pt-5 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground"><span>Built for practical digital work</span><span className="h-px flex-1 bg-border" /><span>East Africa and beyond</span></div></div>
        </section>

        <section id="work" className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-24">
          <div className="grid gap-8 md:grid-cols-[.7fr_1.3fr]">
            <div><p className="font-mono text-[11px] uppercase tracking-[.2em] text-primary">Work areas</p><h2 className="mt-4 max-w-sm font-serif text-4xl leading-tight tracking-tight md:text-5xl">Four ways to contribute.</h2></div>
            <div>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">These are illustrative categories, not current client jobs or offers of paid work. Real client listings are not available yet.</p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {areas.map((item) => <article key={item.number} data-testid={`category-preview-${item.number}`} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between"><span className="font-mono text-[10px] tracking-widest text-muted-foreground">{item.number} / IDEA</span><item.icon className="h-5 w-5 text-primary" /></div>
                  <h3 className="mt-6 font-serif text-xl">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                  <span className="mt-4 inline-block rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Illustrative task idea</span>
                </article>)}
              </div>
              <Link href="/auth/register" data-testid="link-landing-work" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Explore work areas <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>

        <section id="features" className="bg-[#e9e7dc]">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-10 md:py-24">
            <div className="max-w-2xl"><p className="font-mono text-[11px] uppercase tracking-[.2em] text-primary">More in the app</p><h2 className="mt-4 font-serif text-4xl leading-tight md:text-5xl">One home for work and useful tools.</h2></div>
            <div className="mt-9 grid gap-3 md:grid-cols-2">
               <article className="rounded-2xl border border-[#d4d2c8] bg-card p-5"><div className="flex items-center gap-3"><ClipboardList className="h-5 w-5 text-primary" /><h3 className="font-serif text-xl">Simple Quiz</h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">A separate interactive quiz with a one-time platform-funded $1–$5 reward based on quiz results. Not freelance work, a client job, or a client payment.</p><Link href="/auth/register" data-testid="link-landing-quiz" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">Learn about Lipwa Tasks <ArrowRight className="h-4 w-4" /></Link></article>
              <article className="rounded-2xl border border-[#d4d2c8] bg-card p-5"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-primary" /><h3 className="font-serif text-xl">Wallet</h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Review your account balance and wallet activity in the existing wallet.</p></article>
              <article className="rounded-2xl border border-[#d4d2c8] bg-card p-5"><div className="flex items-center gap-3"><Landmark className="h-5 w-5 text-muted-foreground" /><h3 className="font-serif text-xl">Soft Loans <span className="font-sans text-xs text-muted-foreground">Coming Soon</span></h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Soft Loans are not available yet.</p></article>
              <article className="rounded-2xl border border-[#d4d2c8] bg-card p-5"><div className="flex items-center gap-3"><CandlestickChart className="h-5 w-5 text-muted-foreground" /><h3 className="font-serif text-xl">Forex <span className="font-sans text-xs text-muted-foreground">Coming Soon</span></h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Forex is not available yet. No forex trades or deposits are available.</p></article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 md:px-10">
          <div className="grid gap-8 rounded-[1.7rem] bg-[#183b32] px-6 py-10 text-[#f5f3e9] md:grid-cols-[1fr_auto] md:items-center md:px-12 md:py-14">
            <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#a6c6b7]">Straight talk</p><h2 className="mt-4 max-w-2xl font-serif text-3xl leading-tight md:text-4xl">No client-funded freelance jobs are listed yet.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-[#c5d5cd]">The four work areas are previews only. Real paid listings can appear only after a client posts and funds the work.</p></div>
            <Link href="/auth/register" data-testid="link-standards-register" className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#d5e3d5] px-5 font-semibold text-[#183b32] transition-transform hover:-translate-y-0.5">Create your account <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="mt-10 flex flex-col justify-between gap-5 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
            <Link href="/" className="flex items-center gap-2 font-semibold text-foreground"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary font-serif text-primary-foreground">L</span>Lipwa Tasks</Link>
            <p>Practical work and useful tools, with clear expectations.</p>
            <div className="flex gap-5"><Link href="/auth/login" data-testid="link-footer-login">Log in</Link><Link href="/auth/register" data-testid="link-footer-register">Register</Link></div>
          </div>
        </section>
      </main>
    </div>
  );
}
