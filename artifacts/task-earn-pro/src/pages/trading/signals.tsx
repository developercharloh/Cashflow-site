import { useState, useEffect } from "react";
import { Link } from "wouter";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS, buildTicks, computeTickStats, generateSignal } from "@/lib/trading-engine";

type FilterTab = "all" | "digits" | "updown" | "highslows";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all",       label: "All" },
  { id: "digits",    label: "Digits" },
  { id: "updown",    label: "Up & Down" },
  { id: "highslows", label: "Highs & Lows" },
];

interface LiveSignal {
  id: string;
  symbol: string;
  market: string;
  category: string;
  direction: string;
  confidence: number;
  icon: string;
  iconBg: string;
  timestamp: Date;
  status: "won" | "lost" | "active";
}

function buildSignals(): LiveSignal[] {
  return MARKETS.slice(0, 12).map((m, i) => {
    const ticks = buildTicks(m.base, m.vol, 300);
    const stats = computeTickStats(ticks, ticks[ticks.length - 1].price);
    const sig = generateSignal(stats, m);
    const statuses: ("won" | "lost" | "active")[] = ["won", "won", "lost", "active", "won"];
    return {
      id: `${m.id}-${i}`,
      symbol: m.id,
      market: m.name,
      category: m.category,
      direction: sig.direction,
      confidence: sig.confidence,
      icon: m.icon,
      iconBg: m.iconBg,
      timestamp: new Date(Date.now() - i * 45000),
      status: statuses[i % statuses.length],
    };
  });
}

function fmt(d: Date) {
  return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SignalsPage() {
  const [tab, setTab] = useState<FilterTab>("all");
  const [signals, setSignals] = useState<LiveSignal[]>(buildSignals);

  useEffect(() => {
    const id = setInterval(() => {
      setSignals(prev => prev.map(s => ({
        ...s,
        confidence: Math.max(68, Math.min(97, s.confidence + (Math.random() - 0.5) * 2)),
        timestamp: s.status === "active" ? new Date() : s.timestamp,
      })));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  const filtered = signals.filter(s => tab === "all" || s.category === tab);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-black text-foreground">Signals</h1>
        <button data-testid="signals-filter-btn" className="text-muted-foreground">
          <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 px-4 mb-4">
        {FILTER_TABS.map(t => (
          <button
            key={t.id}
            data-testid={`signals-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all border",
              tab === t.id
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Signal cards */}
      <div className="px-4 space-y-2 pb-4">
        {filtered.map(sig => (
          <Link
            key={sig.id}
            href={`/markets/${sig.symbol}`}
            data-testid={`signal-card-${sig.id}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
          >
            <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0", sig.iconBg)}>
              {sig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground truncate">{sig.market}</p>
              <p className="text-sm font-black text-foreground">{sig.direction}</p>
              <p className="text-[9px] text-muted-foreground">{fmt(sig.timestamp)}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <p className={cn("text-sm font-black", sig.confidence >= 80 ? "text-primary" : "text-warning")}>
                {Math.round(sig.confidence)}%
              </p>
              <p className="text-[9px] text-muted-foreground font-semibold">CONFIDENCE</p>
              <span
                data-testid={`signal-status-${sig.id}`}
                className={cn(
                  "text-[9px] font-black px-2 py-0.5 rounded-full",
                  sig.status === "won"    ? "bg-primary/15 text-primary" :
                  sig.status === "lost"   ? "bg-destructive/15 text-destructive" :
                  "bg-warning/15 text-warning"
                )}
              >
                {sig.status.toUpperCase()}
              </span>
            </div>
          </Link>
        ))}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
            <p className="text-sm">No signals in this category</p>
          </div>
        )}
      </div>
    </div>
  );
}
