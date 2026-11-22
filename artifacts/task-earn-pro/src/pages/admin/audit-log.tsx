import { useAdminGetAuditLog } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ScrollText } from "lucide-react";

export default function AdminAuditLog() {
  const { data: entries, isLoading, isError, refetch } = useAdminGetAuditLog({ limit: 200 });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Administrator audit log</h1>
        <p className="mt-1 text-muted-foreground">Recent profile, access, role, wallet, task, and review actions.</p>
      </header>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5" />Latest actions</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
            : isError ? <div className="py-8 text-center"><p role="alert" className="text-sm">Audit entries could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => void refetch()}>Try again</Button></div>
              : !entries?.length ? <p className="py-8 text-center text-sm text-muted-foreground">No administrator actions have been recorded yet.</p>
                : <div className="space-y-3">
                  {entries.map((entry) => (
                    <article key={entry.id} className="rounded-xl border border-border p-4" data-testid={`audit-entry-${entry.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{entry.action.replaceAll("_", " ")}</Badge>
                          <span className="text-xs text-muted-foreground">{entry.adminName} · {entry.targetType} #{entry.targetId}</span>
                        </div>
                        <time className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</time>
                      </div>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-[11px] leading-5 text-muted-foreground">{JSON.stringify(entry.details, null, 2)}</pre>
                    </article>
                  ))}
                </div>}
        </CardContent>
      </Card>
    </div>
  );
}
