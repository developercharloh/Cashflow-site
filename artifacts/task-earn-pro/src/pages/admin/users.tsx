import { useState } from "react";
import { useAdminGetUsers, useAdminBanUser, getAdminGetUsersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Shield, ShieldOff, Users } from "lucide-react";

export default function AdminUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: users, isLoading } = useAdminGetUsers({ search: search || undefined }, {
    query: { queryKey: getAdminGetUsersQueryKey({ search: search || undefined }) }
  });
  const banMutation = useAdminBanUser();

  const handleBan = (id: number, banned: boolean) => {
    banMutation.mutate({ id, data: { banned } }, {
      onSuccess: () => {
        toast({ title: banned ? "User Banned" : "User Unbanned", description: `User has been ${banned ? "banned" : "unbanned"}.` });
        queryClient.invalidateQueries({ queryKey: getAdminGetUsersQueryKey() });
      }
    });
  };

  const LEVEL_NAMES: Record<number, string> = { 1: "Explorer", 2: "Builder", 3: "Professional", 4: "Elite" };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">View and manage platform users</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />Users ({users?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Name", "Email", "Level", "Balance", "Tasks", "Status", "Actions"].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-xs text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`user-${user.id}`}>
                      <td className="py-3 px-3 font-medium">{user.name}</td>
                      <td className="py-3 px-3 text-muted-foreground">{user.email}</td>
                      <td className="py-3 px-3">
                        <Badge variant="outline">{LEVEL_NAMES[user.level]}</Badge>
                      </td>
                      <td className="py-3 px-3 text-green-500 font-medium">${user.balance.toFixed(2)}</td>
                      <td className="py-3 px-3">{user.tasksCompleted}</td>
                      <td className="py-3 px-3">
                        {user.isBanned ? (
                          <Badge variant="outline" className="text-red-500 border-red-500/30">Banned</Badge>
                        ) : user.isAdmin ? (
                          <Badge variant="outline" className="text-purple-500 border-purple-500/30">Admin</Badge>
                        ) : (
                          <Badge variant="outline" className="text-green-500 border-green-500/30">Active</Badge>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {!user.isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBan(user.id, !user.isBanned)}
                            disabled={banMutation.isPending}
                            data-testid={`button-ban-${user.id}`}
                            className={user.isBanned ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}
                          >
                            {user.isBanned ? <><Shield className="w-3 h-3 mr-1" />Unban</> : <><ShieldOff className="w-3 h-3 mr-1" />Ban</>}
                          </Button>
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
    </div>
  );
}
