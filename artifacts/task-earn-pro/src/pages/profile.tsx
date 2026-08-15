import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetKycStatus } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ShieldX, ShieldAlert, Shield,
  Loader2, User, Mail, Star, CheckCircle, ArrowRight, RefreshCw,
} from "lucide-react";

const KYC_CONFIG: Record<string, { label: string; icon: React.ReactNode; class: string; desc: string }> = {
  none:     { label: "Not Verified",  icon: <Shield      className="w-5 h-5" />, class: "bg-muted text-muted-foreground border-border", desc: "Complete identity verification to unlock withdrawals." },
  pending:  { label: "Under Review",  icon: <ShieldAlert className="w-5 h-5" />, class: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800", desc: "Your verification is being reviewed. Withdrawals are unlocked once approved." },
  approved: { label: "Verified ✓",   icon: <ShieldCheck className="w-5 h-5" />, class: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800", desc: "Your identity is verified. Withdrawals are fully enabled." },
  rejected: { label: "Rejected",      icon: <ShieldX     className="w-5 h-5" />, class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",                desc: "Verification failed. Please try again with a valid ID." },
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: kyc, isLoading: kycLoading, refetch } = useGetKycStatus({
    query: { queryKey: ["kycStatus"], enabled: !!user },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kyc") === "done") {
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => refetch(), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kycStatus = kyc?.kycStatus ?? "none";
  const kycInfo = KYC_CONFIG[kycStatus] ?? KYC_CONFIG.none;

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
          <p className="text-xs text-muted-foreground mt-0.5">Required for withdrawals · Powered by Didit</p>
        </div>
        <div className="p-4 space-y-4">
          {kycLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking status…
            </div>
          ) : (
            <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-semibold ${kycInfo.class}`}>
              {kycInfo.icon}
              {kycInfo.label}
            </div>
          )}

          <p className="text-xs text-muted-foreground">{kycInfo.desc}</p>

          {/* Show submission summary if available */}
          {(kyc as any)?.submission && kycStatus !== "none" && (
            <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5">
              <p className="text-xs font-semibold">Submitted Details</p>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{(kyc as any).submission.fullName}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Country</span>
                <span className="font-medium">{(kyc as any).submission.country}</span>
              </div>
              {(kyc as any).submission.faceMatchScore != null && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Face Match</span>
                  <span className="font-medium text-emerald-600">{((kyc as any).submission.faceMatchScore * 100).toFixed(1)}%</span>
                </div>
              )}
              {(kyc as any).submission.rejectionReason && (
                <div className="text-xs text-destructive mt-1">Reason: {(kyc as any).submission.rejectionReason}</div>
              )}
            </div>
          )}

          {/* CTA buttons */}
          {(kycStatus === "none" || kycStatus === "rejected") && (
            <Button className="w-full" onClick={() => setLocation("/kyc")}>
              <ArrowRight className="w-4 h-4 mr-2" />
              {kycStatus === "rejected" ? "Try Again" : "Verify My Identity"}
            </Button>
          )}
          {kycStatus === "pending" && (
            <Button variant="outline" className="w-full" onClick={() => refetch()} disabled={kycLoading}>
              {kycLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Refreshing…</> : <><RefreshCw className="w-4 h-4 mr-2" />Refresh Status</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
