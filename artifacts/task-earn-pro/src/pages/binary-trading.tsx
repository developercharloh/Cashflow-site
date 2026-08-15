import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Square, RefreshCw, Wallet } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { GraduationCap, BookOpen, Video, FileText, Users2, Lock } from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const MARKETS = [
  { id: "R_10",    name: "Volatility 10",        vol: 0.0005, base: 5200 },
  { id: "1HZ10V",  name: "Volatility 10 (1s)",   vol: 0.0005, base: 5000 },
  { id: "R_25",    name: "Volatility 25",         vol: 0.0013, base: 3400 },
  { id: "1HZ25V",  name: "Volatility 25 (1s)",   vol: 0.0013, base: 3200 },
  { id: "R_50",    name: "Volatility 50",         vol: 0.0027, base: 2300 },
  { id: "1HZ50V",  name: "Volatility 50 (1s)",   vol: 0.0027, base: 2100 },
  { id: "R_75",    name: "Volatility 75",         vol: 0.0045, base: 1600 },
  { id: "1HZ75V",  name: "Volatility 75 (1s)",   vol: 0.0045, base: 1400 },
  { id: "R_100",   name: "Volatility 100",        vol: 0.007,  base: 950  },
  { id: "1HZ100V", name: "Volatility 100 (1s)",  vol: 0.007,  base: 850  },
];

const TRADE_TYPES = [
  { id: "rise-fall",       label: "Rise/Fall"       },
  { id: "even-odd",        label: "Even/Odd"        },
  { id: "matches-differs", label: "Matches/Differs" },
  { id: "over-under",      label: "Over/Under"      },
] as const;

type TradeTypeId = typeof TRADE_TYPES[number]["id"];
type Direction = "rise" | "fall" | "even" | "odd" | "matches" | "differs" | "over" | "under";

const DEFAULT_TICKS: Record<TradeTypeId, number> = {
  "rise-fall": 5, "even-odd": 1, "matches-differs": 1, "over-under": 1,
};

const PAYOUTS: Record<Direction, number> = {
  rise: 1.85, fall: 1.85, even: 1.90, odd: 1.90,
  matches: 9.00, differs: 1.10,
  over: 0, under: 0,
};

function getPayout(dir: "over" | "under", barrier: number): number {
  const winCount = dir === "over" ? 9 - barrier : barrier;
  if (winCount <= 0) return 9.50;
  return Math.round(0.95 / (winCount / 10) * 100) / 100;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricePoint { price: number; idx: number; }
interface Contract {
  id: string; direction: Direction; tradeType: TradeTypeId;
  stake: number; entryPrice: number; ticksTotal: number;
  ticksRemaining: number; isDemo: boolean; barrier: number;
  payoutMultiplier: number;
}
interface TradeResult {
  id: string; direction: Direction; stake: number;
  win: boolean; payout: number; netChange: number; lastDigit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLastDigit(price: number) { return Math.floor(Math.round(price * 100) % 10); }
function nextPrice(p: number, vol: number) {
  return Math.max(0.01, p * (1 + (Math.random() - 0.5) * 2 * vol));
}
function initHistory(base: number, vol: number, n = 60): PricePoint[] {
  let p = base;
  return Array.from({ length: n }, (_, i) => { p = nextPrice(p, vol); return { price: p, idx: i }; });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BinaryTradingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("token");

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

  const [tradeType, setTradeType] = useState<TradeTypeId>("rise-fall");
  const [stake, setStake] = useState("1.00");
  const [tickCount, setTickCount] = useState(5);
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [overBarrier, setOverBarrier] = useState(4);
  const [underBarrier, setUnderBarrier] = useState(5);

  const contractsRef = useRef<Contract[]>([]);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [recentResults, setRecentResults] = useState<TradeResult[]>([]);

  const autoRef = useRef(false);
  const autoDirRef = useRef<Direction | null>(null);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [autoDirection, setAutoDirection] = useState<Direction | null>(null);
  const [sessionPnl, setSessionPnl] = useState(0);

  const [martingale, setMartingale] = useState(false);
  const martingaleRef = useRef(false);
  const martingaleStakeRef = useRef(1);
  const baseStakeRef = useRef(1);

  const [takeProfitInput, setTakeProfitInput] = useState("");
  const [stopLossInput, setStopLossInput]     = useState("");
  const takeProfitRef  = useRef<number | null>(null);
  const stopLossRef    = useRef<number | null>(null);
  const sessionPnlRef  = useRef(0);

  const realBalance = user?.balance ?? 0;
  const balance = accountMode === "demo" ? demoBalance : realBalance;

  // ── Sync refs ─────────────────────────────────────────────────────────────────
  useEffect(() => { martingaleRef.current = martingale; }, [martingale]);
  useEffect(() => { takeProfitRef.current = takeProfitInput ? parseFloat(takeProfitInput) : null; }, [takeProfitInput]);
  useEffect(() => { stopLossRef.current   = stopLossInput   ? parseFloat(stopLossInput)   : null; }, [stopLossInput]);
  useEffect(() => { setTickCount(DEFAULT_TICKS[tradeType]); }, [tradeType]);

  // ── Reset market ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = initHistory(market.base, market.vol);
    priceRef.current = h[h.length - 1].price;
    setPriceHistory(h);
    setCurrentPrice(priceRef.current);
    contractsRef.current = [];
    setActiveContracts([]);
    autoRef.current = false;
    autoDirRef.current = null;
    setIsAutoTrading(false);
    setAutoDirection(null);
  }, [marketId]);

  // ── TP / SL check (called after every resolved contract) ─────────────────────
  const checkTPSL = useCallback((newPnl: number) => {
    if (!autoRef.current) return;
    const tp = takeProfitRef.current;
    const sl = stopLossRef.current;
    if (tp !== null && newPnl >= tp) {
      autoRef.current = false; autoDirRef.current = null;
      setIsAutoTrading(false); setAutoDirection(null);
      toast({ title: `🎯 Take Profit hit! +$${newPnl.toFixed(2)}`, description: "Auto trading stopped." });
    } else if (sl !== null && newPnl <= -Math.abs(sl)) {
      autoRef.current = false; autoDirRef.current = null;
      setIsAutoTrading(false); setAutoDirection(null);
      toast({ title: `🛑 Stop Loss triggered! -$${Math.abs(newPnl).toFixed(2)}`, description: "Auto trading stopped.", variant: "destructive" });
    }
  }, [toast]);

  // ── Resolve binary contract ───────────────────────────────────────────────────
  const resolveContract = useCallback(async (contract: Contract, exitPrice: number) => {
    if (!contract.isDemo) {
      try {
        const resp = await fetch("/api/binary/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ stake: contract.stake, direction: contract.direction, barrier: contract.barrier, isDemo: false }),
        });
        const data = await resp.json();
        if (!resp.ok) { toast({ title: "Error", description: data.error, variant: "destructive" }); return; }
        setRecentResults(p => [{ id: contract.id, direction: contract.direction, stake: contract.stake, win: data.win, payout: data.payout, netChange: data.netChange, lastDigit: data.lastDigit }, ...p].slice(0, 15));
        const newPnl = Math.round((sessionPnlRef.current + data.netChange) * 100) / 100;
        sessionPnlRef.current = newPnl;
        setSessionPnl(newPnl);
        if (martingaleRef.current && autoRef.current) {
          if (data.win) { martingaleStakeRef.current = baseStakeRef.current; }
          else { martingaleStakeRef.current = Math.round(martingaleStakeRef.current * 200) / 100; }
        }
        checkTPSL(newPnl);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      } catch { toast({ title: "Network error", variant: "destructive" }); }
      return;
    }

    const lastDigit = getLastDigit(exitPrice);
    let win = false;
    switch (contract.direction) {
      case "rise":    win = exitPrice > contract.entryPrice; break;
      case "fall":    win = exitPrice < contract.entryPrice; break;
      case "even":    win = lastDigit % 2 === 0; break;
      case "odd":     win = lastDigit % 2 !== 0; break;
      case "matches": win = lastDigit === contract.barrier; break;
      case "differs": win = lastDigit !== contract.barrier; break;
      case "over":    win = lastDigit > contract.barrier; break;
      case "under":   win = lastDigit < contract.barrier; break;
    }
    const payout = win ? Math.round(contract.stake * contract.payoutMultiplier * 100) / 100 : 0;
    const netChange = Math.round((payout - contract.stake) * 100) / 100;
    setDemoBalance(p => { const nb = Math.max(0, Math.round((p + netChange) * 100) / 100); localStorage.setItem("binary_demo", nb.toFixed(2)); return nb; });
    const newPnl = Math.round((sessionPnlRef.current + netChange) * 100) / 100;
    sessionPnlRef.current = newPnl;
    setSessionPnl(newPnl);
    setRecentResults(p => [{ id: contract.id, direction: contract.direction, stake: contract.stake, win, payout, netChange, lastDigit }, ...p].slice(0, 15));
    if (martingaleRef.current && autoRef.current) {
      if (win) { martingaleStakeRef.current = baseStakeRef.current; }
      else { martingaleStakeRef.current = Math.round(martingaleStakeRef.current * 200) / 100; }
    }
    checkTPSL(newPnl);
  }, [queryClient, token, toast, checkTPSL]);

  // ── Place trade ───────────────────────────────────────────────────────────────
  const placeTrade = useCallback((dir: Direction) => {
    const baseStake = parseFloat(stake) || 0;
    const stakeNum = (martingaleRef.current && autoRef.current) ? martingaleStakeRef.current : baseStake;
    const bal = accountMode === "demo" ? demoBalance : realBalance;
    if (stakeNum <= 0 || bal < stakeNum) {
      toast({ title: "Insufficient balance", description: accountMode === "real" ? "Deposit funds to trade live." : "Reset your demo balance.", variant: "destructive" });
      autoRef.current = false; autoDirRef.current = null; setIsAutoTrading(false); setAutoDirection(null);
      return;
    }
    const barrierVal = tradeType === "matches-differs" ? selectedDigit
      : dir === "over" ? overBarrier
      : dir === "under" ? underBarrier
      : 5;
    const payoutMultiplier = (dir === "over" || dir === "under")
      ? getPayout(dir, barrierVal)
      : PAYOUTS[dir];
    const contract: Contract = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      direction: dir, tradeType, stake: stakeNum,
      entryPrice: priceRef.current, ticksTotal: tickCount,
      ticksRemaining: tickCount,
      isDemo: accountMode === "demo",
      barrier: barrierVal,
      payoutMultiplier,
    };
    if (accountMode === "demo") {
      setDemoBalance(p => { const nb = Math.max(0, Math.round((p - stakeNum) * 100) / 100); localStorage.setItem("binary_demo", nb.toFixed(2)); return nb; });
    }
    contractsRef.current = [...contractsRef.current, contract];
    setActiveContracts([...contractsRef.current]);
  }, [accountMode, demoBalance, realBalance, stake, tickCount, tradeType, selectedDigit, overBarrier, underBarrier, toast]);

  const startAutoTrading = useCallback((dir: Direction) => {
    const sn = parseFloat(stake) || 1;
    baseStakeRef.current = sn;
    martingaleStakeRef.current = sn;
    autoRef.current = true; autoDirRef.current = dir;
    setIsAutoTrading(true); setAutoDirection(dir);
    placeTrade(dir);
  }, [placeTrade, stake]);

  const stopAutoTrading = useCallback(() => {
    autoRef.current = false; autoDirRef.current = null;
    setIsAutoTrading(false); setAutoDirection(null);
  }, []);

  // ── Tick engine ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let idx = 60;
    const id = setInterval(() => {
      const p = nextPrice(priceRef.current, market.vol);
      priceRef.current = p;
      setCurrentPrice(p);
      setPriceHistory(prev => [...prev.slice(-59), { price: p, idx: idx++ }]);

      const toResolve: Contract[] = [];
      contractsRef.current = contractsRef.current
        .map(c => ({ ...c, ticksRemaining: c.ticksRemaining - 1 }))
        .filter(c => { if (c.ticksRemaining <= 0) { toResolve.push(c); return false; } return true; });
      setActiveContracts([...contractsRef.current]);
      for (const c of toResolve) resolveContract(c, p);

      if (autoRef.current && toResolve.length > 0 && contractsRef.current.length === 0 && autoDirRef.current) {
        setTimeout(() => { if (autoRef.current && autoDirRef.current) placeTrade(autoDirRef.current); }, 150);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [market.vol, resolveContract, placeTrade]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const lastDigit = getLastDigit(currentPrice);
  const priceTrend = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 1].price >= priceHistory[priceHistory.length - 2].price
    : true;
  const priceMin = Math.min(...priceHistory.map(p => p.price)) * 0.9995;
  const priceMax = Math.max(...priceHistory.map(p => p.price)) * 1.0005;
  const activeContract = activeContracts[0];
  const stakeNum = parseFloat(stake) || 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ── Account bar + market ── */}
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

      {/* ── Price chart ── */}
      <div className="relative bg-[#050510] border-b border-border shrink-0" style={{ height: 130 }}>
        <div className="absolute top-2 left-3 z-10 pointer-events-none">
          <p className="text-white/40 text-[9px] leading-none">{market.name}</p>
          <p className={cn("text-lg font-bold font-mono leading-tight mt-0.5",
            priceTrend ? "text-green-400" : "text-red-400")}>
            {currentPrice.toFixed(2)}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-white/30 text-[9px]">Digit:</span>
            <span className="text-amber-300 font-extrabold text-base leading-none">{lastDigit}</span>
          </div>
        </div>

        {activeContract && (
          <div className="absolute top-2 right-3 z-10 text-right pointer-events-none">
            <p className="text-white/30 text-[9px]">Entry {activeContract.entryPrice.toFixed(2)}</p>
            <div className="flex items-center gap-0.5 justify-end mt-0.5">
              {Array.from({ length: activeContract.ticksTotal }).map((_, i) => (
                <div key={i} className={cn("w-2 h-2 rounded-full",
                  i < activeContract.ticksTotal - activeContract.ticksRemaining ? "bg-amber-400" : "bg-white/20")} />
              ))}
            </div>
            <p className="text-amber-300 text-[9px] mt-0.5">{activeContract.ticksRemaining} tick{activeContract.ticksRemaining !== 1 ? "s" : ""} left</p>
          </div>
        )}

        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={priceTrend ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                <stop offset="100%" stopColor={priceTrend ? "#22c55e" : "#ef4444"} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={[priceMin, priceMax]} hide />
            <Area type="linear" dataKey="price" stroke={priceTrend ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5} fill="url(#pg)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Trade panel ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 space-y-3 pb-24">

          {/* Trade type tabs */}
          <div className="flex overflow-x-auto gap-1 no-scrollbar">
            {TRADE_TYPES.map(tt => (
              <button key={tt.id}
                onClick={() => { setTradeType(tt.id); stopAutoTrading(); }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border",
                  tradeType === tt.id
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
                )}>
                {tt.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TRADING ACADEMY BANNER */}
          {/* ══════════════════════════════════════════════════════════ */}
          <div className="rounded-2xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-950/60 to-slate-900">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <GraduationCap className="w-4 h-4 text-amber-400" />
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Task Earn Trading Academy</p>
                  </div>
                  <h3 className="text-base font-extrabold text-white leading-tight">Master Forex &amp; Binary Options</h3>
                  <p className="text-[11px] text-white/60 mt-0.5 leading-snug">Professional mentorship, trading documents &amp; live classes.</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-amber-400/70 font-medium">One-time</p>
                  <p className="text-xl font-black text-amber-400">$100</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[
                  { icon: Video, text: "Live Free Classes" },
                  { icon: Users2, text: "1-on-1 Mentorship" },
                  { icon: FileText, text: "Trading Documents" },
                  { icon: BookOpen, text: "Forex & Binary Ops" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 text-white/70 text-[11px]">
                    <Icon className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 transition-all text-slate-900 font-bold text-sm">
              <Lock className="w-3.5 h-3.5" />
              Unlock Academy — $100 One-Time
            </button>
          </div>

          {/* ══════════════════════════════════════════════════════════ */}
          {/* BINARY TRADING */}
          {/* ══════════════════════════════════════════════════════════ */}
            <div className="space-y-3">

              {/* Session P&L */}
              {(() => {
                const wins = recentResults.filter(r => r.win).length;
                const losses = recentResults.length - wins;
                const totalStaked = recentResults.reduce((s, r) => s + r.stake, 0);
                return (
                  <div className="rounded-xl bg-card border border-border px-4 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total P&amp;L</p>
                      <p className={cn("text-xl font-extrabold leading-tight", sessionPnl >= 0 ? "text-green-400" : "text-red-400")}>
                        {sessionPnl >= 0 ? "+$" : "-$"}{Math.abs(sessionPnl).toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-3 text-center">
                      <div>
                        <p className="text-[9px] text-muted-foreground">Staked</p>
                        <p className="text-xs font-bold">${totalStaked.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-green-400">Wins</p>
                        <p className="text-xs font-bold text-green-400">{wins}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-red-400">Losses</p>
                        <p className="text-xs font-bold text-red-400">{losses}</p>
                      </div>
                      {recentResults.length > 0 && (
                        <div>
                          <p className="text-[9px] text-muted-foreground">Rate</p>
                          <p className="text-xs font-bold">{Math.round(wins / recentResults.length * 100)}%</p>
                        </div>
                      )}
                    </div>
                    {recentResults.length > 0 && (
                      <button onClick={() => { setRecentResults([]); setSessionPnl(0); sessionPnlRef.current = 0; }}
                        className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Martingale toggle */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-card border border-border">
                <div>
                  <p className="text-xs font-semibold">Martingale</p>
                  <p className="text-[10px] text-muted-foreground">Doubles stake after every loss, resets on win</p>
                </div>
                <button
                  onClick={() => !isAutoTrading && setMartingale(m => !m)}
                  disabled={isAutoTrading}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50",
                    martingale ? "bg-primary" : "bg-muted border border-border",
                  )}>
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                    martingale ? "left-[calc(100%-1.125rem)]" : "left-0.5",
                  )} />
                </button>
              </div>

              {/* Take Profit + Stop Loss */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] font-medium mb-1 text-green-400 uppercase tracking-wider">Take Profit ($)</p>
                  <input
                    type="number" min="0.01" step="1"
                    value={takeProfitInput}
                    disabled={isAutoTrading}
                    onChange={e => setTakeProfitInput(e.target.value)}
                    placeholder="e.g. 10.00"
                    className="w-full bg-muted border border-green-500/30 rounded-lg px-3 py-2 text-sm font-bold text-center text-green-400 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                  />
                  <p className="text-[9px] text-muted-foreground mt-0.5">Stop when P&L ≥ +$X</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium mb-1 text-red-400 uppercase tracking-wider">Stop Loss ($)</p>
                  <input
                    type="number" min="0.01" step="1"
                    value={stopLossInput}
                    disabled={isAutoTrading}
                    onChange={e => setStopLossInput(e.target.value)}
                    placeholder="e.g. 5.00"
                    className="w-full bg-muted border border-red-500/30 rounded-lg px-3 py-2 text-sm font-bold text-center text-red-400 placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
                  />
                  <p className="text-[9px] text-muted-foreground mt-0.5">Stop when P&L ≤ -$X</p>
                </div>
              </div>

              {/* Stake + Ticks */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Stake (USD)</p>
                  <input
                    type="number" min="0.01" step="0.50"
                    value={stake}
                    onChange={e => setStake(e.target.value)}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      setStake(isNaN(v) || v < 0.01 ? "0.50" : v.toFixed(2));
                    }}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">Number of Ticks</p>
                  <input
                    type="number" min="1" max="100"
                    value={tickCount}
                    onChange={e => setTickCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Matches/Differs digit picker */}
              {tradeType === "matches-differs" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">Select digit (0–9)</p>
                  <div className="grid grid-cols-10 gap-1">
                    {[0,1,2,3,4,5,6,7,8,9].map(d => (
                      <button key={d} onClick={() => setSelectedDigit(d)}
                        className={cn("aspect-square rounded-lg text-xs font-bold",
                          selectedDigit === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Matches: last digit = {selectedDigit} · Differs: last digit ≠ {selectedDigit}</p>
                </div>
              )}

              {/* Over/Under barrier pickers */}
              {tradeType === "over-under" && (
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold text-green-400 mb-1">Over — last digit above</p>
                    <div className="grid grid-cols-9 gap-1">
                      {[0,1,2,3,4,5,6,7,8].map(d => (
                        <button key={d} onClick={() => setOverBarrier(d)}
                          className={cn("rounded-lg py-1.5 text-xs font-bold transition-colors",
                            overBarrier === d ? "bg-green-600 text-white" : "bg-muted text-muted-foreground hover:bg-green-600/30")}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-red-400 mb-1">Under — last digit below</p>
                    <div className="grid grid-cols-9 gap-1">
                      {[1,2,3,4,5,6,7,8,9].map(d => (
                        <button key={d} onClick={() => setUnderBarrier(d)}
                          className={cn("rounded-lg py-1.5 text-xs font-bold transition-colors",
                            underBarrier === d ? "bg-red-600 text-white" : "bg-muted text-muted-foreground hover:bg-red-600/30")}>
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Real account nudge */}
              {accountMode === "real" && realBalance < stakeNum && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span>Insufficient real balance. </span>
                  <Link href="/wallet" className="underline font-semibold">Deposit funds →</Link>
                </div>
              )}

              {/* Trade buttons */}
              {!isAutoTrading ? (
                <div className="grid grid-cols-2 gap-2">
                  {tradeType === "rise-fall" && (<>
                    <button onClick={() => startAutoTrading("rise")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-sm transition-all">
                      <TrendingUp className="w-4 h-4" /> Rise ▲
                    </button>
                    <button onClick={() => startAutoTrading("fall")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm transition-all">
                      <TrendingDown className="w-4 h-4" /> Fall ▼
                    </button>
                  </>)}
                  {tradeType === "even-odd" && (<>
                    <button onClick={() => startAutoTrading("even")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-sm transition-all">
                      Even
                    </button>
                    <button onClick={() => startAutoTrading("odd")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-sm transition-all">
                      Odd
                    </button>
                  </>)}
                  {tradeType === "matches-differs" && (<>
                    <button onClick={() => startAutoTrading("matches")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-sm transition-all">
                      Matches {selectedDigit}
                    </button>
                    <button onClick={() => startAutoTrading("differs")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-cyan-600 hover:bg-cyan-700 active:scale-95 text-white font-bold text-sm transition-all">
                      Differs {selectedDigit}
                    </button>
                  </>)}
                  {tradeType === "over-under" && (<>
                    <button onClick={() => startAutoTrading("over")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-sm transition-all">
                      Over {overBarrier} ▲
                    </button>
                    <button onClick={() => startAutoTrading("under")}
                      className="flex items-center justify-center gap-2 py-4 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm transition-all">
                      Under {underBarrier} ▼
                    </button>
                  </>)}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-primary">Auto: <span className="uppercase">{autoDirection}</span> · ${stakeNum.toFixed(2)}/contract</p>
                      <p className="text-xs text-muted-foreground">Buying continuously until stopped</p>
                    </div>
                  </div>
                  <button onClick={stopAutoTrading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-sm transition-all">
                    <Square className="w-4 h-4 fill-white" /> Stop Trading
                  </button>
                </div>
              )}

              {/* Active contracts */}
              {activeContracts.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active</p>
                  {activeContracts.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-card border border-border">
                      <div>
                        <p className="text-xs font-bold capitalize">{c.direction} · ${c.stake.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">Entry: {c.entryPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: c.ticksTotal }).map((_, i) => (
                          <div key={i} className={cn("w-2.5 h-2.5 rounded-full transition-colors",
                            i < c.ticksTotal - c.ticksRemaining ? "bg-primary" : "bg-muted")} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Results */}
              {recentResults.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Results</p>
                    <button onClick={() => { setRecentResults([]); setSessionPnl(0); sessionPnlRef.current = 0; }}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" /> Clear
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentResults.map(r => (
                      <div key={r.id} className={cn("flex items-center justify-between px-3 py-2 rounded-lg text-xs border",
                        r.win ? "bg-green-500/8 border-green-500/20" : "bg-red-500/8 border-red-500/20")}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("font-bold shrink-0", r.win ? "text-green-400" : "text-red-400")}>{r.win ? "✓" : "✗"}</span>
                          <span className="capitalize text-muted-foreground truncate">{r.direction}</span>
                          <span className="text-muted-foreground/60 shrink-0">d:{r.lastDigit}</span>
                        </div>
                        <span className={cn("font-bold shrink-0", r.win ? "text-green-400" : "text-red-400")}>
                          {r.win ? `+$${r.netChange.toFixed(2)}` : `-$${r.stake.toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Demo reset */}
              {accountMode === "demo" && (
                <button onClick={() => {
                  setDemoBalance(10000);
                  localStorage.setItem("binary_demo", "10000");
                  setSessionPnl(0);
                  toast({ title: "Demo reset", description: "Virtual balance restored to $10,000" });
                }} className="w-full py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Reset Demo to $10,000
                </button>
              )}
            </div>

        </div>
      </div>
    </div>
  );
}
