import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { AreaChart, Area, YAxis, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Square, RefreshCw, Wallet } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

// ── Constants ────────────────────────────────────────────────────────────────

const MARKETS = [
  { id: "R_10",  name: "Volatility 10 Index",  vol: 0.0005, base: 5000 },
  { id: "R_25",  name: "Volatility 25 Index",  vol: 0.0013, base: 3200 },
  { id: "R_50",  name: "Volatility 50 Index",  vol: 0.0027, base: 2100 },
  { id: "R_75",  name: "Volatility 75 Index",  vol: 0.0045, base: 1400 },
  { id: "R_100", name: "Volatility 100 Index", vol: 0.007,  base: 850  },
];

const TRADE_TYPES = [
  { id: "rise-fall",       label: "Rise/Fall"        },
  { id: "even-odd",        label: "Even/Odd"         },
  { id: "matches-differs", label: "Matches/Differs"  },
  { id: "over-under",      label: "Over/Under"       },
] as const;

type TradeTypeId = typeof TRADE_TYPES[number]["id"];
type Direction = "rise" | "fall" | "even" | "odd" | "matches" | "differs" | "over" | "under";

const CONTRACT_TICKS: Record<TradeTypeId, number> = {
  "rise-fall": 5, "even-odd": 1, "matches-differs": 1, "over-under": 1,
};

const PAYOUTS: Record<Direction, number> = {
  rise: 1.85, fall: 1.85, even: 1.90, odd: 1.90,
  matches: 9.00, differs: 1.10,
  over: 0, under: 0, // dynamic — use getPayout()
};

/** Over [n]: digits > n → (9-n) winning digits. Under [n]: digits < n → n winning digits. */
function getPayout(dir: "over" | "under", barrier: number): number {
  const winCount = dir === "over" ? 9 - barrier : barrier;
  if (winCount <= 0) return 9.50;
  return Math.round(0.95 / (winCount / 10) * 100) / 100;
}

const STAKE_PRESETS = [0.5, 1, 2, 5, 10];

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLastDigit(price: number) { return Math.floor(Math.round(price * 100) % 10); }
function nextPrice(p: number, vol: number) {
  return Math.max(0.01, p * (1 + (Math.random() - 0.5) * 2 * vol));
}
function initHistory(base: number, vol: number, n = 60): PricePoint[] {
  let p = base;
  return Array.from({ length: n }, (_, i) => { p = nextPrice(p, vol); return { price: p, idx: i }; });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BinaryTradingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const token = localStorage.getItem("token");

  const [accountMode, setAccountMode] = useState<"demo" | "real">("demo");
  const [demoBalance, setDemoBalance] = useState(() => {
    const s = localStorage.getItem("binary_demo");
    return s ? parseFloat(s) : 1000;
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
  const [stake, setStake] = useState(1);
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [overBarrier, setOverBarrier] = useState(4);   // 0–8
  const [underBarrier, setUnderBarrier] = useState(5); // 1–9

  const contractsRef = useRef<Contract[]>([]);
  const [activeContracts, setActiveContracts] = useState<Contract[]>([]);
  const [recentResults, setRecentResults] = useState<TradeResult[]>([]);

  const autoRef = useRef(false);
  const autoDirRef = useRef<Direction | null>(null);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [autoDirection, setAutoDirection] = useState<Direction | null>(null);
  const [sessionPnl, setSessionPnl] = useState(0);

  const realBalance = user?.balance ?? 0;
  const balance = accountMode === "demo" ? demoBalance : realBalance;

  // ── Reset market ────────────────────────────────────────────────────────────
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

  // ── Resolve ─────────────────────────────────────────────────────────────────
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
        setSessionPnl(p => Math.round((p + data.netChange) * 100) / 100);
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      } catch { toast({ title: "Network error", variant: "destructive" }); }
      return;
    }

    // Demo — resolve locally
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
    setSessionPnl(p => Math.round((p + netChange) * 100) / 100);
    setRecentResults(p => [{ id: contract.id, direction: contract.direction, stake: contract.stake, win, payout, netChange, lastDigit }, ...p].slice(0, 15));
  }, [queryClient, token, toast]);

  // ── Place trade ─────────────────────────────────────────────────────────────
  const placeTrade = useCallback((dir: Direction) => {
    const bal = accountMode === "demo" ? demoBalance : realBalance;
    if (bal < stake) {
      toast({ title: "Insufficient balance", description: accountMode === "real" ? "Deposit funds to trade real money." : "Reset your demo balance.", variant: "destructive" });
      autoRef.current = false; autoDirRef.current = null; setIsAutoTrading(false); setAutoDirection(null);
      return;
    }
    const ticksTotal = CONTRACT_TICKS[tradeType];
    const barrierVal = tradeType === "matches-differs" ? selectedDigit
      : dir === "over" ? overBarrier
      : dir === "under" ? underBarrier
      : 5;
    const payoutMultiplier = (dir === "over" || dir === "under")
      ? getPayout(dir, barrierVal)
      : PAYOUTS[dir];
    const contract: Contract = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      direction: dir, tradeType, stake,
      entryPrice: priceRef.current, ticksTotal,
      ticksRemaining: ticksTotal,
      isDemo: accountMode === "demo",
      barrier: barrierVal,
      payoutMultiplier,
    };
    if (accountMode === "demo") {
      setDemoBalance(p => { const nb = Math.max(0, Math.round((p - stake) * 100) / 100); localStorage.setItem("binary_demo", nb.toFixed(2)); return nb; });
    }
    contractsRef.current = [...contractsRef.current, contract];
    setActiveContracts([...contractsRef.current]);
  }, [accountMode, demoBalance, realBalance, stake, tradeType, selectedDigit, overBarrier, underBarrier, toast]);

  // ── Auto-trading ────────────────────────────────────────────────────────────
  const startAutoTrading = useCallback((dir: Direction) => {
    autoRef.current = true; autoDirRef.current = dir;
    setIsAutoTrading(true); setAutoDirection(dir);
    placeTrade(dir);
  }, [placeTrade]);

  const stopAutoTrading = useCallback(() => {
    autoRef.current = false; autoDirRef.current = null;
    setIsAutoTrading(false); setAutoDirection(null);
  }, []);

  // ── Tick engine ─────────────────────────────────────────────────────────────
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

  // ── Derived ─────────────────────────────────────────────────────────────────
  const lastDigit = getLastDigit(currentPrice);
  const priceTrend = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 1].price >= priceHistory[priceHistory.length - 2].price
    : true;
  const priceMin = Math.min(...priceHistory.map(p => p.price)) * 0.9995;
  const priceMax = Math.max(...priceHistory.map(p => p.price)) * 1.0005;
  const activeContract = activeContracts[0];

  const displayPayout =
    tradeType === "over-under" ? getPayout("over", overBarrier)
    : tradeType === "rise-fall" ? PAYOUTS.rise
    : tradeType === "even-odd" ? PAYOUTS.even
    : PAYOUTS.differs;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ── Account bar ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border shrink-0">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button onClick={() => setAccountMode("demo")}
            className={cn("px-3 py-1.5 font-semibold transition-colors", accountMode === "demo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            Demo
          </button>
          <button onClick={() => setAccountMode("real")}
            className={cn("px-3 py-1.5 font-semibold transition-colors", accountMode === "real" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
            Real
          </button>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground">{accountMode === "demo" ? "Virtual" : "Real"} Balance</p>
          <p className="text-base font-bold text-green-400 leading-tight">${balance.toFixed(2)}</p>
        </div>
        <div className={cn("text-right", sessionPnl >= 0 ? "text-green-400" : "text-red-400")}>
          <p className="text-[10px] text-muted-foreground">Session P&L</p>
          <p className="text-sm font-bold leading-tight">{sessionPnl >= 0 ? "+" : ""}${sessionPnl.toFixed(2)}</p>
        </div>
      </div>

      {/* ── Market selector ── */}
      <div className="flex overflow-x-auto px-3 py-1.5 gap-1.5 bg-card border-b border-border shrink-0 no-scrollbar">
        {MARKETS.map(m => (
          <button key={m.id} onClick={() => setMarketId(m.id)}
            className={cn("px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors",
              marketId === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
            {m.id}
          </button>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="relative bg-[#050510] border-b border-border shrink-0" style={{ height: 130 }}>
        <div className="absolute top-2 left-3 z-10 pointer-events-none">
          <p className="text-white/40 text-[9px] leading-none">{market.name}</p>
          <p className={cn("text-lg font-bold font-mono leading-tight mt-0.5", priceTrend ? "text-green-400" : "text-red-400")}>
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

          {/* Trade type */}
          <div className="flex overflow-x-auto gap-1 no-scrollbar">
            {TRADE_TYPES.map(tt => (
              <button key={tt.id} onClick={() => setTradeType(tt.id)}
                className={cn("px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border",
                  tradeType === tt.id ? "bg-primary/15 text-primary border-primary/40" : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80")}>
                {tt.label}
              </button>
            ))}
          </div>

          {/* Stake */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground font-medium">Stake (USD)</span>
              <span className="text-xs text-muted-foreground">Payout ×{displayPayout.toFixed(2)} = <span className="text-green-400 font-bold">${(stake * displayPayout).toFixed(2)}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setStake(s => Math.max(0.5, Math.round((s - 0.5) * 10) / 10))}
                className="w-8 h-8 rounded-lg bg-muted text-lg font-bold flex items-center justify-center hover:bg-muted/80">−</button>
              <div className="flex-1 grid grid-cols-5 gap-1">
                {STAKE_PRESETS.map(p => (
                  <button key={p} onClick={() => setStake(p)}
                    className={cn("py-1.5 rounded-lg text-xs font-bold transition-colors",
                      stake === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
                    ${p}
                  </button>
                ))}
              </div>
              <button onClick={() => setStake(s => Math.round((s + 0.5) * 10) / 10)}
                className="w-8 h-8 rounded-lg bg-muted text-lg font-bold flex items-center justify-center hover:bg-muted/80">+</button>
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
              <p className="text-[10px] text-muted-foreground mt-1">Matches: last digit = {selectedDigit} (×9 payout) · Differs: ≠ {selectedDigit} (×1.10)</p>
            </div>
          )}

          {/* Over/Under barrier pickers — separate per direction */}
          {tradeType === "over-under" && (
            <div className="space-y-2.5">
              {/* Over: barrier 0–8, winning digits = (9-n)/10 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-green-400">Over — last digit &gt; barrier</p>
                  <span className="text-[11px] text-green-400 font-bold">×{getPayout("over", overBarrier).toFixed(2)} · {(9 - overBarrier) * 10}% win</span>
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {[0,1,2,3,4,5,6,7,8].map(d => (
                    <button key={d} onClick={() => setOverBarrier(d)}
                      className={cn("rounded-lg py-1 flex flex-col items-center gap-0 transition-colors",
                        overBarrier === d ? "bg-green-600 text-white" : "bg-muted text-muted-foreground hover:bg-green-600/30")}>
                      <span className="text-xs font-bold">{d}</span>
                      <span className="text-[8px] opacity-70">{(9-d)*10}%</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Under: barrier 1–9, winning digits = n/10 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-red-400">Under — last digit &lt; barrier</p>
                  <span className="text-[11px] text-red-400 font-bold">×{getPayout("under", underBarrier).toFixed(2)} · {underBarrier * 10}% win</span>
                </div>
                <div className="grid grid-cols-9 gap-1">
                  {[1,2,3,4,5,6,7,8,9].map(d => (
                    <button key={d} onClick={() => setUnderBarrier(d)}
                      className={cn("rounded-lg py-1 flex flex-col items-center gap-0 transition-colors",
                        underBarrier === d ? "bg-red-600 text-white" : "bg-muted text-muted-foreground hover:bg-red-600/30")}>
                      <span className="text-xs font-bold">{d}</span>
                      <span className="text-[8px] opacity-70">{d*10}%</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Duration */}
          <p className="text-xs text-muted-foreground">
            Duration: <span className="text-foreground font-semibold">{CONTRACT_TICKS[tradeType]} tick{CONTRACT_TICKS[tradeType] > 1 ? "s" : ""}</span> (~{CONTRACT_TICKS[tradeType]}s)
          </p>

          {/* Real account — no balance nudge */}
          {accountMode === "real" && realBalance < stake && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <Wallet className="w-4 h-4 shrink-0" />
              <span>Insufficient real balance. </span>
              <Link href="/wallet" className="underline font-semibold">Deposit funds →</Link>
            </div>
          )}

          {/* ── Trade buttons ── */}
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
                  className="flex flex-col items-center justify-center py-3.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold transition-all">
                  <span className="text-sm">Over {overBarrier} ▲</span>
                  <span className="text-[10px] opacity-80">×{getPayout("over", overBarrier).toFixed(2)} · {(9 - overBarrier) * 10}% win</span>
                </button>
                <button onClick={() => startAutoTrading("under")}
                  className="flex flex-col items-center justify-center py-3.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold transition-all">
                  <span className="text-sm">Under {underBarrier} ▼</span>
                  <span className="text-[10px] opacity-80">×{getPayout("under", underBarrier).toFixed(2)} · {underBarrier * 10}% win</span>
                </button>
              </>)}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-primary">Auto: <span className="uppercase">{autoDirection}</span> · ${stake}/contract</p>
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

          {/* Recent results */}
          {recentResults.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Results</p>
                <button onClick={() => { setRecentResults([]); setSessionPnl(0); }}
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

          {/* Demo balance reset */}
          {accountMode === "demo" && demoBalance < 5 && (
            <button onClick={() => {
              setDemoBalance(1000);
              localStorage.setItem("binary_demo", "1000");
              setSessionPnl(0);
              toast({ title: "Demo reset", description: "Virtual balance restored to $1,000" });
            }} className="w-full py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Reset Demo to $1,000
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
