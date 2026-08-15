import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Crash math ────────────────────────────────────────────────────────────────
// House-edge distribution: 60% crash at 1.00x, 25% at 1.01-1.20x, 10% at 1.20-1.60x,
// 4% at 1.60-2.50x, 1% above 2.50x — reaction time never enough at the low end.
function generateCrash(): number {
  const r = Math.random();
  if (r < 0.60) return 1.00;                                                      // instant crash
  if (r < 0.85) return 1.00 + ((r - 0.60) / 0.25) * 0.20;                       // 1.00-1.20
  if (r < 0.95) return 1.20 + ((r - 0.85) / 0.10) * 0.40;                       // 1.20-1.60
  if (r < 0.99) return 1.60 + ((r - 0.95) / 0.04) * 0.90;                       // 1.60-2.50
  return Math.max(2.50, Math.min(0.99 / (1 - r), 80));                           // 2.50+ (rare)
}
function calcMultiplier(elapsed: number): number {
  return Math.round(Math.exp(0.13 * elapsed) * 100) / 100;
}

// ── SVG chart helpers ─────────────────────────────────────────────────────────
const VW = 400;
const VH = 210;
const PL = 14; const PB = 22; const PT = 12; const PR = 8;

function mToY(m: number, maxM: number): number {
  const logM   = Math.log(Math.max(1, m));
  const logMax = Math.log(Math.max(1.05, maxM * 1.15));
  return VH - PB - (logM / logMax) * (VH - PB - PT);
}
function tToX(t: number, maxT: number): number {
  return PL + (t / Math.max(maxT * 1.1, 3)) * (VW - PL - PR);
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "waiting" | "flying" | "crashed";
interface ChartPt { t: number; m: number; }
interface HistItem { id: string; crash: number; }

interface Props {
  demoBalance: number;
  setDemoBalance: (fn: (p: number) => number) => void;
  accountMode: "demo" | "real";
  realBalance: number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ProAviatorGame({
  demoBalance, setDemoBalance, accountMode, realBalance,
}: Props) {
  const { toast } = useToast();

  // ── Display state ────────────────────────────────────────────────────────────
  const [phase, setPhase]           = useState<Phase>("waiting");
  const [countdown, setCountdown]   = useState(5);
  const [multiplier, setMultiplier] = useState(1.00);
  const [chartPts, setChartPts]     = useState<ChartPt[]>([{ t: 0, m: 1 }]);
  const [history, setHistory]       = useState<HistItem[]>([]);
  const [sessionPnl, setSessionPnl] = useState(0);
  const [betPlaced, setBetPlaced]   = useState(false);
  const [cashedOut, setCashedOut]   = useState(false);
  const [lastResult, setLastResult] = useState<{ win: boolean; profit: number; mult: number } | null>(null);

  // ── Bet inputs ───────────────────────────────────────────────────────────────
  const [betInput, setBetInput]       = useState("1.00");
  const [autoCashoutInput, setAutoCashoutInput] = useState("");
  const [autoBet, setAutoBet]         = useState(false);

  // ── All timing / volatile state via refs (safe inside setInterval closure) ───
  const phaseRef        = useRef<Phase>("waiting");
  const countdownRef    = useRef(5);
  const crashAtRef      = useRef(generateCrash());
  const flyStartRef     = useRef(0);
  const crashTimerRef   = useRef(0);
  const lastCDTickRef   = useRef(Date.now());
  const multiplierRef   = useRef(1.00);
  const betPlacedRef    = useRef(false);
  const cashedOutRef    = useRef(false);

  // Synced refs for user inputs/props
  const betInputRef        = useRef("1.00");
  const autoCashoutRef     = useRef("");
  const autoBetRef         = useRef(false);
  const accountModeRef     = useRef(accountMode);
  const demoBalanceRef     = useRef(demoBalance);
  const realBalanceRef     = useRef(realBalance);

  useEffect(() => { betInputRef.current = betInput; }, [betInput]);
  useEffect(() => { autoCashoutRef.current = autoCashoutInput; }, [autoCashoutInput]);
  useEffect(() => { autoBetRef.current = autoBet; }, [autoBet]);
  useEffect(() => { accountModeRef.current = accountMode; }, [accountMode]);
  useEffect(() => { demoBalanceRef.current = demoBalance; }, [demoBalance]);
  useEffect(() => { realBalanceRef.current = realBalance; }, [realBalance]);

  // ── Stable helpers (safe to call from interval) ──────────────────────────────
  const credit = useCallback((amount: number) => {
    if (accountModeRef.current === "demo") {
      setDemoBalance(p => {
        const nb = Math.round((p + amount) * 100) / 100;
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
  }, [setDemoBalance]);

  const deduct = useCallback((amount: number) => {
    if (accountModeRef.current === "demo") {
      setDemoBalance(p => {
        const nb = Math.max(0, Math.round((p - amount) * 100) / 100);
        localStorage.setItem("binary_demo", nb.toFixed(2));
        return nb;
      });
    }
  }, [setDemoBalance]);

  // ── Perform cashout (called from interval or button) ─────────────────────────
  const performCashOut = useCallback((m: number) => {
    if (!betPlacedRef.current || cashedOutRef.current) return;
    cashedOutRef.current = true;
    setCashedOut(true);
    const stake  = parseFloat(betInputRef.current) || 0;
    const payout = Math.round(stake * m * 100) / 100;
    const profit = Math.round((payout - stake) * 100) / 100;
    credit(payout);
    setSessionPnl(p => Math.round((p + profit) * 100) / 100);
    setLastResult({ win: true, profit, mult: m });
    toast({ title: `💸 Cashed out at ${m.toFixed(2)}x!`, description: `+$${profit.toFixed(2)} profit` });
  }, [credit, toast]);

  // ── Stable cashout ref so interval can call the latest version ────────────────
  const cashOutRef = useRef(performCashOut);
  useEffect(() => { cashOutRef.current = performCashOut; }, [performCashOut]);

  // ── Place bet ─────────────────────────────────────────────────────────────────
  const placeBet = useCallback(() => {
    if (phaseRef.current !== "waiting") {
      toast({ title: "⏳ Wait for next round" });
      return;
    }
    if (betPlacedRef.current) { toast({ title: "Bet already placed" }); return; }
    const amount = parseFloat(betInputRef.current) || 0;
    const bal = accountModeRef.current === "demo" ? demoBalanceRef.current : realBalanceRef.current;
    if (amount <= 0 || bal < amount) {
      toast({ title: "Insufficient balance", variant: "destructive" }); return;
    }
    betPlacedRef.current = true;
    setBetPlaced(true);
    deduct(amount);
    toast({ title: "✅ Bet placed!", description: "Cash out before the plane flies away!" });
  }, [deduct, toast]);

  // Manual cashout button
  const handleCashOut = useCallback(() => {
    if (phaseRef.current !== "flying" || !betPlacedRef.current || cashedOutRef.current) return;
    cashOutRef.current(multiplierRef.current);
  }, []);

  // ── Single continuous game loop (never stops) ─────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const p   = phaseRef.current;

      // ─── WAITING PHASE ────────────────────────────────────────────────────────
      if (p === "waiting") {
        if (now - lastCDTickRef.current >= 1000) {
          lastCDTickRef.current = now;
          countdownRef.current -= 1;
          setCountdown(countdownRef.current);

          if (countdownRef.current <= 0) {
            phaseRef.current = "flying";
            flyStartRef.current = now;
            setPhase("flying");
          }
        }
      }

      // ─── FLYING PHASE ────────────────────────────────────────────────────────
      else if (p === "flying") {
        const elapsed = (now - flyStartRef.current) / 1000;
        const m = calcMultiplier(elapsed);
        multiplierRef.current = m;
        setMultiplier(m);
        setChartPts(prev => [...prev, { t: elapsed, m }]);

        // Auto cashout
        const ac = parseFloat(autoCashoutRef.current);
        if (betPlacedRef.current && !cashedOutRef.current && !isNaN(ac) && ac >= 1.01 && m >= ac) {
          cashOutRef.current(m);
        }

        // Crash check
        if (m >= crashAtRef.current) {
          const finalCrash = crashAtRef.current;

          if (betPlacedRef.current && !cashedOutRef.current) {
            const stake = parseFloat(betInputRef.current) || 0;
            setSessionPnl(prev => Math.round((prev - stake) * 100) / 100);
            setLastResult({ win: false, profit: -stake, mult: finalCrash });
            toast({
              title: `💥 Flew away at ${finalCrash.toFixed(2)}x`,
              description: `-$${stake.toFixed(2)} — better luck next round`,
              variant: "destructive",
            });
          }

          setHistory(prev => [{ id: `${now}`, crash: finalCrash }, ...prev].slice(0, 20));
          phaseRef.current = "crashed";
          setPhase("crashed");
          crashTimerRef.current = now;
        }
      }

      // ─── CRASHED PHASE ───────────────────────────────────────────────────────
      else if (p === "crashed") {
        if (now - crashTimerRef.current >= 3500) {
          // Reset for new round
          countdownRef.current = 5;
          crashAtRef.current   = generateCrash();
          multiplierRef.current = 1.00;
          cashedOutRef.current = false;
          lastCDTickRef.current = now;

          setCashedOut(false);
          setLastResult(null);
          setMultiplier(1.00);
          setChartPts([{ t: 0, m: 1 }]);
          setCountdown(5);

          // Auto-bet
          if (autoBetRef.current) {
            const amount = parseFloat(betInputRef.current) || 0;
            const bal = accountModeRef.current === "demo" ? demoBalanceRef.current : realBalanceRef.current;
            if (amount > 0 && bal >= amount) {
              betPlacedRef.current = true;
              setBetPlaced(true);
              setDemoBalance(prev => {
                const nb = Math.max(0, Math.round((prev - amount) * 100) / 100);
                localStorage.setItem("binary_demo", nb.toFixed(2));
                return nb;
              });
            } else {
              betPlacedRef.current = false;
              setBetPlaced(false);
            }
          } else {
            betPlacedRef.current = false;
            setBetPlaced(false);
          }

          phaseRef.current = "waiting";
          setPhase("waiting");
        }
      }
    }, 100);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only — all live values accessed via refs

  // ── SVG path calculation ──────────────────────────────────────────────────────
  const maxT   = chartPts.length > 1 ? chartPts[chartPts.length - 1].t : 3;
  const maxM   = Math.max(...chartPts.map(p => p.m), multiplier * 1.3, 1.8);
  const svgPts = chartPts.map(pt => ({ x: tToX(pt.t, maxT), y: mToY(pt.m, maxM) }));
  const pathD  = svgPts.length > 1
    ? "M " + svgPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")
    : `M ${PL},${VH - PB}`;
  const lastPt    = svgPts[svgPts.length - 1] ?? { x: PL, y: VH - PB };
  const isCrashed = phase === "crashed";
  const isFlying  = phase === "flying";
  const isWaiting = phase === "waiting";
  const lineColor = isCrashed ? "#ef4444" : "#00e887";
  const balance   = accountMode === "demo" ? demoBalance : realBalance;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2.5">

      {/* ── History bar ── */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 min-h-[24px]">
        {history.length === 0
          ? <span className="text-[10px] text-muted-foreground/50 italic self-center">History will appear here</span>
          : history.map(h => (
            <span key={h.id} className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 border tabular-nums",
              h.crash < 2   ? "bg-red-500/15 text-red-400 border-red-500/20" :
              h.crash < 10  ? "bg-blue-500/15 text-blue-400 border-blue-500/20" :
                              "bg-green-500/15 text-green-400 border-green-500/20",
            )}>
              {h.crash.toFixed(2)}×
            </span>
          ))
        }
      </div>

      {/* ── Main game canvas ── */}
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden border transition-all duration-500",
          isCrashed
            ? "border-red-500/40 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
            : isFlying
            ? "border-green-500/25 shadow-[0_0_30px_rgba(0,232,135,0.08)]"
            : "border-white/8",
        )}
        style={{
          height: 230,
          background: "linear-gradient(180deg, #080818 0%, #050510 60%, #030310 100%)",
        }}
      >
        {/* Subtle star dots */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "50px 40px",
          backgroundPosition: "10px 10px",
        }} />

        {/* Grid reference lines */}
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full">
          {[1.5, 2, 3, 5, 10].map(gm => {
            const gy = mToY(gm, maxM);
            return gy > PT + 4 && gy < VH - PB - 4 ? (
              <g key={gm}>
                <line x1={PL} y1={gy} x2={VW - PR} y2={gy}
                  stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                <text x={VW - PR - 2} y={gy - 3} fill="rgba(255,255,255,0.2)"
                  fontSize="8" textAnchor="end">{gm.toFixed(gm < 2 ? 1 : 0)}×</text>
              </g>
            ) : null;
          })}
        </svg>

        {/* Curve */}
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full">
          <defs>
            <filter id="glow-line">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="fill-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
            </linearGradient>
            <clipPath id="chart-clip">
              <rect x={PL} y={PT} width={VW - PL - PR} height={VH - PT - PB} />
            </clipPath>
          </defs>

          {/* Fill area */}
          {svgPts.length > 1 && (
            <path
              clipPath="url(#chart-clip)"
              d={`${pathD} L ${lastPt.x.toFixed(1)},${VH - PB} L ${PL},${VH - PB} Z`}
              fill="url(#fill-grad)"
            />
          )}
          {/* Main curve with glow */}
          <path d={pathD} clipPath="url(#chart-clip)"
            stroke={lineColor} strokeWidth="2.5" fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            filter="url(#glow-line)" />

          {/* Plane dot at tip */}
          {!isCrashed && svgPts.length > 0 && (
            <>
              <circle cx={lastPt.x} cy={lastPt.y} r="4"
                fill={lineColor} opacity="0.9" filter="url(#glow-line)" />
              <text x={lastPt.x + 10} y={lastPt.y - 6}
                fontSize="18" textAnchor="start" className="select-none">✈️</text>
            </>
          )}
          {isCrashed && (
            <text x={lastPt.x} y={lastPt.y - 6}
              fontSize="22" textAnchor="middle" className="select-none">💥</text>
          )}

          {/* Baseline axis */}
          <line x1={PL} y1={VH - PB} x2={VW - PR} y2={VH - PB}
            stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1={PL} y1={PT} x2={PL} y2={VH - PB}
            stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
        </svg>

        {/* ── Centre overlay ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          {isWaiting ? (
            <div className="text-center">
              <p className="text-white/40 text-[10px] uppercase tracking-[0.2em] mb-1">Next round in</p>
              <p className="text-6xl font-black text-white tabular-nums"
                style={{ textShadow: "0 0 30px rgba(255,255,255,0.4)" }}>
                {countdown}
              </p>
              {betPlaced && (
                <p className="text-[#00e887] text-xs mt-2 font-semibold animate-pulse">
                  ✈️ Bet placed — ready!
                </p>
              )}
            </div>
          ) : isCrashed ? (
            <div className="text-center">
              <p className="text-red-400/70 text-[10px] uppercase tracking-[0.2em] mb-1">Flew Away</p>
              <p className="text-5xl font-black text-red-400 tabular-nums"
                style={{ textShadow: "0 0 20px rgba(239,68,68,0.5)" }}>
                {crashAtRef.current.toFixed(2)}×
              </p>
              {lastResult && (
                <p className={cn("text-sm font-bold mt-1.5",
                  lastResult.win ? "text-[#00e887]" : "text-red-400")}>
                  {lastResult.win ? `+$${lastResult.profit.toFixed(2)}` : `-$${Math.abs(lastResult.profit).toFixed(2)}`}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className={cn("text-6xl font-black tabular-nums transition-all",
                cashedOut ? "text-white/30" : "text-[#00e887]")}
                style={cashedOut ? {} : { textShadow: "0 0 30px rgba(0,232,135,0.6)" }}>
                {multiplier.toFixed(2)}×
              </p>
              {cashedOut && lastResult && (
                <p className="text-[#00e887] text-sm font-bold mt-1">
                  ✓ Cashed out at {lastResult.mult.toFixed(2)}× · +${lastResult.profit.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Current balance badge */}
        <div className="absolute top-2 right-3 text-right">
          <p className="text-[8px] text-white/25 uppercase tracking-widest">{accountMode === "demo" ? "Demo" : "Real"}</p>
          <p className="text-xs font-bold text-[#00e887]">${balance.toFixed(2)}</p>
        </div>
      </div>

      {/* ── Bet controls ── */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Bet ($)</p>
          <input
            type="number" min="0.10" step="0.50"
            value={betInput}
            disabled={betPlaced}
            onChange={e => setBetInput(e.target.value)}
            onBlur={e => {
              const v = parseFloat(e.target.value);
              setBetInput(isNaN(v) || v < 0.10 ? "1.00" : v.toFixed(2));
            }}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium mb-1 uppercase tracking-wider">Auto Cashout (×)</p>
          <input
            type="number" min="1.10" step="0.25"
            value={autoCashoutInput}
            onChange={e => setAutoCashoutInput(e.target.value)}
            placeholder="e.g. 2.00"
            className="w-full bg-muted border border-border rounded-xl px-3 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/40"
          />
        </div>
      </div>

      {/* ── Main action button ── */}
      {isFlying && betPlaced && !cashedOut ? (
        <button
          onClick={handleCashOut}
          className="w-full py-4 rounded-xl font-extrabold text-lg text-black transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #00e887 0%, #00c97a 100%)",
            boxShadow: "0 0 24px rgba(0,232,135,0.4), 0 4px 12px rgba(0,0,0,0.3)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}>
          CASH OUT · ${(parseFloat(betInput || "0") * multiplier).toFixed(2)}
        </button>
      ) : isWaiting && !betPlaced ? (
        <button
          onClick={placeBet}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground font-bold text-sm transition-all">
          <Zap className="w-4 h-4" />
          Place Bet · ${parseFloat(betInput || "0").toFixed(2)}
        </button>
      ) : isWaiting && betPlaced ? (
        <div className="w-full py-4 rounded-xl border border-[#00e887]/30 bg-[#00e887]/5 text-[#00e887] font-bold text-sm text-center">
          ✓ Bet Placed — Waiting for takeoff...
        </div>
      ) : isCrashed ? (
        <div className="w-full py-4 rounded-xl bg-muted text-muted-foreground font-bold text-sm text-center opacity-60">
          Next round starting...
        </div>
      ) : (
        <div className="w-full py-4 rounded-xl bg-muted text-muted-foreground font-bold text-sm text-center opacity-60">
          {cashedOut ? "✓ Cashed out — watching round" : "Place a bet next round"}
        </div>
      )}

      {/* ── Bottom row: auto-bet + P&L ── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Auto-bet toggle */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-card border border-border">
          <div>
            <p className="text-xs font-semibold">Auto Bet</p>
            <p className="text-[9px] text-muted-foreground">Repeat each round</p>
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
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-card border border-border">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Session P&L</p>
            <p className={cn("text-base font-extrabold tabular-nums",
              sessionPnl >= 0 ? "text-green-400" : "text-red-400")}>
              {sessionPnl >= 0 ? "+$" : "-$"}{Math.abs(sessionPnl).toFixed(2)}
            </p>
          </div>
          <button onClick={() => setSessionPnl(0)}
            className="text-muted-foreground hover:text-foreground p-1">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
