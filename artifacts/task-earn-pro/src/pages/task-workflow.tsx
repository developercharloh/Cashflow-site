import { useMemo, useState } from "react";
import { upload as uploadBlob } from "@vercel/blob/client";
import {
  getGetMyTaskBidsQueryKey,
  getGetMyWorkSubmissionsQueryKey,
  getGetTasksQueryKey,
  useGetTaskPackageInfo,
  useGetMyTaskBids,
  useGetMyWorkSubmissions,
  useGetTasks,
  useRequestTaskSubmissionUpload,
  useSubmitTaskBid,
  useSubmitWrittenTask,
} from "@workspace/api-client-react";
import type { MyTaskBid, Task } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AudioLines, BookOpenCheck, ChevronRight, Clock3, FileCheck2, FileSpreadsheet, FileText, Loader2, LockKeyhole, ShieldCheck, Upload, UsersRound, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const CATEGORIES = ["Academic Writing", "Data Entry", "Transcription", "AI Training"] as const;
const CATEGORY_ICONS = {
  "Academic Writing": BookOpenCheck,
  "Data Entry": FileSpreadsheet,
  Transcription: AudioLines,
  "AI Training": FileText,
};
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function errorMessage(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

function publicAssetUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;
}

function deadlinePassed(bid: MyTaskBid) {
  return bid.status === "expired" || (bid.status === "assigned" && !!bid.deadlineAt && new Date(bid.deadlineAt).getTime() <= Date.now());
}

function statusLabel(bid: MyTaskBid) {
  if (deadlinePassed(bid)) return "Expired";
  return {
    pending: "Pending",
    assigned: "Assigned",
    submitted: "Submitted",
    completed: "Completed",
    rejected: "Declined",
    expired: "Expired",
  }[bid.status] ?? bid.status;
}

function statusStyle(bid: MyTaskBid) {
  if (deadlinePassed(bid)) return "border-amber-700/25 bg-amber-700/5 text-amber-800";
  return bid.status === "assigned" ? "border-primary/25 bg-primary/5 text-primary" :
    bid.status === "completed" ? "border-primary/25 bg-primary/5 text-primary" :
    bid.status === "rejected" ? "border-destructive/25 bg-destructive/5 text-destructive" : "";
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
  const tasksQuery = useGetTasks();
  const bidsQuery = useGetMyTaskBids({ query: { queryKey: getGetMyTaskBidsQueryKey(), refetchInterval: 30_000 } });
  const submissionsQuery = useGetMyWorkSubmissions();
  const packageQuery = useGetTaskPackageInfo();
  const bidMutation = useSubmitTaskBid();
  const uploadMutation = useRequestTaskSubmissionUpload();
  const submitMutation = useSubmitWrittenTask();
  const tasks = tasksQuery.data ?? [];
  const bids = bidsQuery.data ?? [];
  const hasTaskAccess = ["silver", "diamond", "legacy"].includes(packageQuery.data?.currentPackage ?? "free");
  const visibleTasks = useMemo(() => tasks.filter((task) => category === "All" || task.category === category), [tasks, category]);
  const bidByTask = useMemo(() => new Map(bids.map((bid) => [bid.taskId, bid])), [bids]);
  const activeBid = selectedTask ? bidByTask.get(selectedTask.id) : undefined;
  const pending = uploading || uploadMutation.isPending || submitMutation.isPending;

  const invalidateWorkflow = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetMyTaskBidsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetMyWorkSubmissionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetTasksQueryKey() }),
    ]);
  };
  const closeTask = () => {
    setSelectedTask(null);
    setWrittenWork("");
    setSelectedFile(null);
  };

  const requestBid = (task: Task) => {
    if (!hasTaskAccess) {
      toast({ title: "Choose a task package first", description: "A package is required before you can bid.", variant: "destructive" });
      return;
    }
    bidMutation.mutate({ id: task.id }, {
      onSuccess: async () => {
        toast({ title: "Task bid submitted. Check back later to see whether it was assigned to you." });
        await invalidateWorkflow();
      },
      onError: (error) => toast({ title: "Bid could not be submitted", description: errorMessage(error), variant: "destructive" }),
    });
  };

  const sendWork = (task: Task, attachment?: { path: string; name: string; contentType: string; size: number }) => {
    submitMutation.mutate({
      id: task.id,
      data: {
        textSubmission: writtenWork.trim() || undefined,
        attachmentPath: attachment?.path,
        attachmentName: attachment?.name,
        attachmentContentType: attachment?.contentType,
        attachmentSize: attachment?.size,
      },
    }, {
      onSuccess: async () => {
        setUploading(false);
        toast({ title: "Work submitted", description: "Your submission is recorded." });
        await invalidateWorkflow();
        closeTask();
      },
      onError: (error) => {
        setUploading(false);
        toast({ title: "Submission failed", description: errorMessage(error), variant: "destructive" });
      },
    });
  };

  const submitWork = () => {
    if (!selectedTask || activeBid?.status !== "assigned" || deadlinePassed(activeBid)) return;
    if (writtenWork.trim().length < 50 && !selectedFile) {
      toast({ title: "Add more work", description: "Write at least 50 characters or attach a work file.", variant: "destructive" });
      return;
    }
    if (!writtenWork.trim() && !selectedFile) {
      toast({ title: "Add your work", description: "Write a response or attach a file before submitting.", variant: "destructive" });
      return;
    }
    if (!selectedFile) {
      sendWork(selectedTask);
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast({ title: "File is too large", description: "Attachments must be 10 MB or smaller.", variant: "destructive" });
      return;
    }
    if (!selectedFile.type) {
      toast({ title: "Unsupported file", description: "Choose a supported file with a known content type.", variant: "destructive" });
      return;
    }
    setUploading(true);
    uploadMutation.mutate({
      data: { taskId: selectedTask.id, name: selectedFile.name, size: selectedFile.size, contentType: selectedFile.type },
    }, {
      onSuccess: async (upload) => {
        try {
          let path: string;
          if (upload.provider === "vercel") {
            if (!upload.objectPrefix) throw new Error("File storage is not configured.");
            const safeName = selectedFile.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 140);
            const blob = await uploadBlob(`${upload.objectPrefix}${crypto.randomUUID()}-${safeName}`, selectedFile, {
              access: "private",
              contentType: selectedFile.type,
              handleUploadUrl: "/api/tasks/work-submissions/upload-url",
              clientPayload: JSON.stringify({ taskId: selectedTask.id, name: selectedFile.name, size: selectedFile.size, contentType: selectedFile.type }),
              headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
            });
            path = `/objects/${blob.pathname}`;
          } else {
            if (!upload.uploadURL || !upload.objectPath) throw new Error("File storage returned an invalid upload link.");
            const response = await fetch(upload.uploadURL, { method: "PUT", headers: { "Content-Type": selectedFile.type }, body: selectedFile });
            if (!response.ok) throw new Error("File upload did not complete. Please retry.");
            path = upload.objectPath;
          }
          sendWork(selectedTask, { path, name: selectedFile.name, contentType: selectedFile.type, size: selectedFile.size });
        } catch (error) {
          setUploading(false);
          toast({ title: "File upload failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
        }
      },
      onError: (error) => {
        setUploading(false);
        toast({ title: "File upload failed", description: errorMessage(error), variant: "destructive" });
      },
    });
  };

  const myOpenWork = bids.filter((bid) => ["assigned", "pending"].includes(bid.status) || (bid.status === "assigned" && deadlinePassed(bid)));

  return (
    <div className="px-4 pb-10 pt-6 sm:px-7 sm:pt-9">
      <div className="mx-auto max-w-5xl">
        <header className="relative overflow-hidden rounded-[1.5rem] border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
          <div className="absolute right-0 top-0 h-36 w-36 translate-x-1/3 -translate-y-1/3 rounded-full border-[20px] border-accent/60 sm:h-52 sm:w-52 sm:border-[28px]" aria-hidden="true" />
          <div className="relative max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[.19em] text-primary">Lipwa Tasks / Work board</p>
            <h1 className="mt-3 max-w-xl font-serif text-[2.35rem] leading-[.98] tracking-tight sm:text-5xl">Find work worth doing.</h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Browse clear briefs across writing, data, transcription, and AI training. A bid is a request for a place—not permission to start work. Work begins only after assignment.</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-2 text-xs font-medium text-primary"><ShieldCheck className="h-4 w-4" />Reward and funded place limits are shown up front</div>
          </div>
        </header>

        {myOpenWork.length > 0 && (
          <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/[.035] p-4 sm:p-5" aria-label="Your task bids">
            <div className="flex items-end justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-primary">Your task places</p><h2 className="mt-1 font-serif text-2xl">Bids and assignments</h2></div><span className="text-xs text-muted-foreground">{myOpenWork.length} active</span></div>
            <div className="mt-3 space-y-2">
              {myOpenWork.map((bid) => {
                const expired = deadlinePassed(bid);
                return <article key={bid.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 sm:px-4" data-testid={`my-task-bid-${bid.id}`}>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{bid.taskTitle}</p><p className="mt-1 text-xs text-muted-foreground">{bid.status === "pending" ? "Waiting for an available place" : expired ? "The submission deadline has passed" : bid.status === "assigned" ? `Deadline: ${bid.deadlineAt ? new Date(bid.deadlineAt).toLocaleString() : `${bid.deadlineHours} hours after assignment`}` : "Your task place"}</p></div>
                  <div className="flex items-center gap-2"><Badge variant="outline" className={statusStyle(bid)}>{statusLabel(bid)}</Badge>{bid.status === "assigned" && !expired && <Button size="sm" onClick={() => setSelectedTask(tasks.find((task) => task.id === bid.taskId) ?? null)} disabled={!tasks.some((task) => task.id === bid.taskId)}>Open work</Button>}</div>
                </article>;
              })}
            </div>
          </section>
        )}

        <section className="mt-7" aria-label="Task discovery">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Browse opportunities</p><h2 className="mt-1 font-serif text-2xl sm:text-3xl">Available work</h2></div>
            {!tasksQuery.isLoading && !tasksQuery.isError && <p className="text-xs text-muted-foreground">{visibleTasks.length} {visibleTasks.length === 1 ? "listing" : "listings"}{category !== "All" ? ` · ${category}` : ""}</p>}
          </div>
          <nav aria-label="Filter task category" className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {(["All", ...CATEGORIES] as const).map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"}`} data-testid={`filter-category-${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</button>)}
          </nav>
          {category === "Academic Writing" && <p className="mt-3 rounded-xl border border-border bg-accent/35 px-4 py-3 text-xs leading-5 text-muted-foreground">Academic writing tasks include technical editing and research organization for engineering and computer science, as well as proofreading and citation work. They do not complete graded coursework.</p>}
          {tasksQuery.isLoading ? (
            <div className="mt-5 space-y-3" aria-label="Loading task listings">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-border bg-card/70" />)}</div>
          ) : tasksQuery.isError ? (
            <section role="alert" className="mt-5 rounded-2xl border border-border bg-card px-5 py-8 text-center"><p className="font-semibold">Work listings could not be loaded.</p><p className="mt-1 text-sm text-muted-foreground">Please try the board again.</p><Button variant="outline" className="mt-4" onClick={() => void tasksQuery.refetch()}>Try again</Button></section>
          ) : visibleTasks.length === 0 ? (
            <section className="mt-5 rounded-2xl border border-dashed border-border bg-card/60 px-5 py-9 text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><FileCheck2 className="h-5 w-5" /></div><h3 className="mt-3 font-semibold">No open tasks in this category yet</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Try another category or check back soon. New work appears when it is ready to accept.</p></section>
          ) : (
            <section aria-label="Task listings" className="mt-4 space-y-3">
              {visibleTasks.map((task) => {
                const Icon = CATEGORY_ICONS[task.category as keyof typeof CATEGORY_ICONS] ?? FileText;
                const bid = bidByTask.get(task.id);
                const expired = !!bid && deadlinePassed(bid);
                const unavailable = !!bid && ["pending", "assigned", "submitted", "completed", "rejected", "expired"].includes(bid.status);
                return <Card key={task.id} className="overflow-hidden border-border bg-card transition-colors hover:border-primary/35" data-testid={`task-card-${task.id}`}>
                  <CardContent className="p-4 sm:px-5 sm:py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/70 text-primary"><Icon className="h-[18px] w-[18px]" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="font-mono text-[9px] uppercase tracking-[.14em] text-primary">{task.category}</p><span className="text-border">/</span><span className="text-[10px] text-muted-foreground">Level {task.minLevel}+</span></div>
                        <h3 className="mt-1 font-serif text-xl leading-tight sm:text-[1.4rem]">{task.title}</h3>
                        <p className="mt-1.5 line-clamp-2 max-w-3xl text-[13px] leading-5 text-muted-foreground">{task.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/80 pt-3 text-[11px] text-muted-foreground sm:gap-x-5">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-primary"><Wallet className="h-3.5 w-3.5" />${task.reward.toFixed(2)} reward</span><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{task.estimatedMinutes} min</span><span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />Up to {task.maxCompletions} places</span>
                          {task.assetUrl && <span className="inline-flex items-center gap-1.5"><AudioLines className="h-3.5 w-3.5" />Audio included</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end sm:mt-2">
                      {unavailable ? <div className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-xs font-semibold sm:w-auto ${expired ? "bg-amber-700/5 text-amber-800" : "bg-muted text-foreground"}`}><FileCheck2 className="h-4 w-4" />{expired ? "Expired" : statusLabel(bid!)}</div> : <Button className="h-9 w-full gap-1.5 rounded-lg px-3 text-xs sm:w-auto" onClick={() => setSelectedTask(task)} data-testid={`button-open-task-${task.id}`}>Read task & bid <ChevronRight className="h-4 w-4" /></Button>}
                    </div>
                  </CardContent>
                </Card>;
              })}
            </section>
          )}
        </section>

        <section className="mt-9 border-t border-border pt-6">
          <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Your activity</p><h2 className="mt-1 font-serif text-2xl">Submission history</h2></div><p className="text-xs text-muted-foreground">Work you have sent</p></div>
          {submissionsQuery.isLoading ? <div className="mt-4 space-y-2" aria-label="Loading submissions">{[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl border border-border bg-card" />)}</div> : submissionsQuery.isError ? <p role="alert" className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Your submissions could not be loaded just now.</p> : (submissionsQuery.data?.length ?? 0) === 0 ? <div className="mt-4 rounded-xl border border-dashed border-border bg-card/60 p-5"><p className="text-sm font-medium">Nothing submitted yet</p><p className="mt-1 text-xs leading-5 text-muted-foreground">After assignment, submit your work before the deadline. Its status will appear here.</p></div> : <div className="mt-4 space-y-2">{submissionsQuery.data?.map((submission) => <article key={submission.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3.5" data-testid={`submission-${submission.id}`}><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-5">{submission.taskTitle}</p><p className="mt-1 text-[11px] text-muted-foreground">Sent {new Date(submission.submittedAt).toLocaleString()}{submission.attachmentName ? ` · ${submission.attachmentName}` : ""}</p>{submission.reviewNote && <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">Review note: {submission.reviewNote}</p>}</div><div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1"><p className="text-sm font-semibold">${submission.reward.toFixed(2)}</p><Badge variant="outline" className={submission.status === "approved" ? "border-primary/25 bg-primary/5 text-primary" : ""}>{submission.status === "approved" ? "Approved · reward credited" : submission.status === "submitted" ? "Submitted" : submission.status === "rejected" ? "Not approved" : submission.status}</Badge></div></article>)}</div>}
        </section>
      </div>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && closeTask()}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
          {selectedTask && <>
            <DialogHeader><p className="font-mono text-[9px] uppercase tracking-[.16em] text-primary">{selectedTask.category} · Level {selectedTask.minLevel}+</p><DialogTitle className="font-serif text-2xl leading-tight">{selectedTask.title}</DialogTitle><DialogDescription>{selectedTask.description}</DialogDescription></DialogHeader>
            <div className="rounded-xl border border-border bg-muted/40 p-4"><h3 className="text-sm font-semibold">Task instructions</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedTask.instructions || selectedTask.description}</p></div>
            {selectedTask.assetUrl && <div className="rounded-xl border border-border bg-muted/40 p-4"><h3 className="flex items-center gap-2 text-sm font-semibold"><AudioLines className="h-4 w-4 text-primary" />Task audio</h3><p className="mt-1 text-xs text-muted-foreground">Listen to the full clip and follow the task instructions.</p><audio controls preload="none" src={publicAssetUrl(selectedTask.assetUrl)} className="mt-3 w-full" aria-label={`Audio for ${selectedTask.title}`}>Your browser does not support audio playback.</audio></div>}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm"><span className="inline-flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" />Reward after work is accepted</span><strong className="text-primary">${selectedTask.reward.toFixed(2)}</strong></div>
             {!activeBid && (bidsQuery.isLoading || packageQuery.isLoading) ? (
              <div className="animate-pulse rounded-xl border border-border bg-muted/50 p-4"><div className="h-4 w-36 rounded bg-muted" /><div className="mt-3 h-10 rounded-lg bg-muted" /></div>
            ) : !activeBid && bidsQuery.isError ? (
              <div role="alert" className="rounded-xl border border-border bg-muted/40 p-4"><p className="text-sm font-semibold">Your task status could not be checked.</p><p className="mt-1 text-xs text-muted-foreground">We will not send another bid until your status is available.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void bidsQuery.refetch()}>Check again</Button></div>
             ) : !activeBid && packageQuery.isError ? (
               <div role="alert" className="rounded-xl border border-border bg-muted/40 p-4"><p className="text-sm font-semibold">Package access could not be checked.</p><p className="mt-1 text-xs text-muted-foreground">We will not send a bid until your access is confirmed.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void packageQuery.refetch()}>Check again</Button></div>
             ) : !activeBid && !hasTaskAccess ? (
               <div className="space-y-3 rounded-xl border border-accent bg-accent/30 p-4"><p className="text-sm font-semibold">A task package is needed to bid.</p><p className="text-xs leading-5 text-muted-foreground">Choose Silver or Diamond to unlock unlimited task bids. The package is charged once from your wallet.</p><Link href="/packages"><Button className="w-full">View task packages</Button></Link></div>
            ) : !activeBid ? (
               <div className="space-y-3"><div className="rounded-xl border border-border bg-muted/30 p-4 text-sm leading-5 text-muted-foreground"><LockKeyhole className="mb-2 h-4 w-4 text-primary" />A task place must be assigned to you before you can begin or submit work. This task has up to {selectedTask.maxCompletions} funded places.</div><Button className="w-full" onClick={() => requestBid(selectedTask)} disabled={bidMutation.isPending || !selectedTask.isActive}>{bidMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending bid…</> : "Bid for this task"}</Button></div>
            ) : activeBid.status === "assigned" && !deadlinePassed(activeBid) ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold text-primary">Assigned to you</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Submit within {activeBid.deadlineHours} hours. Deadline: {activeBid.deadlineAt ? new Date(activeBid.deadlineAt).toLocaleString() : `${activeBid.deadlineHours} hours after assignment`}.</p></div>
                <div><label htmlFor="written-work" className="text-sm font-medium">Written response</label><Textarea id="written-work" className="mt-2 min-h-36" maxLength={50000} value={writtenWork} onChange={(event) => setWrittenWork(event.target.value)} placeholder="Write your response or attach a work file."/><p className="mt-1 text-right text-[11px] text-muted-foreground">{writtenWork.length.toLocaleString()} / 50,000</p></div>
                <div><label htmlFor="work-attachment" className="text-sm font-medium">Optional work file · 10 MB maximum</label><div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-border p-3"><Upload className="h-4 w-4 shrink-0 text-muted-foreground" /><input id="work-attachment" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.jpg,.jpeg,.png,.mp3,.wav" className="min-w-0 flex-1 text-xs" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></div>{selectedFile && <p className="mt-2 text-xs text-muted-foreground">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>}</div>
                 <Button className="w-full" onClick={submitWork} disabled={pending || (writtenWork.trim().length < 50 && !selectedFile)}>{pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading and submitting…</> : "Submit completed work"}</Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-4"><div className="flex items-center gap-2"><Badge variant="outline" className={statusStyle(activeBid)}>{statusLabel(activeBid)}</Badge></div><p className="mt-2 text-sm leading-5 text-muted-foreground">{activeBid.status === "pending" ? "Your request is in. You can begin only if a task place is assigned to you." : deadlinePassed(activeBid) ? "The task deadline has passed. Work submission is closed." : activeBid.status === "rejected" ? activeBid.reviewNote || "This request was not selected for a task place." : activeBid.status === "submitted" ? "Your completed work has been received." : activeBid.status === "completed" ? "This task is complete." : activeBid.reviewNote || "This task place is no longer available."}</p>{activeBid.status === "assigned" && activeBid.deadlineAt && <p className="mt-2 text-xs text-muted-foreground">Deadline: {new Date(activeBid.deadlineAt).toLocaleString()}</p>}</div>
            )}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
