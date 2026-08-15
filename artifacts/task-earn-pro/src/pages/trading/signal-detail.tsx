import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { ChevronLeft, Star, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis, Cell, BarChart, Bar } from "recharts";
import { PieChart, Pie } from "recharts";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  MARKETS, DEMO_START, buildTicks, nextPrice, computeTickStats,
  generateSignal, getOverUnderPayout, PAYOUTS, lastDigit, type TickStats,
  type AccountMode,
} from "@/lib/trading-engine";

function useTradeHistory() {
  const key = "elite_trade_history";
  const get = () => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } };
  const add = (rec: object) => {
    const prev = get(); const next = [{ ...rec, id: Date.now().toString(), timestamp: new Date().toISOString() }, ...prev].slice(0, 200);
    localStorage.setItem(key, JSON.stringify(next));
  };
  return { add };
}

export default function SignalDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { add: addTrade } = useTradeHistory();

  const market = MARKETS.find(m => m.id === symbol) ?? MARKETS[0];

  const [mode] = useState<AccountMode>(() => (localStorage.getItem("trading_mode") as AccountMode) || "demo");
  const [demo, setDemo] = useState(() => { const s = localStorage.getItem("elite_demo"); return s ? parseFloat(s) : DEMO_START; });
  const realBalance = user?.balance ?? 0;
  const balance = mode === "demo" ? demo : realBalance;

  const priceRef = useRef(market.base);
  const ticksRef = useRef(buildTicks(market.base, market.vol, 200));
  const [stats, setStats] = useState<TickStats>(() => computeTickStats(ticksRef.current, ticksRef.current[ticksRef.current.length - 1].price));
  const [signal, setSignal] = useState(() => generateSignal(stats, market));
  const [priceHistory, setPriceHistory] = useState(() => ticksRef.current.slice(-60));

  const [stake, setStake] = useState("1.00");
  const [barrier, setBarrier] = useState(4);
  const [showMore, setShowMore] = useState(false);
  const [activeTrade, setActiveTrade] = useState<{ dir: string; ticksLeft: number; stake: number; payout: number } | null>(null);

  const stakeNum = parseFloat(stake) || 0;
  const payout = market.contractTypes[0] === "even-odd"
    ? PAYOUTS[signal.direction.toLowerCase()] ?? 1.87
    : market.contractTypes[0] === "over-under"
    ? getOverUnderPayout(signal.direction === "OVER" ? "over" : "under", barrier)
    : PAYOUTS[signal.direction.toLowerCase()] ?? 1.85;
  const payoutAmt = stakeNum * payout;
  const payoutPct  = Math.round((payout - 1) * 100);

  // Live tick engine
  useEffect(() => {
    let idx = ticksRef.current.length;
    const id = setInterval(() => {
      const p = nextPrice(priceRef.current, market.vol);
      priceRef.current = p;
      ticksRef.current = [...ticksRef.current, { price: p, idx: idx++ }].slice(-1000);
      setPriceHistory(prev => [...prev.slice(-59), { price: p, idx }]);
      const newStats = computeTickStats(ticksRef.current, p);
      setStats(newStats);
      setSignal(generateSignal(newStats, market));
      if (activeTrade) {
        setActiveTrade(prev => {
          if (!prev) return null;
          if (prev.ticksLeft <= 1) {
            const ld = lastDigit(p);
            let won = false;
            const dir = prev.dir.toLowerCase();
            if (dir === "even") won = ld % 2 === 0;
            else if (dir === "odd") won = ld % 2 !== 0;
            else if (dir === "rise") won = p > priceRef.current;
            else if (dir === "fall") won = p < priceRef.current;
            else if (dir === "over") won = ld > barrier;
            else if (dir === "under") won = ld < barrier;
            const profit = won ? prev.payout - prev.stake : -prev.stake;
            if (mode === "demo") {
              const credit = won ? prev.payout : 0;
              setDemo(d => { const nd = Math.max(0, Math.round((d + credit) * 100) / 100); localStorage.setItem("elite_demo", nd.toFixed(2)); return nd; });
            }
            addTrade({ symbol: market.id, market: market.name, contractType: market.contractTypes[0], direction: prev.dir, stake: prev.stake, payout: won ? prev.payout : 0, profit, outcome: won ? "won" : "lost" });
            toast({ title: won ? `Won $${prev.payout.toFixed(2)}` : `Lost $${prev.stake.toFixed(2)}`, description: won ? "Trade resolved successfully" : "Trade expired out of the money", variant: won ? "default" : "destructive" });
            return null;
          }
          return { ...prev, ticksLeft: prev.ticksLeft - 1 };
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [market, activeTrade, barrier, mode, toast, addTrade]);

  const placeTrade = useCallback((dir: string) => {
    if (stakeNum <= 0 || balance < stakeNum) {
      toast({ title: "Insufficient balance", variant: "destructive" }); return;
    }
    if (activeTrade) { toast({ title: "Trade already active" }); return; }
    if (mode === "demo") {
      setDemo(d => { const nd = Math.max(0, Math.round((d - stakeNum) * 100) / 100); localStorage.setItem("elite_demo", nd.toFixed(2)); return nd; });
    }
    setActiveTrade({ dir, ticksLeft: 1, stake: stakeNum, payout: Math.round(stakeNum * payout * 100) / 100 });
    toast({ title: `${dir} trade placed`, description: `$${stakeNum.toFixed(2)} stake — resolves in 1 tick` });
  }, [stakeNum, balance, activeTrade, mode, payout, toast]);

  const trend = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 1].price >= priceHistory[priceHistory.length - 2].price
    : true;

  const barData = stats.digitPct.map((pct, i) => ({ digit: i, pct, fill: i % 2 === 0 ? "#22c55e" : "#3b82f6" }));

  const confBars = Math.round(signal.confidence / 10);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button data-testid="back-btn" onClick={() => setLocation("/markets")} className="text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
        <h1 className="text-sm font-black text-foreground">EVEN / ODD</h1>
        <div className="flex items-center gap-3">
          <Star className="w-4 h-4 text-muted-foreground" />
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Market + live badge */}
      <div className="flex items-center justify-between px-4 mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{market.name}</p>
        <span data-testid="live-badge" className="flex items-center gap-1.5 text-primary text-[10px] font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />LIVE
        </span>
      </div>

      {/* Signal hero */}
      <div className="mx-4 rounded-2xl bg-card border border-border p-4 text-center mb-3">
        <p className="text-[10px] font-bold text-primary tracking-widest uppercase mb-1">Strong Buy</p>
        <p data-testid="signal-direction" className="text-5xl font-black text-primary mb-1 tracking-tight">{signal.direction}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Confidence</p>
        <p data-testid="signal-confidence" className="text-4xl font-black text-foreground mb-2">{signal.confidence}%</p>
        {/* confidence bars */}
        <div className="flex items-center justify-center gap-1 mb-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={cn("h-1.5 rounded-full flex-1", i < confBars ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        {/* 1000-tick stats */}
        <div className="rounded-xl bg-muted/60 px-3 py-2 mb-3">
          <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest mb-1">Last 1000 Ticks</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-bold text-primary">EVEN {stats.evenPct}%</p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full bg-primary rounded-full" style={{ width: `${stats.evenPct}%` }} />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-destructive">ODD {stats.oddPct}%</p>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full bg-destructive rounded-full" style={{ width: `${stats.oddPct}%` }} />
              </div>
            </div>
          </div>
        </div>
        {/* Recommended + duration */}
        <div className="grid grid-cols-2 gap-2 text-left">
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[9px] text-muted-foreground">Recommended</p>
            <p className="text-xs font-bold text-primary">{signal.direction}</p>
          </div>
          <div className="rounded-lg bg-muted/60 px-3 py-2">
            <p className="text-[9px] text-muted-foreground">Duration</p>
            <p className="text-xs font-bold text-foreground">1 Tick</p>
          </div>
        </div>
      </div>

      {/* Stake + payout */}
      <div className="mx-4 rounded-2xl bg-card border border-border p-4 mb-3">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-1.5">Stake</p>
            <div className="flex items-center gap-2">
              <button data-testid="stake-dec" onClick={() => setStake(s => Math.max(0.5, parseFloat(s) - 0.5).toFixed(2))} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-foreground font-bold text-sm">−</button>
              <input data-testid="stake-input" type="number" min="0.50" step="0.50" value={stake} onChange={e => setStake(e.target.value)} className="flex-1 bg-transparent text-sm font-black text-foreground text-center focus:outline-none" />
              <button data-testid="stake-inc" onClick={() => setStake(s => (parseFloat(s) + 0.5).toFixed(2))} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-foreground font-bold text-sm">+</button>
            </div>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase font-semibold mb-1.5">Potential Payout</p>
            <p data-testid="payout-value" className="text-sm font-black text-foreground">${payoutAmt.toFixed(2)}</p>
            <p className="text-xs text-primary font-bold">{payoutPct}%</p>
          </div>
        </div>

        {/* Buy buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="buy-even"
            disabled={!!activeTrade}
            onClick={() => placeTrade(signal.direction)}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-black text-sm disabled:opacity-50 glow-green transition-all active:scale-95"
          >
            <ChevronUp className="w-4 h-4" />
            BUY {signal.direction}
          </button>
          <button
            data-testid="buy-odd"
            disabled={!!activeTrade}
            onClick={() => placeTrade(signal.direction === "EVEN" ? "ODD" : signal.direction === "RISE" ? "FALL" : "ODD")}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-destructive text-destructive-foreground font-black text-sm disabled:opacity-50 glow-red transition-all active:scale-95"
          >
            <ChevronDown className="w-4 h-4" />
            BUY {signal.direction === "EVEN" ? "ODD" : signal.direction === "RISE" ? "FALL" : "ODD"}
          </button>
        </div>

        {activeTrade && (
          <div className="mt-3 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 text-center">
            <p className="text-xs font-bold text-primary">Trade Active — resolving…</p>
          </div>
        )}

        <button onClick={() => setShowMore(s => !s)} className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-3">
          More Info {showMore ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Digit frequency */}
      <div className="mx-4 rounded-2xl bg-card border border-border p-4 mb-3">
        <p className="text-xs font-bold text-foreground mb-3">Digit Frequency (Last 1000 Ticks)</p>
        <div style={{ height: 90 }}>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={barData} barSize={18} margin={{ top: 0, right: 0, left: 0, bottom: 12 }}>
              <YAxis hide domain={[0, 20]} />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-around">
          {stats.digitPct.map((pct, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-[8px] text-muted-foreground font-bold">{pct}%</span>
              <span className="text-[9px] font-black text-foreground">{i}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Even/Odd distribution */}
      <div className="mx-4 rounded-2xl bg-card border border-border p-4 mb-3">
        <p className="text-xs font-bold text-foreground mb-3">Even / Odd Distribution</p>
        <div className="flex items-center gap-4">
          <div style={{ width: 90, height: 90 }}>
            <ResponsiveContainer width={90} height={90}>
              <PieChart>
                <Pie data={[{ v: stats.evenPct }, { v: stats.oddPct }]} dataKey="v" cx={40} cy={40} innerRadius={25} outerRadius={42} startAngle={90} endAngle={-270}>
                  <Cell fill="#22c55e" />
                  <Cell fill="#ef4444" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
              <span className="text-xs font-black text-primary">{stats.evenPct}% EVEN</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive shrink-0" />
              <span className="text-xs font-black text-destructive">{stats.oddPct}% ODD</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2">
            <p className="text-[9px] text-muted-foreground">Most Frequent</p>
            <p className="text-sm font-black text-primary">{stats.mostFrequent.digit} ({stats.mostFrequent.pct}%)</p>
          </div>
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-[9px] text-muted-foreground">Least Frequent</p>
            <p className="text-sm font-black text-destructive">{stats.leastFrequent.digit} ({stats.leastFrequent.pct}%)</p>
          </div>
        </div>
      </div>

      {/* Live price chart */}
      <div className="mx-4 rounded-2xl bg-card border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-foreground">Live Price</p>
          <p className={cn("text-sm font-black font-mono", trend ? "text-primary" : "text-destructive")}>
            {priceHistory[priceHistory.length - 1]?.price.toFixed(2) ?? "—"}
          </p>
        </div>
        <div style={{ height: 70 }}>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="priceg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={trend ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={trend ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={["auto", "auto"]} hide />
              <Area type="linear" dataKey="price" stroke={trend ? "#22c55e" : "#ef4444"} strokeWidth={1.5}
                fill="url(#priceg)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
