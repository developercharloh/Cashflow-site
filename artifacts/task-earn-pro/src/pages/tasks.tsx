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
import { AudioLines, BookOpenCheck, FileSpreadsheet, FileText, Loader2, Upload, Wallet } from "lucide-react";

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
  const { data: submissions } = useGetMyWorkSubmissions();
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
    <div className="px-4 pb-10 pt-8 sm:px-7 sm:pt-12">
      <header className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary">Expert freelance work</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Choose a task. Submit real work.</h1>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Only Academic Writing, Data Entry, Transcription, and AI Training listings appear here. Every listing has a fixed reward and capped platform-funded payout. An admin reviews work before approving a wallet reward; the budget cap is not an escrow transfer.
        </p>
      </header>

      <nav aria-label="Filter task category" className="mt-7 flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            aria-pressed={category === item}
            className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      {category === "Academic Writing" && (
        <p className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-xs leading-5 text-muted-foreground">
          Academic writing work is limited to ethical support such as proofreading, citation formatting, and research organization—not completing graded work.
        </p>
      )}

      {isLoading ? (
        <div className="mt-8 flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : isError ? (
        <section role="alert" className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-semibold">Work listings could not be loaded.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button>
        </section>
      ) : visibleTasks.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-border bg-card/50 p-7 text-center">
          <h2 className="font-semibold">No open tasks in this category yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">New listings appear here after an admin publishes them with a reward budget and a completion limit.</p>
        </section>
      ) : (
        <section aria-label="Open freelance tasks" className="mt-6 grid gap-3 md:grid-cols-2">
          {visibleTasks.map((task) => {
            const Icon = CATEGORY_ICONS[task.category as keyof typeof CATEGORY_ICONS] ?? FileText;
            const existingSubmission = activeSubmissionByTask.get(task.id);
            return (
              <Card key={task.id} className="overflow-hidden border-border transition-colors hover:border-primary/35" data-testid={`task-card-${task.id}`}>
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Icon className="h-5 w-5" /></div>
                    <Badge variant="outline" className="capitalize text-[10px]">{task.difficulty} · Level {task.minLevel}+</Badge>
                  </div>
                  <p className="mt-5 font-mono text-[9px] uppercase tracking-[.16em] text-primary">{task.category}</p>
                  <h2 className="mt-2 font-serif text-2xl leading-tight">{task.title}</h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{task.description}</p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-green-600"><Wallet className="h-3.5 w-3.5" />${task.reward.toFixed(2)} on approval</span>
                    <span>{task.estimatedMinutes} min estimate</span>
                    <span>Up to {task.maxCompletions} workers</span>
                  </div>
                  {existingSubmission ? (
                    <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs font-medium">
                      {submissionStatus(existingSubmission.status)}
                    </div>
                  ) : (
                    <Button className="mt-4 w-full" onClick={() => setSelectedTask(task)} data-testid={`button-open-task-${task.id}`}>
                      View instructions and submit
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section className="mt-9">
        <h2 className="font-serif text-2xl">Your submissions</h2>
        {(submissions?.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Submitted work and review decisions will show here.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {submissions?.map((submission) => (
              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                <div>
                  <p className="text-sm font-semibold">{submission.taskTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(submission.submittedAt).toLocaleString()}</p>
                  {submission.reviewNote && <p className="mt-2 max-w-2xl text-xs text-muted-foreground">Review note: {submission.reviewNote}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${submission.reward.toFixed(2)}</p>
                  <Badge variant="outline" className="mt-1">{submissionStatus(submission.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">{selectedTask.category} · {selectedTask.difficulty} · Level {selectedTask.minLevel}+</p>
                <DialogTitle className="font-serif text-2xl">{selectedTask.title}</DialogTitle>
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
                <span>Reward after admin approval</span>
                <strong className="text-green-600">${selectedTask.reward.toFixed(2)}</strong>
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
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
