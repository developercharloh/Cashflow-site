import { Link } from "wouter";
import { ArrowLeft, Clock3, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetKycStatus } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";

export default function KycPage() {
  const { user } = useAuth();
  const { data: kyc } = useGetKycStatus({
    query: { queryKey: ["kycStatus"], enabled: !!user },
  });
  const alreadyVerified = kyc?.kycStatus === "approved";

  return (
    <main className="px-4 pt-5 pb-24 max-w-lg mx-auto space-y-5">
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to profile
      </Link>

      <section className="bg-card border border-border rounded-2xl p-6 text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {alreadyVerified
            ? <ShieldCheck className="w-8 h-8 text-primary" />
            : <Clock3 className="w-8 h-8 text-primary" />}
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Identity verification</h1>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <Clock3 className="w-3.5 h-3.5" />
            {alreadyVerified ? "Already verified" : "Coming Soon"}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {alreadyVerified
            ? "Your account is verified. You can continue to use the wallet."
            : "Identity verification is not available yet. Withdrawals require an approved verified account."}
        </p>
        {!alreadyVerified && (
          <p className="text-xs text-muted-foreground">
            We are not collecting identity documents or personal verification details right now.
          </p>
        )}
        <Link href="/profile">
          <Button className="w-full">Return to profile</Button>
        </Link>
      </section>
    </main>
  );
}
