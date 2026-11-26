import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAdminGetTaskBidsQueryKey,
  getAdminGetTasksQueryKey,
  useAdminGetTaskBids,
  useAdminGetTasks,
  useAdminReviewTaskBid,
} from "@workspace/api-client-react";
import type { AdminTaskBid } from "@workspace/api-client-react";
import { AlertCircle, Check, Clock3, Loader2, ShieldCheck, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Decision = "assign" | "reject";
type Filter = "pending" | "all";

function errorMessage(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function AdminTaskBidsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const bidsQuery = useAdminGetTaskBids();
  const tasksQuery = useAdminGetTasks();
  const review = useAdminReviewTaskBid();
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<AdminTaskBid | null>(null);
  const [decision, setDecision] = useState<Decision>("assign");
  const [note, setNote] = useState("");

  const bids = bidsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const allocatedByTask = useMemo(() => {
    const assignedOrSubmitted = new Map<number, number>();
    const completedBids = new Map<number, number>();
    for (const bid of bids) {
      if (["assigned", "submitted"].includes(bid.status)) {
        assignedOrSubmitted.set(bid.taskId, (assignedOrSubmitted.get(bid.taskId) ?? 0) + 1);
      }
      if (bid.status === "completed") {
        completedBids.set(bid.taskId, (completedBids.get(bid.taskId) ?? 0) + 1);
      }
    }
    return new Map(tasks.map((task) => [
      task.id,
      Math.max(task.completionCount ?? 0, completedBids.get(task.id) ?? 0) + (assignedOrSubmitted.get(task.id) ?? 0),
    ]));
  }, [bids, tasks]);
  const visible = useMemo(() => bids.filter((bid) => filter === "all" || bid.status === "pending"), [bids, filter]);

  const fundedPlaces = (bid: AdminTaskBid) => {
    const task = taskById.get(bid.taskId);
    if (!task || task.reward <= 0) return 0;
    return Math.min(task.maxCompletions, Math.floor((task.fundingBudget + 0.000001) / task.reward));
  };
  const remainingPlaces = (bid: AdminTaskBid) => Math.max(0, fundedPlaces(bid) - (allocatedByTask.get(bid.taskId) ?? 0));

  const startReview = (bid: AdminTaskBid, nextDecision: Decision) => {
    setSelected(bid);
    setDecision(nextDecision);
    setNote("");
  };
  const closeReview = () => {
    if (review.isPending) return;
    setSelected(null);
    setNote("");
  };
  const confirmReview = () => {
    if (!selected) return;
    const task = taskById.get(selected.taskId);
    if (decision === "assign" && (!task || !task.isActive || remainingPlaces(selected) < 1)) {
      toast({ title: "No funded places remain", description: "This task cannot be assigned beyond its funded place limit.", variant: "destructive" });
      return;
    }
    review.mutate({ id: selected.id, data: { decision, note: note.trim() || undefined } }, {
      onSuccess: async () => {
        toast({ title: decision === "assign" ? "Task place assigned" : "Bid declined", description: decision === "assign" ? "The worker can now begin their task." : "The worker's bid has been declined." });
        setSelected(null);
        setNote("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getAdminGetTaskBidsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getAdminGetTasksQueryKey() }),
        ]);
      },
      onError: (error) => toast({ title: "Bid decision could not be saved", description: errorMessage(error), variant: "destructive" }),
    });
  };

  return (
    <div className="px-4 pb-12 pt-6 sm:px-7 sm:pt-9">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[1.5rem] border border-border bg-card p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Admin / workforce</p><h1 className="mt-2 font-serif text-4xl leading-none sm:text-5xl">Task bids</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Assign a worker only when an active task has a funded place available. Assignment starts their deadline.</p></div>
            <div className="flex items-center gap-2 self-start rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary sm:self-auto"><ShieldCheck className="h-4 w-4" />Funded-place guard</div>
          </div>
        </header>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-2" role="tablist" aria-label="Filter task bids">
            {(["pending", "all"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`min-h-10 rounded-full border px-4 text-xs font-semibold transition-colors ${filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"}`} data-testid={`filter-bids-${value}`}>{value === "pending" ? "Needs a decision" : "All bids"}</button>)}
          </div>
          {!bidsQuery.isLoading && !bidsQuery.isError && <span className="text-xs text-muted-foreground">{visible.length} {visible.length === 1 ? "bid" : "bids"}</span>}
        </div>

        {bidsQuery.isLoading || tasksQuery.isLoading ? (
          <div className="mt-4 space-y-3" aria-label="Loading task bids">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-border bg-card" />)}</div>
        ) : bidsQuery.isError || tasksQuery.isError ? (
          <section role="alert" className="mt-4 rounded-2xl border border-border bg-card p-6 text-center"><AlertCircle className="mx-auto h-6 w-6 text-destructive" /><h2 className="mt-2 font-semibold">Bid queue could not be loaded.</h2><p className="mt-1 text-sm text-muted-foreground">Review data is unchanged. Try again.</p><Button variant="outline" className="mt-4" onClick={() => { void bidsQuery.refetch(); void tasksQuery.refetch(); }}>Try again</Button></section>
        ) : visible.length === 0 ? (
          <section className="mt-4 rounded-2xl border border-dashed border-border bg-card/70 px-5 py-10 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><Check className="h-5 w-5" /></span><h2 className="mt-3 font-semibold">{filter === "pending" ? "Nothing needs a decision." : "No task bids yet."}</h2><p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{filter === "pending" ? "New worker requests will appear here." : "Worker bids will be listed here as they arrive."}</p></section>
        ) : (
          <section className="mt-4 space-y-3" aria-label="Task bids">
            {visible.map((bid) => {
              const places = fundedPlaces(bid);
              const remaining = remainingPlaces(bid);
              const canAssign = bid.status === "pending" && remaining > 0 && !!taskById.get(bid.taskId)?.isActive;
              return <article key={bid.id} className="rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid={`admin-task-bid-${bid.id}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="text-[10px]">{bid.category}</Badge><Badge variant="outline" className={bid.status === "assigned" || bid.status === "completed" ? "border-primary/25 bg-primary/5 text-primary" : ""}>{bid.status}</Badge></div>
                    <h2 className="mt-2 font-serif text-xl leading-tight">{bid.taskTitle}</h2>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p className="flex items-center gap-2"><UserRound className="h-3.5 w-3.5" /><span className="font-semibold text-foreground">{bid.userName}</span><span className="truncate">{bid.userEmail}</span></p>
                      <p className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" />Bid {new Date(bid.bidAt).toLocaleString()}</p>
                      <p>Reward <strong className="font-mono text-foreground">{money(bid.reward)}</strong> · {bid.deadlineHours}h after assignment</p>
                      <p>Funded places <strong className="font-mono text-foreground">{remaining} remaining</strong> of {places}</p>
                    </div>
                    {bid.deadlineAt && <p className="mt-2 text-xs text-muted-foreground">Assigned deadline: {new Date(bid.deadlineAt).toLocaleString()}</p>}
                    {bid.reviewNote && <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Note: {bid.reviewNote}</p>}
                    {bid.status === "pending" && remaining === 0 && <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-800"><AlertCircle className="h-3.5 w-3.5" />No funded places remain for this task.</p>}
                  </div>
                  {bid.status === "pending" && <div className="flex shrink-0 gap-2 sm:flex-col">
                    <Button className="min-h-10 flex-1 gap-2 sm:w-36" disabled={!canAssign || review.isPending} onClick={() => startReview(bid, "assign")} data-testid={`button-assign-bid-${bid.id}`}><Check className="h-4 w-4" />Assign</Button>
                    <Button variant="outline" className="min-h-10 flex-1 gap-2 sm:w-36" disabled={review.isPending} onClick={() => startReview(bid, "reject")} data-testid={`button-decline-bid-${bid.id}`}><X className="h-4 w-4" />Decline</Button>
                  </div>}
                </div>
              </article>;
            })}
          </section>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeReview()}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>{decision === "assign" ? "Assign this task place?" : "Decline this bid?"}</DialogTitle><DialogDescription>{decision === "assign" ? "The worker will be able to begin work and their submission deadline starts on assignment." : "The worker will see that their request was declined."}</DialogDescription></DialogHeader>
          {selected && <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm"><p className="font-semibold">{selected.taskTitle}</p><p className="mt-1 text-xs text-muted-foreground">{selected.userName} · {selected.userEmail}</p>{decision === "assign" && <p className="mt-2 text-xs text-primary">{remainingPlaces(selected)} funded {remainingPlaces(selected) === 1 ? "place" : "places"} remaining</p>}</div>}
          <div><label htmlFor="review-note" className="text-sm font-medium">Note to worker <span className="text-muted-foreground">(optional)</span></label><Textarea id="review-note" className="mt-2 min-h-24" maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a brief note if helpful." /></div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={closeReview} disabled={review.isPending}>Cancel</Button><Button variant={decision === "reject" ? "destructive" : "default"} onClick={confirmReview} disabled={review.isPending || (decision === "assign" && (!selected || remainingPlaces(selected) < 1))}>{review.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : decision === "assign" ? "Confirm assignment" : "Confirm decline"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
