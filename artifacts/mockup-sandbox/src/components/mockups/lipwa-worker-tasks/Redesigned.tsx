import "./_group.css";
import { useMemo, useState } from "react";
import {
  AudioLines,
  BookOpenCheck,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Upload,
  UsersRound,
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
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = ["All", "Academic Writing", "Data Entry", "Transcription", "AI Training"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_ICONS = {
  "Academic Writing": BookOpenCheck,
  "Data Entry": FileSpreadsheet,
  Transcription: AudioLines,
  "AI Training": FileText,
};

const SAMPLE_TASKS = [
  {
    id: 1,
    category: "Academic Writing",
    title: "Edit a research abstract without changing its findings",
    description: "Improve the clarity and structure of a short, fictional research abstract while preserving every reported fact.",
    instructions: "Edit the abstract for clarity. Keep the findings and all numbers unchanged, and provide a short list of the edits you made.",
    reward: 1,
    estimatedMinutes: 20,
    maxCompletions: 10,
    difficulty: "Hard",
    minLevel: 1,
    assetUrl: null,
  },
  {
    id: 2,
    category: "Data Entry",
    title: "Standardize inventory records and flag conflicts",
    description: "Normalize product names, units, and stock counts without losing the original source values.",
    instructions: "Standardize each row and flag any conflicting quantities. Include a short note explaining each change.",
    reward: 1.15,
    estimatedMinutes: 18,
    maxCompletions: 10,
    difficulty: "Medium",
    minLevel: 1,
    assetUrl: null,
  },
  {
    id: 3,
    category: "Transcription",
    title: "Transcribe a short service call",
    description: "Create a clean transcript from a brief recording, keeping speaker turns and meaningful pauses clear.",
    instructions: "Listen to the full clip. Use speaker labels, preserve names and numbers exactly, and mark any unclear words with a timestamp.",
    reward: 1.35,
    estimatedMinutes: 16,
    maxCompletions: 8,
    difficulty: "Medium",
    minLevel: 1,
    assetUrl: null,
  },
  {
    id: 4,
    category: "AI Training",
    title: "Compare two summaries against source facts",
    description: "Choose the more accurate summary and identify unsupported claims, missing details, and instruction-following issues.",
    instructions: "Compare both summaries with the source. List every factual error and explain which summary is more reliable.",
    reward: 1.5,
    estimatedMinutes: 25,
    maxCompletions: 8,
    difficulty: "Hard",
    minLevel: 1,
    assetUrl: null,
  },
] as const;

const INITIAL_SUBMISSIONS = [
  {
    id: 24,
    taskId: 3,
    taskTitle: "Transcribe a short service call",
    reward: 1,
    status: "submitted",
    submittedAt: "2025-02-18T10:42:00.000Z",
    reviewNote: "",
    attachmentName: "",
  },
  {
    id: 21,
    taskId: 8,
    taskTitle: "Clean a customer feedback spreadsheet",
    reward: 0.85,
    status: "approved",
    submittedAt: "2025-02-16T14:20:00.000Z",
    reviewNote: "",
    attachmentName: "feedback-clean.csv",
  },
  {
    id: 19,
    taskId: 11,
    taskTitle: "Proofread a short methods section",
    reward: 1.2,
    status: "rejected",
    submittedAt: "2025-02-14T09:05:00.000Z",
    reviewNote: "Please include a brief change log alongside the revised text.",
    attachmentName: "",
  },
];

function statusLabel(status: string) {
  if (status === "approved") return "Approved · reward credited";
  if (status === "submitted") return "Under review";
  if (status === "rejected") return "Not approved";
  return status;
}

export function Redesigned() {
  const [category, setCategory] = useState<Category>("All");
  const [selectedTask, setSelectedTask] = useState<(typeof SAMPLE_TASKS)[number] | null>(null);
  const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
  const [writtenWork, setWrittenWork] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notice, setNotice] = useState("");
  const filteredTasks = useMemo(
    () => SAMPLE_TASKS.filter((task) => category === "All" || task.category === category),
    [category],
  );

  function closeDialog() {
    setSelectedTask(null);
    setWrittenWork("");
    setSelectedFile(null);
  }

  function submitPreviewWork() {
    if (!selectedTask || (!writtenWork.trim() && !selectedFile)) return;
    setSubmissions((current) => [
      {
        id: Date.now(),
        taskId: selectedTask.id,
        taskTitle: selectedTask.title,
        reward: selectedTask.reward,
        status: "submitted",
        submittedAt: new Date().toISOString(),
        reviewNote: "",
        attachmentName: selectedFile?.name ?? "",
      },
      ...current,
    ]);
    setNotice("Sample submission added to your history.");
    closeDialog();
  }

  const activeSubmissionByTask = new Map(
    submissions
      .filter((submission) => submission.status === "submitted" || submission.status === "approved")
      .map((submission) => [submission.taskId, submission]),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[10px] font-semibold tracking-wide text-amber-900">
        Redesigned preview · sample listings and submission history
      </div>
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-5 sm:px-7 sm:pt-8">
        <header className="relative overflow-hidden rounded-[1.5rem] border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
          <div className="absolute right-0 top-0 h-36 w-36 translate-x-1/3 -translate-y-1/3 rounded-full border-[20px] border-accent/60 sm:h-52 sm:w-52 sm:border-[28px]" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.19em] text-primary">Lipwa Tasks / Work board</p>
            <h1 className="mt-3 max-w-xl font-serif text-[2.35rem] leading-[.98] tracking-tight sm:text-5xl">Good work, clearly rewarded.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Find focused freelance work in writing, data, transcription, and AI training. Each listing shows its reward up front; your wallet is credited when your work is approved.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-2 text-xs font-medium text-primary">
              <ShieldCheck className="h-4 w-4" /> Every submission is reviewed before payment
            </div>
          </div>
        </header>

        <section className="mt-7" aria-label="Task discovery">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Browse opportunities</p>
              <h2 className="mt-1 font-serif text-2xl sm:text-3xl">Available work</h2>
            </div>
            <p className="text-xs text-muted-foreground">{filteredTasks.length} {filteredTasks.length === 1 ? "listing" : "listings"}{category !== "All" ? ` · ${category}` : ""}</p>
          </div>
          <nav aria-label="Filter task category" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
                data-testid={`filter-${item.toLowerCase().replaceAll(" ", "-")}`}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
              >
                {item}
              </button>
            ))}
          </nav>
          {category === "Academic Writing" && (
            <p className="mt-3 rounded-xl border border-border bg-accent/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
              Academic writing tasks support ethical work such as proofreading, citation formatting, and research organization—not completing graded work.
            </p>
          )}
          {notice && (
            <p role="status" className="mt-3 rounded-lg bg-primary/8 px-3 py-2 text-xs font-medium text-primary">{notice}</p>
          )}

          <section aria-label="Open freelance tasks" className="mt-4 space-y-3">
            {filteredTasks.map((task) => {
              const Icon = CATEGORY_ICONS[task.category as keyof typeof CATEGORY_ICONS] ?? FileText;
              const existingSubmission = activeSubmissionByTask.get(task.id);
              return (
                <Card key={task.id} className="overflow-hidden border-border bg-card transition-colors hover:border-primary/35" data-testid={`task-card-${task.id}`}>
                  <CardContent className="p-4 sm:px-5 sm:py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/70 text-primary"><Icon className="h-[18px] w-[18px]" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-primary">{task.category}</p>
                          <span className="text-border">/</span>
                          <span className="text-[10px] text-muted-foreground">{task.difficulty} · Level {task.minLevel}+</span>
                        </div>
                        <h3 className="mt-1 font-serif text-xl leading-tight sm:text-[1.4rem]">{task.title}</h3>
                        <p className="mt-1.5 line-clamp-2 max-w-3xl text-[13px] leading-5 text-muted-foreground">{task.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/80 pt-3 text-[11px] text-muted-foreground sm:gap-x-5">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-primary"><Wallet className="h-3.5 w-3.5" />${task.reward.toFixed(2)} on approval</span>
                          <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{task.estimatedMinutes} min</span>
                          <span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />Up to {task.maxCompletions}</span>
                          {task.assetUrl && <span className="inline-flex items-center gap-1.5"><AudioLines className="h-3.5 w-3.5" />Audio included</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end sm:mt-2">
                      {existingSubmission ? (
                        <div className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold sm:w-auto ${existingSubmission.status === "approved" ? "bg-primary/8 text-primary" : "bg-muted text-foreground"}`}>
                          {existingSubmission.status === "approved" ? <Check className="h-4 w-4" /> : <FileCheck2 className="h-4 w-4" />}
                          {statusLabel(existingSubmission.status)}
                        </div>
                      ) : (
                        <Button className="h-9 w-full gap-1.5 rounded-lg px-3 text-xs sm:w-auto" onClick={() => setSelectedTask(task)} data-testid={`button-open-task-${task.id}`}>
                          Read instructions <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        </section>

        <section className="mt-9 border-t border-border pt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your activity</p><h2 className="mt-1 font-serif text-2xl">Submission history</h2></div>
            <p className="text-xs text-muted-foreground">Review decisions and reward status</p>
          </div>
          <div className="mt-4 space-y-2">
            {submissions.map((submission) => (
              <div key={submission.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5">{submission.taskTitle}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Submitted {new Date(submission.submittedAt).toLocaleString()}{submission.attachmentName ? ` · ${submission.attachmentName}` : ""}</p>
                  {submission.reviewNote && <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">Review note: {submission.reviewNote}</p>}
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <p className="text-sm font-semibold">${submission.reward.toFixed(2)}</p>
                  <Badge variant="outline" className={`whitespace-nowrap text-[10px] ${submission.status === "approved" ? "border-primary/25 bg-primary/5 text-primary" : submission.status === "rejected" ? "border-destructive/25 bg-destructive/5 text-destructive" : ""}`}>{statusLabel(submission.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
          {selectedTask && (
            <>
              <DialogHeader>
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">{selectedTask.category} · {selectedTask.difficulty} · Level {selectedTask.minLevel}+</p>
                <DialogTitle className="font-serif text-2xl leading-tight">{selectedTask.title}</DialogTitle>
                <DialogDescription>{selectedTask.description}</DialogDescription>
              </DialogHeader>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <h3 className="text-sm font-semibold">Instructions and quality checks</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedTask.instructions}</p>
              </div>
              {selectedTask.assetUrl && (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><AudioLines className="h-4 w-4 text-primary" />Task audio</h3>
                  <audio controls preload="none" src={selectedTask.assetUrl} className="mt-3 w-full" aria-label={`Audio for ${selectedTask.title}`}>Your browser does not support audio playback.</audio>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Wallet reward after approval</span>
                <strong className="text-primary">${selectedTask.reward.toFixed(2)}</strong>
              </div>
              <div>
                <label htmlFor="preview-written-work" className="text-sm font-medium">Written response</label>
                <Textarea id="preview-written-work" className="mt-2 min-h-32" maxLength={50_000} value={writtenWork} onChange={(event) => setWrittenWork(event.target.value)} placeholder="Write your response and address each quality check." />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">{writtenWork.length.toLocaleString()} / 50,000</p>
              </div>
              <div>
                <label htmlFor="preview-work-attachment" className="text-sm font-medium">Optional work file · 10 MB maximum</label>
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input id="preview-work-attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.mp3,.wav" className="min-w-0 flex-1 text-xs" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
                </div>
                {selectedFile && <p className="mt-2 text-xs text-muted-foreground">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={closeDialog}>Cancel</Button>
                <Button onClick={submitPreviewWork} disabled={!writtenWork.trim() && !selectedFile}>Add sample submission</Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground">Preview only — no files or submissions are sent.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
