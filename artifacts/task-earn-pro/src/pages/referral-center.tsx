import { useState } from "react";
import { useGetReferralInfo, useGetReferralList } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, Copy, Link2, UsersRound, Wallet, TrendingUp, ArrowUpRight } from "lucide-react";

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export default function ReferralsPage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const infoQuery = useGetReferralInfo();
  const referralsQuery = useGetReferralList();
  const info = infoQuery.data;
  const referrals = referralsQuery.data;

  const copyLink = async () => {
    if (!info?.referralLink) return;
    try {
      await navigator.clipboard.writeText(info.referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast({ title: "Referral link copied" });
    } catch {
      toast({ title: "Could not copy the link", description: "Please select and copy the link instead.", variant: "destructive" });
    }
  };

  return (
    <div className="px-4 pb-12 pt-6 sm:px-7 sm:pt-9">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[1.6rem] border border-border bg-card p-5 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Community / referrals</p>
          <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><h1 className="font-serif text-4xl leading-none sm:text-5xl">Good work travels.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Invite someone to Lipwa Tasks. A new signup through your link earns you $1 immediately.</p></div>
            {info && <Button onClick={copyLink} className="h-11 gap-2 self-start sm:self-auto" data-testid="button-copy-referral-link">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy invite link"}</Button>}
          </div>
          {infoQuery.isLoading ? <div className="mt-6 h-14 animate-pulse rounded-xl bg-muted" /> : infoQuery.isError || !info ? (
            <div role="alert" className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
              <p className="text-sm font-semibold">Your referral details could not be loaded.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void infoQuery.refetch()}>Try again</Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <Link2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-mono text-xs text-muted-foreground" data-testid="text-referral-link">{info.referralLink}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-accent/55 px-4 py-3">
                <span className="text-xs text-muted-foreground">Your code</span><strong className="font-mono text-sm">{info.referralCode}</strong>
              </div>
            </div>
          )}
        </header>
        {infoQuery.isLoading ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />)}</div>
        ) : info ? (
          <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Referral totals">
            {[
              { label: "People invited", value: info.totalReferrals.toLocaleString(), icon: UsersRound },
              { label: "Active referrals", value: info.activeReferrals.toLocaleString(), icon: ArrowUpRight },
              { label: "Earned · pending", value: `${money(info.totalEarned)} · ${money(info.pendingEarnings)}`, icon: Wallet },
            ].map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 text-primary" /></div>
                <p className="mt-3 font-mono text-2xl tracking-tight" data-testid={`referral-metric-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p>
              </article>
            ))}
          </section>
        ) : null}
        <section className="mt-7">
          <div className="flex items-end justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">Your network</p><h2 className="mt-1 font-serif text-2xl">Referral activity</h2></div>
            {!referralsQuery.isLoading && referrals && <span className="text-xs text-muted-foreground">{referrals.length} {referrals.length === 1 ? "person" : "people"}</span>}
          </div>
          {referralsQuery.isLoading ? (
            <div className="mt-4 space-y-2" aria-label="Loading referral activity">{[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-xl border border-border bg-card" />)}</div>
          ) : referralsQuery.isError ? (
            <div role="alert" className="mt-4 rounded-xl border border-border bg-card p-5"><p className="text-sm font-semibold">Referral activity could not be loaded.</p><Button variant="outline" size="sm" className="mt-3" onClick={() => void referralsQuery.refetch()}>Try again</Button></div>
          ) : referrals?.length ? (
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {referrals.map((person) => (
                <article key={person.id} className="flex items-center gap-3 px-4 py-4 sm:px-5" data-testid={`referral-person-${person.id}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-serif text-lg text-primary">{person.name.trim().charAt(0).toUpperCase() || "?"}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{person.name}</p><p className="mt-1 text-xs text-muted-foreground">Joined {new Date(person.joinedAt).toLocaleDateString()} · {person.tasksCompleted} {person.tasksCompleted === 1 ? "task" : "tasks"} completed</p></div>
                   <div className="text-right"><Badge variant="outline" className="capitalize">{person.status}</Badge></div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-border bg-card/70 px-5 py-9 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent text-primary"><TrendingUp className="h-5 w-5" /></span>
              <h3 className="mt-3 font-semibold">Your first invite is one share away.</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-muted-foreground">Share your referral link. New signups through it earn you $1 immediately.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
