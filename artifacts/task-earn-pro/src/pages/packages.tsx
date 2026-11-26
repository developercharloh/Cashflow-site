import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTaskPackageInfoQueryKey,
  getGetTransactionsQueryKey,
  getGetWalletQueryKey,
  useGetTaskPackageInfo,
  usePurchaseTaskPackage,
} from "@workspace/api-client-react";
import { ArrowRight, BadgeCheck, Coins, Diamond, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PACKAGE_PRICE: Record<string, number> = { silver: 7.69, diamond: 19.23 };
const PACKAGE_LABEL: Record<string, string> = { free: "Free", silver: "Silver", diamond: "Diamond", legacy: "Legacy" };

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function errorText(error: unknown) {
  const apiError = error as { data?: { error?: string }; message?: string };
  return apiError.data?.error ?? apiError.message ?? "Please try again.";
}

export default function PackagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: info, isLoading, isError, refetch } = useGetTaskPackageInfo();
  const purchase = usePurchaseTaskPackage();

  const buy = (code: "silver" | "diamond") => {
    if (!info) return;
    const charge = ["silver", "legacy"].includes(info.currentPackage) && code === "diamond" ? 11.54 : PACKAGE_PRICE[code];
    if (info.walletBalance < charge) {
      toast({
        title: "Not enough in your wallet",
        description: `You need ${money(charge)} for this upgrade. Your available balance is ${money(info.walletBalance)}.`,
        variant: "destructive",
      });
      return;
    }
    purchase.mutate({ data: { package: code } }, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getGetTaskPackageInfoQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
        ]);
        toast({ title: "Access updated", description: `${code === "silver" ? "Silver" : "Diamond"} task access is now active.` });
      },
      onError: (error) => toast({
        title: "Purchase not completed",
        description: errorText(error),
        variant: "destructive",
      }),
    });
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
            <p className="mt-1 text-sm text-muted-foreground">Your wallet has not been charged. Please try again.</p>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()}>Try again</Button>
          </section>
        ) : (
          <>
            <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:px-5" aria-label="Current access and wallet balance">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary"><BadgeCheck className="h-5 w-5" /></span>
                <div><p className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">Current access</p><p className="font-semibold">{PACKAGE_LABEL[info.currentPackage] ?? info.currentPackage}</p></div>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">Wallet</span>
                <strong className="font-mono text-sm">{money(info.walletBalance)}</strong>
              </div>
            </section>
            <section className="mt-5 grid gap-4 md:grid-cols-2" aria-label="Available task packages">
              {(["silver", "diamond"] as const).map((code, index) => {
                const item = info.packages.find((pack) => pack.code === code);
                const current = info.currentPackage === code ||
                  ((info.currentPackage === "diamond" || info.currentPackage === "legacy") && code === "silver");
                const upgrade = ["silver", "legacy"].includes(info.currentPackage) && code === "diamond";
                const Icon = code === "silver" ? Sparkles : Diamond;
                const price = upgrade ? 11.54 : PACKAGE_PRICE[code];
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
                        {purchase.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating access…</> : <>Choose {item?.name ?? (code === "silver" ? "Silver" : "Diamond")} <ArrowRight className="h-4 w-4" /></>}
                      </Button>
                    )}
                  </article>
                );
              })}
            </section>
            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">Your wallet is charged only when the purchase succeeds. Need funds? <Link href="/wallet" className="font-semibold text-primary underline-offset-4 hover:underline">Visit your wallet</Link>.</p>
          </>
        )}
      </div>
    </div>
  );
}
