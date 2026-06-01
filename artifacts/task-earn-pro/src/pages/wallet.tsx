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
  Wallet2, TrendingUp, ArrowDownLeft, ArrowUpRight, Loader2,
  DollarSign, Users, Star, CheckCircle, Clock, XCircle,
  Plus, Banknote, CreditCard, Landmark, RefreshCw, AlertCircle,
} from "lucide-react";

const STATUS_STYLE: Record<string, { icon: React.ReactNode; class: string }> = {
  completed: { icon: <CheckCircle className="w-3 h-3" />, class: "text-green-600 bg-green-50 border-green-200" },
  pending:   { icon: <Clock      className="w-3 h-3" />, class: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  rejected:  { icon: <XCircle   className="w-3 h-3" />, class: "text-red-500 bg-red-50 border-red-200" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  earning:    <ArrowDownLeft className="w-4 h-4 text-green-600" />,
  deposit:    <Plus          className="w-4 h-4 text-blue-500" />,
  withdrawal: <ArrowUpRight  className="w-4 h-4 text-red-500" />,
  bonus:      <Star          className="w-4 h-4 text-yellow-500" />,
  referral:   <Users         className="w-4 h-4 text-blue-400" />,
};

type ModalType = "deposit" | "withdraw_paystack" | "withdraw_manual" | null;

export default function WalletPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modal, setModal] = useState<ModalType>(null);
  const [txnType, setTxnType] = useState("all");

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("");
  const [manualAccount, setManualAccount] = useState("");

  const { data: wallet, isLoading } = useGetWallet();
  const { data: transactions } = useGetTransactions(
    txnType !== "all" ? { type: txnType } : {},
    { query: { queryKey: getGetTransactionsQueryKey(txnType !== "all" ? { type: txnType } : {}) } }
  );
  const { data: banks } = useGetBanks({
    query: { queryKey: ["getBanks"], enabled: modal === "withdraw_paystack" },
  });

  const depositMutation = useInitializeDeposit();
  const paystackWithdrawMutation = usePaystackWithdraw();
  const manualWithdrawMutation = useRequestWithdrawal();
  const verifyPendingMutation = useVerifyPendingDeposits();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    qc.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
  };

  // On every wallet page load — silently verify any pending Paystack deposits.
  // This catches the case where the API was down during the redirect callback.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reference") || params.get("trxref")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    verifyPendingMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.count > 0) {
          const total = (data.credited ?? []).reduce((s, c) => s + c.amount, 0);
          toast({
            title: "Deposit Confirmed!",
            description: `$${total.toFixed(2)} has been credited to your wallet.`,
          });
          invalidate();
        }
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeposit = () => {
    const amt = parseFloat(depositAmount);
    if (!amt || amt < 1) { toast({ title: "Minimum deposit is $1", variant: "destructive" }); return; }
    depositMutation.mutate({ data: { amount: amt } }, {
      onSuccess: (data) => { window.location.href = data.authorizationUrl; },
      onError: (err: any) => toast({ title: "Deposit failed", description: err.data?.error ?? err.message, variant: "destructive" }),
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

  const handlePaystackWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt < 5) { toast({ title: "Minimum withdrawal is $5", variant: "destructive" }); return; }
    if (!bankCode || !accountNumber || !accountName) {
      toast({ title: "Please fill all bank details", variant: "destructive" }); return;
    }
    paystackWithdrawMutation.mutate({ data: { amount: amt, bankCode, accountNumber, accountName } }, {
      onSuccess: () => {
        toast({ title: "Withdrawal Initiated", description: "Paystack is processing your transfer." });
        setModal(null);
        setWithdrawAmount(""); setBankCode(""); setAccountNumber(""); setAccountName("");
        invalidate();
      },
      onError: (err: any) => toast({ title: "Withdrawal failed", description: err.data?.error ?? err.message, variant: "destructive" }),
    });
  };

  const handleManualWithdraw = () => {
    const amt = parseFloat(manualAmount);
    if (!amt || !manualMethod || !manualAccount) {
      toast({ title: "Please fill all fields", variant: "destructive" }); return;
    }
    manualWithdrawMutation.mutate({ data: { amount: amt, method: manualMethod, accountDetails: manualAccount } }, {
      onSuccess: () => {
        toast({ title: "Withdrawal Requested", description: "Your request is being reviewed." });
        setModal(null);
        setManualAmount(""); setManualMethod(""); setManualAccount("");
        invalidate();
      },
      onError: (err: any) => toast({ title: "Error", description: err.data?.error ?? err.message, variant: "destructive" }),
    });
  };

  const hasPendingDeposit = transactions?.some(t => t.type === "deposit" && t.status === "pending");

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

      {/* Pending deposit alert banner */}
      {hasPendingDeposit && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-800">Payment pending confirmation</p>
            <p className="text-xs text-yellow-700">Already paid? Tap to check your deposit status.</p>
          </div>
          <button
            onClick={handleCheckPending}
            disabled={verifyPendingMutation.isPending}
            className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-yellow-800 border border-yellow-300 rounded-lg px-3 py-1.5 hover:bg-yellow-100 transition-colors"
          >
            {verifyPendingMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />}
            Check
          </button>
        </div>
      )}

      {/* Balance card */}
      <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg,#0f2027 0%,#203a43 50%,#2c5364 100%)" }}>
        <p className="text-xs opacity-60 mb-1">Available Balance</p>
        <p className="text-4xl font-bold mb-1">${wallet.balance.toFixed(2)}</p>
        <p className="text-xs opacity-50 mb-5">Available to withdraw or use</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setModal("deposit")}
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(90deg,#2563eb,#3b82f6)" }}
          >
            <Plus className="w-4 h-4" /> Deposit
          </button>
          <button
            onClick={() => setModal("withdraw_paystack")}
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
          { label: "Tasks",    value: wallet.totalTaskEarnings,    icon: <DollarSign className="w-3.5 h-3.5 text-primary" /> },
          { label: "Referrals", value: wallet.totalReferralEarnings, icon: <Users className="w-3.5 h-3.5 text-blue-500" /> },
          { label: "Bonuses",  value: wallet.totalBonusEarnings,   icon: <Star className="w-3.5 h-3.5 text-yellow-500" /> },
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

      {/* ── DEPOSIT MODAL ──────────────────────────────────────────────────────── */}
      <Dialog open={modal === "deposit"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Deposit via Paystack
            </DialogTitle>
            <DialogDescription>
              Pay securely with card, bank transfer, USSD, or mobile money.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Amount (USD)</Label>
              <Input
                type="number" min="1" placeholder="e.g. 10"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum $1.00 · You will be redirected to Paystack</p>
            </div>
            <Button className="w-full" onClick={handleDeposit} disabled={depositMutation.isPending}>
              {depositMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting…</>
                : "Pay with Paystack →"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PAYSTACK WITHDRAW MODAL ────────────────────────────────────────────── */}
      <Dialog open={modal === "withdraw_paystack"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-green-600" /> Bank Transfer (Paystack)
            </DialogTitle>
            <DialogDescription>Withdraw directly to your bank. Minimum $5.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" min="5" placeholder="e.g. 20" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} />
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
            <Button className="w-full" onClick={handlePaystackWithdraw} disabled={paystackWithdrawMutation.isPending}>
              {paystackWithdrawMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processing…</>
                : "Withdraw via Paystack"}
            </Button>
            <button
              className="w-full text-xs text-muted-foreground underline text-center"
              onClick={() => setModal("withdraw_manual")}
            >
              Use M-Pesa / PayPal instead
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MANUAL WITHDRAW MODAL ─────────────────────────────────────────────── */}
      <Dialog open={modal === "withdraw_manual"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-orange-500" /> Manual Withdrawal
            </DialogTitle>
            <DialogDescription>M-Pesa, Airtel, or PayPal. Processed within 24 hours. Minimum $5.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" min="5" placeholder="e.g. 10" value={manualAmount} onChange={e => setManualAmount(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={manualMethod} onValueChange={setManualMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="airtel">Airtel Money</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account / Phone / Email</Label>
              <Input placeholder="e.g. +254 700 000 000" value={manualAccount} onChange={e => setManualAccount(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleManualWithdraw} disabled={manualWithdrawMutation.isPending}>
              {manualWithdrawMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Submitting…</>
                : "Request Withdrawal"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
