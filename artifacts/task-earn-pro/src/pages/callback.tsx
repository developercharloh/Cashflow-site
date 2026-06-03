import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useVerifyPendingDeposits } from "@workspace/api-client-react";
import { CheckCircle2, Loader2, Clock } from "lucide-react";

export default function CallbackPage() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"verifying" | "success" | "processing">("verifying");
  const [amount, setAmount] = useState(0);
  const verifyMutation = useVerifyPendingDeposits();

  useEffect(() => {
    verifyMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.count > 0) {
          const total = (data.credited ?? []).reduce((s: number, c: any) => s + c.amount, 0);
          setAmount(total);
          setStatus("success");
        } else {
          setStatus("processing");
        }
        setTimeout(() => setLocation("/dashboard"), 3500);
      },
      onError: () => {
        setStatus("processing");
        setTimeout(() => setLocation("/dashboard"), 3500);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="space-y-5 max-w-xs w-full">
        {status === "verifying" && (
          <>
            <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold">Verifying Payment…</h2>
            <p className="text-muted-foreground text-sm">Please wait while we confirm your deposit.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto animate-in zoom-in duration-300">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-bold text-emerald-600">Payment Received!</h2>
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold">${amount.toFixed(2)}</span> has been added to your balance.
            </p>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3">
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Redirecting you to your dashboard…</p>
            </div>
          </>
        )}

        {status === "processing" && (
          <>
            <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center mx-auto">
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold">Payment Processing</h2>
            <p className="text-muted-foreground text-sm">
              Your payment is being processed. It will reflect in your wallet shortly.
            </p>
            <div className="rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3">
              <p className="text-xs text-yellow-700 dark:text-yellow-400">Redirecting you to your dashboard…</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
