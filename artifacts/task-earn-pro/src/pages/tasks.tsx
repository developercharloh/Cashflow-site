import { Link } from "wouter";
import { ArrowRight, AudioLines, BookOpenCheck, ClipboardList, FileSpreadsheet, Sparkles } from "lucide-react";

const workAreas = [
  {
    id: "academic-writing",
    icon: BookOpenCheck,
    title: "Academic Writing",
    description: "Ethical academic support such as proofreading, citation formatting, and research organization. Not ghostwriting or completing graded work.",
    examples: ["Proofread for clarity and grammar", "Format citations to a supplied style", "Organize research notes and sources"],
  },
  {
    id: "data-entry",
    icon: FileSpreadsheet,
    title: "Data Entry",
    description: "Careful entry, cleanup, and organization of information within a clearly defined scope.",
    examples: ["Enter information into a spreadsheet", "Check rows for consistency", "Organize a supplied contact list"],
  },
  {
    id: "transcription",
    icon: AudioLines,
    title: "Transcription",
    description: "Turn recordings into text with agreed language, formatting, and accuracy requirements.",
    examples: ["Transcribe a short audio recording", "Review a transcript against its source"],
  },
  {
    id: "ai-training",
    icon: Sparkles,
    title: "AI Training",
    description: "Help improve AI systems by evaluating responses or labeling data using a defined project guide.",
    examples: ["Compare AI responses against a rubric", "Label text by topic or intent"],
  },
];

export default function TasksPage() {
  return (
    <div className="px-4 pb-10 pt-8 sm:px-7 sm:pt-12">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Work areas</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">A few ways to contribute.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">Explore four illustrative freelance categories. These are ideas for the kinds of work LipwaTasks may support, not current client jobs or paid listings.</p>
      </header>

      <section data-testid="status-no-client-funded-listings" aria-label="Client-funded listing status" className="mt-7 flex gap-4 rounded-2xl border border-[#d6c39f] bg-[#f2ead9] p-5 sm:p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7d9bd] font-mono text-xs text-[#6c522b]">i</span>
        <div>
          <h2 className="font-semibold text-[#403723]">No client-funded listings yet</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#665c48]">There are currently no paid freelance jobs posted and funded by clients. These category ideas are not listings, offers, or applications. Real paid work can appear only after a client posts and funds it.</p>
        </div>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-2" aria-label="Illustrative freelance categories">
        {workAreas.map((area) => (
          <article key={area.id} data-testid={`card-category-${area.id}`} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-primary"><area.icon className="h-5 w-5" /></div>
              <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Illustrative idea</span>
            </div>
            <h2 className="mt-5 font-serif text-2xl">{area.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{area.description}</p>
            <div className="mt-5 border-t border-border pt-4">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-muted-foreground">Example tasks · not live jobs</p>
              <ul className="mt-3 space-y-2">{area.examples.map((example) => <li key={example} className="flex gap-2 text-xs leading-5 text-muted-foreground"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />{example}</li>)}</ul>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 flex flex-col gap-5 rounded-2xl border border-primary/20 bg-[#e9eee8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="simple-quiz-title">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-card text-primary"><ClipboardList className="h-5 w-5" /></div>
          <div><p className="font-mono text-[9px] uppercase tracking-[.17em] text-primary">Separate platform feature</p><h2 id="simple-quiz-title" className="mt-1 font-serif text-2xl">Simple Quiz</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A short interactive quiz with a one-time, platform-funded reward of $1–$5 based on quiz results. This is not a client freelance job or client payment. Available once per account.</p></div>
        </div>
        <Link href="/quiz" data-testid="link-simple-quiz" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">Open Simple Quiz <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </div>
  );
}
