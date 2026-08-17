import { useState, useEffect } from "react";
import {
  BookOpen, TrendingUp, TrendingDown, RefreshCw,
  CheckCircle2, XCircle, Filter, Trophy, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  status: string;
  description: string;
  createdAt: string;
}

type Filter = "all" | "won" | "lost";

function fmt(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function parseTradeFromDesc(desc: string): { market?: string; contractLabel?: string; isWin: boolean; stake?: number } | null {
  const isWin = desc.includes("WIN");
  const stakeMatch = desc.match(/\$(\d+(?:\.\d+)?)/);
  const stake = stakeMatch ? parseFloat(stakeMatch[1]) : undefined;

  // Try to parse: "V50 | ODD → WIN +$9.00"
  const pipeMatch = desc.match(/^(.+?)\s*\|\s*(.+?)\s*→/);
  if (pipeMatch) {
    return { market: pipeMatch[1].trim(), contractLabel: pipeMatch[2].trim(), isWin, stake };
  }

  // Legacy: "Binary ODD WIN — stake $10.00"
  const legacyMatch = desc.match(/Binary\s+(\w+)\s+(WIN|LOSS)/i);
  if (legacyMatch) {
    return { contractLabel: legacyMatch[1], isWin, stake };
  }

  return { isWin, stake };
}

export default function HistoryPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRealMode] = useState(() => localStorage.getItem("trading_mode") === "real");

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        // Demo mode — show localStorage trades
        loadDemoHistory();
        return;
      }
      const res = await fetch("/api/wallet/transactions?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // Filter to binary trade transactions only
      const trades = (data.transactions ?? []).filter((t: Transaction) =>
        t.description?.toLowerCase().includes("win") ||
        t.description?.toLowerCase().includes("loss") ||
        t.description?.toLowerCase().includes("binary") ||
        t.description?.toLowerCase().includes("signal")
      );
      setTransactions(trades);
    } catch {
      loadDemoHistory();
    } finally {
      setIsLoading(false);
    }
  };

  const loadDemoHistory = () => {
    try {
      const raw = localStorage.getItem("elite_trade_history");
      if (raw) {
        const parsed = JSON.parse(raw);
        // Convert to transaction-like structure
        const mapped: Transaction[] = parsed.map((t: Record<string, unknown>, i: number) => ({
          id: i + 1,
          type: (t.win as boolean) ? "earning" : "withdrawal",
          amount: (t.win as boolean) ? (t.payout as number ?? 0) : (t.stake as number ?? 0),
          status: "completed",
          description: `${t.marketName ?? "Signal"} | ${t.contractLabel ?? "TRADE"} → ${(t.win as boolean) ? "WIN" : "LOSS"} $${(t.stake as number ?? 0).toFixed(2)}`,
          createdAt: (t.timestamp as string) ?? new Date().toISOString(),
        }));
        setTransactions(mapped.reverse());
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  };

  useEffect(() => { fetchTransactions(); }, []);

  // Parse all trades
  const parsedTrades = transactions.map(t => {
    const parsed = parseTradeFromDesc(t.description);
    return { ...t, parsed };
  });

  const filteredTrades = parsedTrades.filter(t => {
    if (filter === "won") return t.parsed?.isWin;
    if (filter === "lost") return t.parsed && !t.parsed.isWin;
    return true;
  });

  const totalTrades = parsedTrades.length;
  const wins = parsedTrades.filter(t => t.parsed?.isWin).length;
  const losses = totalTrades - wins;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  // Estimate P&L from transactions
  const totalPnl = parsedTrades.reduce((acc, t) => {
    if (t.parsed?.isWin) return acc + (t.amount - (t.parsed.stake ?? 0));
    return acc - (t.parsed?.stake ?? t.amount);
  }, 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <BookOpen size={20} className="text-primary" />
              Trade Journal
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              All auto AI execution history
            </p>
          </div>
          <button
            onClick={fetchTransactions}
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 text-muted-foreground hover:text-white transition-all"
          >
            <RefreshCw size={15} className={cn(isLoading && "animate-spin")} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center col-span-1">
            <p className="text-xl font-black text-white">{totalTrades}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Trades</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <p className="text-xl font-black text-emerald-400">{wins}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Wins</p>
          </div>
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
            <p className="text-xl font-black text-rose-400">{losses}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Losses</p>
          </div>
          <div className={cn(
            "rounded-xl border p-3 text-center",
            winRate >= 50 ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"
          )}>
            <p className={cn("text-xl font-black", winRate >= 50 ? "text-emerald-400" : "text-rose-400")}>
              {winRate}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Win Rate</p>
          </div>
        </div>

        {/* Total P&L */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">All-time P&L</span>
            </div>
            <span className={cn(
              "text-2xl font-black",
              totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"
            )}>
              {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
          {(["all", "won", "lost"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                filter === f
                  ? f === "won"
                    ? "bg-emerald-500 text-white"
                    : f === "lost"
                      ? "bg-rose-500 text-white"
                      : "bg-white/20 text-white"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              {f === "all" ? `All (${totalTrades})` : f === "won" ? `Won (${wins})` : `Lost (${losses})`}
            </button>
          ))}
        </div>

        {/* Trade list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="py-16 text-center">
            <Trophy size={40} className="mx-auto text-white/10 mb-3" />
            <p className="text-muted-foreground">No trades yet</p>
            <p className="text-xs text-white/20 mt-1">
              Start auto AI execution to see trades here
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTrades.map(trade => {
              const isWin = trade.parsed?.isWin ?? false;
              const market = trade.parsed?.market;
              const contractLabel = trade.parsed?.contractLabel ?? trade.description;
              const date = new Date(trade.createdAt);

              return (
                <div
                  key={trade.id}
                  className={cn(
                    "rounded-xl border p-3 flex items-center gap-3 transition-all",
                    isWin
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-rose-500/20 bg-rose-500/5"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    isWin ? "bg-emerald-500/15" : "bg-rose-500/15"
                  )}>
                    {isWin
                      ? <CheckCircle2 size={18} className="text-emerald-400" />
                      : <XCircle size={18} className="text-rose-400" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {market && (
                        <span className="text-xs font-bold text-white/70">{market}</span>
                      )}
                      {market && <span className="text-white/20 text-xs">·</span>}
                      <span className={cn(
                        "text-xs font-black",
                        isWin ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {contractLabel}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {date.toLocaleDateString()} · {date.toLocaleTimeString()}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    {isWin ? (
                      <>
                        <p className="text-sm font-black text-emerald-400">
                          +${trade.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center justify-end gap-0.5 text-[10px] text-emerald-400/60">
                          <TrendingUp size={9} /> WIN
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-black text-rose-400">
                          -${trade.amount.toFixed(2)}
                        </p>
                        <div className="flex items-center justify-end gap-0.5 text-[10px] text-rose-400/60">
                          <TrendingDown size={9} /> LOSS
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Demo note */}
        {!isRealMode && (
          <p className="text-center text-xs text-white/20 pb-4">
            Showing demo session history · Switch to Real mode for live trade records
          </p>
        )}
      </div>
    </div>
  );
}
