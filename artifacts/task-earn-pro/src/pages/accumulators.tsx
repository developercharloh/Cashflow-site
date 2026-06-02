import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AreaChart, Area, YAxis, ResponsiveContainer, ReferenceLine } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const MARKETS = [
  { id: "R_10",    name: "Volatility 10",      vol: 0.0005, base: 5200 },
  { id: "1HZ10V",  name: "Volatility 10 (1s)", vol: 0.0005, base: 5000 },
  { id: "R_25",    name: "Volatility 25",      vol: 0.0013, base: 3400 },
  { id: "1HZ25V",  name: "Volatility 25 (1s)", vol: 0.0013, base: 3200 },
  { id: "R_50",    name: "Volatility 50",      vol: 0.0027, base: 2300 },
  { id: "1HZ50V",  name: "Volatility 50 (1s)", vol: 0.0027, base: 2100 },
  { id: "R_75",    name: "Volatility 75",      vol: 0.0045, base: 1600 },
  { id: "1HZ75V",  name: "Volatility 75 (1s)", vol: 0.0045, base: 1400 },
  { id: "R_100",   name: "Volatility 100",     vol: 0.007,  base: 950  },
  { id: "1HZ100V", name: "Volatility 100 (1s)", vol: 0.007, base: 850  },
];

const GROWTH_RATES = [1, 2, 3, 4, 5];

/** Barrier ±% per tick — tighter for higher growth rates */
const BARRIER_PCT: Record<number, number> = {
  1: 0.0100, 2: 0.0060, 3: 0.0040, 4: 0.0030, 5: 0.0025,
};

// ── Price helpers ────────────────────────────────────────────────────────────

function nextPrice(prev: number, vol: number) {
  return Math.max(1, prev * (1 + (Math.random() - 0.5) * vol * 2));
}
function initHistory(base: number, vol: number, n = 60) {
  const h: PricePoint[] = [];
  let p = base;
  for (let i = 0; i < n; i++) { p = nextPrice(p, vol); h.push({ price: p, idx: i }); }
  return h;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface PricePoint { price: number; idx: number; }

interface AccumContract {
  id: string;
  stake: number;
  currentValue: number;
  growthRate: number;
  barrierPct: number;
  prevTickPrice: number;
  upperBarrier: number;
  lowerBarrier: number;
  ticks: number;
  isDemo: boolean;
}

interface AccumResult {
  id: string;
  stake: number;
  finalValue: number;
  profit: number;
  ticks: number;
  knockedOut: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AccumulatorsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [accountMode, setAccountMode] = useState<"demo" | "real">("demo");
  const [demoBalance, setDemoBalance] = useState(() => {
    const s = localStorage.getItem("binary_demo");
    return s ? parseFloat(s) : 10000;
  });

  const [marketId, setMarketId] = useState("R_10");
  const market = MARKETS.find(m => m.id === marketId)!;

  const priceRef = useRef(market.base);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>(() => {
    const h = initHistory(market.base, market.vol);
    priceRef.current = h[h.length - 1].price;
    return h;
  });
  const [currentPrice, setCurrentPrice] = useState(priceRef.current);

  const [stake, setStake] = useState("1.00");
  const [growthRate, setGrowthRate] = useState(2);
  const [sessionPnl, setSessionPnl] = useState(0);

  const contractRef = useRef<AccumContract | null>(null);
  const [activeContract, setActiveContract] = useState<AccumContract | null>(null);
  const [results, setResults] = useState<AccumResult[]>([]);

  const realBalance = user?.balance ?? 0;
  const balance = accountMode === "demo" ? demoBalance : realBalance;

  // ── Reset market ─────────────────────────────────────────────────────────
  useEffect(() => {
    const h = initHistory(market.base, market.vol);
    priceRef.current = h[h.length - 1].price;
    setPriceHistory(h);
    setCurrentPrice(priceRef.current);
  }, [marketId]);

  // ── Tick engine ──────────────────────────────────────────────────────────
  useEffect(() => {
    let idx = 60;
    const id = setInterval(() => {
      const p = nextPrice(priceRef.current, market.vol);
      priceRef.current = p;
      setCurrentPrice(p);
      setPriceHistory(prev => [...prev.slice(-59), { price: p, idx: idx++ }]);

      const c = contractRef.current;
      if (!c) return;

      const change = Math.abs(p - c.prevTickPrice) / c.prevTickPrice;

      if (change > c.barrierPct) {
        // Knocked out
        const result: AccumResult = {
          id: c.id, stake: c.stake, finalValue: 0,
          profit: -c.stake, ticks: c.ticks, knockedOut: true,
        };
        setResults(prev => [result, ...prev].slice(0, 20));
        setSessionPnl(prev => Math.round((prev - c.stake) * 100) / 100);
        contractRef.current = null;
        setActiveContract(null);
        toast({
          title: "Knocked out!",
          description: `Barrier breached after ${c.ticks} tick${c.ticks !== 1 ? "s" : ""}`,
          variant: "destructive",
        });
      } else {
        // Grow by growthRate %
        const newValue = Math.round(c.currentValue * (1 + c.growthRate / 100) * 100) / 100;
        const updated: AccumContract = {
          ...c,
          currentValue: newValue,
          prevTickPrice: p,
          upperBarrier: Math.round(p * (1 + c.barrierPct) * 100) / 100,
          lowerBarrier: Math.round(p * (1 - c.barrierPct) * 100) / 100,
          ticks: c.ticks + 1,
        };
        contractRef.current = updated;
        setActiveContract({ ...updated });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [market.vol, toast]);

  // ── Buy ──────────────────────────────────────────────────────────────────
  const buyContract = useCallback(() => {
    const stakeNum = parseFloat(stake) || 0;
    const bal = accountMode === "demo" ? demoBalance : realBalance;
    if (stakeNum <= 0 || bal < stakeNum) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    if (contractRef.current) {
      toast({ title: "Contract already active", description: "Take profit first" });
      return;
    }
    const bp = BARRIER_PCT[growthRate];
    const c: AccumContract = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stake: stakeNum,
      currentValue: stakeNum,
      growthRate,
      barrierPct: bp,
      prevTickPrice: priceRef.current,
      upperBarrier: Math.round(priceRef.current * (1 + bp) * 100) / 100,
      lowerBarrier: Math.round(priceRef.current * (1 - bp) * 100) / 100,
      ticks: 0,
      isDemo: accountMode === "demo",
    };
    if (accountMode === "demo") {
      setDemoBalance(p => {
        const nb = Math.max(0, Math.round((p - stakeNum) * 100) / 100);
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
    contractRef.current = c;
    setActiveContract({ ...c });
  }, [accountMode, demoBalance, realBalance, stake, growthRate, toast]);

  // ── Sell (Take Profit) ───────────────────────────────────────────────────
  const sellContract = useCallback(() => {
    const c = contractRef.current;
    if (!c) return;
    const profit = Math.round((c.currentValue - c.stake) * 100) / 100;
    const result: AccumResult = {
      id: c.id, stake: c.stake, finalValue: c.currentValue,
      profit, ticks: c.ticks, knockedOut: false,
    };
    setResults(prev => [result, ...prev].slice(0, 20));
    setSessionPnl(prev => Math.round((prev + profit) * 100) / 100);
    if (c.isDemo) {
      setDemoBalance(p => {
        const nb = Math.round((p + c.currentValue) * 100) / 100;
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
    contractRef.current = null;
    setActiveContract(null);
    toast({
      title: profit >= 0 ? "Sold — profit taken!" : "Sold at a loss",
      description: `${profit >= 0 ? "+$" : "-$"}${Math.abs(profit).toFixed(2)} after ${c.ticks} ticks`,
    });
  }, [toast]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const priceTrend = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 1].price >= priceHistory[priceHistory.length - 2].price
    : true;
  const priceMin = Math.min(...priceHistory.map(p => p.price)) * 0.9995;
  const priceMax = Math.max(...priceHistory.map(p => p.price)) * 1.0005;
  const stakeNum = parseFloat(stake) || 0;
  const profit = activeContract
    ? Math.round((activeContract.currentValue - activeContract.stake) * 100) / 100
    : 0;
  const profitPct = activeContract
    ? Math.round((activeContract.currentValue / activeContract.stake - 1) * 10000) / 100
    : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ── Account bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border shrink-0">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs shrink-0">
          <button onClick={() => setAccountMode("demo")}
            className={cn("px-2.5 py-1.5 font-semibold transition-colors",
              accountMode === "demo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            Demo
          </button>
          <button onClick={() => setAccountMode("real")}
            className={cn("px-2.5 py-1.5 font-semibold transition-colors",
              accountMode === "real" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            Real
          </button>
        </div>
        <select
          value={marketId}
          onChange={e => setMarketId(e.target.value)}
          className="flex-1 min-w-0 bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
          {MARKETS.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <div className="text-right shrink-0">
          <p className="text-[9px] text-muted-foreground leading-none">{accountMode === "demo" ? "Virtual" : "Real"}</p>
          <p className="text-sm font-bold text-green-400 leading-tight">${balance.toFixed(2)}</p>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="relative bg-[#050510] border-b border-border shrink-0" style={{ height: 140 }}>
        <div className="absolute top-2 left-3 z-10 pointer-events-none">
          <p className="text-white/40 text-[9px]">{market.name}</p>
          <p className={cn("text-lg font-bold font-mono leading-tight mt-0.5",
            priceTrend ? "text-green-400" : "text-red-400")}>
            {currentPrice.toFixed(2)}
          </p>
          {activeContract && (
            <div className="mt-0.5 space-y-px">
              <p className="text-[9px] text-green-400/80">▲ {activeContract.upperBarrier.toFixed(2)}</p>
              <p className="text-[9px] text-red-400/80">▼ {activeContract.lowerBarrier.toFixed(2)}</p>
            </div>
          )}
        </div>

        {activeContract && (
          <div className="absolute top-2 right-3 z-10 text-right pointer-events-none">
            <p className={cn("text-base font-extrabold leading-tight",
              profit >= 0 ? "text-green-400" : "text-red-400")}>
              ${activeContract.currentValue.toFixed(2)}
            </p>
            <p className={cn("text-[10px] font-bold",
              profitPct >= 0 ? "text-green-400" : "text-red-400")}>
              {profitPct >= 0 ? "+" : ""}{profitPct.toFixed(2)}%
            </p>
            <p className="text-white/30 text-[9px]">{activeContract.ticks} ticks</p>
          </div>
        )}

        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={priceTrend ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                <stop offset="100%" stopColor={priceTrend ? "#22c55e" : "#ef4444"} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={[priceMin, priceMax]} hide />
            {activeContract && (
              <ReferenceLine y={activeContract.upperBarrier} stroke="#22c55e"
                strokeDasharray="3 3" strokeOpacity={0.6} />
            )}
            {activeContract && (
              <ReferenceLine y={activeContract.lowerBarrier} stroke="#ef4444"
                strokeDasharray="3 3" strokeOpacity={0.6} />
            )}
            <Area type="linear" dataKey="price"
              stroke={priceTrend ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5} fill="url(#ag)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Trade panel ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 space-y-3 pb-24">

          {/* Total P&L */}
          {(() => {
            const sold = results.filter(r => !r.knockedOut).length;
            const ko = results.filter(r => r.knockedOut).length;
            const totalProfit = results.reduce((s, r) => s + r.profit, 0);
            return (
              <div className="rounded-xl bg-card border border-border px-4 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total P&L</p>
                  <p className={cn("text-xl font-extrabold leading-tight",
                    sessionPnl >= 0 ? "text-green-400" : "text-red-400")}>
                    {sessionPnl >= 0 ? "+$" : "-$"}{Math.abs(sessionPnl).toFixed(2)}
                  </p>
                </div>
                <div className="flex gap-3 text-center">
                  <div>
                    <p className="text-[9px] text-green-400">Sold</p>
                    <p className="text-xs font-bold text-green-400">{sold}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-red-400">K/O</p>
                    <p className="text-xs font-bold text-red-400">{ko}</p>
                  </div>
                  {results.length > 0 && (
                    <div>
                      <p className="text-[9px] text-muted-foreground">Net</p>
                      <p className={cn("text-xs font-bold", totalProfit >= 0 ? "text-green-400" : "text-red-400")}>
                        {totalProfit >= 0 ? "+$" : "-$"}{Math.abs(totalProfit).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
                {results.length > 0 && (
                  <button onClick={() => { setResults([]); setSessionPnl(0); }}
                    className="text-muted-foreground hover:text-foreground shrink-0">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })()}

          {/* Stake */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1">Stake (USD)</p>
            <input
              type="number"
              min="0.01"
              step="0.50"
              value={stake}
              disabled={!!activeContract}
              onChange={e => setStake(e.target.value)}
              onBlur={e => {
                const v = parseFloat(e.target.value);
                setStake(isNaN(v) || v < 0.01 ? "0.50" : v.toFixed(2));
              }}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Growth rate */}
          <div>
            <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Growth Rate (per tick)</p>
            <div className="grid grid-cols-5 gap-1.5">
              {GROWTH_RATES.map(g => (
                <button key={g}
                  onClick={() => !activeContract && setGrowthRate(g)}
                  disabled={!!activeContract}
                  className={cn("py-2 rounded-lg text-xs font-bold transition-colors border disabled:cursor-not-allowed",
                    growthRate === g
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80")}>
                  {g}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Barrier ±{(BARRIER_PCT[growthRate] * 100).toFixed(2)}% · Higher growth = tighter barrier = higher risk
            </p>
          </div>

          {/* Active contract */}
          {activeContract ? (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-sm font-bold">Accumulating</p>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{activeContract.ticks} ticks</p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-card rounded-lg py-2">
                  <p className="text-[9px] text-muted-foreground">Stake</p>
                  <p className="text-sm font-bold">${activeContract.stake.toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-lg py-2">
                  <p className="text-[9px] text-muted-foreground">Value</p>
                  <p className="text-sm font-bold text-green-400">${activeContract.currentValue.toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-lg py-2">
                  <p className="text-[9px] text-muted-foreground">Profit</p>
                  <p className={cn("text-sm font-bold", profit >= 0 ? "text-green-400" : "text-red-400")}>
                    {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="bg-card rounded-lg py-1.5">
                  <p className="text-muted-foreground">Upper</p>
                  <p className="font-bold text-green-400">{activeContract.upperBarrier.toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-lg py-1.5">
                  <p className="text-muted-foreground">Lower</p>
                  <p className="font-bold text-red-400">{activeContract.lowerBarrier.toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-lg py-1.5">
                  <p className="text-muted-foreground">Growth/tick</p>
                  <p className="font-bold">{activeContract.growthRate}%</p>
                </div>
              </div>

              <button onClick={sellContract}
                className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-sm transition-all">
                Take Profit · ${activeContract.currentValue.toFixed(2)}
              </button>
            </div>
          ) : (
            <button onClick={buyContract}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-sm transition-all">
              <TrendingUp className="w-4 h-4" />
              Buy · ${stakeNum.toFixed(2)} · {growthRate}% growth
            </button>
          )}

          {/* Trade history */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">History</p>
              <div className="space-y-1">
                {results.map(r => (
                  <div key={r.id} className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-xs border",
                    r.knockedOut ? "bg-red-500/8 border-red-500/20" : "bg-green-500/8 border-green-500/20",
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("font-bold shrink-0", r.knockedOut ? "text-red-400" : "text-green-400")}>
                        {r.knockedOut ? "K/O" : "✓"}
                      </span>
                      <span className="text-muted-foreground">{r.ticks} tick{r.ticks !== 1 ? "s" : ""}</span>
                      <span className="text-muted-foreground/60 shrink-0">stake ${r.stake.toFixed(2)}</span>
                    </div>
                    <span className={cn("font-bold shrink-0", r.profit >= 0 ? "text-green-400" : "text-red-400")}>
                      {r.profit >= 0 ? "+$" : "-$"}{Math.abs(r.profit).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Demo balance reset */}
          {accountMode === "demo" && (
            <button
              onClick={() => {
                setDemoBalance(10000);
                localStorage.setItem("binary_demo", "10000");
                setSessionPnl(0);
                toast({ title: "Demo reset", description: "Virtual balance restored to $10,000" });
              }}
              className="w-full py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Reset Demo to $10,000
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
