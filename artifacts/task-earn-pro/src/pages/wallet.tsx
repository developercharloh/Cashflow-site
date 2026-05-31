import { useState } from "react";
import { useGetWallet, useGetTransactions, useRequestWithdrawal, getGetWalletQueryKey, getGetTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet2, TrendingUp, ArrowDownLeft, ArrowUpRight, Loader2, DollarSign, Users, Star, CheckCircle, Clock, XCircle } from "lucide-react";

const STATUS_STYLE: Record<string, { icon: React.ReactNode; class: string }> = {
  completed: { icon: <CheckCircle className="w-3 h-3" />, class: "text-green-500 bg-green-500/10 border-green-500/20" },
  pending: { icon: <Clock className="w-3 h-3" />, class: "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" },
  rejected: { icon: <XCircle className="w-3 h-3" />, class: "text-red-500 bg-red-500/10 border-red-500/20" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  earning: <ArrowDownLeft className="w-4 h-4 text-green-500" />,
  withdrawal: <ArrowUpRight className="w-4 h-4 text-red-400" />,
  bonus: <Star className="w-4 h-4 text-yellow-500" />,
  referral: <Users className="w-4 h-4 text-blue-400" />,
};

export default function WalletPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [accountDetails, setAccountDetails] = useState("");
  const [txnType, setTxnType] = useState("all");

  const { data: wallet, isLoading } = useGetWallet();
  const { data: transactions } = useGetTransactions(
    txnType !== "all" ? { type: txnType } : {},
    { query: { queryKey: getGetTransactionsQueryKey(txnType !== "all" ? { type: txnType } : {}) } }
  );
  const withdrawMutation = useRequestWithdrawal();

  const handleWithdraw = () => {
    if (!amount || !method || !accountDetails) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    const amt = parseFloat(amount);
    withdrawMutation.mutate({ data: { amount: amt, method, accountDetails } }, {
      onSuccess: () => {
        toast({ title: "Withdrawal Requested", description: "Your request is being processed." });
        setWithdrawOpen(false);
        setAmount(""); setMethod(""); setAccountDetails("");
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetTransactionsQueryKey() });
      },
      onError: (err: any) => toast({ title: "Error", description: err.data?.error ?? err.message, variant: "destructive" })
    });
  };

  if (isLoading || !wallet) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground mt-1">Track your earnings and withdrawals</p>
        </div>
        <Button onClick={() => setWithdrawOpen(true)} data-testid="button-withdraw">
          <ArrowUpRight className="w-4 h-4 mr-2" />Withdraw Funds
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Available Balance", value: wallet.balance, icon: <Wallet2 className="w-5 h-5 text-primary" />, green: true },
          { label: "Total Earned", value: wallet.totalEarned, icon: <TrendingUp className="w-5 h-5 text-green-500" /> },
          { label: "Total Withdrawn", value: wallet.totalWithdrawn, icon: <ArrowUpRight className="w-5 h-5 text-red-400" /> },
          { label: "Pending", value: wallet.pendingEarnings, icon: <Clock className="w-5 h-5 text-yellow-500" /> },
        ].map(({ label, value, icon, green }) => (
          <Card key={label} className="border-border">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">{icon}</div>
              </div>
              <div className={`text-2xl font-bold ${green ? "text-primary" : ""}`}>
                ${value.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Task Earnings", value: wallet.totalTaskEarnings, icon: <DollarSign className="w-4 h-4 text-primary" /> },
          { label: "Referral Earnings", value: wallet.totalReferralEarnings, icon: <Users className="w-4 h-4 text-blue-400" /> },
          { label: "Bonus Earnings", value: wallet.totalBonusEarnings, icon: <Star className="w-4 h-4 text-yellow-500" /> },
        ].map(({ label, value, icon }) => (
          <Card key={label} className="border-border">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">{icon}</div>
              <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="font-semibold">${value.toFixed(2)}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            <Tabs value={txnType} onValueChange={setTxnType}>
              <TabsList className="h-8 text-xs">
                {["all", "earning", "withdrawal", "bonus", "referral"].map(t => (
                  <TabsTrigger key={t} value={t} className="text-xs px-2 h-6 capitalize">{t}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {!transactions || transactions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Wallet2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(txn => {
                const status = STATUS_STYLE[txn.status] ?? STATUS_STYLE.completed;
                return (
                  <div key={txn.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`transaction-${txn.id}`}>
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      {TYPE_ICON[txn.type] ?? <DollarSign className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{txn.description}</div>
                      <div className="text-xs text-muted-foreground">{new Date(txn.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${txn.type === "withdrawal" ? "text-red-400" : "text-green-500"}`}>
                        {txn.type === "withdrawal" ? "-" : "+"}${txn.amount.toFixed(2)}
                      </div>
                      <Badge variant="outline" className={`text-xs ${status.class}`}>
                        <span className="flex items-center gap-1">{status.icon}{txn.status}</span>
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Withdrawal</DialogTitle>
            <DialogDescription>Minimum withdrawal is $5.00</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" type="number" min="5" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} data-testid="input-amount" />
            </div>
            <div>
              <Label>Withdrawal Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger data-testid="select-method"><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="account">Account Details</Label>
              <Input id="account" placeholder="Phone number / Account number / Email" value={accountDetails} onChange={e => setAccountDetails(e.target.value)} data-testid="input-account" />
            </div>
            <Button className="w-full" onClick={handleWithdraw} disabled={withdrawMutation.isPending} data-testid="button-confirm-withdraw">
              {withdrawMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Request Withdrawal
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
