import { useState } from "react";
import {
  getAdminGetUsersQueryKey,
  useAdminAdjustUserBalance,
  useAdminBanUser,
  useAdminGetUsers,
  useAdminUpdateUser,
} from "@workspace/api-client-react";
import type { AdminUser, AdminUserUpdate } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Shield, ShieldOff, Users, Pencil, Wallet } from "lucide-react";

function EditAccount({ user, signedInUserId, onClose }: { user: AdminUser; signedInUserId?: number; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState({
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    country: user.country ?? "",
    level: String(user.level),
    isEmailVerified: String(user.isEmailVerified),
    isAdmin: String(user.isAdmin),
    isBanned: String(user.isBanned),
  });
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const updateMutation = useAdminUpdateUser();
  const balanceMutation = useAdminAdjustUserBalance();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
  const errorText = (error: unknown) => {
    const apiError = error as { data?: { error?: string }; message?: string };
    return apiError.data?.error ?? apiError.message ?? "Please try again.";
  };
  const saveProfile = () => {
    const data: AdminUserUpdate = {
      name: profile.name.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim() || null,
      country: profile.country.trim() || null,
      level: Number(profile.level),
      isEmailVerified: profile.isEmailVerified === "true",
      isAdmin: profile.isAdmin === "true",
      isBanned: profile.isBanned === "true",
    };
    updateMutation.mutate({ id: user.id, data }, {
      onSuccess: () => {
        toast({ title: "Account updated", description: "Profile and access changes were saved." });
        void invalidate();
        onClose();
      },
      onError: (error) => toast({ title: "Could not update account", description: errorText(error), variant: "destructive" }),
    });
  };

  const adjustBalance = () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount === 0 || reason.trim().length < 5) return;
    balanceMutation.mutate({ id: user.id, data: { amount: parsedAmount, reason: reason.trim() } }, {
      onSuccess: (updated) => {
        toast({ title: "Wallet adjusted", description: `New balance: $${updated.balance.toFixed(2)}.` });
        void invalidate();
        onClose();
      },
      onError: (error) => toast({ title: "Could not adjust wallet", description: errorText(error), variant: "destructive" }),
    });
  };

  const busy = updateMutation.isPending || balanceMutation.isPending;
  const selectField = (title: string, value: string, choices: Array<[string, string]>, onChange: (value: string) => void) => (
    <div>
      <Label>{title}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>{choices.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Manage {user.name}</DialogTitle>
        <DialogDescription>Profile, access, role, and wallet adjustments are recorded in the administrator audit log.</DialogDescription>
      </DialogHeader>
      <Tabs defaultValue="account">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account">Profile and access</TabsTrigger>
          <TabsTrigger value="balance">Wallet balance</TabsTrigger>
        </TabsList>
        <TabsContent value="account" className="space-y-4 pt-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Name</Label><Input className="mt-1" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input className="mt-1" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input className="mt-1" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <div><Label>Country</Label><Input className="mt-1" value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} /></div>
            <div>{selectField("Level", profile.level, [1,2,3,4,5,6,7].map((level) => [String(level), `Level ${level}`]), (value) => setProfile({ ...profile, level: value }))}</div>
            <div>{selectField("Email verified", profile.isEmailVerified, [["true", "Verified"], ["false", "Not verified"]], (value) => setProfile({ ...profile, isEmailVerified: value }))}</div>
            <div>{selectField("Administrator role", profile.isAdmin, [["false", "Standard user"], ["true", "Administrator"]], (value) => setProfile({ ...profile, isAdmin: value }))}</div>
            <div>{selectField("Account access", profile.isBanned, [["false", "Active"], ["true", "Suspended"]], (value) => setProfile({ ...profile, isBanned: value }))}</div>
          </div>
          {user.id === signedInUserId && <p className="text-xs text-muted-foreground">You cannot remove your own admin access or suspend your own account.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={saveProfile} disabled={busy || profile.name.trim().length < 2 || !profile.email.trim()}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save account
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="balance" className="space-y-4 pt-3">
          <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
            Current wallet balance <strong className="ml-2 text-green-600">${user.balance.toFixed(2)}</strong>
          </div>
          <div>
            <Label>Adjustment amount in USD</Label>
            <Input className="mt-1" type="number" step="0.01" min="-10000" max="10000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Positive adds · negative removes" />
            <p className="mt-1 text-xs text-muted-foreground">Use a negative amount to remove funds. An adjustment cannot make the wallet negative.</p>
          </div>
          <div><Label>Reason required</Label><Input className="mt-1" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain the reason for this adjustment" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button onClick={adjustBalance} disabled={busy || !Number(amount) || reason.trim().length < 5}>
              {balanceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record adjustment
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: signedInUser } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { data: users, isLoading } = useAdminGetUsers({ search: search || undefined }, {
    query: { queryKey: getAdminGetUsersQueryKey({ search: search || undefined }) },
  });
  const banMutation = useAdminBanUser();

  const handleBan = (id: number, banned: boolean) => {
    banMutation.mutate({ id, data: { banned } }, {
      onSuccess: () => {
        toast({ title: banned ? "User suspended" : "User restored" });
        void queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
      },
      onError: (error) => toast({ title: "Could not change account access", description: (() => { const apiError = error as { data?: { error?: string }; message?: string }; return apiError.data?.error ?? apiError.message ?? "Please try again."; })(), variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="mt-1 text-muted-foreground">Manage profiles, account access, admin roles, and audited wallet adjustments.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" />
      </div>
      <Card className="border-border">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Users ({users?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : !users?.length ? <div className="py-10 text-center text-muted-foreground">No users found</div>
              : <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border">{["Name", "Email", "Level", "Balance", "Tasks", "Status", "Actions"].map((heading) => <th key={heading} className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">{heading}</th>)}</tr></thead>
                  <tbody>
                    {users.map((account) => (
                      <tr key={account.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`user-${account.id}`}>
                        <td className="px-3 py-3 font-medium">{account.name}</td>
                        <td className="px-3 py-3 text-muted-foreground">{account.email}</td>
                        <td className="px-3 py-3"><Badge variant="outline">Level {account.level}</Badge></td>
                        <td className="px-3 py-3 font-medium text-green-500">${account.balance.toFixed(2)}</td>
                        <td className="px-3 py-3">{account.tasksCompleted}</td>
                        <td className="px-3 py-3">
                          {account.isBanned ? <Badge variant="outline" className="border-red-500/30 text-red-500">Suspended</Badge>
                            : account.isAdmin ? <Badge variant="outline" className="border-purple-500/30 text-purple-500">Admin</Badge>
                              : <Badge variant="outline" className="border-green-500/30 text-green-500">Active</Badge>}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => setSelectedUser(account)} data-testid={`button-edit-user-${account.id}`}><Pencil className="mr-1 h-3 w-3" />Manage</Button>
                            {!account.isAdmin && <Button size="sm" variant="ghost" onClick={() => handleBan(account.id, !account.isBanned)} disabled={banMutation.isPending} data-testid={`button-ban-${account.id}`} className={account.isBanned ? "text-green-600" : "text-red-500"}>
                              {account.isBanned ? <><Shield className="mr-1 h-3 w-3" />Restore</> : <><ShieldOff className="mr-1 h-3 w-3" />Suspend</>}
                            </Button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </CardContent>
      </Card>
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" />Every manual wallet change creates a wallet transaction and admin audit entry.</div>
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        {selectedUser && <EditAccount user={selectedUser} signedInUserId={signedInUser?.id} onClose={() => setSelectedUser(null)} />}
      </Dialog>
    </div>
  );
}
