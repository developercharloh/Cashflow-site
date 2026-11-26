import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetTaskPackageInfoQueryKey,
  getGetTransactionsQueryKey,
  getGetWalletQueryKey,
  useGetTaskPackageInfo,
  usePurchaseTaskPackage,
} from "@workspace/api-client-react";
import { ArrowRight, BadgeCheck, Diamond, Loader2, ShieldCheck, Sparkles, Wallet2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const PACKAGE_PRICE: Record<string, number> = { silver: 7.69, diamond: 19.23 };
const PACKAGE_LABEL: Record<string, string> = { free: "Free", silver: "Silver", diamond: "Diamond", legacy: "Legacy" };
function money(value: number) {
  return `$${value.toFixed(2)}`;
}

type PurchaseError = {
  data?: {
    error?: string;
    code?: string;
    walletBalance?: number;
    shortfall?: number;
  };
  message?: string;
};

function errorText(error: unknown) {
  const apiError = error as PurchaseError;
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

type PackageCode = "silver" | "diamond";

export default function PackagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: info, isLoading, isError, refetch } = useGetTaskPackageInfo();
  const purchase = usePurchaseTaskPackage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageCode>("silver");
  const [purchaseError, setPurchaseError] = useState("");
  const [serverShortfall, setServerShortfall] = useState<number | null>(null);

  const buy = (code: "silver" | "diamond") => {
    if (!info) return;
    setSelectedPackage(code);
    setPurchaseError("");
    setServerShortfall(null);
    setDialogOpen(true);
  };

  const chargeFor = (code: PackageCode) =>
    ["silver", "legacy"].includes(info?.currentPackage ?? "") && code === "diamond"
      ? 11.54
      : PACKAGE_PRICE[code];

  const shortfallFor = (code: PackageCode) => {
    if (!info) return 0;
    if (code === selectedPackage && serverShortfall !== null) return serverShortfall;
    const chargeCents = Math.round(chargeFor(code) * 100);
    const balanceCents = Math.floor((info.walletBalance + 0.000001) * 100);
    return Math.max(0, chargeCents - balanceCents) / 100;
  };

  const depositAmountFor = (shortfall: number) => Math.max(0.1, Math.round(shortfall * 100) / 100);

  const refreshPackageViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetTaskPackageInfoQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
    ]);
  };

  const submitPurchase = async () => {
    setPurchaseError("");
    try {
      const result = await purchase.mutateAsync({ data: { package: selectedPackage } });
      queryClient.setQueryData(getGetTaskPackageInfoQueryKey(), result);
      setDialogOpen(false);
      await refreshPackageViews();
      toast({
        title: `${PACKAGE_LABEL[selectedPackage]} package active`,
        description: `${money(chargeFor(selectedPackage))} was deducted from your wallet.`,
      });
    } catch (error) {
      const apiError = error as PurchaseError;
      const response = apiError.data;
      if (response?.code === "insufficient_balance" && typeof response.shortfall === "number") {
        setServerShortfall(response.shortfall);
        if (typeof response.walletBalance === "number") {
          queryClient.setQueryData(
            getGetTaskPackageInfoQueryKey(),
            (current: typeof info) => current ? { ...current, walletBalance: response.walletBalance! } : current,
          );
        }
        setPurchaseError("");
      } else {
        setPurchaseError(errorText(error));
      }
    }
  };

  const goToDeposit = (shortfall: number) => {
    const amount = depositAmountFor(shortfall);
    setDialogOpen(false);
    setLocation(`/wallet?depositAmount=${amount.toFixed(2)}&returnTo=/packages`);
  };

  const selectedCharge = info ? chargeFor(selectedPackage) : 0;
  const selectedShortfall = info ? shortfallFor(selectedPackage) : 0;
  const selectedDepositAmount = depositAmountFor(selectedShortfall);

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
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">Wallet balance</p>
                <p className="font-semibold">{money(info.walletBalance)}</p>
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
                    <p className="mt-1 text-xs text-muted-foreground">One-time charge from your wallet</p>
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
                        {shortfallFor(code) > 0
                          ? <>Deposit {money(depositAmountFor(shortfallFor(code)))} to buy <ArrowRight className="h-4 w-4" /></>
                          : <>Buy {item?.name ?? PACKAGE_LABEL[code]} with wallet <ArrowRight className="h-4 w-4" /></>}
                      </Button>
                    )}
                  </article>
                );
              })}
            </section>
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Packages are paid from your wallet. If your balance is short, deposit the amount needed and then retry.</p>
          </>
        )}

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setPurchaseError("");
            setServerShortfall(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Buy {PACKAGE_LABEL[selectedPackage]} with wallet</DialogTitle>
              <DialogDescription>
                Your wallet will be charged {money(selectedCharge)}. Current wallet balance: {money(info?.walletBalance ?? 0)}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedShortfall > 0 ? (
                <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <div className="flex items-center gap-2">
                    <Wallet2 className="h-5 w-5 shrink-0" />
                    <p className="font-semibold">Your wallet is short by {money(selectedShortfall)}.</p>
                  </div>
                  <p className="text-sm">
                    Deposit {money(selectedDepositAmount)} to your wallet, then return here and retry this purchase.
                    {selectedShortfall < 0.1 ? " The minimum M-Pesa deposit is $0.10; any extra will remain in your wallet." : ""}
                  </p>
                  <Button className="w-full gap-2" onClick={() => goToDeposit(selectedShortfall)}>
                    <Wallet2 className="h-4 w-4" />
                    Deposit {money(selectedDepositAmount)}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                    <p className="font-semibold">You have enough in your wallet.</p>
                    <p className="mt-1 text-sm">After purchase, your balance will be {money((info?.walletBalance ?? 0) - selectedCharge)}.</p>
                  </div>
                  {purchaseError && <p role="alert" className="text-sm text-destructive">{purchaseError}</p>}
                  <Button className="w-full gap-2" onClick={() => void submitPurchase()} disabled={purchase.isPending}>
                    {purchase.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Buying package…</>
                      : <><Wallet2 className="h-4 w-4" /> Buy package · {money(selectedCharge)}</>}
                  </Button>
                </>
              )}
              <Button variant="outline" className="w-full" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
