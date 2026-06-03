import { useState, useEffect } from "react";
import {
  useGetWallet, useGetTransactions, useRequestWithdrawal,
  useInitializeDeposit, usePaystackWithdraw, useGetBanks,
  useVerifyPendingDeposits,
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
  ChevronRight, Smartphone, Building2, Banknote,
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
    id: "card",
    label: "Card Payment",
    sub: "Visa, Mastercard, Verve",
    icon: <CreditCard className="w-6 h-6 text-blue-500" />,
    color: "border-blue-100 bg-blue-50/50",
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    sub: "Safaricom mobile money",
    icon: <Smartphone className="w-6 h-6 text-green-600" />,
    color: "border-green-100 bg-green-50/50",
  },
  {
    id: "airtel",
    label: "Airtel Money",
    sub: "Airtel mobile money",
    icon: <Smartphone className="w-6 h-6 text-red-500" />,
    color: "border-red-100 bg-red-50/50",
  },
  {
    id: "bank",
    label: "Bank Transfer",
    sub: "Direct bank deposit",
    icon: <Building2 className="w-6 h-6 text-purple-500" />,
    color: "border-purple-100 bg-purple-50/50",
  },
];

const WITHDRAW_METHODS = [
  {
    id: "bank_paystack",
    label: "Bank Transfer",
    sub: "Instant via Paystack",
    icon: <Landmark className="w-6 h-6 text-green-600" />,
    color: "border-green-100 bg-green-50/50",
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    sub: "Safaricom mobile money",
    icon: <Smartphone className="w-6 h-6 text-green-600" />,
    color: "border-green-100 bg-green-50/50",
  },
  {
    id: "airtel",
    label: "Airtel Money",
    sub: "Airtel mobile money",
    icon: <Smartphone className="w-6 h-6 text-red-500" />,
    color: "border-red-100 bg-red-50/50",
  },
  {
    id: "paypal",
    label: "PayPal",
    sub: "Processed within 24 hours",
    icon: <Banknote className="w-6 h-6 text-blue-600" />,
    color: "border-blue-100 bg-blue-50/50",
  },
];

// Maps deposit method id → Paystack channel(s)
const PAYSTACK_CHANNELS: Record<string, string[]> = {
  card:   ["card"],
  mpesa:  ["mobile_money"],
  airtel: ["mobile_money"],
  bank:   ["bank"],
};

type Stage =
  | { view: "none" }
  | { view: "deposit_pick" }
  | { view: "withdraw_pick" }
  | { view: "deposit_form"; method: typeof DEPOSIT_METHODS[0] }
  | { view: "withdraw_form"; method: typeof WITHDRAW_METHODS[0] };

export default function WalletPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [stage, setStage] = useState<Stage>({ view: "none" });
  const [txnType, setTxnType] = useState("all");

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPhone, setDepositPhone] = useState("");

  // Bank withdrawal state (Paystack)
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  // Manual withdrawal state (M-Pesa / Airtel / PayPal)
  const [manualAmount, setManualAmount] = useState("");
  const [manualAccount, setManualAccount] = useState("");

  // Exchange rates
  const DEPOSIT_RATE = 134;    // 1 USD = 134 KES (deposit)
  const WITHDRAWAL_RATE = 121; // 1 USD = 121 KES (withdrawal)

  const isMobileMoney = (id: string) => id === "mpesa" || id === "airtel";

  const { data: wallet, isLoading } = useGetWallet();
  const { data: transactions } = useGetTransactions(
    txnType !== "all" ? { type: txnType } : {},
    { query: { queryKey: getGetTransactionsQueryKey(txnType !== "all" ? { type: txnType } : {}) } }
  );
  const { data: banks } = useGetBanks({
    query: {
      queryKey: ["getBanks"],
      enabled: stage.view === "withdraw_form" && (stage as any).method?.id === "bank_paystack",
    },
  });

  const depositMutation = useInitializeDeposit();
  const paystackWithdrawMutation = usePaystackWithdraw();
  const manualWithdrawMutation = useRequestWithdrawal();
  const verifyPendingMutation = useVerifyPendingDeposits();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
  };

  const close = () => {
    setStage({ view: "none" });
    setDepositAmount(""); setDepositPhone("");
    setWithdrawAmount(""); setBankCode(""); setAccountNumber(""); setAccountName("");
    setManualAmount(""); setManualAccount("");
  };

  // Auto-verify pending deposits on every wallet load
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

  const handleDeposit = (method: typeof DEPOSIT_METHODS[0]) => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 0.1) { toast({ title: "Minimum deposit is $0.10", variant: "destructive" }); return; }
    if (isMobileMoney(method.id) && !depositPhone.trim()) {
      toast({ title: "Phone number required", description: "Enter your M-Pesa/Airtel phone number.", variant: "destructive" }); return;
    }
    depositMutation.mutate(
      { data: { amount: amt, method: method.id, phone: depositPhone.trim() || undefined } } as any,
      {
        onSuccess: (data: any) => { window.location.href = data.authorizationUrl; },
        onError: (err: any) => toast({ title: "Deposit failed", description: err.data?.error ?? err.message, variant: "destructive" }),
      }
    );
  };

  const handleBankWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 50) { toast({ title: "Minimum withdrawal is $50", variant: "destructive" }); return; }
    if (!bankCode || !accountNumber || !accountName) {
      toast({ title: "Please fill all bank details", variant: "destructive" }); return;
    }
    paystackWithdrawMutation.mutate({ data: { amount: amt, bankCode, accountNumber, accountName } }, {
      onSuccess: () => {
        toast({ title: "Withdrawal Initiated", description: "Paystack is processing your bank transfer." });
        close();
        invalidate();
      },
      onError: (err: any) => toast({ title: "Withdrawal failed", description: err.data?.error ?? err.message, variant: "destructive" }),
    });
  };

  const handleManualWithdraw = (methodId: string) => {
    const amt = parseFloat(manualAmount);
    if (!amt || amt < 50) { toast({ title: "Minimum withdrawal is $50", variant: "destructive" }); return; }
    if (!manualAccount) { toast({ title: "Please enter your account details", variant: "destructive" }); return; }
    manualWithdrawMutation.mutate({ data: { amount: amt, method: methodId, accountDetails: manualAccount } }, {
      onSuccess: () => {
        toast({ title: "Withdrawal Requested", description: "We'll process it within 24 hours." });
        close();
        invalidate();
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
            onClick={() => setStage({ view: "withdraw_pick" })}
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
                <div key={txn.id} className="flex items-center gap-3 p-4">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {TYPE_ICON[txn.type] ?? <DollarSign className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{txn.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(txn.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${txn.type === "withdrawal" ? "text-red-500" : "text-green-600"}`}>
                      {txn.type === "withdrawal" ? "-" : "+"}${txn.amount.toFixed(2)}
                    </p>
                    <Badge variant="outline" className={`text-[9px] ${status.class}`}>
                      <span className="flex items-center gap-0.5">{status.icon}{txn.status}</span>
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════ MODALS ══════════════════ */}

      {/* ── DEPOSIT: method picker ─────────────────── */}
      <Dialog open={stage.view === "deposit_pick"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Deposit Method</DialogTitle>
            <DialogDescription>Select how you want to fund your wallet</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            {DEPOSIT_METHODS.map(m => (
              <button
                key={m.id}
                onClick={() => setStage({ view: "deposit_form", method: m })}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors hover:border-primary/40 text-left ${m.color}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                  {m.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
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

              {/* Phone number — only for mobile money */}
              {isMobileMoney(stage.method.id) && (
                <div>
                  <Label>{stage.method.id === "airtel" ? "Airtel" : "M-Pesa"} Phone Number</Label>
                  <Input
                    type="tel"
                    placeholder="e.g. 0712345678 or +254712345678"
                    value={depositPhone}
                    onChange={e => setDepositPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">You will receive an STK push on this number</p>
                </div>
              )}

              <Button className="w-full" onClick={() => handleDeposit(stage.method)} disabled={depositMutation.isPending}>
                {depositMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
                  : depositAmount && parseFloat(depositAmount) >= 0.1
                    ? `Pay KES ${Math.round(parseFloat(depositAmount) * DEPOSIT_RATE).toLocaleString()} via ${stage.method.label} →`
                    : `Checkout →`}
              </Button>
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
                onClick={() => setStage({ view: "withdraw_form", method: m })}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-colors hover:border-primary/40 text-left ${m.color}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
                  {m.icon}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{m.label}</p>
                  <p className="text-xs text-muted-foreground">{m.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
                  <DialogDescription>Minimum $50.00 · Balance: ${wallet.balance.toFixed(2)}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* ─ Bank Transfer (Paystack) ─ */}
            {stage.method.id === "bank_paystack" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="50" placeholder="e.g. 50" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
                </div>
                <div>
                  <Label>Select Bank</Label>
                  <Select value={bankCode} onValueChange={setBankCode}>
                    <SelectTrigger>
                      <SelectValue placeholder={banks ? "Select your bank" : "Loading banks…"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(banks ?? []).map(b => (
                        <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input placeholder="e.g. 0123456789" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input placeholder="e.g. John Doe" value={accountName} onChange={e => setAccountName(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleBankWithdraw} disabled={paystackWithdrawMutation.isPending}>
                  {paystackWithdrawMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
                    : "Withdraw via Bank Transfer"}
                </Button>
              </div>
            )}

            {/* ─ M-Pesa ─ */}
            {stage.method.id === "mpesa" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="50" placeholder="e.g. 50" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Minimum $50.00</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    You Will Receive (KES)
                    <span className="text-[10px] font-normal bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Auto · Locked</span>
                  </Label>
                  <Input
                    readOnly
                    value={
                      manualAmount && parseFloat(manualAmount) >= 5
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
                <Button className="w-full" onClick={() => handleManualWithdraw("mpesa")} disabled={manualWithdrawMutation.isPending}>
                  {manualWithdrawMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                    : manualAmount && parseFloat(manualAmount) >= 5
                      ? `Withdraw KES ${Math.round(parseFloat(manualAmount) * WITHDRAWAL_RATE).toLocaleString()} via M-Pesa`
                      : "Withdraw via M-Pesa"}
                </Button>
              </div>
            )}

            {/* ─ Airtel Money ─ */}
            {stage.method.id === "airtel" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="50" placeholder="e.g. 50" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Minimum $50.00</p>
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    You Will Receive (KES)
                    <span className="text-[10px] font-normal bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5">Auto · Locked</span>
                  </Label>
                  <Input
                    readOnly
                    value={
                      manualAmount && parseFloat(manualAmount) >= 5
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
                <Button className="w-full" onClick={() => handleManualWithdraw("airtel")} disabled={manualWithdrawMutation.isPending}>
                  {manualWithdrawMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                    : manualAmount && parseFloat(manualAmount) >= 5
                      ? `Withdraw KES ${Math.round(parseFloat(manualAmount) * WITHDRAWAL_RATE).toLocaleString()} via Airtel`
                      : "Withdraw via Airtel Money"}
                </Button>
              </div>
            )}

            {/* ─ PayPal ─ */}
            {stage.method.id === "paypal" && (
              <div className="space-y-4 pt-1">
                <div>
                  <Label>Amount (USD)</Label>
                  <Input type="number" min="50" placeholder="e.g. 50" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
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
