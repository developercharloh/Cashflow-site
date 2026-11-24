import { useEffect, useState } from "react";
import { getKycSubmissionDocument, useGetKycSubmissions, useReviewKycSubmission } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, ShieldX, Shield, ShieldAlert, Loader2,
  Search, ChevronDown, ChevronUp, CheckCircle, XCircle, RefreshCw, FileImage, X,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  pending_submission: { label: "Not Submitted", icon: <Shield className="w-3.5 h-3.5" />, class: "bg-muted text-muted-foreground border-border" },
  pending_review:    { label: "Pending Review", icon: <ShieldAlert className="w-3.5 h-3.5" />, class: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400" },
  approved:          { label: "Approved", icon: <ShieldCheck className="w-3.5 h-3.5" />, class: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400" },
  rejected:          { label: "Rejected", icon: <ShieldX className="w-3.5 h-3.5" />, class: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400" },
  resubmit_required: { label: "Resubmit", icon: <RefreshCw className="w-3.5 h-3.5" />, class: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400" },
};

export default function AdminKycPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const [loadingDocument, setLoadingDocument] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  const { data: submissions, isLoading, refetch } = useGetKycSubmissions({
    query: { queryKey: ["kycSubmissions"] },
  });

  const reviewMutation = useReviewKycSubmission();

  const openDocument = async (id: number, side: "front" | "back" | "selfie") => {
    const key = `${id}:${side}`;
    setLoadingDocument(key);
    try {
      const file = await getKycSubmissionDocument(id, side);
      const sideLabel = side === "selfie" ? "Selfie" : side === "front" ? "Front" : "Back";
      setPreview({ url: URL.createObjectURL(file), label: `${sideLabel} identity image` });
    } catch (error) {
      const detail = (error as { data?: { error?: string }; message?: string }).data?.error
        ?? (error as { message?: string }).message
        ?? "The private document could not be opened.";
      toast({ title: "Document unavailable", description: detail, variant: "destructive" });
    } finally {
      setLoadingDocument(null);
    }
  };

  const filtered = (submissions ?? []).filter(s => {
    const matchSearch = !search || [s.userEmail, s.userName, s.fullName, s.nationalId]
      .some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = statusFilter === "all" || s.kycStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleReview = (id: number, action: "approve" | "reject" | "resubmit", reason?: string) => {
    setActionId(id);
    reviewMutation.mutate({ id, data: { action, rejectionReason: reason } }, {
      onSuccess: () => {
        toast({ title: action === "approve" ? "Approved ✓" : action === "reject" ? "Rejected" : "Resubmission Requested" });
        setExpanded(null);
        setRejectReason("");
        setActionId(null);
        refetch();
      },
      onError: (err: any) => {
        toast({ title: "Error", description: err.data?.error ?? "Action failed", variant: "destructive" });
        setActionId(null);
      },
    });
  };

  const counts = {
    all: (submissions ?? []).length,
    pending_review: (submissions ?? []).filter(s => s.kycStatus === "pending_review").length,
    approved: (submissions ?? []).filter(s => s.kycStatus === "approved").length,
    rejected: (submissions ?? []).filter(s => s.kycStatus === "rejected").length,
  };

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">KYC Management</h1>
        <p className="text-sm text-muted-foreground">Review and manage identity verifications</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", count: counts.pending_review, color: "text-yellow-600" },
          { label: "Approved", count: counts.approved, color: "text-emerald-600" },
          { label: "Rejected", count: counts.rejected, color: "text-red-500" },
        ].map(c => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.count}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-8 h-9" placeholder="Search name, email, ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="all">All ({counts.all})</option>
          <option value="pending_review">Pending ({counts.pending_review})</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="resubmit_required">Resubmit</option>
        </select>
      </div>

      {/* Submissions list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No KYC submissions found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(sub => {
            const cfg = STATUS_CONFIG[sub.kycStatus] ?? STATUS_CONFIG.pending_submission;
            const isExpanded = expanded === sub.id;
            return (
              <div key={sub.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => { setExpanded(isExpanded ? null : sub.id); setRejectReason(""); }}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0">
                    {sub.userName?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{sub.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">{sub.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${cfg.class}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ["Full Name", sub.fullName],
                        ["Date of Birth", sub.dateOfBirth],
                        ["Issuing Country", sub.country],
                        ["Nationality", sub.nationality ?? "—"],
                        ["Phone", sub.phoneNumber],
                        ["Document Number", sub.nationalId],
                        ["Face Match", sub.faceMatchScore != null ? `${(sub.faceMatchScore * 100).toFixed(1)}%` : "—"],
                        ["Submitted", sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : "—"],
                        ["Document Type", ({
                          alien_id: "Alien ID card",
                          national_id: "National ID",
                          passport: "Passport",
                          driving_license: "Driving License",
                        } as Record<string, string>)[sub.documentType ?? ""] ?? sub.documentType ?? "—"],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className="font-semibold truncate">{value}</p>
                        </div>
                      ))}
                    </div>

                    {(sub.frontIdPath || sub.backIdPath || sub.selfieImagePath) && (
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <p className="mb-2 text-xs font-semibold">Private identity documents</p>
                        <div className="flex flex-wrap gap-2">
                          {sub.frontIdPath && (
                            <Button type="button" variant="outline" size="sm" disabled={loadingDocument === `${sub.id}:front`} onClick={() => openDocument(sub.id, "front")}>
                              {loadingDocument === `${sub.id}:front` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                              View front image
                            </Button>
                          )}
                          {sub.backIdPath && (
                            <Button type="button" variant="outline" size="sm" disabled={loadingDocument === `${sub.id}:back`} onClick={() => openDocument(sub.id, "back")}>
                              {loadingDocument === `${sub.id}:back` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                              View back image
                            </Button>
                          )}
                          {sub.selfieImagePath && (
                            <Button type="button" variant="outline" size="sm" disabled={loadingDocument === `${sub.id}:selfie`} onClick={() => openDocument(sub.id, "selfie")}>
                              {loadingDocument === `${sub.id}:selfie` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                              View selfie
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {sub.rejectionReason && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                        <p className="text-xs font-semibold text-red-700 dark:text-red-400">Rejection Reason</p>
                        <p className="text-xs text-red-700 dark:text-red-400 mt-1">{sub.rejectionReason}</p>
                      </div>
                    )}

                    {/* Admin actions */}
                    {sub.kycStatus === "pending_review" && (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                            disabled={reviewMutation.isPending && actionId === sub.id}
                            onClick={() => handleReview(sub.id, "approve")}
                          >
                            {reviewMutation.isPending && actionId === sub.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            disabled={!rejectReason.trim() || (reviewMutation.isPending && actionId === sub.id)}
                            onClick={() => handleReview(sub.id, "resubmit", rejectReason)}
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />Request Update
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Reason (required for rejection or update request)"
                            value={expanded === sub.id ? rejectReason : ""}
                            maxLength={500}
                            onChange={e => setRejectReason(e.target.value)}
                            className="flex-1 h-8 text-sm"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={!rejectReason.trim() || (reviewMutation.isPending && actionId === sub.id)}
                            onClick={() => handleReview(sub.id, "reject", rejectReason)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                          </Button>
                        </div>
                      </div>
                    )}

                    {sub.kycStatus === "approved" && (
                      <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                        <ShieldCheck className="w-4 h-4" /> Identity Verified
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={preview.label} onClick={() => setPreview(null)}>
          <div className="relative max-h-full w-full max-w-3xl rounded-2xl bg-card p-3 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{preview.label}</p>
              <Button type="button" variant="ghost" size="icon" aria-label="Close image preview" onClick={() => setPreview(null)}><X className="h-4 w-4" /></Button>
            </div>
            <img src={preview.url} alt={preview.label} className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
