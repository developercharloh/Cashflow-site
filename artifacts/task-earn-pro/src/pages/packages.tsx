import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTaskPackageInfoQueryKey,
  getGetTransactionsQueryKey,
  getTaskPackageMpesaPurchaseStatus,
  useGetTaskPackageInfo,
  useStartTaskPackageMpesaPurchase,
} from "@workspace/api-client-react";
import { ArrowRight, BadgeCheck, CheckCircle, Diamond, Loader2, ShieldCheck, Smartphone, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const PACKAGE_PRICE: Record<string, number> = { silver: 7.69, diamond: 19.23 };
const PACKAGE_LABEL: Record<string, string> = { free: "Free", silver: "Silver", diamond: "Diamond", legacy: "Legacy" };
const DEPOSIT_RATE_KES = 130;

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function priceInKes(value: number) {
  return Math.round(value * DEPOSIT_RATE_KES);
}

function errorText(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

type PackageCode = "silver" | "diamond";
type PackagePaymentState =
  | { status: "idle" }
  | { status: "pending"; reference: string; package: PackageCode; chargeUsd: number; amountKes: number; message: string; timedOut?: boolean }
  | { status: "completed"; package: PackageCode; message: string }
  | { status: "rejected"; package: PackageCode; message: string };

export default function PackagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: info, isLoading, isError, refetch } = useGetTaskPackageInfo();
  const purchase = useStartTaskPackageMpesaPurchase();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageCode>("silver");
  const [phone, setPhone] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [payment, setPayment] = useState<PackagePaymentState>({ status: "idle" });
  const [checkingStatus, setCheckingStatus] = useState(false);

  const buy = (code: "silver" | "diamond") => {
    if (!info) return;
    setSelectedPackage(code);
    setPayment({ status: "idle" });
    setPaymentError("");
    setDialogOpen(true);
  };

  const chargeFor = (code: PackageCode) =>
    ["silver", "legacy"].includes(info?.currentPackage ?? "") && code === "diamond"
      ? 11.54
      : PACKAGE_PRICE[code];

  const refreshPackageViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTaskPackageInfoQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
    ]);
  };

  const submitPurchase = async () => {
    if (!phone.trim()) {
      setPaymentError("Enter the phone number that should receive the M-Pesa prompt.");
      return;
    }
    setPaymentError("");
    try {
      const result = await purchase.mutateAsync({ data: { package: selectedPackage, phone: phone.trim() } });
      setSelectedPackage(result.package);
      setPayment({
        status: "pending",
        reference: result.reference,
        package: result.package,
        chargeUsd: result.chargeUsd,
        amountKes: result.amountKes,
        message: result.message,
      });
    } catch (error) {
      setPaymentError(errorText(error));
    }
  };

  useEffect(() => {
    if (payment.status !== "pending" || payment.timedOut) return;
    let attempts = 0;
    let active = true;
    const poll = async () => {
      try {
        const result = await getTaskPackageMpesaPurchaseStatus(payment.reference);
        if (!active) return;
        if (result.status === "completed") {
          setPayment({ status: "completed", package: result.package, message: result.message });
          await refreshPackageViews();
          toast({ title: "Package active", description: `${PACKAGE_LABEL[result.package]} access is ready for task bids.` });
          return;
        }
        if (result.status === "rejected") {
          setPayment({ status: "rejected", package: result.package, message: result.message });
          return;
        }
        setPayment((current) => current.status === "pending"
          ? { ...current, message: result.message }
          : current);
      } catch {
        // A temporary status-check error should not stop payment confirmation polling.
      }
      attempts += 1;
      if (attempts >= 24 && active) {
        setPayment((current) => current.status === "pending" ? { ...current, timedOut: true } : current);
        return;
      }
      if (active) window.setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.status === "pending" ? payment.reference : null, payment.status, payment.status === "pending" ? payment.timedOut : false]);

  const checkPaymentStatus = async () => {
    if (payment.status !== "pending") return;
    setCheckingStatus(true);
    try {
      const result = await getTaskPackageMpesaPurchaseStatus(payment.reference);
      if (result.status === "completed") {
        setPayment({ status: "completed", package: result.package, message: result.message });
        await refreshPackageViews();
        toast({ title: "Package active", description: `${PACKAGE_LABEL[result.package]} access is ready for task bids.` });
      } else if (result.status === "rejected") {
        setPayment({ status: "rejected", package: result.package, message: result.message });
      } else {
        setPayment((current) => current.status === "pending" ? { ...current, message: result.message } : current);
      }
    } catch (error) {
      setPaymentError(errorText(error));
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="px-4 pb-12 pt-6 sm:px-7 sm:pt-9">
      <div className="mx-auto max-w-5xl">
        <header className="relative overflow-hidden rounded-[1.6rem] border border-border bg-primary px-5 py-7 text-primary-foreground sm:px-9 sm:py-10">
          <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full border-[1px] border-primary-foreground/20 sm:h-80 sm:w-80" />
          <div className="pointer-events-none absolute -right-2 top-5 h-44 w-44 rounded-full border-[1px] border-primary-foreground/15 sm:h-60 sm:w-60" />
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-primary-foreground/70">Task access / one-time purchase</p>
          <h1 className="mt-3 max-w-xl font-serif text-4xl leading-[.98] sm:text-5xl">A clear path to more work.</h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/80">Choose permanent access once. Both paid packages unlock unlimited task bids.</p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2 text-xs">
            <ShieldCheck className="h-4 w-4" /> No recurring charge
          </div>
        </header>

        {isLoading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Loading task packages">
            {[0, 1].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border border-border bg-card" />)}
          </div>
        ) : isError || !info ? (
          <section role="alert" className="mt-6 rounded-2xl border border-border bg-card px-5 py-8 text-center">
            <p className="font-semibold">Package details are unavailable.</p>
            <p className="mt-1 text-sm text-muted-foreground">No package payment was started. Please try again.</p>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button>
          </section>
        ) : (
          <>
            <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5" aria-label="Current package access">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary"><BadgeCheck className="h-5 w-5" /></span>
                <div><p className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">Current access</p><p className="font-semibold">{PACKAGE_LABEL[info.currentPackage] ?? info.currentPackage}</p></div>
              </div>
            </section>
            <section className="mt-5 grid gap-4 md:grid-cols-2" aria-label="Available task packages">
              {(["silver", "diamond"] as const).map((code, index) => {
                const item = info.packages.find((pack) => pack.code === code);
                const current = info.currentPackage === code ||
                  ((info.currentPackage === "diamond" || info.currentPackage === "legacy") && code === "silver");
                const upgrade = ["silver", "legacy"].includes(info.currentPackage) && code === "diamond";
                const Icon = code === "silver" ? Sparkles : Diamond;
                const price = chargeFor(code);
                return (
                  <article key={code} className={`relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7 ${code === "diamond" ? "border-primary/45 shadow-[0_16px_44px_hsl(var(--primary)/.08)]" : "border-border"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">{index === 0 ? "A steady start" : "Full access"}</p>
                        <h2 className="mt-2 font-serif text-3xl">{item?.name ?? (code === "silver" ? "Silver" : "Diamond")}</h2>
                      </div>
                      <span className={`grid h-11 w-11 place-items-center rounded-xl ${code === "diamond" ? "bg-primary text-primary-foreground" : "bg-accent text-primary"}`}><Icon className="h-5 w-5" /></span>
                    </div>
                    <p className="mt-3 min-h-10 text-sm leading-5 text-muted-foreground">{item?.description ?? "Permanent access to task bidding."}</p>
                    <div className="mt-5 flex items-end gap-2">
                      <span className="font-mono text-4xl tracking-tight">{money(price)}</span>
                      {upgrade && <span className="pb-1 text-xs text-muted-foreground">upgrade difference</span>}
                      {!upgrade && <span className="pb-1 text-xs text-muted-foreground">one time</span>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">KES {priceInKes(price).toLocaleString()} via M-Pesa Express</p>
                    <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-sm">
                      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
                      <span>Unlimited task bids</span>
                    </div>
                    {current ? (
                      <div className="mt-5 flex min-h-11 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground" data-testid={`status-package-${code}`}>
                        {info.currentPackage === "legacy" ? "Included in existing access" : info.currentPackage === code ? "Your current package" : "Included in Diamond"}
                      </div>
                    ) : (
                      <Button className="mt-5 h-11 w-full gap-2" disabled={purchase.isPending} onClick={() => buy(code)} data-testid={`button-buy-${code}`}>
                        <>Get {item?.name ?? (code === "silver" ? "Silver" : "Diamond")} with M-Pesa Express <ArrowRight className="h-4 w-4" /></>
                      </Button>
                    )}
                  </article>
                );
              })}
            </section>
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Pay directly with M-Pesa Express. You don’t need to top up your wallet first.</p>
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Pay for {PACKAGE_LABEL[selectedPackage]}</DialogTitle>
              <DialogDescription>
                A secure M-Pesa prompt for KES {(payment.status === "pending" ? payment.amountKes : priceInKes(chargeFor(selectedPackage))).toLocaleString()} will be sent to your phone. Your package activates after payment is confirmed.
              </DialogDescription>
            </DialogHeader>

            {payment.status === "idle" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="package-mpesa-phone">M-Pesa phone number</Label>
                  <Input
                    id="package-mpesa-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0712345678 or +254712345678"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={purchase.isPending}
                  />
                </div>
                {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
                <Button className="w-full gap-2" onClick={() => void submitPurchase()} disabled={purchase.isPending}>
                  {purchase.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending prompt…</>
                    : <><Smartphone className="h-4 w-4" /> Send M-Pesa prompt · KES {priceInKes(chargeFor(selectedPackage)).toLocaleString()}</>}
                </Button>
              </div>
            )}

            {payment.status === "pending" && (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="font-semibold">Waiting for payment confirmation</p>
                </div>
                <p className="text-sm">{payment.message}</p>
                <p className="text-sm">Confirm KES {payment.amountKes.toLocaleString()} on your phone. Your wallet balance is not used.</p>
                {paymentError && <p role="alert" className="text-sm text-red-700">{paymentError}</p>}
                {payment.timedOut && (
                  <Button variant="outline" className="w-full" onClick={() => void checkPaymentStatus()} disabled={checkingStatus}>
                    {checkingStatus ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking…</> : "Check payment status"}
                  </Button>
                )}
              </div>
            )}

            {payment.status === "completed" && (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="flex items-center gap-2"><CheckCircle className="h-5 w-5" /><p className="font-semibold">{PACKAGE_LABEL[payment.package]} package active</p></div>
                <p className="text-sm">{payment.message}</p>
                <Button className="w-full" onClick={() => setDialogOpen(false)}>Done</Button>
              </div>
            )}

            {payment.status === "rejected" && (
              <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950">
                <div className="flex items-center gap-2"><XCircle className="h-5 w-5" /><p className="font-semibold">Payment not completed</p></div>
                <p className="text-sm">{payment.message}</p>
                <Button className="w-full" onClick={() => { setPayment({ status: "idle" }); setPaymentError(""); }}>Try again</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
