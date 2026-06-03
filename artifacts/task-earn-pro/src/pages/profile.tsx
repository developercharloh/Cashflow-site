import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGetKycStatus, useCreateKycSession } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, ShieldX, ShieldAlert, Shield,
  Loader2, User, Mail, Calendar, Star, CheckCircle, ExternalLink,
} from "lucide-react";

const KYC_CONFIG: Record<string, { label: string; icon: React.ReactNode; class: string; desc: string }> = {
  none:     { label: "Not Verified",   icon: <Shield      className="w-5 h-5" />, class: "bg-muted text-muted-foreground border-border",         desc: "Verify your identity to unlock higher withdrawal limits." },
  pending:  { label: "Under Review",   icon: <ShieldAlert className="w-5 h-5" />, class: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800", desc: "Your identity is being reviewed. This usually takes a few minutes." },
  approved: { label: "Verified ✓",     icon: <ShieldCheck className="w-5 h-5" />, class: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800", desc: "Your identity has been successfully verified." },
  rejected: { label: "Rejected",       icon: <ShieldX     className="w-5 h-5" />, class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",                 desc: "Verification failed. Please try again with a clear, valid ID." },
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [justReturned, setJustReturned] = useState(false);

  const { data: kyc, isLoading: kycLoading, refetch } = useGetKycStatus({
    query: { queryKey: ["kycStatus"], enabled: !!user },
  });
  const sessionMutation = useCreateKycSession();

  // If Didit redirected back with ?kyc=done, re-fetch status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kyc") === "done") {
      setJustReturned(true);
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => refetch(), 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const handleVerify = () => {
    sessionMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  };

  const kycStatus = kyc?.kycStatus ?? "none";
  const kycInfo = KYC_CONFIG[kycStatus] ?? KYC_CONFIG.none;
  const memberSince = user ? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) : null;

  return (
    <div className="px-4 pt-4 pb-24 space-y-5 max-w-lg mx-auto">
      {/* Header */}
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
          {user?.isEmailVerified && (
            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-3 p-4">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground">Member Level</p>
            <p className="text-sm font-semibold">{user?.levelName ?? "Starter"}</p>
          </div>
        </div>
      </div>

      {/* ── Identity Verification ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <p className="font-bold text-sm">Identity Verification</p>
          <p className="text-xs text-muted-foreground mt-0.5">Powered by Didit · Secure KYC</p>
        </div>

        <div className="p-4 space-y-4">
          {justReturned && kycStatus === "pending" && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-400">
              Thanks! We received your submission and are reviewing it now.
            </div>
          )}

          {/* Status badge */}
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

          {/* Benefits */}
          {kycStatus !== "approved" && (
            <div className="rounded-xl bg-muted/50 border border-border p-3 space-y-1.5">
              <p className="text-xs font-semibold">Why verify?</p>
              {[
                "Unlock higher withdrawal limits",
                "Build trust with the platform",
                "Required for large payouts",
                "One-time process — takes ~2 min",
              ].map(b => (
                <div key={b} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          {kycStatus === "none" || kycStatus === "rejected" ? (
            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={sessionMutation.isPending}
            >
              {sessionMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Preparing…</>
                : <><ExternalLink className="w-4 h-4 mr-2" />{kycStatus === "rejected" ? "Try Again" : "Verify My Identity"}</>}
            </Button>
          ) : kycStatus === "pending" ? (
            <Button variant="outline" className="w-full" onClick={() => refetch()} disabled={kycLoading}>
              {kycLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Refreshing…</> : "Refresh Status"}
            </Button>
          ) : null}

          {sessionMutation.isError && (
            <p className="text-xs text-destructive text-center">
              {(sessionMutation.error as any)?.data?.error ?? "Failed to start verification. Please try again."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
