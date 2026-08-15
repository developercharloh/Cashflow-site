import { useState } from "react";
import { useAdminGetWithdrawals, useAdminApproveWithdrawal, useAdminRejectWithdrawal, getAdminGetWithdrawalsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle, XCircle, Wallet2 } from "lucide-react";

export default function AdminWithdrawals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const { data: withdrawals, isLoading } = useAdminGetWithdrawals(
    { status: status !== "all" ? status : undefined },
    { query: { queryKey: getAdminGetWithdrawalsQueryKey({ status: status !== "all" ? status : undefined }) } }
  );
  const approveMutation = useAdminApproveWithdrawal();
  const rejectMutation = useAdminRejectWithdrawal();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminGetWithdrawalsQueryKey() });

  const handleApprove = (id: number) => {
    approveMutation.mutate({ id }, {
      onSuccess: () => { toast({ title: "Withdrawal Approved" }); invalidate(); }
    });
  };

  const handleReject = () => {
    if (!rejectId || !reason) return;
    rejectMutation.mutate({ id: rejectId, data: { reason } }, {
      onSuccess: () => { toast({ title: "Withdrawal Rejected" }); setRejectId(null); setReason(""); invalidate(); }
    });
  };

  const STATUS_STYLE: Record<string, string> = {
    pending: "text-yellow-500 border-yellow-500/30",
    completed: "text-green-500 border-green-500/30",
    rejected: "text-red-500 border-red-500/30",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Withdrawal Approvals</h1>
        <p className="text-muted-foreground mt-1">Review and process withdrawal requests</p>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {["all", "pending", "completed", "rejected"].map(s => (
            <TabsTrigger key={s} value={s} className="capitalize">{s}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet2 className="w-5 h-5" />Withdrawals ({withdrawals?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : !withdrawals || withdrawals.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No withdrawals to show</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["User", "Amount", "Method", "Account", "Date", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`withdrawal-${w.id}`}>
                      <td className="py-3 px-3 font-medium">{w.userName}</td>
                      <td className="py-3 px-3 text-green-500 font-bold">${w.amount.toFixed(2)}</td>
                      <td className="py-3 px-3 capitalize">{w.method}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs max-w-[120px] truncate">{w.accountDetails}</td>
                      <td className="py-3 px-3 text-muted-foreground text-xs">{new Date(w.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLE[w.status] ?? ""}`}>{w.status}</Badge>
                      </td>
                      <td className="py-3 px-3">
                        {w.status === "pending" && (
                          <div className="flex gap-2">
                            <Button size="sm" className="text-xs" onClick={() => handleApprove(w.id)} disabled={approveMutation.isPending} data-testid={`button-approve-${w.id}`}>
                              <CheckCircle className="w-3 h-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-xs text-red-400 border-red-400/30" onClick={() => setRejectId(w.id)} data-testid={`button-reject-${w.id}`}>
                              <XCircle className="w-3 h-3 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Reason for rejection</label>
              <Input placeholder="Enter reason..." value={reason} onChange={e => setReason(e.target.value)} className="mt-1" data-testid="input-reject-reason" />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending || !reason} data-testid="button-confirm-reject">
                {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}Reject
              </Button>
              <Button variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
