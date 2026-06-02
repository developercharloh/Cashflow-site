import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Crash math ────────────────────────────────────────────────────────────────
// ~50% crash below 2x, long tail up to 500x
function generateCrash(): number {
  const r = Math.random();
  if (r < 0.01) return 1.00; // 1% instant crash
  return Math.max(1.01, Math.min(0.99 / (1 - r), 500));
}

// Multiplier from elapsed seconds (exponential curve matching Aviator feel)
function calcMultiplier(elapsed: number): number {
  return Math.round(Math.exp(0.13 * elapsed) * 100) / 100;
}

// ── Chart helpers ─────────────────────────────────────────────────────────────
const CW = 300; // SVG viewBox width
const CH = 160; // SVG viewBox height
const PL = 12;  // padding left
const PB = 14;  // padding bottom
const PT = 10;  // padding top

function mToY(m: number, maxM: number): number {
  const logM   = Math.log(Math.max(1, m));
  const logMax = Math.log(Math.max(1.05, maxM * 1.15));
  return CH - PB - (logM / logMax) * (CH - PB - PT);
}
function tToX(t: number, maxT: number): number {
  const span = Math.max(maxT * 1.15, 3);
  return PL + (t / span) * (CW - PL - 6);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "waiting" | "flying" | "crashed";
interface ChartPt { t: number; m: number; }
interface HistoryItem { id: string; crash: number; }

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  demoBalance: number;
  setDemoBalance: (fn: (p: number) => number) => void;
  accountMode: "demo" | "real";
  realBalance: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProAviatorGame({ demoBalance, setDemoBalance, accountMode, realBalance }: Props) {
  const { toast } = useToast();

  // ── Game state ──────────────────────────────────────────────────────────────
  const [phase, setPhase]         = useState<Phase>("waiting");
  const [countdown, setCountdown] = useState(5);
  const [multiplier, setMultiplier] = useState(1.00);
  const [chartPts, setChartPts]   = useState<ChartPt[]>([{ t: 0, m: 1 }]);
  const [history, setHistory]     = useState<HistoryItem[]>([]);
  const [sessionPnl, setSessionPnl] = useState(0);
  const [lastResult, setLastResult] = useState<{ win: boolean; profit: number; cashoutAt: number } | null>(null);

  // ── Bet state ───────────────────────────────────────────────────────────────
  const [betInput, setBetInput]       = useState("1.00");
  const [autoCashout, setAutoCashout] = useState("");
  const [autoBet, setAutoBet]         = useState(false);
  const [betPlaced, setBetPlaced]     = useState(false);
  const [cashedOut, setCashedOut]     = useState(false);

  // ── Refs (stable inside intervals) ──────────────────────────────────────────
  const phaseRef        = useRef<Phase>("waiting");
  const multiplierRef   = useRef(1.00);
  const crashAtRef      = useRef(generateCrash());
  const startTimeRef    = useRef<number>(0);
  const betPlacedRef    = useRef(false);
  const cashedOutRef    = useRef(false);
  const autoCashoutRef  = useRef("");
  const betInputRef     = useRef("1.00");
  const autoBetRef      = useRef(false);
  const balanceRef      = useRef(demoBalance);

  // Sync refs
  useEffect(() => { balanceRef.current = accountMode === "demo" ? demoBalance : realBalance; }, [demoBalance, realBalance, accountMode]);
  useEffect(() => { autoCashoutRef.current = autoCashout; }, [autoCashout]);
  useEffect(() => { betInputRef.current = betInput; }, [betInput]);
  useEffect(() => { autoBetRef.current = autoBet; }, [autoBet]);

  // ── Deduct bet ──────────────────────────────────────────────────────────────
  const deductBet = useCallback((amount: number) => {
    if (accountMode === "demo") {
      setDemoBalance(p => {
        const nb = Math.max(0, Math.round((p - amount) * 100) / 100);
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
  }, [accountMode, setDemoBalance]);

  const creditWin = useCallback((amount: number) => {
    if (accountMode === "demo") {
      setDemoBalance(p => {
        const nb = Math.round((p + amount) * 100) / 100;
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
  }, [accountMode, setDemoBalance]);

  // ── Cash out ────────────────────────────────────────────────────────────────
  const cashOut = useCallback(() => {
    if (phaseRef.current !== "flying" || !betPlacedRef.current || cashedOutRef.current) return;
    cashedOutRef.current = true;
    setCashedOut(true);

    const stake  = parseFloat(betInputRef.current) || 0;
    const mult   = multiplierRef.current;
    const payout = Math.round(stake * mult * 100) / 100;
    const profit = Math.round((payout - stake) * 100) / 100;

    creditWin(payout);
    setSessionPnl(p => Math.round((p + profit) * 100) / 100);
    setLastResult({ win: true, profit, cashoutAt: mult });
    toast({
      title: `💸 Cashed out at ${mult.toFixed(2)}x!`,
      description: `+$${profit.toFixed(2)} profit`,
    });
  }, [creditWin, toast]);

  // ── Round lifecycle ──────────────────────────────────────────────────────────
  const startWaiting = useCallback(() => {
    phaseRef.current = "waiting";
    setPhase("waiting");
    setCountdown(5);
    setMultiplier(1.00);
    multiplierRef.current = 1.00;
    setChartPts([{ t: 0, m: 1 }]);
    setBetPlaced(false);
    betPlacedRef.current = false;
    setCashedOut(false);
    cashedOutRef.current = false;
    crashAtRef.current = generateCrash();

    // Auto-bet: place bet for next round automatically
    if (autoBetRef.current) {
      const amount = parseFloat(betInputRef.current) || 0;
      const bal = balanceRef.current;
      if (amount > 0 && bal >= amount) {
        betPlacedRef.current = true;
        setBetPlaced(true);
        deductBet(amount);
      }
    }
  }, [deductBet]);

  // Main game loop
  useEffect(() => {
    let flyInterval: ReturnType<typeof setInterval> | null = null;
    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    let crashTimeout: ReturnType<typeof setTimeout> | null = null;

    function beginFlying() {
      phaseRef.current = "flying";
      setPhase("flying");
      startTimeRef.current = Date.now();

      flyInterval = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const m = calcMultiplier(elapsed);
        multiplierRef.current = m;
        setMultiplier(m);
        setChartPts(prev => [...prev, { t: elapsed, m }]);

        // Auto cashout
        const ac = parseFloat(autoCashoutRef.current);
        if (betPlacedRef.current && !cashedOutRef.current && !isNaN(ac) && ac >= 1.01 && m >= ac) {
          cashOut();
        }

        // Crash
        if (m >= crashAtRef.current) {
          if (flyInterval) clearInterval(flyInterval);

          // Lose bet if didn't cash out
          if (betPlacedRef.current && !cashedOutRef.current) {
            const stake  = parseFloat(betInputRef.current) || 0;
            setSessionPnl(p => Math.round((p - stake) * 100) / 100);
            setLastResult({ win: false, profit: -stake, cashoutAt: m });
            toast({
              title: `💥 Crashed at ${crashAtRef.current.toFixed(2)}x`,
              description: `-$${stake.toFixed(2)}`,
              variant: "destructive",
            });
          }

          const crashVal = crashAtRef.current;
          phaseRef.current = "crashed";
          setPhase("crashed");
          setHistory(prev => [{ id: `${Date.now()}`, crash: crashVal }, ...prev].slice(0, 20));

          crashTimeout = setTimeout(() => { startWaiting(); }, 3500);
        }
      }, 100);
    }

    // Countdown
    let cdLeft = 5;
    countdownInterval = setInterval(() => {
      cdLeft--;
      setCountdown(cdLeft);
      if (cdLeft <= 0) {
        if (countdownInterval) clearInterval(countdownInterval);
        beginFlying();
      }
    }, 1000);

    return () => {
      if (flyInterval)      clearInterval(flyInterval);
      if (countdownInterval) clearInterval(countdownInterval);
      if (crashTimeout)     clearTimeout(crashTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // single mount — managed via startWaiting callback

  // ── Place bet ────────────────────────────────────────────────────────────────
  const placeBet = useCallback(() => {
    if (phaseRef.current !== "waiting") { toast({ title: "Wait for next round" }); return; }
    if (betPlacedRef.current) { toast({ title: "Bet already placed" }); return; }
    const amount = parseFloat(betInput) || 0;
    const bal = accountMode === "demo" ? demoBalance : realBalance;
    if (amount <= 0 || bal < amount) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    betPlacedRef.current = true;
    setBetPlaced(true);
    deductBet(amount);
    toast({ title: "✅ Bet placed!", description: `$${amount.toFixed(2)} — cash out before crash!` });
  }, [betInput, accountMode, demoBalance, realBalance, deductBet, toast]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const balance = accountMode === "demo" ? demoBalance : realBalance;
  const isCrashed = phase === "crashed";
  const isFlying  = phase === "flying";
  const isWaiting = phase === "waiting";

  // SVG path
  const maxT = chartPts.length > 1 ? chartPts[chartPts.length - 1].t : 3;
  const maxM = isCrashed
    ? Math.max(...chartPts.map(p => p.m), 1.5)
    : Math.max(...chartPts.map(p => p.m), multiplier * 1.3, 1.5);

  const svgPts = chartPts.map(pt => ({
    x: tToX(pt.t, maxT),
    y: mToY(pt.m, maxM),
  }));

  const pathD = svgPts.length > 1
    ? "M " + svgPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")
    : `M ${PL},${CH - PB}`;

  const lastPt = svgPts[svgPts.length - 1] ?? { x: PL, y: CH - PB };

  const lineColor = isCrashed ? "#ef4444" : "#22c55e";

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── History chips ── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {history.length === 0 ? (
          <span className="text-[10px] text-muted-foreground italic">No rounds yet</span>
        ) : history.map(h => (
          <span key={h.id} className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border",
            h.crash < 2   ? "bg-red-500/15 text-red-400 border-red-500/25" :
            h.crash < 10  ? "bg-blue-500/15 text-blue-400 border-blue-500/25" :
                            "bg-green-500/15 text-green-400 border-green-500/25",
          )}>
            {h.crash.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* ── Main chart area ── */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden border transition-colors",
        isCrashed ? "bg-red-950/30 border-red-500/30" : "bg-[#050514] border-border",
      )} style={{ height: 200 }}>

        {/* Grid lines */}
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full opacity-10"
        >
          {[1.5, 2, 3, 5, 10].map(gridM => {
            const gy = mToY(gridM, maxM);
            return gy > PT && gy < CH - PB ? (
              <line key={gridM} x1={PL} y1={gy} x2={CW - 4} y2={gy}
                stroke="#fff" strokeWidth="0.5" strokeDasharray="3 4" />
            ) : null;
          })}
        </svg>

        {/* Curve */}
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          <defs>
            <linearGradient id="av-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {/* Fill area */}
          {svgPts.length > 1 && (
            <path
              d={`${pathD} L ${lastPt.x.toFixed(1)},${CH - PB} L ${PL},${CH - PB} Z`}
              fill="url(#av-fill)"
            />
          )}
          {/* Main curve */}
          <path d={pathD} stroke={lineColor} strokeWidth="2.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
          {/* Plane at tip */}
          {!isCrashed && (
            <text x={lastPt.x} y={lastPt.y - 6} textAnchor="middle"
              fontSize="14" className="select-none" style={{ filter: "drop-shadow(0 0 4px rgba(34,197,94,0.8))" }}>
              ✈️
            </text>
          )}
          {/* Explosion on crash */}
          {isCrashed && (
            <text x={lastPt.x} y={lastPt.y - 4} textAnchor="middle"
              fontSize="20" className="select-none">
              💥
            </text>
          )}
        </svg>

        {/* ── Centre overlay: multiplier or countdown ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {isWaiting ? (
            <div className="text-center">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Starting in</p>
              <p className="text-5xl font-extrabold text-white font-mono">{countdown}</p>
              {betPlaced && (
                <p className="text-green-400 text-xs mt-1 font-semibold animate-pulse">
                  ✓ Bet placed — get ready!
                </p>
              )}
            </div>
          ) : isCrashed ? (
            <div className="text-center">
              <p className="text-red-400/80 text-xs uppercase tracking-widest mb-1">Flew Away</p>
              <p className="text-5xl font-extrabold text-red-400 font-mono">
                {(crashAtRef.current).toFixed(2)}x
              </p>
              {lastResult && (
                <p className={cn("text-sm font-bold mt-1",
                  lastResult.win ? "text-green-400" : "text-red-400")}>
                  {lastResult.win ? `+$${lastResult.profit.toFixed(2)}` : `-$${Math.abs(lastResult.profit).toFixed(2)}`}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className={cn("text-6xl font-extrabold font-mono leading-none",
                cashedOut ? "text-white/40" : "text-green-400")}>
                {multiplier.toFixed(2)}x
              </p>
              {cashedOut && lastResult && (
                <p className="text-green-400 text-sm font-bold mt-1">
                  Cashed out ✓ +${lastResult.profit.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-1 top-0 bottom-4 flex flex-col justify-between pointer-events-none">
          {[maxM, (maxM + 1) / 2, 1].map((lv, i) => (
            <span key={i} className="text-[8px] text-white/20 font-mono">{lv.toFixed(1)}x</span>
          ))}
        </div>
      </div>

      {/* ── Bet controls ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground font-medium mb-1">Bet Amount ($)</p>
          <input
            type="number" min="0.10" step="0.50"
            value={betInput}
            disabled={betPlaced}
            onChange={e => setBetInput(e.target.value)}
            onBlur={e => {
              const v = parseFloat(e.target.value);
              setBetInput(isNaN(v) || v < 0.10 ? "1.00" : v.toFixed(2));
            }}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-medium mb-1">Auto Cash Out (×)</p>
          <input
            type="number" min="1.01" step="0.25"
            value={autoCashout}
            onChange={e => setAutoCashout(e.target.value)}
            placeholder="e.g. 2.00"
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Main action button */}
      {isFlying && betPlaced && !cashedOut ? (
        <button
          onClick={cashOut}
          className="w-full py-4 rounded-xl bg-green-500 hover:bg-green-600 active:scale-95 text-white font-extrabold text-lg transition-all shadow-lg shadow-green-500/20 animate-pulse">
          Cash Out · ${(parseFloat(betInput || "0") * multiplier).toFixed(2)}
        </button>
      ) : isWaiting && !betPlaced ? (
        <button
          onClick={placeBet}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-sm transition-all">
          <Zap className="w-4 h-4" />
          Place Bet · ${parseFloat(betInput || "0").toFixed(2)}
        </button>
      ) : isWaiting && betPlaced ? (
        <button disabled
          className="w-full py-4 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 font-bold text-sm opacity-80 cursor-not-allowed">
          ✓ Bet Placed · Waiting for takeoff...
        </button>
      ) : isCrashed ? (
        <button disabled
          className="w-full py-4 rounded-xl bg-muted text-muted-foreground font-bold text-sm cursor-not-allowed opacity-60">
          Next round starting...
        </button>
      ) : (
        <button disabled
          className="w-full py-4 rounded-xl bg-muted text-muted-foreground font-bold text-sm cursor-not-allowed opacity-60">
          {cashedOut ? "✓ Cashed out — watch the round" : "Bet to play"}
        </button>
      )}

      {/* Auto-bet toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-card border border-border">
        <div>
          <p className="text-xs font-semibold">Auto Bet</p>
          <p className="text-[10px] text-muted-foreground">Automatically place the same bet each round</p>
        </div>
        <button
          onClick={() => setAutoBet(a => { autoBetRef.current = !a; return !a; })}
          className={cn(
            "relative w-10 h-5 rounded-full transition-colors shrink-0",
            autoBet ? "bg-primary" : "bg-muted border border-border",
          )}>
          <span className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
            autoBet ? "left-[calc(100%-1.125rem)]" : "left-0.5",
          )} />
        </button>
      </div>

      {/* Session P&L */}
      <div className="rounded-xl bg-card border border-border px-4 py-2.5 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Session P&L</p>
          <p className={cn("text-xl font-extrabold", sessionPnl >= 0 ? "text-green-400" : "text-red-400")}>
            {sessionPnl >= 0 ? "+$" : "-$"}{Math.abs(sessionPnl).toFixed(2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-muted-foreground">{accountMode === "demo" ? "Virtual" : "Real"} Balance</p>
          <p className="text-sm font-bold text-green-400">${balance.toFixed(2)}</p>
        </div>
        <button onClick={() => setSessionPnl(0)}
          className="text-muted-foreground hover:text-foreground shrink-0 ml-2">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
