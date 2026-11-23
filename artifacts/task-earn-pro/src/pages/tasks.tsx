import { useMemo, useState } from "react";
import { upload as uploadBlob } from "@vercel/blob/client";
import {
  getGetMyWorkSubmissionsQueryKey,
  getGetTasksQueryKey,
  useGetMyWorkSubmissions,
  useGetTasks,
  useRequestTaskSubmissionUpload,
  useSubmitWrittenTask,
} from "@workspace/api-client-react";
import type { Task } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AudioLines, BookOpenCheck, Check, ChevronRight, Clock3, FileCheck2, FileSpreadsheet, FileText, Loader2, ShieldCheck, Upload, UsersRound, Wallet } from "lucide-react";

const CATEGORIES = ["Academic Writing", "Data Entry", "Transcription", "AI Training"] as const;
const CATEGORY_ICONS = {
  "Academic Writing": BookOpenCheck,
  "Data Entry": FileSpreadsheet,
  Transcription: AudioLines,
  "AI Training": FileText,
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function errorMessage(error: unknown) {
  const maybeApiError = error as { data?: { error?: string }; message?: string };
  return maybeApiError.data?.error ?? maybeApiError.message ?? "Please try again.";
}

function publicAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  return `${base}${path.replace(/^\/+/, "")}`;
}

export default function TasksPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | "All">(() => {
    const requested = new URLSearchParams(window.location.search).get("category");
    return CATEGORIES.find((item) => item === requested) ?? "All";
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [writtenWork, setWrittenWork] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: tasks, isLoading, isError, refetch } = useGetTasks();
  const { data: submissions, isLoading: submissionsLoading, isError: submissionsError } = useGetMyWorkSubmissions();
  const uploadMutation = useRequestTaskSubmissionUpload();
  const submitMutation = useSubmitWrittenTask();

  const visibleTasks = useMemo(
    () => (tasks ?? []).filter((task) => category === "All" || task.category === category),
    [tasks, category],
  );
  const activeSubmissionByTask = new Map(
    (submissions ?? [])
      .filter((submission) => submission.status === "submitted" || submission.status === "approved")
      .map((submission) => [submission.taskId, submission]),
  );

  const resetDialog = () => {
    setSelectedTask(null);
    setWrittenWork("");
    setSelectedFile(null);
  };

  const submitWork = (task: Task, attachment?: { path: string; name: string; contentType: string; size: number }) => {
    submitMutation.mutate(
      {
        id: task.id,
        data: {
          textSubmission: writtenWork.trim() || undefined,
          attachmentPath: attachment?.path,
          attachmentName: attachment?.name,
          attachmentContentType: attachment?.contentType,
          attachmentSize: attachment?.size,
        },
      },
      {
        onSuccess: () => {
          setUploading(false);
          toast({ title: "Work submitted", description: "Your submission is now waiting for admin review. Rewards are paid only after approval." });
          void queryClient.invalidateQueries({ queryKey: getGetMyWorkSubmissionsQueryKey() });
          void queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() });
          resetDialog();
        },
        onError: (error) => {
          setUploading(false);
          toast({ title: "Submission failed", description: errorMessage(error), variant: "destructive" });
        },
      },
    );
  };

  const handleSubmit = () => {
    if (!selectedTask) return;
    if (!writtenWork.trim() && !selectedFile) {
      toast({ title: "Add your work", description: "Write a response or attach a file before submitting.", variant: "destructive" });
      return;
    }
    if (!selectedFile) {
      submitWork(selectedTask);
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast({ title: "File is too large", description: "Attachments must be 10 MB or smaller.", variant: "destructive" });
      return;
    }
    if (!selectedFile.type) {
      toast({ title: "Unsupported file", description: "Choose a PDF, Office document, image, CSV, text, or audio file.", variant: "destructive" });
      return;
    }
    setUploading(true);
    uploadMutation.mutate(
      { data: { name: selectedFile.name, size: selectedFile.size, contentType: selectedFile.type } },
      {
        onSuccess: async (upload) => {
          try {
            let objectPath: string;
            if (upload.provider === "vercel") {
              if (!upload.objectPrefix) throw new Error("File storage is not configured.");
              const safeName = selectedFile.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 140);
              const blob = await uploadBlob(
                `${upload.objectPrefix}${crypto.randomUUID()}-${safeName}`,
                selectedFile,
                {
                  access: "private",
                  contentType: selectedFile.type,
                  handleUploadUrl: "/api/tasks/work-submissions/upload-url",
                  clientPayload: JSON.stringify({
                    name: selectedFile.name,
                    size: selectedFile.size,
                    contentType: selectedFile.type,
                  }),
                  headers: {
                    Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
                  },
                },
              );
              objectPath = `/objects/${blob.pathname}`;
            } else {
              if (!upload.uploadURL || !upload.objectPath) throw new Error("File storage returned an invalid upload link.");
              const result = await fetch(upload.uploadURL, {
                method: "PUT",
                headers: { "Content-Type": selectedFile.type },
                body: selectedFile,
              });
              if (!result.ok) throw new Error("File upload did not complete. Please retry.");
              objectPath = upload.objectPath;
            }
            submitWork(selectedTask, {
              path: objectPath,
              name: selectedFile.name,
              contentType: selectedFile.type,
              size: selectedFile.size,
            });
          } catch (error) {
            setUploading(false);
            toast({ title: "File upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
          }
        },
        onError: (error) => {
          setUploading(false);
          toast({ title: "File upload failed", description: errorMessage(error), variant: "destructive" });
        },
      },
    );
  };

  const pending = uploading || uploadMutation.isPending || submitMutation.isPending;
  const submissionStatus = (status: string) =>
    status === "approved" ? "Approved · reward credited" : status === "submitted" ? "Under review" : status === "rejected" ? "Not approved" : status;

  return (
    <div className="px-4 pb-10 pt-6 sm:px-7 sm:pt-9">
      <div className="mx-auto max-w-5xl">
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
            {!isLoading && !isError && <p className="text-xs text-muted-foreground">{visibleTasks.length} {visibleTasks.length === 1 ? "listing" : "listings"}{category !== "All" ? ` · ${category}` : ""}</p>}
          </div>
          <nav aria-label="Filter task category" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["All", ...CATEGORIES] as const).map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                {item}
              </button>
            ))}
          </nav>
          {category === "Academic Writing" && (
            <p className="mt-3 rounded-xl border border-border bg-accent/35 px-4 py-3 text-xs leading-5 text-muted-foreground">
              Academic writing tasks support ethical work such as proofreading, citation formatting, and research organization—not completing graded work.
            </p>
          )}

          {isLoading ? (
            <div className="mt-5 space-y-3" aria-label="Loading task listings">
              {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-border bg-card/70" />)}
            </div>
          ) : isError ? (
            <section role="alert" className="mt-5 rounded-2xl border border-border bg-card px-5 py-8 text-center">
              <p className="font-semibold">Work listings could not be loaded.</p>
              <p className="mt-1 text-sm text-muted-foreground">Your work is safe. Please try the board again.</p>
              <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button>
            </section>
          ) : visibleTasks.length === 0 ? (
            <section className="mt-5 rounded-2xl border border-dashed border-border bg-card/60 px-5 py-9 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><FileCheck2 className="h-5 w-5" /></div>
              <h3 className="mt-3 font-semibold">No open tasks in this category yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Try another category or check back soon. New work appears here when it is ready to accept.</p>
            </section>
          ) : (
            <section aria-label="Open freelance tasks" className="mt-4 space-y-3">
              {visibleTasks.map((task) => {
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
                            {submissionStatus(existingSubmission.status)}
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
          )}
        </section>

        <section className="mt-9 border-t border-border pt-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your activity</p><h2 className="mt-1 font-serif text-2xl">Submission history</h2></div>
            <p className="text-xs text-muted-foreground">Review decisions and reward status</p>
          </div>
          {submissionsLoading ? (
            <div className="mt-4 space-y-2" aria-label="Loading submissions">{[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl border border-border bg-card" />)}</div>
          ) : submissionsError ? (
            <p role="alert" className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Your submissions could not be loaded just now.</p>
          ) : (submissions?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card/60 p-5">
              <p className="text-sm font-medium">Nothing submitted yet</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Once you send work for review, its status and reward will be recorded here.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {submissions?.map((submission) => (
                <div key={submission.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5" data-testid={`submission-${submission.id}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5">{submission.taskTitle}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Submitted {new Date(submission.submittedAt).toLocaleString()}{submission.attachmentName ? ` · ${submission.attachmentName}` : ""}</p>
                    {submission.reviewNote && <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">Review note: {submission.reviewNote}</p>}
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                    <p className="text-sm font-semibold">${submission.reward.toFixed(2)}</p>
                    <Badge variant="outline" className={`whitespace-nowrap text-[10px] ${submission.status === "approved" ? "border-primary/25 bg-primary/5 text-primary" : submission.status === "rejected" ? "border-destructive/25 bg-destructive/5 text-destructive" : ""}`}>{submissionStatus(submission.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && resetDialog()}>
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
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedTask.instructions || selectedTask.description}</p>
              </div>
              {selectedTask.assetUrl && (
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold"><AudioLines className="h-4 w-4 text-primary" />Task audio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Listen to the full clip and transcribe it using the task instructions.</p>
                  <audio controls preload="none" src={publicAssetUrl(selectedTask.assetUrl)} className="mt-3 w-full" aria-label={`Audio for ${selectedTask.title}`}>
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm">
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Wallet reward after approval</span>
                <strong className="text-primary">${selectedTask.reward.toFixed(2)}</strong>
              </div>
              <div>
                <label htmlFor="written-work" className="text-sm font-medium">Written response</label>
                <Textarea
                  id="written-work"
                  className="mt-2 min-h-36"
                  maxLength={50_000}
                  value={writtenWork}
                  onChange={(event) => setWrittenWork(event.target.value)}
                  placeholder="Explain your work, include the requested analysis, and address each quality check. At least 50 characters when no file is attached."
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">{writtenWork.length.toLocaleString()} / 50,000</p>
              </div>
              <div>
                <label htmlFor="work-attachment" className="text-sm font-medium">Optional work file · 10 MB maximum</label>
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-border p-3">
                  <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    id="work-attachment"
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.mp3,.wav"
                    className="min-w-0 flex-1 text-xs"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </div>
                {selectedFile && <p className="mt-2 text-xs text-muted-foreground">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={resetDialog} disabled={pending}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={pending || (!writtenWork.trim() && !selectedFile)}>
                  {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading and submitting…</> : "Submit for review"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
