import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { AreaChart, Area, YAxis, ResponsiveContainer, ReferenceLine } from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, TrendingDown, Square, RefreshCw, Wallet,
  ShieldAlert, Target, X,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

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
  { id: "accumulators",    label: "Accumulators"    },
] as const;

type TradeTypeId = typeof TRADE_TYPES[number]["id"];
type Direction = "rise" | "fall" | "even" | "odd" | "matches" | "differs" | "over" | "under";

const DEFAULT_TICKS: Record<TradeTypeId, number> = {
  "rise-fall": 5, "even-odd": 1, "matches-differs": 1, "over-under": 1, "accumulators": 1,
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

// ── Accumulator constants ──────────────────────────────────────────────────────

const GROWTH_RATES = [1, 2, 3, 4, 5];

const BARRIER_PCT: Record<number, number> = {
  1: 0.0100, 2: 0.0060, 3: 0.0040, 4: 0.0030, 5: 0.0025,
};

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
  takeProfit: number | null;
  stopLoss: number | null;
}

interface AccumResult {
  id: string;
  stake: number;
  profit: number;
  ticks: number;
  reason: "take-profit" | "stop-loss" | "manual";
}

interface ResultModal {
  show: boolean;
  reason: "take-profit" | "stop-loss" | "manual";
  profit: number;
  finalValue: number;
  ticks: number;
  stake: number;
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

  // Binary contracts
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

  // Accumulator state
  const [growthRate, setGrowthRate] = useState(2);
  const [takeProfitInput, setTakeProfitInput] = useState("20.00");
  const [stopLossInput, setStopLossInput] = useState("10.00");
  const accumContractRef = useRef<AccumContract | null>(null);
  const [activeAccumContract, setActiveAccumContract] = useState<AccumContract | null>(null);
  const [accumResults, setAccumResults] = useState<AccumResult[]>([]);
  const [accumSessionPnl, setAccumSessionPnl] = useState(0);
  const [resultModal, setResultModal] = useState<ResultModal>({
    show: false, reason: "manual", profit: 0, finalValue: 0, ticks: 0, stake: 0,
  });

  const realBalance = user?.balance ?? 0;
  const balance = accountMode === "demo" ? demoBalance : realBalance;

  // ── Sync martingale ref ───────────────────────────────────────────────────────
  useEffect(() => { martingaleRef.current = martingale; }, [martingale]);

  // ── Reset ticks default when trade type changes ───────────────────────────────
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

  // ── Accumulator: close contract ───────────────────────────────────────────────
  const closeAccumContract = useCallback((
    c: AccumContract,
    reason: "take-profit" | "stop-loss" | "manual",
    knockedOut = false,
  ) => {
    const finalValue = knockedOut ? 0 : c.currentValue;
    const profit = Math.round((finalValue - c.stake) * 100) / 100;

    setAccumResults(prev => [{
      id: c.id, stake: c.stake, profit, ticks: c.ticks, reason,
    }, ...prev].slice(0, 20));
    setAccumSessionPnl(prev => Math.round((prev + profit) * 100) / 100);

    if (c.isDemo) {
      setDemoBalance(p => {
        const nb = Math.max(0, Math.round((p + finalValue) * 100) / 100);
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }

    accumContractRef.current = null;
    setActiveAccumContract(null);

    setResultModal({ show: true, reason, profit, finalValue, ticks: c.ticks, stake: c.stake });

    const title =
      reason === "take-profit" ? "🎯 Take Profit Hit!" :
      reason === "stop-loss"   ? "🛑 Stop Loss Hit"    :
                                 (profit >= 0 ? "Profit taken!" : "Sold at a loss");
    toast({
      title,
      description: `${profit >= 0 ? "+$" : "-$"}${Math.abs(profit).toFixed(2)} after ${c.ticks} tick${c.ticks !== 1 ? "s" : ""}`,
      variant: reason === "stop-loss" ? "destructive" : "default",
    });
  }, [toast]);

  // ── Binary: resolve contract ──────────────────────────────────────────────────
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
        if (martingaleRef.current && autoRef.current) {
          if (data.win) { martingaleStakeRef.current = baseStakeRef.current; }
          else { martingaleStakeRef.current = Math.round(martingaleStakeRef.current * 200) / 100; }
        }
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
    setSessionPnl(p => Math.round((p + netChange) * 100) / 100);
    setRecentResults(p => [{ id: contract.id, direction: contract.direction, stake: contract.stake, win, payout, netChange, lastDigit }, ...p].slice(0, 15));
    if (martingaleRef.current && autoRef.current) {
      if (win) { martingaleStakeRef.current = baseStakeRef.current; }
      else { martingaleStakeRef.current = Math.round(martingaleStakeRef.current * 200) / 100; }
    }
  }, [queryClient, token, toast]);

  // ── Tick engine (binary + accumulators) ──────────────────────────────────────
  useEffect(() => {
    let idx = 60;
    const id = setInterval(() => {
      const p = nextPrice(priceRef.current, market.vol);
      priceRef.current = p;
      setCurrentPrice(p);
      setPriceHistory(prev => [...prev.slice(-59), { price: p, idx: idx++ }]);

      // ── Binary contracts ──
      const toResolve: Contract[] = [];
      contractsRef.current = contractsRef.current
        .map(c => ({ ...c, ticksRemaining: c.ticksRemaining - 1 }))
        .filter(c => { if (c.ticksRemaining <= 0) { toResolve.push(c); return false; } return true; });
      setActiveContracts([...contractsRef.current]);
      for (const c of toResolve) resolveContract(c, p);
      if (autoRef.current && toResolve.length > 0 && contractsRef.current.length === 0 && autoDirRef.current) {
        setTimeout(() => { if (autoRef.current && autoDirRef.current) placeTrade(autoDirRef.current); }, 150);
      }

      // ── Accumulator contract ──
      const ac = accumContractRef.current;
      if (!ac) return;

      const change = Math.abs(p - ac.prevTickPrice) / ac.prevTickPrice;

      if (change > ac.barrierPct) {
        // Barrier breached → Stop Loss (knocked out)
        closeAccumContract(ac, "stop-loss", true);
        return;
      }

      // Grow value
      const newValue = Math.round(ac.currentValue * (1 + ac.growthRate / 100) * 100) / 100;
      const runningProfit = Math.round((newValue - ac.stake) * 100) / 100;

      // Auto Take Profit
      if (ac.takeProfit !== null && runningProfit >= ac.takeProfit) {
        const updated: AccumContract = {
          ...ac, currentValue: newValue, prevTickPrice: p,
          upperBarrier: Math.round(p * (1 + ac.barrierPct) * 100) / 100,
          lowerBarrier: Math.round(p * (1 - ac.barrierPct) * 100) / 100,
          ticks: ac.ticks + 1,
        };
        accumContractRef.current = updated;
        closeAccumContract(updated, "take-profit", false);
        return;
      }

      const updated: AccumContract = {
        ...ac,
        currentValue: newValue,
        prevTickPrice: p,
        upperBarrier: Math.round(p * (1 + ac.barrierPct) * 100) / 100,
        lowerBarrier: Math.round(p * (1 - ac.barrierPct) * 100) / 100,
        ticks: ac.ticks + 1,
      };
      accumContractRef.current = updated;
      setActiveAccumContract({ ...updated });
    }, 1000);
    return () => clearInterval(id);
  }, [market.vol, resolveContract, closeAccumContract]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Binary: place trade ───────────────────────────────────────────────────────
  const placeTrade = useCallback((dir: Direction) => {
    const baseStake = parseFloat(stake) || 0;
    const stakeNum = (martingaleRef.current && autoRef.current) ? martingaleStakeRef.current : baseStake;
    const bal = accountMode === "demo" ? demoBalance : realBalance;
    if (stakeNum <= 0 || bal < stakeNum) {
      toast({ title: "Insufficient balance", description: accountMode === "real" ? "Deposit funds to trade real money." : "Reset your demo balance.", variant: "destructive" });
      autoRef.current = false; autoDirRef.current = null; setIsAutoTrading(false); setAutoDirection(null);
      return;
    }
    const ticksTotal = tickCount;
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
      entryPrice: priceRef.current, ticksTotal,
      ticksRemaining: ticksTotal,
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

  // ── Accumulator: buy ──────────────────────────────────────────────────────────
  const buyAccumContract = useCallback(() => {
    const stakeNum = parseFloat(stake) || 0;
    const bal = accountMode === "demo" ? demoBalance : realBalance;
    if (stakeNum <= 0 || bal < stakeNum) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    if (accumContractRef.current) {
      toast({ title: "Contract already active" });
      return;
    }
    const tp = parseFloat(takeProfitInput) || null;
    const bp = BARRIER_PCT[growthRate];
    const c: AccumContract = {
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stake: stakeNum,
      currentValue: stakeNum,
      growthRate,
      barrierPct: bp,
      prevTickPrice: priceRef.current,
      upperBarrier: Math.round(priceRef.current * (1 + bp) * 100) / 100,
      lowerBarrier: Math.round(priceRef.current * (1 - bp) * 100) / 100,
      ticks: 0,
      isDemo: accountMode === "demo",
      takeProfit: tp,
      stopLoss: parseFloat(stopLossInput) || null,
    };
    if (accountMode === "demo") {
      setDemoBalance(p => {
        const nb = Math.max(0, Math.round((p - stakeNum) * 100) / 100);
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
    accumContractRef.current = c;
    setActiveAccumContract({ ...c });
  }, [accountMode, demoBalance, realBalance, stake, growthRate, takeProfitInput, stopLossInput, toast]);

  const sellAccumContract = useCallback(() => {
    const c = accumContractRef.current;
    if (!c) return;
    closeAccumContract(c, "manual", false);
  }, [closeAccumContract]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const lastDigit = getLastDigit(currentPrice);
  const priceTrend = priceHistory.length > 1
    ? priceHistory[priceHistory.length - 1].price >= priceHistory[priceHistory.length - 2].price
    : true;
  const priceMin = Math.min(...priceHistory.map(p => p.price)) * 0.9995;
  const priceMax = Math.max(...priceHistory.map(p => p.price)) * 1.0005;
  const activeContract = activeContracts[0];
  const stakeNum = parseFloat(stake) || 0;
  const accumProfit = activeAccumContract
    ? Math.round((activeAccumContract.currentValue - activeAccumContract.stake) * 100) / 100
    : 0;
  const isAccum = tradeType === "accumulators";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">

      {/* ── Full-screen accumulator result modal ── */}
      {resultModal.show && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(5,5,20,0.97)" }}>
          <div className="w-full max-w-xs mx-auto px-6 text-center space-y-6">
            <div className={cn(
              "w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4",
              resultModal.reason === "stop-loss"
                ? "bg-red-500/10 border-red-500/40"
                : "bg-green-500/10 border-green-500/40",
            )}>
              {resultModal.reason === "stop-loss"
                ? <ShieldAlert className="w-10 h-10 text-red-400" />
                : <Target className="w-10 h-10 text-green-400" />}
            </div>

            <div className="space-y-1">
              <p className={cn("text-2xl font-extrabold tracking-tight",
                resultModal.reason === "stop-loss" ? "text-red-400" : "text-green-400")}>
                {resultModal.reason === "take-profit" ? "Take Profit Hit!" :
                 resultModal.reason === "stop-loss"   ? "Stop Loss Hit"    : "Trade Closed"}
              </p>
              <p className="text-muted-foreground text-sm">
                {resultModal.reason === "take-profit" ? "Your target was reached. Great call!" :
                 resultModal.reason === "stop-loss"   ? "Barrier was breached. Stake lost."    :
                                                        "You manually closed the position."}
              </p>
            </div>

            <div className={cn("rounded-2xl border px-6 py-5",
              resultModal.profit >= 0
                ? "bg-green-500/8 border-green-500/20"
                : "bg-red-500/8 border-red-500/20")}>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                {resultModal.profit >= 0 ? "Profit" : "Loss"}
              </p>
              <p className={cn("text-4xl font-extrabold",
                resultModal.profit >= 0 ? "text-green-400" : "text-red-400")}>
                {resultModal.profit >= 0 ? "+$" : "-$"}{Math.abs(resultModal.profit).toFixed(2)}
              </p>
              <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span>Stake <strong className="text-foreground">${resultModal.stake.toFixed(2)}</strong></span>
                <span>Ticks <strong className="text-foreground">{resultModal.ticks}</strong></span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => { setResultModal(m => ({ ...m, show: false })); buyAccumContract(); }}
                className={cn(
                  "w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95",
                  resultModal.reason === "stop-loss"
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "bg-green-600 hover:bg-green-700 text-white",
                )}>
                Trade Again
              </button>
              <button
                onClick={() => setResultModal(m => ({ ...m, show: false }))}
                className="w-full py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
                <X className="w-4 h-4" /> Close
              </button>
            </div>
          </div>
        </div>
      )}

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
          disabled={!!activeAccumContract}
          className="flex-1 min-w-0 bg-muted border border-border rounded-lg px-2 py-1.5 text-[11px] font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
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
          <p className="text-white/40 text-[9px] leading-none">{market.name}</p>
          <p className={cn("text-lg font-bold font-mono leading-tight mt-0.5",
            priceTrend ? "text-green-400" : "text-red-400")}>
            {currentPrice.toFixed(2)}
          </p>
          {!isAccum && (
            <div className="flex items-center gap-1">
              <span className="text-white/30 text-[9px]">Digit:</span>
              <span className="text-amber-300 font-extrabold text-base leading-none">{lastDigit}</span>
            </div>
          )}
          {isAccum && activeAccumContract && (
            <div className="mt-0.5 space-y-px">
              <p className="text-[9px] text-green-400/80">▲ {activeAccumContract.upperBarrier.toFixed(2)}</p>
              <p className="text-[9px] text-red-400/80">▼ {activeAccumContract.lowerBarrier.toFixed(2)}</p>
            </div>
          )}
        </div>

        {/* Binary active contract ticks overlay */}
        {!isAccum && activeContract && (
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

        {/* Accumulator value overlay */}
        {isAccum && activeAccumContract && (
          <div className="absolute top-2 right-3 z-10 text-right pointer-events-none">
            <p className={cn("text-base font-extrabold leading-tight",
              accumProfit >= 0 ? "text-green-400" : "text-red-400")}>
              ${activeAccumContract.currentValue.toFixed(2)}
            </p>
            <p className={cn("text-[10px] font-bold",
              accumProfit >= 0 ? "text-green-400" : "text-red-400")}>
              {accumProfit >= 0 ? "+$" : "-$"}{Math.abs(accumProfit).toFixed(2)}
            </p>
            <p className="text-white/30 text-[9px]">{activeAccumContract.ticks} ticks</p>
          </div>
        )}

        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={priceTrend ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                <stop offset="100%" stopColor={priceTrend ? "#22c55e" : "#ef4444"} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis domain={[priceMin, priceMax]} hide />
            {/* Accumulator barriers — visible while contract is live */}
            {isAccum && activeAccumContract && (
              <ReferenceLine
                y={activeAccumContract.upperBarrier}
                stroke="#22c55e"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeOpacity={0.85}
              />
            )}
            {isAccum && activeAccumContract && (
              <ReferenceLine
                y={activeAccumContract.lowerBarrier}
                stroke="#ef4444"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                strokeOpacity={0.85}
              />
            )}
            <Area type="linear" dataKey="price"
              stroke={priceTrend ? "#22c55e" : "#ef4444"}
              strokeWidth={1.5} fill="url(#pg)" dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Trade panel ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 space-y-3 pb-24">

          {/* P&L strip */}
          {isAccum ? (
            (() => {
              const won = accumResults.filter(r => r.reason !== "stop-loss").length;
              const sl  = accumResults.filter(r => r.reason === "stop-loss").length;
              const net = accumResults.reduce((s, r) => s + r.profit, 0);
              return (
                <div className="rounded-xl bg-card border border-border px-4 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Total P&L</p>
                    <p className={cn("text-xl font-extrabold leading-tight",
                      accumSessionPnl >= 0 ? "text-green-400" : "text-red-400")}>
                      {accumSessionPnl >= 0 ? "+$" : "-$"}{Math.abs(accumSessionPnl).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex gap-3 text-center">
                    <div>
                      <p className="text-[9px] text-green-400">Won</p>
                      <p className="text-xs font-bold text-green-400">{won}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-red-400">SL Hit</p>
                      <p className="text-xs font-bold text-red-400">{sl}</p>
                    </div>
                    {accumResults.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted-foreground">Net</p>
                        <p className={cn("text-xs font-bold", net >= 0 ? "text-green-400" : "text-red-400")}>
                          {net >= 0 ? "+$" : "-$"}{Math.abs(net).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                  {accumResults.length > 0 && (
                    <button onClick={() => { setAccumResults([]); setAccumSessionPnl(0); }}
                      className="text-muted-foreground hover:text-foreground shrink-0">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })()
          ) : (
            (() => {
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
                    <button onClick={() => { setRecentResults([]); setSessionPnl(0); }}
                      className="text-[10px] text-muted-foreground hover:text-foreground shrink-0">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })()
          )}

          {/* Trade type tabs */}
          <div className="flex overflow-x-auto gap-1 no-scrollbar">
            {TRADE_TYPES.map(tt => (
              <button key={tt.id}
                onClick={() => { setTradeType(tt.id); stopAutoTrading(); }}
                disabled={!!activeAccumContract}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors border disabled:opacity-50",
                  tradeType === tt.id
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80",
                )}>
                {tt.label}
              </button>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* ACCUMULATOR PANEL */}
          {/* ═══════════════════════════════════════════════════════ */}
          {isAccum ? (
            <div className="space-y-3">
              {/* Stake */}
              <div>
                <p className="text-[11px] text-muted-foreground font-medium mb-1">Stake (USD)</p>
                <input
                  type="number" min="0.01" step="0.50"
                  value={stake}
                  disabled={!!activeAccumContract}
                  onChange={e => setStake(e.target.value)}
                  onBlur={e => {
                    const v = parseFloat(e.target.value);
                    setStake(isNaN(v) || v < 0.01 ? "1.00" : v.toFixed(2));
                  }}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              {/* Stop Loss / Take Profit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <ShieldAlert className="w-3 h-3 text-red-400" />
                    <p className="text-[11px] text-muted-foreground font-medium">Stop Loss ($)</p>
                  </div>
                  <input
                    type="number" min="0.01" step="0.50"
                    value={stopLossInput}
                    disabled={!!activeAccumContract}
                    onChange={e => setStopLossInput(e.target.value)}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      setStopLossInput(isNaN(v) || v < 0.01 ? "" : v.toFixed(2));
                    }}
                    placeholder="No SL"
                    className="w-full bg-muted border border-red-500/30 rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-red-500/50 disabled:opacity-50"
                  />
                  <p className="text-[9px] text-muted-foreground mt-0.5">Barrier breach = full loss</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Target className="w-3 h-3 text-green-400" />
                    <p className="text-[11px] text-muted-foreground font-medium">Take Profit ($)</p>
                  </div>
                  <input
                    type="number" min="0.01" step="0.50"
                    value={takeProfitInput}
                    disabled={!!activeAccumContract}
                    onChange={e => setTakeProfitInput(e.target.value)}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      setTakeProfitInput(isNaN(v) || v < 0.01 ? "" : v.toFixed(2));
                    }}
                    placeholder="No TP"
                    className="w-full bg-muted border border-green-500/30 rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-green-500/50 disabled:opacity-50"
                  />
                  <p className="text-[9px] text-muted-foreground mt-0.5">Auto-sell when hit</p>
                </div>
              </div>

              {/* Growth rate */}
              <div>
                <p className="text-[11px] text-muted-foreground font-medium mb-1.5">Growth Rate (per tick)</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {GROWTH_RATES.map(g => (
                    <button key={g}
                      onClick={() => !activeAccumContract && setGrowthRate(g)}
                      disabled={!!activeAccumContract}
                      className={cn("py-2 rounded-lg text-xs font-bold transition-colors border disabled:cursor-not-allowed",
                        growthRate === g
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80")}>
                      {g}%
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Barrier ±{(BARRIER_PCT[growthRate] * 100).toFixed(2)}% · Higher growth = tighter barrier
                </p>
              </div>

              {/* Active accumulator contract */}
              {activeAccumContract ? (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                      <p className="text-sm font-bold">Accumulating</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{activeAccumContract.ticks} ticks</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-card rounded-lg py-2">
                      <p className="text-[9px] text-muted-foreground">Stake</p>
                      <p className="text-sm font-bold">${activeAccumContract.stake.toFixed(2)}</p>
                    </div>
                    <div className="bg-card rounded-lg py-2">
                      <p className="text-[9px] text-muted-foreground">Value</p>
                      <p className="text-sm font-bold text-green-400">${activeAccumContract.currentValue.toFixed(2)}</p>
                    </div>
                    <div className="bg-card rounded-lg py-2">
                      <p className="text-[9px] text-muted-foreground">Profit</p>
                      <p className={cn("text-sm font-bold", accumProfit >= 0 ? "text-green-400" : "text-red-400")}>
                        {accumProfit >= 0 ? "+$" : "-$"}{Math.abs(accumProfit).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* TP/SL levels */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-center">
                    <div className="bg-red-500/8 border border-red-500/20 rounded-lg py-1.5">
                      <p className="text-red-400/70">Barrier breach → Loss</p>
                      <div className="space-y-px mt-0.5">
                        <p className="font-bold text-green-400">▲ {activeAccumContract.upperBarrier.toFixed(2)}</p>
                        <p className="font-bold text-red-400">▼ {activeAccumContract.lowerBarrier.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="bg-green-500/8 border border-green-500/20 rounded-lg py-1.5">
                      <p className="text-green-400/70">Take Profit target</p>
                      <p className="font-bold text-green-400 mt-0.5">
                        {activeAccumContract.takeProfit ? `+$${activeAccumContract.takeProfit.toFixed(2)}` : "Manual only"}
                      </p>
                    </div>
                  </div>

                  <button onClick={sellAccumContract}
                    className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-700 active:scale-95 text-white font-bold text-sm transition-all">
                    Take Profit · ${activeAccumContract.currentValue.toFixed(2)}
                  </button>
                </div>
              ) : (
                <button onClick={buyAccumContract}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-sm transition-all">
                  <TrendingUp className="w-4 h-4" />
                  Buy · ${stakeNum.toFixed(2)} · {growthRate}% growth
                </button>
              )}

              {/* Accumulator history */}
              {accumResults.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">History</p>
                  <div className="space-y-1">
                    {accumResults.map(r => (
                      <div key={r.id} className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-xs border",
                        r.reason === "stop-loss"
                          ? "bg-red-500/8 border-red-500/20"
                          : "bg-green-500/8 border-green-500/20",
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold shrink-0 text-[10px]">
                            {r.reason === "take-profit" ? "🎯" : r.reason === "stop-loss" ? "🛑" : "✓"}
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
            </div>

          ) : (
          /* ═══════════════════════════════════════════════════════ */
          /* BINARY PANEL */
          /* ═══════════════════════════════════════════════════════ */
            <div className="space-y-3">
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

              {/* Real account balance nudge */}
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

              {/* Active binary contracts */}
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

              {/* Binary results */}
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
            </div>
          )}

          {/* Demo balance reset — always at bottom */}
          {accountMode === "demo" && (
            <button onClick={() => {
              setDemoBalance(10000);
              localStorage.setItem("binary_demo", "10000");
              setSessionPnl(0);
              setAccumSessionPnl(0);
              toast({ title: "Demo reset", description: "Virtual balance restored to $10,000" });
            }} className="w-full py-2.5 rounded-xl border border-border text-xs text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Reset Demo to $10,000
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
