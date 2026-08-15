import { useState, useEffect } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS } from "@/lib/trading-engine";

type Filter = "all" | "won" | "lost";

interface TradeRecord {
  id: string;
  symbol: string;
  market: string;
  direction: string;
  stake: number;
  payout: number;
  profit: number;
  outcome: "won" | "lost";
  timestamp: string;
  icon: string;
  iconBg: string;
}

function loadHistory(): TradeRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem("elite_trade_history") || "[]");
    if (raw.length > 0) return raw;
  } catch { /* ignore */ }
  // Seed demo data so History isn't empty on first load
  return [
    { id: "1", symbol: "1HZ10V", market: "Volatility 10 (1s) Index", direction: "EVEN", stake: 1.00, payout: 1.87, profit: 0.87, outcome: "won",  timestamp: new Date(Date.now() - 1*60000).toISOString(), icon: "EO", iconBg: "bg-purple-600" },
    { id: "2", symbol: "1HZ25V", market: "Volatility 25 (1s) Index", direction: "OVER 5", stake: 1.00, payout: 1.82, profit: 0.82, outcome: "won",  timestamp: new Date(Date.now() - 2*60000).toISOString(), icon: "OU", iconBg: "bg-orange-500" },
    { id: "3", symbol: "R_50",   market: "Volatility 50 Index",      direction: "DIFFERS",stake: 1.00, payout: 1.78, profit: 0.78, outcome: "won",  timestamp: new Date(Date.now() - 3*60000).toISOString(), icon: "MD", iconBg: "bg-yellow-500" },
    { id: "4", symbol: "R_25",   market: "Volatility 25 Index",      direction: "RISE",   stake: 1.00, payout: 0,    profit:-1.00, outcome: "lost", timestamp: new Date(Date.now() - 4*60000).toISOString(), icon: "RF", iconBg: "bg-green-600" },
    { id: "5", symbol: "CRASH500","market": "Crash 500 Index",        direction: "NO TOUCH",stake:1.00,payout: 1.65, profit: 0.65, outcome: "won",  timestamp: new Date(Date.now() - 5*60000).toISOString(), icon: "TN", iconBg: "bg-red-600" },
  ];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function HistoryPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [records, setRecords] = useState<TradeRecord[]>(loadHistory);

  useEffect(() => {
    // Refresh from localStorage when user places new trades
    const id = setInterval(() => setRecords(loadHistory()), 3000);
    return () => clearInterval(id);
  }, []);

  const filtered = records.filter(r => filter === "all" || r.outcome === filter);

  const totals = {
    won:  records.filter(r => r.outcome === "won").length,
    lost: records.filter(r => r.outcome === "lost").length,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-black text-foreground">History</h1>
        <button data-testid="history-filter-btn" className="text-muted-foreground">
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-2 px-4 mb-3">
        <div className="flex-1 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-center">
          <p className="text-[9px] text-muted-foreground">Won</p>
          <p className="text-sm font-black text-primary">{totals.won}</p>
        </div>
        <div className="flex-1 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2 text-center">
          <p className="text-[9px] text-muted-foreground">Lost</p>
          <p className="text-sm font-black text-destructive">{totals.lost}</p>
        </div>
        <div className="flex-1 rounded-xl bg-muted border border-border px-3 py-2 text-center">
          <p className="text-[9px] text-muted-foreground">Total</p>
          <p className="text-sm font-black text-foreground">{records.length}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 mb-4">
        {(["all", "won", "lost"] as Filter[]).map(f => (
          <button
            key={f}
            data-testid={`history-filter-${f}`}
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Trade rows */}
      <div className="px-4 space-y-2 pb-4">
        {filtered.map(r => (
          <div
            key={r.id}
            data-testid={`history-row-${r.id}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
          >
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0", r.iconBg)}>
              {r.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground truncate">{r.market}</p>
              <p className="text-sm font-black text-foreground">{r.direction}</p>
              <p className="text-[9px] text-muted-foreground">{fmt(r.timestamp)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className={cn("text-sm font-black", r.outcome === "won" ? "text-primary" : "text-destructive")}>
                {r.outcome === "won" ? `+$${r.payout.toFixed(2)}` : `-$${r.stake.toFixed(2)}`}
              </p>
              <span
                data-testid={`history-outcome-${r.id}`}
                className={cn(
                  "text-[9px] font-black",
                  r.outcome === "won" ? "text-primary" : "text-destructive"
                )}
              >
                {r.outcome === "won" ? "Won" : "Lost"}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
            <p className="text-sm">No trades recorded yet</p>
            <p className="text-xs text-center">Place trades from the Markets screen to see your history here</p>
          </div>
        )}
      </div>
    </div>
  );
}
