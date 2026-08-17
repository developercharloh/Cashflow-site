import { useState, useRef, useCallback, useEffect } from "react";
import {
  Zap, Target, ShieldAlert, TrendingUp, TrendingDown,
  Play, Square, Trophy, AlertTriangle, RefreshCw,
  ChevronUp, ChevronDown, BarChart2, CheckCircle2, XCircle,
  Cpu, Radio, Flame, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryOptions } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  DIGIT_MARKETS,
  buildTicks,
  generateAISignal,
  type MarketDef,
  type TradeRecord,
} from "@/lib/trading-engine";

// ─── helpers ────────────────────────────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function fmt(n: number) {
  return (n >= 0 ? "+" : "") + n.toFixed(2);
}

function getToken() {
  return localStorage.getItem("token") ?? "";
}

// ─── Number Input ────────────────────────────────────────────
function NumInput({
  label, icon, value, onChange, min = 0, step = 1, prefix = "$", disabled = false,
}: {
  label: string; icon: React.ReactNode; value: number;
  onChange: (v: number) => void; min?: number; step?: number; prefix?: string; disabled?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/5 p-3 space-y-1 transition-opacity", disabled && "opacity-50 pointer-events-none")}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(2))))}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronDown size={14} />
        </button>
        <div className="flex-1 flex items-center justify-center gap-1">
          <span className="text-sm text-muted-foreground">{prefix}</span>
          <input
            type="number"
            value={value}
            min={min}
            step={step}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="w-20 bg-transparent text-center text-white font-bold text-base outline-none"
          />
        </div>
        <button
          onClick={() => onChange(parseFloat((value + step).toFixed(2)))}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <ChevronUp size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Trade Card ──────────────────────────────────────────────
function TradeCard({ trade }: { trade: TradeRecord }) {
  const isAnalyzing = trade.status === "analyzing";
  const isExecuting = trade.status === "executing";
  const isPending = isAnalyzing || isExecuting;

  return (
    <div className={cn(
      "rounded-xl border p-3 transition-all duration-500",
      isPending
        ? "border-primary/40 bg-primary/5 animate-pulse"
        : trade.win
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-rose-500/30 bg-rose-500/5"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isPending ? (
            <Radio size={14} className="text-primary animate-spin" />
          ) : trade.win ? (
            <CheckCircle2 size={14} className="text-emerald-400" />
          ) : (
            <XCircle size={14} className="text-rose-400" />
          )}
          <div>
            <span className="text-xs font-bold text-white">{trade.marketName.replace(" Index", "")}</span>
            <span className="mx-1.5 text-white/30">·</span>
            <span className={cn(
              "text-xs font-bold",
              isPending ? "text-primary" :
              trade.win ? "text-emerald-400" : "text-rose-400"
            )}>
              {trade.contractLabel}
            </span>
          </div>
        </div>
        <div className="text-right">
          {isPending ? (
            <span className="text-xs text-muted-foreground">
              {isAnalyzing ? "Analyzing…" : "Executing…"}
            </span>
          ) : (
            <span className={cn(
              "text-sm font-bold",
              trade.win ? "text-emerald-400" : "text-rose-400"
            )}>
              {fmt(trade.netChange)}
            </span>
          )}
          <div className="text-xs text-muted-foreground">
            ${trade.stake.toFixed(2)} stake
            {!isPending && trade.lastDigit >= 0 && (
              <span className="ml-1 text-white/40">· digit {trade.lastDigit}</span>
            )}
          </div>
        </div>
      </div>
      {!isPending && (
        <div className="mt-1.5 flex items-center gap-1">
          <div className={cn(
            "text-[10px] px-1.5 py-0.5 rounded font-bold",
            trade.win ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
          )}>
            {trade.win ? "WIN" : "LOSS"}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {trade.timestamp.toLocaleTimeString()}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── TP Popup ────────────────────────────────────────────────
function TPPopup({ pnl, trades, wins, onClose }: {
  pnl: number; trades: number; wins: number; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950 to-[hsl(220,30%,7%)] p-8 text-center shadow-2xl shadow-emerald-500/20 animate-in zoom-in-75 duration-300">
        {/* Sparkles ring */}
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40">
            <Trophy size={40} className="text-emerald-400" />
          </div>
        </div>
        <div className="flex justify-center gap-2 mb-3">
          {[...Array(5)].map((_, i) => (
            <Sparkles key={i} size={14} className="text-yellow-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <h2 className="text-2xl font-black text-white mb-1">Target Reached! 🎯</h2>
        <p className="text-emerald-400 text-sm mb-6">Your AI strategy crushed it!</p>

        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Session Profit</span>
            <span className="font-bold text-emerald-400 text-lg">{fmt(pnl)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Trades</span>
            <span className="font-bold text-white">{trades}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Win Rate</span>
            <span className="font-bold text-emerald-400">
              {trades > 0 ? Math.round((wins / trades) * 100) : 0}%
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors"
        >
          Start New Session
        </button>
      </div>
    </div>
  );
}

// ─── SL Popup ────────────────────────────────────────────────
function SLPopup({ pnl, trades, wins, onClose }: {
  pnl: number; trades: number; wins: number; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-gradient-to-b from-rose-950 to-[hsl(220,30%,7%)] p-8 text-center shadow-2xl shadow-rose-500/20 animate-in zoom-in-75 duration-300">
        <div className="relative mx-auto mb-6 w-20 h-20">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/40">
            <ShieldAlert size={40} className="text-rose-400" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-1">Stop Loss Hit 🛡️</h2>
        <p className="text-rose-400 text-sm mb-6">Auto execution stopped to protect your account</p>

        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Session Loss</span>
            <span className="font-bold text-rose-400 text-lg">{fmt(pnl)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Trades</span>
            <span className="font-bold text-white">{trades}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Win Rate</span>
            <span className="font-bold text-white">
              {trades > 0 ? Math.round((wins / trades) * 100) : 0}%
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm transition-colors"
        >
          Try New Session
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function SignalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isRealMode = localStorage.getItem("trading_mode") === "real";

  // Demo balance
  const [demoBalance, setDemoBalance] = useState(() =>
    parseFloat(localStorage.getItem("elite_demo") ?? "10000")
  );
  const demoBalanceRef = useRef(demoBalance);
  useEffect(() => { demoBalanceRef.current = demoBalance; }, [demoBalance]);

  const displayBalance = isRealMode
    ? (user?.balance ?? 0)
    : demoBalance;

  // ── Config ────────────────────────────────────────────────
  const [stake, setStake] = useState(10);
  const [targetProfit, setTargetProfit] = useState(50);
  const [stopLoss, setStopLoss] = useState(30);
  const [martingale, setMartingale] = useState(1.5);
  const [selectedMarket, setSelectedMarket] = useState<string>("all");

  // ── Session State ─────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [currentStake, setCurrentStake] = useState(stake);
  const [runningPnl, setRunningPnl] = useState(0);
  const [tradeLog, setTradeLog] = useState<TradeRecord[]>([]);
  const [execStatus, setExecStatus] = useState<string>("Ready to start auto AI execution");
  const [popup, setPopup] = useState<null | "tp" | "sl">(null);
  const [winCount, setWinCount] = useState(0);

  // ── Refs for async loop ───────────────────────────────────
  const isRunningRef = useRef(false);
  const runningPnlRef = useRef(0);
  const currentStakeRef = useRef(stake);
  const stakeRef = useRef(stake);
  const targetProfitRef = useRef(targetProfit);
  const stopLossRef = useRef(stopLoss);
  const martingaleRef = useRef(martingale);
  const selectedMarketRef = useRef(selectedMarket);
  const marketIndexRef = useRef(0);
  const tradeCountRef = useRef(0);
  const winCountRef = useRef(0);

  // Keep refs in sync
  useEffect(() => { stakeRef.current = stake; }, [stake]);
  useEffect(() => { targetProfitRef.current = targetProfit; }, [targetProfit]);
  useEffect(() => { stopLossRef.current = stopLoss; }, [stopLoss]);
  useEffect(() => { martingaleRef.current = martingale; }, [martingale]);
  useEffect(() => { selectedMarketRef.current = selectedMarket; }, [selectedMarket]);

  // ── Reset session ─────────────────────────────────────────
  const resetSession = () => {
    runningPnlRef.current = 0;
    currentStakeRef.current = stake;
    tradeCountRef.current = 0;
    winCountRef.current = 0;
    marketIndexRef.current = 0;
    setRunningPnl(0);
    setCurrentStake(stake);
    setTradeLog([]);
    setWinCount(0);
    setExecStatus("Ready to start auto AI execution");
  };

  // ── Execution loop ────────────────────────────────────────
  const runLoop = useCallback(async () => {
    while (isRunningRef.current) {
      // Pick market
      let market: MarketDef;
      if (selectedMarketRef.current === "all") {
        market = DIGIT_MARKETS[marketIndexRef.current % DIGIT_MARKETS.length];
        marketIndexRef.current++;
      } else {
        market = DIGIT_MARKETS.find(m => m.id === selectedMarketRef.current) ?? DIGIT_MARKETS[0];
      }

      const tradeStake = currentStakeRef.current;

      // ── Phase 1: Analyzing ─────────────────────────────
      setExecStatus(`🔍  Analyzing ${market.shortName}…`);
      const pendingId = `${Date.now()}-${Math.random()}`;
      const ticks = buildTicks(market, 120);
      const signal = generateAISignal(ticks, market);

      const pendingTrade: TradeRecord = {
        id: pendingId,
        market: market.id,
        marketName: market.name,
        contractType: signal.contractType,
        contractLabel: signal.contractLabel,
        direction: signal.direction,
        stake: tradeStake,
        payout: 0, netChange: 0, win: false, lastDigit: -1,
        timestamp: new Date(),
        status: "analyzing",
      };
      setTradeLog(prev => [pendingTrade, ...prev].slice(0, 60));
      await sleep(900);
      if (!isRunningRef.current) break;

      // ── Phase 2: Executing ─────────────────────────────
      setExecStatus(`⚡  Executing $${tradeStake.toFixed(2)} ${signal.contractLabel} on ${market.shortName}`);
      setTradeLog(prev =>
        prev.map(t => t.id === pendingId ? { ...t, status: "executing" as const } : t)
      );

      // Deduct stake from demo balance immediately
      if (!isRealMode) {
        const nb = Math.max(0, demoBalanceRef.current - tradeStake);
        demoBalanceRef.current = nb;
        setDemoBalance(nb);
        localStorage.setItem("elite_demo", nb.toString());
      }

      await sleep(700);
      if (!isRunningRef.current) {
        // Refund demo if stopped mid-trade
        if (!isRealMode) {
          const nb = demoBalanceRef.current + tradeStake;
          demoBalanceRef.current = nb;
          setDemoBalance(nb);
          localStorage.setItem("elite_demo", nb.toString());
        }
        break;
      }

      // ── API call ──────────────────────────────────────
      let win = false, payout = 0, netChange = 0, lastDigit = 0;
      try {
        const res = await fetch("/api/binary/trade", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            stake: tradeStake,
            direction: signal.direction,
            barrier: signal.barrier,
            isDemo: !isRealMode,
            market: market.shortName,
            contractType: signal.contractLabel,
          }),
        });
        const data = await res.json();
        win = data.win ?? false;
        payout = data.payout ?? 0;
        lastDigit = data.lastDigit ?? 0;
        netChange = data.netChange ?? (win ? payout - tradeStake : -tradeStake);

        // Real mode: refresh balance from server
        if (isRealMode) {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryOptions().queryKey });
        } else {
          // Demo: credit payout on win
          if (win) {
            const nb = demoBalanceRef.current + payout;
            demoBalanceRef.current = nb;
            setDemoBalance(nb);
            localStorage.setItem("elite_demo", nb.toString());
          }
        }
      } catch {
        // On error, refund demo and continue
        if (!isRealMode) {
          const nb = demoBalanceRef.current + tradeStake;
          demoBalanceRef.current = nb;
          setDemoBalance(nb);
          localStorage.setItem("elite_demo", nb.toString());
        }
        setExecStatus("⚠️  Network error — retrying…");
        await sleep(2000);
        continue;
      }

      // ── Update trade log ──────────────────────────────
      setTradeLog(prev =>
        prev.map(t =>
          t.id === pendingId
            ? { ...t, status: "complete" as const, win, payout, netChange, lastDigit }
            : t
        )
      );

      // ── Update session stats ──────────────────────────
      const newPnl = parseFloat((runningPnlRef.current + netChange).toFixed(2));
      runningPnlRef.current = newPnl;
      setRunningPnl(newPnl);
      tradeCountRef.current++;
      if (win) {
        winCountRef.current++;
        setWinCount(w => w + 1);
      }

      // Martingale
      if (win) {
        currentStakeRef.current = stakeRef.current;
        setCurrentStake(stakeRef.current);
      } else {
        const ns = parseFloat(Math.min(
          tradeStake * martingaleRef.current,
          stakeRef.current * 128 // cap at 128x to prevent runaway
        ).toFixed(2));
        currentStakeRef.current = ns;
        setCurrentStake(ns);
      }

      // ── Check TP / SL ─────────────────────────────────
      if (newPnl >= targetProfitRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        setPopup("tp");
        setExecStatus("🎯 Target Profit reached!");
        break;
      }
      if (newPnl <= -stopLossRef.current) {
        isRunningRef.current = false;
        setIsRunning(false);
        setPopup("sl");
        setExecStatus("🛡️ Stop Loss triggered. Session ended.");
        break;
      }

      setExecStatus(
        win
          ? `✅  WIN +$${payout.toFixed(2)} on ${market.shortName} · Next trade…`
          : `❌  LOSS -$${tradeStake.toFixed(2)} on ${market.shortName} · Martingale $${currentStakeRef.current.toFixed(2)}`
      );
      await sleep(1000);
    }
  }, [isRealMode, queryClient]);

  // ── Start ─────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    resetSession();
    isRunningRef.current = true;
    currentStakeRef.current = stake;
    setIsRunning(true);
    runLoop();
  }, [stake, runLoop]);

  // ── Stop ──────────────────────────────────────────────────
  const handleStop = () => {
    isRunningRef.current = false;
    setIsRunning(false);
    setExecStatus("⏹️  Auto execution stopped");
  };

  // Cleanup on unmount
  useEffect(() => () => { isRunningRef.current = false; }, []);

  const totalTrades = tradeCountRef.current;
  const winRate = totalTrades > 0 ? Math.round((winCount / totalTrades) * 100) : 0;
  const tpProgress = Math.min(100, Math.max(0, (runningPnl / targetProfit) * 100));
  const slProgress = Math.min(100, Math.max(0, (-runningPnl / stopLoss) * 100));

  const selectedMarketObj = selectedMarket === "all"
    ? null
    : DIGIT_MARKETS.find(m => m.id === selectedMarket);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-5">

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Cpu size={20} className="text-primary" />
              Auto AI Execution
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deriv Volatility Indices · Digit Contracts
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {isRealMode ? "Real" : "Demo"} Balance
            </p>
            <p className="text-xl font-black text-primary">${displayBalance.toFixed(2)}</p>
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* ── Left: Config ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-3">

            {/* Config Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <BarChart2 size={12} /> Strategy Configuration
              </h2>

              <NumInput
                label="Stake per trade"
                icon={<span className="text-primary">💰</span>}
                value={stake}
                onChange={v => { setStake(v); if (!isRunning) setCurrentStake(v); }}
                min={0.35}
                step={1}
                disabled={isRunning}
              />
              <NumInput
                label="Target Profit"
                icon={<Target size={12} className="text-emerald-400" />}
                value={targetProfit}
                onChange={setTargetProfit}
                min={1}
                step={5}
                disabled={isRunning}
              />
              <NumInput
                label="Stop Loss"
                icon={<ShieldAlert size={12} className="text-rose-400" />}
                value={stopLoss}
                onChange={setStopLoss}
                min={1}
                step={5}
                disabled={isRunning}
              />

              {/* Martingale */}
              <div className={cn("rounded-xl border border-white/10 bg-white/5 p-3 space-y-2", isRunning && "opacity-50 pointer-events-none")}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flame size={12} className="text-orange-400" />
                  <span>Martingale (after loss)</span>
                </div>
                <div className="flex gap-2">
                  {[1, 1.5, 2, 2.5, 3].map(v => (
                    <button
                      key={v}
                      onClick={() => setMartingale(v)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                        martingale === v
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                          : "bg-white/5 text-muted-foreground hover:bg-white/10"
                      )}
                    >
                      {v === 1 ? "Off" : `${v}×`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Market */}
              <div className={cn("rounded-xl border border-white/10 bg-white/5 p-3 space-y-2", isRunning && "opacity-50 pointer-events-none")}>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Radio size={12} className="text-primary" />
                  <span>Market</span>
                </div>
                <select
                  value={selectedMarket}
                  onChange={e => setSelectedMarket(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none"
                >
                  <option value="all">🌐 All Markets (Multi-Market)</option>
                  {DIGIT_MARKETS.map(m => (
                    <option key={m.id} value={m.id}>{m.shortName} — {m.name}</option>
                  ))}
                </select>
                {selectedMarket === "all" && (
                  <p className="text-[10px] text-muted-foreground">
                    AI cycles through all 10 volatility indices
                  </p>
                )}
              </div>

              {/* Current stake display when running */}
              {isRunning && martingale > 1 && currentStake !== stake && (
                <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-orange-400">Martingale active</span>
                  <span className="text-sm font-bold text-orange-400">${currentStake.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Start / Stop */}
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="w-full py-4 rounded-2xl bg-primary hover:bg-primary/90 text-black font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Play size={18} fill="black" />
                Start Auto AI Execution
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="w-full py-4 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-500/30 animate-pulse"
              >
                <Square size={18} fill="white" />
                Stop Execution
              </button>
            )}

            {!isRunning && tradeLog.length > 0 && (
              <button
                onClick={resetSession}
                className="w-full py-2.5 rounded-xl border border-white/10 hover:border-white/20 text-muted-foreground hover:text-white text-sm flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw size={14} /> Reset Session
              </button>
            )}
          </div>

          {/* ── Right: Execution panel ─────────────────── */}
          <div className="lg:col-span-3 space-y-3">

            {/* Status + P&L */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-4">

              {/* Status line */}
              <div className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                isRunning ? "bg-primary/10 border border-primary/20" : "bg-white/5"
              )}>
                {isRunning ? (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white/20 flex-shrink-0" />
                )}
                <span className={cn("font-medium truncate", isRunning ? "text-primary" : "text-muted-foreground")}>
                  {execStatus}
                </span>
              </div>

              {/* Session stats row */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Trades", value: totalTrades, color: "text-white" },
                  { label: "Wins", value: winCount, color: "text-emerald-400" },
                  { label: "Losses", value: totalTrades - winCount, color: "text-rose-400" },
                  { label: "Win Rate", value: `${winRate}%`, color: winRate >= 50 ? "text-emerald-400" : "text-rose-400" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-white/5 p-2 text-center">
                    <p className={cn("text-base font-black", s.color)}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Running P&L */}
              <div className="rounded-xl bg-white/5 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Session P&L</p>
                <p className={cn(
                  "text-4xl font-black tabular-nums transition-all",
                  runningPnl > 0 ? "text-emerald-400" : runningPnl < 0 ? "text-rose-400" : "text-white/40"
                )}>
                  {runningPnl > 0 ? "+" : ""}{runningPnl.toFixed(2)}
                </p>
              </div>

              {/* TP Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-emerald-400">
                    <Target size={11} />
                    <span>Target Profit: ${targetProfit}</span>
                  </div>
                  <span className="text-emerald-400 font-bold">{tpProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                    style={{ width: `${tpProgress}%` }}
                  />
                </div>

                {/* SL Progress */}
                <div className="flex items-center justify-between text-xs mt-2">
                  <div className="flex items-center gap-1 text-rose-400">
                    <ShieldAlert size={11} />
                    <span>Stop Loss: ${stopLoss}</span>
                  </div>
                  <span className="text-rose-400 font-bold">{slProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-500"
                    style={{ width: `${slProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Live Trade Log */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <Radio size={12} className="text-primary" />
                  Live Trade Log
                </h2>
                {tradeLog.length > 0 && (
                  <span className="text-xs text-muted-foreground">{tradeLog.length} trades</span>
                )}
              </div>

              {tradeLog.length === 0 ? (
                <div className="py-10 text-center">
                  <Cpu size={32} className="mx-auto text-white/10 mb-3" />
                  <p className="text-sm text-muted-foreground">Trades will appear here</p>
                  <p className="text-xs text-white/20 mt-1">Configure and hit Start</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                  {tradeLog.map(trade => (
                    <TradeCard key={trade.id} trade={trade} />
                  ))}
                </div>
              )}
            </div>

            {/* Quick info row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Best win</p>
                  <p className="text-sm font-bold text-emerald-400">
                    {tradeLog.filter(t => t.win).length > 0
                      ? `+$${Math.max(...tradeLog.filter(t => t.win && t.status === "complete").map(t => t.payout)).toFixed(2)}`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex items-center gap-2">
                <TrendingDown size={16} className="text-rose-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Biggest loss</p>
                  <p className="text-sm font-bold text-rose-400">
                    {tradeLog.filter(t => !t.win && t.status === "complete").length > 0
                      ? `-$${Math.max(...tradeLog.filter(t => !t.win && t.status === "complete").map(t => t.stake)).toFixed(2)}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TP Popup ────────────────────────────────────────── */}
      {popup === "tp" && (
        <TPPopup
          pnl={runningPnl}
          trades={tradeCountRef.current}
          wins={winCountRef.current}
          onClose={() => { setPopup(null); resetSession(); }}
        />
      )}

      {/* ── SL Popup ────────────────────────────────────────── */}
      {popup === "sl" && (
        <SLPopup
          pnl={runningPnl}
          trades={tradeCountRef.current}
          wins={winCountRef.current}
          onClose={() => { setPopup(null); resetSession(); }}
        />
      )}
    </div>
  );
}
