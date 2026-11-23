import "./_group.css";
import { useState } from "react";
import {
  AudioLines,
  BookOpenCheck,
  FileSpreadsheet,
  FileText,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const categories = ["All", "Academic Writing", "Data Entry", "Transcription", "AI Training"] as const;
type Category = (typeof categories)[number];

const categoryIcons = {
  "Academic Writing": BookOpenCheck,
  "Data Entry": FileSpreadsheet,
  Transcription: AudioLines,
  "AI Training": FileText,
};

const tasks = [
  {
    id: 1,
    category: "Academic Writing" as const,
    title: "Edit a research abstract without changing its findings",
    description: "Improve the clarity and structure of a short, fictional research abstract while preserving every reported fact.",
    instructions: "Edit the abstract for clarity. Keep the findings and all numbers unchanged, and provide a short list of the edits you made.",
    reward: 1,
    estimatedMinutes: 20,
    maxCompletions: 10,
    difficulty: "Hard",
    minLevel: 1,
  },
  {
    id: 2,
    category: "Academic Writing" as const,
    title: "Audit claims against a small evidence table",
    description: "Separate supported findings from overstatements and produce a concise evidence-grounded correction.",
    instructions: "For each claim, identify whether it is supported, partly supported, or unsupported. Quote the evidence that matters and suggest the strongest accurate wording.",
    reward: 1.25,
    estimatedMinutes: 22,
    maxCompletions: 10,
    difficulty: "Hard",
    minLevel: 1,
  },
  {
    id: 3,
    category: "Data Entry" as const,
    title: "Standardize inventory records and flag conflicts",
    description: "Normalize product names, units, and stock counts without losing the original source values.",
    instructions: "Standardize each row and flag any conflicting quantities. Include a short note explaining each change.",
    reward: 1,
    estimatedMinutes: 18,
    maxCompletions: 10,
    difficulty: "Hard",
    minLevel: 1,
  },
  {
    id: 4,
    category: "AI Training" as const,
    title: "Compare two summaries against source facts",
    description: "Choose the more accurate summary and identify unsupported claims, missing details, and instruction-following issues.",
    instructions: "Compare both summaries with the source. List every factual error and explain which summary is more reliable.",
    reward: 1.5,
    estimatedMinutes: 25,
    maxCompletions: 8,
    difficulty: "Hard",
    minLevel: 1,
  },
];

function PreviewMark() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[10px] font-semibold text-amber-800">
      Current screen preview · sample listings
    </div>
  );
}

export function Current() {
  const [category, setCategory] = useState<Category>("All");
  const [selectedTask, setSelectedTask] = useState<(typeof tasks)[number] | null>(null);
  const filteredTasks = category === "All" ? tasks : tasks.filter((task) => task.category === category);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PreviewMark />
      <main className="px-4 pb-10 pt-8 sm:px-7 sm:pt-12">
        <header className="max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Expert freelance work</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Choose a task. Submit real work.</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Only Academic Writing, Data Entry, Transcription, and AI Training listings appear here. Every listing has a fixed reward and capped platform-funded payout. An admin reviews work before approving a wallet reward; the budget cap is not an escrow transfer.
          </p>
        </header>

        <nav aria-label="Filter task category" className="mt-7 flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              aria-pressed={category === item}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                category === item
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {item}
            </button>
          ))}
        </nav>

        <section aria-label="Open freelance tasks" className="mt-6 grid gap-3 md:grid-cols-2">
          {filteredTasks.map((task) => {
            const Icon = categoryIcons[task.category];
            return (
              <Card key={task.id} className="overflow-hidden border-border transition-colors hover:border-primary/35">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {task.difficulty} · Level {task.minLevel}+
                    </Badge>
                  </div>
                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[.16em] text-primary">{task.category}</p>
                  <h2 className="mt-2 font-serif text-2xl leading-tight">{task.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{task.description}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-green-700">
                      <Wallet className="h-3.5 w-3.5" />${task.reward.toFixed(2)} on approval
                    </span>
                    <span>{task.estimatedMinutes} min estimate</span>
                    <span>Up to {task.maxCompletions} workers</span>
                  </div>
                  <Button className="mt-4 w-full" onClick={() => setSelectedTask(task)}>
                    View instructions and submit
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="mt-9">
          <h2 className="font-serif text-2xl">Your submissions</h2>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="text-sm font-semibold">Transcribe a short service call</p>
              <p className="mt-1 text-xs text-muted-foreground">Submitted today · review note available after decision</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">$1.00</p>
              <Badge variant="outline" className="mt-1">Under review</Badge>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">
                  {selectedTask.category} · {selectedTask.difficulty} · Level {selectedTask.minLevel}+
                </p>
                <DialogTitle className="font-serif text-2xl">{selectedTask.title}</DialogTitle>
                <DialogDescription>{selectedTask.description}</DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold">Instructions and quality checks</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedTask.instructions}</p>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3 text-sm">
                <span>Reward after admin approval</span>
                <strong className="text-green-700">${selectedTask.reward.toFixed(2)}</strong>
              </div>
              <Button onClick={() => setSelectedTask(null)}>Close preview</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
