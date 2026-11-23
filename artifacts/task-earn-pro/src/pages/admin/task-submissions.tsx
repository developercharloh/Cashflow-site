import { useState } from "react";
import {
  getAdminGetTaskSubmissionsQueryKey,
  useAdminGetTaskSubmissions,
  useAdminReviewTaskSubmission,
} from "@workspace/api-client-react";
import type { AdminTaskSubmission } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

const STATUSES = ["submitted", "approved", "rejected", "all"] as const;

function messageFor(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

export default function AdminTaskSubmissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("submitted");
  const [selected, setSelected] = useState<AdminTaskSubmission | null>(null);
  const [decision, setDecision] = useState<"approved" | "rejected">("approved");
  const [note, setNote] = useState("");
  const { data: submissions, isLoading, isError, refetch } = useAdminGetTaskSubmissions(
    { status },
    { query: { queryKey: getAdminGetTaskSubmissionsQueryKey({ status }) } },
  );
  const reviewMutation = useAdminReviewTaskSubmission();

  const close = () => {
    setSelected(null);
    setNote("");
  };

  const handleReview = () => {
    if (!selected || note.trim().length < 3) return;
    reviewMutation.mutate(
      { id: selected.id, data: { decision, note: note.trim() } },
      {
        onSuccess: () => {
          toast({
            title: decision === "approved" ? "Work approved" : "Work rejected",
            description: decision === "approved" ? `$${selected.reward.toFixed(2)} was credited to the worker's wallet.` : "The worker has been notified with your review note.",
          });
          void queryClient.invalidateQueries({ queryKey: getAdminGetTaskSubmissionsQueryKey() });
          close();
        },
        onError: (error) => toast({ title: "Review failed", description: messageFor(error), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Work review</h1>
        <p className="mt-1 text-muted-foreground">Review written responses before paying the platform-funded reward.</p>
      </header>

      <nav aria-label="Filter submissions" className="flex flex-wrap gap-2">
        {STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            aria-pressed={status === item}
            className={`rounded-full border px-3 py-2 text-xs font-medium capitalize ${status === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/50"}`}
          >
            {item === "submitted" ? "Needs review" : item}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : isError ? (
        <div role="alert" className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="font-semibold">The review queue could not be loaded.</p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button>
        </div>
      ) : !submissions?.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-7 text-center text-sm text-muted-foreground">No submissions in this view.</div>
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => {
            const hasUnavailableAttachment = Boolean(submission.attachmentName);
            return (
              <Card key={submission.id} data-testid={`submission-${submission.id}`}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-serif text-xl">{submission.taskTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{submission.userName} · {submission.userEmail} · {new Date(submission.submittedAt).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{submission.status}</Badge>
                      <strong className="text-green-600">${submission.reward.toFixed(2)}</strong>
                    </div>
                  </div>
                  {submission.textSubmission && (
                    <div className="mt-4 max-h-52 overflow-y-auto rounded-xl border border-border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap">{submission.textSubmission}</div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {submission.attachmentName && (
                        <p className="text-xs text-muted-foreground">
                          Previous attachment retained in the record: {submission.attachmentName} · file access is paused
                        </p>
                      )}
                      {submission.reviewNote && <p className="text-xs text-muted-foreground">Review: {submission.reviewNote}</p>}
                    </div>
                    {submission.status === "submitted" && (
                      <div className="flex gap-2">
                        {hasUnavailableAttachment ? (
                          <p className="text-xs text-amber-700">Review is paused until this attachment is accessible.</p>
                        ) : (
                          <>
                            <Button size="sm" onClick={() => { setSelected(submission); setDecision("approved"); setNote(""); }}>
                              <CheckCircle className="mr-1.5 h-4 w-4" />Approve and pay
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-500" onClick={() => { setSelected(submission); setDecision("rejected"); setNote(""); }}>
                              <XCircle className="mr-1.5 h-4 w-4" />Reject
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{decision === "approved" ? "Approve submission and pay reward?" : "Reject this submission?"}</DialogTitle>
            <DialogDescription>
              {decision === "approved"
                ? `Approving adds $${selected?.reward.toFixed(2)} to ${selected?.userName}'s wallet.`
                : "The worker will receive your review note. No reward will be paid."}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label htmlFor="review-note" className="text-sm font-medium">Review note</label>
            <Textarea id="review-note" className="mt-2" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={decision === "approved" ? "Briefly note why the submission meets the task criteria." : "Explain what requirement was not met."} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={reviewMutation.isPending}>Cancel</Button>
            <Button variant={decision === "rejected" ? "destructive" : "default"} onClick={handleReview} disabled={reviewMutation.isPending || note.trim().length < 3}>
              {reviewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {decision === "approved" ? "Approve and credit wallet" : "Reject and notify"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
