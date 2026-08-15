import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Eye, EyeOff, Menu, RefreshCw, Zap, TrendingUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import {
  MARKETS, DEMO_START, buildTicks, nextPrice, computeTickStats,
  generateSignal, type AccountMode,
} from "@/lib/trading-engine";

const DIGIT_MARKETS = MARKETS.filter(m => m.category === "digits").slice(0, 3);

function MiniChart({ color, positive }: { color: string; positive: boolean }) {
  const pts = useRef(Array.from({ length: 20 }, () => 50 + Math.random() * 30));
  const [data, setData] = useState(pts.current.map((v, i) => ({ v, i })));
  useEffect(() => {
    const id = setInterval(() => {
      const last = pts.current[pts.current.length - 1];
      const next = Math.max(10, Math.min(90, last + (Math.random() - 0.48) * 8));
      pts.current = [...pts.current.slice(1), next];
      setData(pts.current.map((v, i) => ({ v, i })));
    }, 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`mg-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={positive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
            <stop offset="100%" stopColor={positive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={[0, 100]} hide />
        <Area type="monotone" dataKey="v" stroke={positive ? "#22c55e" : "#ef4444"} strokeWidth={1.5}
          fill={`url(#mg-${color})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface ActiveSignal {
  symbol: string;
  market: string;
  direction: string;
  confidence: number;
  positive: boolean;
}

export default function TradingHome() {
  const { user } = useAuth();

  const [mode, setMode] = useState<AccountMode>(() =>
    (localStorage.getItem("trading_mode") as AccountMode) || "demo"
  );
  const [demo, setDemo] = useState(() => {
    const s = localStorage.getItem("elite_demo");
    return s ? parseFloat(s) : DEMO_START;
  });
  const [showBalance, setShowBalance] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const realBalance = user?.balance ?? 0;
  const balance = mode === "demo" ? demo : realBalance;

  const todayGain = mode === "demo" ? 542.30 : 0;
  const todayPct  = mode === "demo" ? 5.58   : 0;

  // Live performance chart data
  const [chartData, setChartData] = useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      t: i,
      v: 200 + Math.sin(i / 4) * 120 + Math.random() * 80,
    }))
  );

  useEffect(() => {
    const id = setInterval(() => {
      setChartData(prev => {
        const last = prev[prev.length - 1].v;
        const next = Math.max(50, last + (Math.random() - 0.44) * 30);
        return [...prev.slice(1), { t: prev[prev.length - 1].t + 1, v: next }];
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Active signals computed from tick stats
  const [signals, setSignals] = useState<ActiveSignal[]>([]);
  useEffect(() => {
    const sigs: ActiveSignal[] = DIGIT_MARKETS.map(m => {
      const ticks = buildTicks(m.base, m.vol, 200);
      const stats = computeTickStats(ticks, ticks[ticks.length - 1].price);
      const sig = generateSignal(stats, m);
      return { symbol: m.id, market: m.name, direction: sig.direction, confidence: sig.confidence, positive: sig.direction !== "FALL" && sig.direction !== "ODD" };
    });
    setSignals(sigs);
    const id = setInterval(() => {
      setSignals(prev => prev.map(s => ({
        ...s,
        confidence: Math.max(70, Math.min(97, s.confidence + (Math.random() - 0.5) * 3)),
      })));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const stats = [
    { label: "Win Rate",       value: mode === "demo" ? "86.7%" : "—",        positive: true  },
    { label: "Total Signals",  value: mode === "demo" ? "152"    : "0",        positive: true  },
    { label: "Profits",        value: mode === "demo" ? "$1,256" : "$0.00",    positive: true  },
    { label: "Losses",         value: mode === "demo" ? "$193"   : "$0.00",    positive: false },
  ];

  const switchMode = (m: AccountMode) => {
    setMode(m);
    localStorage.setItem("trading_mode", m);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <button data-testid="menu-btn" onClick={() => setMenuOpen(o => !o)} className="text-muted-foreground">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black tracking-widest text-primary">ELITE</span>
          <div className="flex gap-0.5">
            {[0,1,2,3].map(i => <div key={i} className={cn("w-0.5 rounded-full bg-primary", i % 2 === 0 ? "h-3" : "h-4")} />)}
          </div>
          <span className="text-xs font-black tracking-widest text-foreground">SIGNALS PRO</span>
        </div>
        <Link href="/notifications" className="relative text-muted-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full" />
        </Link>
      </header>

      <div className="px-4 space-y-3 pb-4">
        {/* Balance card */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium">Virtual Balance</span>
            <div className="flex items-center gap-2">
              <button data-testid="toggle-balance" onClick={() => setShowBalance(s => !s)} className="text-muted-foreground">
                {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>
          <p data-testid="balance-value" className="text-3xl font-black text-foreground mb-0.5">
            {showBalance ? `$${balance.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "••••••"}
          </p>
          {mode === "demo" && (
            <p className="text-sm text-primary font-semibold">
              +${todayGain.toFixed(2)} ({todayPct}%) Today
            </p>
          )}
          {/* Mode switch */}
          <div className="flex gap-2 mt-3">
            {(["demo", "real"] as AccountMode[]).map(m => (
              <button
                key={m}
                data-testid={`mode-${m}`}
                onClick={() => switchMode(m)}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                  mode === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {m === "demo" ? "Demo" : "Real"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl bg-card border border-border p-2.5 flex flex-col gap-1">
              <p className="text-[9px] text-muted-foreground font-medium leading-none">{s.label}</p>
              <p className={cn("text-sm font-extrabold leading-none", s.positive ? "text-primary" : "text-destructive")}>
                {s.value}
              </p>
              <MiniChart color={s.label} positive={s.positive} />
            </div>
          ))}
        </div>

        {/* Market Status */}
        <div className="rounded-xl bg-card border border-border px-3 py-2.5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Market Status</p>
            <p className="text-[10px] text-muted-foreground/70">All systems operational</p>
          </div>
          <span data-testid="market-status" className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            LIVE
          </span>
        </div>

        {/* Today's Overview chart */}
        <div className="rounded-2xl bg-card border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-foreground">Today's Overview</p>
            <span className="text-[10px] text-muted-foreground">Today</span>
          </div>
          <div className="flex gap-4 mb-2">
            <div>
              <p className="text-[9px] text-muted-foreground">Profit</p>
              <p className="text-lg font-black text-primary">{mode === "demo" ? "$542.30" : "$0.00"}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground">Trades</p>
              <p className="text-lg font-black text-foreground">{mode === "demo" ? "28" : "0"}</p>
            </div>
          </div>
          <div style={{ height: 80 }}>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={["auto", "auto"]} />
                <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5}
                  fill="url(#hg)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Active Signals */}
        <div className="rounded-2xl bg-card border border-border p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-foreground">Active Signals</p>
            <Link href="/signals" className="text-[10px] text-primary font-semibold">See All</Link>
          </div>
          <div className="space-y-2">
            {signals.map((sig, i) => (
              <Link
                key={sig.symbol}
                href={`/markets/${sig.symbol}`}
                data-testid={`active-signal-${i}`}
                className="flex items-center gap-3 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-black text-white shrink-0",
                  ["bg-purple-600", "bg-orange-500", "bg-yellow-500"][i])}>
                  {sig.direction.slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{sig.market}</p>
                  <p className="text-xs font-black text-foreground">{sig.direction}</p>
                </div>
                <div style={{ width: 60, height: 28 }}>
                  <MiniChart color={`sig${i}`} positive={sig.positive} />
                </div>
                <p className={cn("text-sm font-black shrink-0", sig.positive ? "text-primary" : "text-destructive")}>
                  {Math.round(sig.confidence)}%
                </p>
              </Link>
            ))}
          </div>
        </div>

        {/* AI Power card */}
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 via-card to-card p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-xs font-black text-purple-300">AI Power</p>
              <p className="text-[10px] text-muted-foreground leading-snug">Our AI scans the market 24/7 to find high probability setups</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
