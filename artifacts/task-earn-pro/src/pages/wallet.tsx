import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetWallet, useGetTransactions, useRequestWithdrawal,
  useChargeDeposit,
  useVerifyPendingDeposits, useGetKycStatus,
  getGetWalletQueryKey, getGetTransactionsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Wallet2, TrendingUp, ArrowUpRight, Loader2,
  DollarSign, Users, Star, CheckCircle, Clock, XCircle,
  Plus, CreditCard, Landmark, RefreshCw,
  ChevronRight, Smartphone, Banknote,
} from "lucide-react";

const STATUS_STYLE: Record<string, { icon: React.ReactNode; class: string }> = {
  completed: { icon: <CheckCircle className="w-3 h-3" />, class: "text-green-600 bg-green-50 border-green-200" },
  pending:   { icon: <Clock      className="w-3 h-3" />, class: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  rejected:  { icon: <XCircle   className="w-3 h-3" />, class: "text-red-500 bg-red-50 border-red-200" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  earning:    <CheckCircle  className="w-4 h-4 text-green-600" />,
  deposit:    <Plus         className="w-4 h-4 text-blue-500"  />,
  withdrawal: <ArrowUpRight className="w-4 h-4 text-red-500"  />,
  bonus:      <Star         className="w-4 h-4 text-yellow-500"/>,
  referral:   <Users        className="w-4 h-4 text-blue-400" />,
};

// ─── Method definitions ───────────────────────────────────────────────────────

const DEPOSIT_METHODS = [
  {
    id: "mpesa",
    label: "M-Pesa Express",
    sub: "Secure STK push to your phone",
    icon: <Smartphone className="w-6 h-6 text-emerald-700 dark:text-emerald-300" />,
    color: "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
  },
  {
    id: "card",
    label: "Card Deposit",
    sub: "Card deposits are not available yet",
    icon: <CreditCard className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
    color: "border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80",
  },
];

const WITHDRAW_METHODS = [
  {
    id: "bank",
    label: "Bank Transfer",
    sub: "Bank account payout",
    icon: <Landmark className="w-6 h-6 text-green-600" />,
    color: "border-green-100 bg-green-50/50",
  },
  {
    id: "card",
    label: "Debit / Credit Card",
    sub: "Coming Soon — card withdrawals are not available yet",
    icon: <CreditCard className="w-6 h-6 text-blue-500" />,
    color: "border-blue-100 bg-blue-50/50",
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    sub: "Receive your payout on M-Pesa",
    icon: <Smartphone className="w-6 h-6 text-green-600" />,
    color: "border-green-100 bg-green-50/50",
  },
  {
    id: "paypal",
    label: "PayPal",
    sub: "Processed within 24 hours",
    icon: <Banknote className="w-6 h-6 text-blue-600" />,
    color: "border-blue-100 bg-blue-50/50",
  },
];

type Stage =
  | { view: "none" }
  | { view: "deposit_pick" }
  | { view: "withdraw_pick" }
  | { view: "deposit_form"; method: typeof DEPOSIT_METHODS[0] }
  | { view: "withdraw_form"; method: typeof WITHDRAW_METHODS[0] };

export default function WalletPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [stage, setStage] = useState<Stage>({ view: "none" });
  const [txnType, setTxnType] = useState("all");

  // STK Push state (M-Pesa deposit polling)
  type StkStatus = "idle" | "sending" | "sent" | "confirmed" | "failed";
  const [stkState, setStkState] = useState<{
    status: StkStatus;
    reference?: string;
    amount?: number;
    countdown: number;
  }>({ status: "idle", countdown: 120 });

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPhone, setDepositPhone] = useState("");

  // Bank withdrawal state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  // Manual withdrawal state (M-Pesa / PayPal)
  const [manualAmount, setManualAmount] = useState("");
  const [manualAccount, setManualAccount] = useState("");

  // Exchange rates
  const DEPOSIT_RATE = 130;    // 1 USD = 130 KES (deposit)
  const WITHDRAWAL_RATE = 125; // 1 USD = 125 KES (withdrawal)

  const isMobileMoney = (id: string) => id === "mpesa";

  const { data: wallet, isLoading } = useGetWallet();
  const { data: transactions } = useGetTransactions(
    txnType !== "all" ? { type: txnType } : {},
    { query: { queryKey: getGetTransactionsQueryKey(txnType !== "all" ? { type: txnType } : {}) } }
  );
  const { data: kyc } = useGetKycStatus({ query: { queryKey: ["kycStatus"] } });
  const isKycApproved = kyc?.kycStatus === "approved";

  const chargeDepositMutation = useChargeDeposit();
  const manualWithdrawMutation = useRequestWithdrawal();
  const verifyPendingMutation = useVerifyPendingDeposits();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
  };

  const close = () => {
    setStage({ view: "none" });
    setDepositAmount(""); setDepositPhone("");
    setWithdrawAmount(""); setBankName(""); setAccountNumber(""); setAccountName("");
    setManualAmount(""); setManualAccount("");
    setStkState({ status: "idle", countdown: 120 });
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedAmount = Number(params.get("depositAmount"));
    if (!Number.isFinite(requestedAmount) || requestedAmount < 0.1) return;

    setDepositAmount(requestedAmount.toFixed(2));
    setStage({ view: "deposit_form", method: DEPOSIT_METHODS[0] });
  }, []);

  const returnToPackagesAfterDeposit = () => {
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    const target = returnTo === "/packages" ? returnTo : null;
    window.setTimeout(() => {
      close();
      if (target) setLocation(target);
    }, 3000);
  };

  // ── STK push polling ────────────────────────────────────────────────────────
  useEffect(() => {
    if (stkState.status !== "sent" || !stkState.reference) return;

    const depositReference = stkState.reference;
    const token = localStorage.getItem("token");
    let attempts = 0;
    const maxAttempts = 24; // 24 × 5 s = 120 s = 2 min

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setStkState(prev => ({ ...prev, countdown: Math.max(0, prev.countdown - 1) }));
    }, 1000);

    // Polling
    const pollInterval = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch(`/api/wallet/deposits/${encodeURIComponent(depositReference)}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (d.status === "completed") {
          clearInterval(pollInterval);
          clearInterval(countdownInterval);
          setStkState(prev => ({ ...prev, status: "confirmed", amount: d.amount }));
          invalidate();
          toast({ title: "Deposit Confirmed! 🎉", description: `$${d.amount?.toFixed(2)} has been credited to your wallet.` });
          returnToPackagesAfterDeposit();
          return;
        }
        if (d.status === "rejected") {
          clearInterval(pollInterval);
          clearInterval(countdownInterval);
          setStkState(prev => ({ ...prev, status: "failed" }));
          return;
        }
      } catch { /* network hiccup — keep polling */ }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        clearInterval(countdownInterval);
        setStkState(prev => ({ ...prev, status: "failed" }));
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stkState.status, stkState.reference]);

  // ── Send M-Pesa STK push ────────────────────────────────────────────────────
  const handleMpesaDeposit = (method: typeof DEPOSIT_METHODS[0]) => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 0.1) { toast({ title: "Minimum deposit is $0.10", variant: "destructive" }); return; }
    if (!depositPhone.trim()) { toast({ title: "Phone number is required for M-Pesa", variant: "destructive" }); return; }

    setStkState({ status: "sending", countdown: 120 });
    chargeDepositMutation.mutate(
      { data: { amount: amt, phone: depositPhone.trim(), provider: method.id } },
      {
        onSuccess: (data: any) => {
          setStkState({ status: "sent", reference: data.reference, amount: amt, countdown: 120 });
        },
        onError: (err: any) => {
          setStkState({ status: "idle", countdown: 120 });
          toast({ title: "STK Push failed", description: err.data?.error ?? err.message, variant: "destructive" });
        },
      }
    );
  };

  // Reconcile pending deposits with the payment provider; never complete by age alone.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reference") || params.get("trxref")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    verifyPendingMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.count > 0) {
          const total = (data.credited ?? []).reduce((s, c) => s + c.amount, 0);
          toast({ title: "Deposit Confirmed!", description: `$${total.toFixed(2)} credited to your wallet.` });
          invalidate();
        }
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBankWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 0.5) { toast({ title: "Minimum withdrawal is $0.50", variant: "destructive" }); return; }
    if (!bankName || !accountNumber || !accountName) {
      toast({ title: "Please fill all bank details", variant: "destructive" }); return;
    }
    manualWithdrawMutation.mutate({
      data: {
        amount: amt,
        method: "bank",
        accountDetails: JSON.stringify({ bankName, accountNumber, accountName }),
      },
    }, {
      onSuccess: () => {
        toast({ title: "Withdrawal request received", description: "Status: Pending." });
        close(); invalidate();
      },
      onError: (err: any) => toast({ title: "Withdrawal failed", description: err.data?.error ?? err.message, variant: "destructive" }),
    });
  };

  const handleMobileWithdraw = (provider: "mpesa" | "airtel") => {
    const amt = parseFloat(manualAmount);
    if (!amt || amt < 0.5) { toast({ title: "Minimum withdrawal is $0.50", variant: "destructive" }); return; }
    if (!manualAccount) { toast({ title: "Please enter your phone number", variant: "destructive" }); return; }
    manualWithdrawMutation.mutate({
      data: { amount: amt, method: provider, accountDetails: manualAccount },
    }, {
      onSuccess: () => {
        toast({ title: "Withdrawal request received", description: "Status: Pending." });
        close(); invalidate();
      },
      onError: (err: any) => toast({ title: "Withdrawal failed", description: err.data?.error ?? err.message, variant: "destructive" }),
    });
  };

  const handleManualWithdraw = (methodId: string) => {
    const amt = parseFloat(manualAmount);
    if (!amt || amt < 0.5) { toast({ title: "Minimum withdrawal is $0.50", variant: "destructive" }); return; }
    if (!manualAccount) { toast({ title: "Please enter your account details", variant: "destructive" }); return; }
    manualWithdrawMutation.mutate({ data: { amount: amt, method: methodId, accountDetails: manualAccount } }, {
      onSuccess: () => {
        toast({ title: "Withdrawal request received", description: "Status: Pending." });
        close(); invalidate();
      },
      onError: (err: any) => toast({ title: "Error", description: err.data?.error ?? err.message, variant: "destructive" }),
    });
  };

  const handleCheckPending = () => {
    verifyPendingMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.count > 0) {
          const total = (data.credited ?? []).reduce((s, c) => s + c.amount, 0);
          toast({ title: "Deposit Credited!", description: `$${total.toFixed(2)} added to your wallet.` });
        } else {
          toast({ title: "All up to date", description: "No pending deposits found." });
        }
        invalidate();
      },
      onError: () => toast({ title: "Check failed", description: "Please try again.", variant: "destructive" }),
    });
  };

  const hasPendingDeposit = transactions?.some(t => t.type === "deposit" && t.status === "pending");
  void hasPendingDeposit;

  if (isLoading || !wallet) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="px-4 pt-4 pb-24 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Wallet</h1>
        <p className="text-sm text-muted-foreground">Manage your earnings and payments</p>
      </div>

      {/* Balance card with Deposit + Withdraw */}
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)" }}>
        <p className="text-xs opacity-60 mb-1">Available Balance</p>
        <p className="text-4xl font-bold mb-1">${wallet.balance.toFixed(2)}</p>
        <p className="text-xs opacity-50 mb-5">Available to withdraw or use</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setStage({ view: "deposit_pick" })}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(90deg,#2563eb,#3b82f6)" }}
          >
            <Plus className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => {
              if (!isKycApproved) {
                toast({ title: "Identity verification required", description: "Complete identity verification to request a withdrawal.", variant: "destructive" });
                setLocation("/kyc");
                return;
              }
              setStage({ view: "withdraw_pick" });
            }}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(90deg,#16a34a,#22c55e)" }}
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Earned", value: wallet.totalEarned, icon: <TrendingUp className="w-4 h-4 text-green-600" />, color: "text-green-600" },
          { label: "Withdrawn",    value: wallet.totalWithdrawn, icon: <ArrowUpRight className="w-4 h-4 text-red-500" />, color: "text-red-500" },
          { label: "Pending",      value: wallet.pendingEarnings, icon: <Clock className="w-4 h-4 text-yellow-500" />, color: "text-yellow-600" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-2">{icon}</div>
            <p className={`text-base font-bold ${color}`}>${value.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Earnings breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Tasks",     value: wallet.totalTaskEarnings,    icon: <DollarSign className="w-3.5 h-3.5 text-primary" /> },
          { label: "Referrals", value: wallet.totalReferralEarnings, icon: <Users className="w-3.5 h-3.5 text-blue-500" /> },
          { label: "Bonuses",   value: wallet.totalBonusEarnings,   icon: <Star className="w-3.5 h-3.5 text-yellow-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">{icon}</div>
            <div>
              <p className="text-xs font-bold">${value.toFixed(2)}</p>
              <p className="text-[9px] text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <div className="bg-card border border-border rounded-2xl">
        <div className="p-4 border-b border-border flex items-center justify-between gap-2">
          <p className="font-bold text-sm shrink-0">Transactions</p>
          <div className="flex gap-1 overflow-x-auto">
            {["all","earning","deposit","withdrawal","bonus","referral"].map(t => (
              <button
                key={t}
                onClick={() => setTxnType(t)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold capitalize whitespace-nowrap transition-colors ${
                  txnType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {!transactions || transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Wallet2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transactions.map(txn => {
              const status = STATUS_STYLE[txn.status] ?? STATUS_STYLE.completed;
              return (
                <div key={txn.id} className="p-4 space-y-1.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {TYPE_ICON[txn.type] ?? <DollarSign className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(txn.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${txn.type === "withdrawal" || txn.amount < 0 ? "text-red-500" : "text-green-600"}`}>
                        {txn.type === "withdrawal" || txn.amount < 0 ? "-" : "+"}${Math.abs(txn.amount).toFixed(2)}
                      </p>
                      <Badge variant="outline" className={`text-[9px] ${status.class}`}>
                        <span className="flex items-center gap-0.5">{status.icon}{txn.status}</span>
                      </Badge>
                    </div>
                  </div>
                  {txn.status === "rejected" && (txn as any).rejectionReason && (
                    <div className="ml-12 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-[11px] text-red-600 dark:text-red-400">
                        <span className="font-semibold">Reason: </span>{(txn as any).rejectionReason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* ── DEPOSIT: method picker ─────────────────── */}
      <Dialog open={stage.view === "deposit_pick"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose Deposit Method</DialogTitle>
            <DialogDescription>Select how you want to fund your wallet</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {DEPOSIT_METHODS.map(m => (
              <button
                key={m.id}
                disabled={m.id === "card"}
                onClick={() => {
                  if (m.id === "card") return;
                  setStage({ view: "deposit_form", method: m });
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${m.color} ${m.id === "card" ? "cursor-not-allowed" : "hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-950/70"}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.id === "card" ? "bg-white dark:bg-slate-700" : "bg-white/80 dark:bg-slate-900/50"}`}>
                  {m.icon}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${m.id === "card" ? "text-slate-600 dark:text-slate-300" : "text-slate-900 dark:text-white"}`}>{m.label}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{m.sub}</p>
                </div>
                {m.id === "card"
                  ? <Badge variant="outline" className="shrink-0 text-[10px]">Coming Soon</Badge>
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
            ))}
            <button
              onClick={handleCheckPending}
              disabled={verifyPendingMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border rounded-xl"
            >
              {verifyPendingMutation.isPending
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Checking…</>
                : <><RefreshCw className="w-3.5 h-3.5" /> Already paid? Check deposit status</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DEPOSIT: amount form ───────────────────── */}
      {stage.view === "deposit_form" && (
        <Dialog open onOpenChange={(o) => !o && setStage({ view: "deposit_pick" })}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stage.method.color}`}>
                  {stage.method.icon}
                </div>
                <div>
                  <DialogTitle>{stage.method.label}</DialogTitle>
                  <DialogDescription>{stage.method.sub}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              {new URLSearchParams(window.location.search).get("returnTo") === "/packages" && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                  Deposit the requested amount here. After the deposit is confirmed, you’ll return to Packages to retry your purchase.
                </div>
              )}

              {/* USD amount */}
              <div>
                <Label>Amount (USD)</Label>
                <Input
                  type="number" min="0.1" step="0.01" placeholder="e.g. 5"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum $0.10</p>
              </div>

              {/* KES equivalent — shown for all methods */}
              <div>
                <Label className="flex items-center gap-1.5">
                  Total in KES
                  <span className="text-[10px] font-normal bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Auto · Locked</span>
                </Label>
                <Input
                  readOnly
                  value={
                    depositAmount && parseFloat(depositAmount) >= 0.1
                      ? `KES ${Math.round(parseFloat(depositAmount) * DEPOSIT_RATE).toLocaleString()}`
                      : ""
                  }
                  placeholder="KES — enter USD amount above"
                  className="bg-muted/60 text-muted-foreground cursor-not-allowed select-none"
                  tabIndex={-1}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Rate: 1 USD = {DEPOSIT_RATE} KES
                </p>
              </div>

              {/* Phone number — required for mobile money */}
              {isMobileMoney(stage.method.id) && (
                <div>
                  <Label>M-Pesa Phone Number <span className="text-red-500">*</span></Label>
                  <Input
                    type="tel"
                    placeholder="e.g. 0712345678 or +254712345678"
                    value={depositPhone}
                    onChange={e => setDepositPhone(e.target.value)}
                    disabled={stkState.status !== "idle"}
                  />
                  <p className="text-xs text-muted-foreground mt-1">You'll receive an STK push PIN prompt on this number</p>
                </div>
              )}

              {/* STK push waiting UI — shown after push is sent */}
              {isMobileMoney(stage.method.id) && stkState.status !== "idle" && (
                <div className={`rounded-xl border p-4 space-y-3 ${
                  stkState.status === "confirmed"
                    ? "bg-green-50 border-green-200"
                    : stkState.status === "failed"
                      ? "bg-red-50 border-red-200"
                      : "bg-green-50/60 border-green-200"
                }`}>
                  {(stkState.status === "sending" || stkState.status === "sent") && (
                    <>
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-green-700 shrink-0" />
                        <p className="text-sm font-semibold text-green-800">
                          {stkState.status === "sending" ? "Sending STK push…" : "Waiting for PIN confirmation"}
                        </p>
                      </div>
                      {stkState.status === "sent" && (
                        <>
                          <p className="text-xs text-green-700">
                            Check your phone — enter your M-Pesa PIN to confirm the deposit of{" "}
                            <span className="font-bold">KES {Math.round((stkState.amount ?? 0) * DEPOSIT_RATE).toLocaleString()}</span>.
                          </p>
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-green-600 shrink-0" />
                            <p className="text-xs text-green-700">
                              Auto-checking… expires in <span className="font-mono font-bold">{stkState.countdown}s</span>
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {stkState.status === "confirmed" && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                      <p className="text-sm font-semibold text-green-800">
                        Deposit confirmed! ${stkState.amount?.toFixed(2)} added to your wallet.
                      </p>
                    </div>
                  )}
                  {stkState.status === "failed" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-sm font-semibold text-red-700">PIN not confirmed in time</p>
                      </div>
                      <p className="text-xs text-red-600">
                        If you entered your PIN, tap "Check deposit status" on the payment screen — it may still be processing.
                      </p>
                      <button
                        className="text-xs underline text-red-700"
                        onClick={() => setStkState({ status: "idle", countdown: 120 })}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* M-Pesa Express is active; card deposits remain unavailable. */}
              {isMobileMoney(stage.method.id) ? (
                <Button
                  className="w-full"
                  onClick={() => handleMpesaDeposit(stage.method)}
                  disabled={stkState.status !== "idle" || chargeDepositMutation.isPending}
                >
                  {stkState.status === "sending"
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
                    : stkState.status === "sent"
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Waiting for PIN…</>
                      : stkState.status === "confirmed"
                        ? <><CheckCircle className="w-4 h-4 mr-2" />Confirmed!</>
                        : depositAmount && parseFloat(depositAmount) >= 0.1
                          ? `Send M-Pesa STK Push — KES ${Math.round(parseFloat(depositAmount) * DEPOSIT_RATE).toLocaleString()} →`
                          : "Send M-Pesa STK Push →"}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled
                >
                  Card deposits are coming soon
                </Button>
              )}
              <button className="w-full text-xs text-muted-foreground text-center underline" onClick={() => setStage({ view: "deposit_pick" })}>
                ← Choose a different method
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}


      {/* ── WITHDRAW: method picker ────────────────── */}
      <Dialog open={stage.view === "withdraw_pick"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Withdrawal Method</DialogTitle>
            <DialogDescription>Select how you want to receive your funds</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {WITHDRAW_METHODS.map(m => (
              <button
                key={m.id}
                disabled={m.id === "card"}
                onClick={() => {
                  if (m.id !== "card") setStage({ view: "withdraw_form", method: m });
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors text-left disabled:opacity-60 ${m.color} ${m.id !== "card" ? "hover:border-primary/40" : ""}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                  {m.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </div>
                {m.id === "card"
                  ? <Badge variant="outline" className="shrink-0 text-[10px]">Coming Soon</Badge>
                  : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── WITHDRAW: form per method ──────────────── */}
      {stage.view === "withdraw_form" && (
        <Dialog open onOpenChange={(o) => !o && setStage({ view: "withdraw_pick" })}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stage.method.color}`}>
                  {stage.method.icon}
                </div>
                <div>
                  <DialogTitle>Withdraw via {stage.method.label}</DialogTitle>
                  <DialogDescription>Minimum $0.50 · Balance: ${wallet.balance.toFixed(2)}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* ─ Bank Transfer ─ */}
            {stage.method.id === "bank" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="0.5" step="0.01" placeholder="e.g. 5" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Bank Name</Label>
                  <Input placeholder="e.g. Your bank" value={bankName} onChange={e => setBankName(e.target.value)} />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input placeholder="e.g. 0123456789" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input placeholder="e.g. John Doe" value={accountName} onChange={e => setAccountName(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleBankWithdraw} disabled={manualWithdrawMutation.isPending}>
                  {manualWithdrawMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                    : "Submit for review"}
                </Button>
              </div>
            )}

            {/* ─ M-Pesa ─ */}
            {stage.method.id === "mpesa" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="0.5" step="0.01" placeholder="e.g. 5" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Minimum $0.50</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    You Will Receive (KES)
                    <span className="text-[10px] font-normal bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Auto · Locked</span>
                  </Label>
                  <Input
                    readOnly
                    value={
                      manualAmount && parseFloat(manualAmount) >= 0.5
                        ? `KES ${Math.round(parseFloat(manualAmount) * WITHDRAWAL_RATE).toLocaleString()}`
                        : ""
                    }
                    placeholder="KES — enter USD above"
                    className="bg-muted/60 text-muted-foreground cursor-not-allowed select-none"
                    tabIndex={-1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Rate: 1 USD = {WITHDRAWAL_RATE} KES</p>
                </div>
                <div>
                  <Label>M-Pesa Phone Number</Label>
                  <Input placeholder="e.g. +254 700 000 000" value={manualAccount} onChange={e => setManualAccount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Must be a registered Safaricom number</p>
                </div>
                <Button className="w-full" onClick={() => handleMobileWithdraw("mpesa")} disabled={manualWithdrawMutation.isPending}>
                  {manualWithdrawMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                    : "Submit for review"}
                </Button>
              </div>
            )}

            {/* ─ Airtel Money ─ */}
            {stage.method.id === "airtel" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="0.5" step="0.01" placeholder="e.g. 5" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Minimum $0.50</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    You Will Receive (KES)
                    <span className="text-[10px] font-normal bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Auto · Locked</span>
                  </Label>
                  <Input
                    readOnly
                    value={
                      manualAmount && parseFloat(manualAmount) >= 0.5
                        ? `KES ${Math.round(parseFloat(manualAmount) * WITHDRAWAL_RATE).toLocaleString()}`
                        : ""
                    }
                    placeholder="KES — enter USD above"
                    className="bg-muted/60 text-muted-foreground cursor-not-allowed select-none"
                    tabIndex={-1}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Rate: 1 USD = {WITHDRAWAL_RATE} KES</p>
                </div>
                <div>
                  <Label>Airtel Phone Number</Label>
                  <Input placeholder="e.g. +254 733 000 000" value={manualAccount} onChange={e => setManualAccount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Must be a registered Airtel number</p>
                </div>
                <Button className="w-full" onClick={() => handleMobileWithdraw("airtel")} disabled={manualWithdrawMutation.isPending}>
                  {manualWithdrawMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
                    : manualAmount && parseFloat(manualAmount) >= 0.5
                      ? `Send KES ${Math.round(parseFloat(manualAmount) * WITHDRAWAL_RATE).toLocaleString()} via Airtel`
                      : "Withdraw via Airtel Money"}
                </Button>
              </div>
            )}

            {/* ─ PayPal ─ */}
            {stage.method.id === "paypal" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="0.5" step="0.01" placeholder="e.g. 5" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Minimum $0.50</p>
                </div>
                <div>
                  <Label>PayPal Email Address</Label>
                  <Input type="email" placeholder="you@example.com" value={manualAccount} onChange={e => setManualAccount(e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => handleManualWithdraw("paypal")} disabled={manualWithdrawMutation.isPending}>
                  {manualWithdrawMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</> : "Withdraw via PayPal"}
                </Button>
              </div>
            )}

            <button className="w-full text-xs text-muted-foreground text-center underline mt-1" onClick={() => setStage({ view: "withdraw_pick" })}>
              ← Choose a different method
            </button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
