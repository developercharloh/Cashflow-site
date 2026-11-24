import { useGetKycStatus } from "@workspace/api-client-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Clock3, Loader2, User, Mail, Star, CheckCircle,
} from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const { data: kyc, isLoading: kycLoading } = useGetKycStatus({
    query: { queryKey: ["kycStatus"], enabled: !!user },
  });
  const isKycApproved = kyc?.kycStatus === "approved";
  const isKycUnderReview = (kyc?.kycStatus === "pending" && !!kyc?.submission) || kyc?.submission?.kycStatus === "pending_review";
  const needsCorrection = kyc?.kycStatus === "rejected" || kyc?.submission?.kycStatus === "resubmit_required";

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details and verification</p>
      </div>

      {/* Avatar + basic info */}
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold shrink-0">
          {user?.name?.charAt(0).toUpperCase() ?? "U"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">{user?.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Star className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-semibold">{user?.levelName ?? "Starter"}</span>
          </div>
        </div>
      </div>

      {/* Account details */}
      <div className="bg-card border border-border rounded-2xl divide-y divide-border">
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Full Name</p>
            <p className="text-sm font-semibold">{user?.name ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Email Address</p>
            <p className="text-sm font-semibold">{user?.email ?? "—"}</p>
          </div>
          {user?.isEmailVerified && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Star className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Member Level</p>
            <p className="text-sm font-semibold">{user?.levelName ?? "Starter"}</p>
          </div>
        </div>
      </div>

      {/* Identity Verification */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="font-bold text-sm">Identity Verification</p>
          <p className="text-xs text-muted-foreground mt-0.5">Required before requesting a withdrawal</p>
        </div>
        <div className="p-4 space-y-4">
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-semibold ${
            isKycApproved
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
              : isKycUnderReview
                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800"
                : needsCorrection
                  ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
                  : "bg-muted text-muted-foreground border-border"
          }`}>
            {kycLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isKycApproved
                ? <ShieldCheck className="w-4 h-4" />
                : isKycUnderReview ? <Clock3 className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            {kycLoading ? "Checking status…" : isKycApproved ? "Verified" : isKycUnderReview ? "Under review" : needsCorrection ? "Update needed" : "Not verified"}
          </div>
          <p className="text-xs text-muted-foreground">
            {isKycApproved
              ? "Your identity is verified. Withdrawals remain available."
              : isKycUnderReview
                ? "Your identity check is under review. The status will update here."
                : "Complete identity verification to request a withdrawal."}
          </p>
          {!isKycApproved && (
            <Link href="/kyc">
              <Button variant="outline" className="w-full">
                {isKycUnderReview ? "View status" : needsCorrection ? "Update details" : "Complete verification"}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
