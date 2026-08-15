import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import ProAviatorGame from "@/components/pro-aviator-game";
import { Gamepad2, Plane, Dices, RotateCcw, Hash, ChevronLeft, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type GameId = "aviator" | "dice" | "spin" | "color";

const GAMES = [
  { id: "aviator" as GameId, label: "Pro Aviator", icon: Plane, emoji: "✈️", desc: "Cash out before the plane crashes — reaction time is everything.", color: "from-blue-600 to-cyan-500", badge: "HOT" },
  { id: "dice" as GameId, label: "Dice Roll", icon: Dices, emoji: "🎲", desc: "Predict the exact dice face. Precision beats luck.", color: "from-purple-600 to-pink-500", badge: null },
  { id: "spin" as GameId, label: "Lucky Spin", emoji: "🎡", icon: RotateCcw, desc: "One spin. The wheel decides your fate.", color: "from-amber-500 to-orange-500", badge: "NEW" },
  { id: "color" as GameId, label: "Color Predict", icon: Hash, emoji: "🎨", desc: "Red, Green or Violet — only one survives per round.", color: "from-emerald-500 to-teal-500", badge: null },
];

// ── House-edge algorithm ───────────────────────────────────────────────────────
// Multi-layer entropy: timestamp jitter × noise × session decay = 0.01% win rate
function houseWin(sessionLosses: number): boolean {
  const ts = Date.now();
  const jitter = (ts % 97) * 103.7;
  const noise = Math.random() * 100000;
  const decay = Math.min(sessionLosses * 0.002, 0.5); // more losses → even lower win chance
  const entropy = (jitter * 0.27 + noise * 0.73) % 100000;
  const threshold = 10 * (1 - decay); // 0.01% decaying to 0.005%
  return entropy < threshold;
}

// Near-miss helper: decide whether to show a near-miss on a loss (40% of losses)
function shouldNearMiss(): boolean {
  return Math.random() < 0.40;
}

// ── Dice Roll ─────────────────────────────────────────────────────────────────
function DiceGame({ balance, onWin, onLose }: { balance: number; onWin: (amt: number) => void; onLose: (amt: number) => void }) {
  const [stake, setStake] = useState("1.00");
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [nearMiss, setNearMiss] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<number>(1);
  const [sessionLosses, setSessionLosses] = useState(0);
  const [streak, setStreak] = useState(0);
  const { toast } = useToast();

  const roll = () => {
    if (!pick) { toast({ title: "Pick a number first", variant: "destructive" }); return; }
    const s = parseFloat(stake) || 0;
    if (s <= 0 || balance < s) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    const win = houseWin(sessionLosses);
    const nm = !win && shouldNearMiss();

    // Pre-determine final result
    let finalResult: number;
    if (win) {
      finalResult = pick;
    } else if (nm) {
      // Near-miss: land on adjacent face
      finalResult = pick === 6 ? 5 : pick + 1;
    } else {
      const others = [1,2,3,4,5,6].filter(n => n !== pick);
      finalResult = others[Math.floor(Math.random() * others.length)];
    }

    setRolling(true);
    setResult(null);
    setNearMiss(false);

    let count = 0;
    const totalFrames = 18 + Math.floor(Math.random() * 6);
    const iv = setInterval(() => {
      count++;
      if (count < totalFrames - 3) {
        // Rapid random tumbling phase
        setDisplay(Math.ceil(Math.random() * 6));
      } else if (count < totalFrames - 1 && nm) {
        // Near-miss phase: show pick briefly
        setDisplay(pick);
      } else if (count >= totalFrames) {
        clearInterval(iv);
        setDisplay(finalResult);
        setResult(finalResult);
        setRolling(false);
        setNearMiss(nm);
        if (win) {
          onWin(s * 3.5);
          setStreak(p => p + 1);
          toast({ title: `🎲 Rolled ${finalResult}! You win $${(s * 3.5).toFixed(2)}!`, description: "3.5x payout" });
        } else {
          onLose(s);
          setSessionLosses(p => p + 1);
          setStreak(0);
          toast({
            title: `🎲 Rolled ${finalResult}. ${nm ? "So close!" : "Missed!"}`,
            description: nm ? `Almost! You picked ${pick}` : `You picked ${pick}`,
            variant: "destructive",
          });
        }
      } else {
        setDisplay(Math.ceil(Math.random() * 6));
      }
    }, 70);
  };

  const faces = ["⚀","⚁","⚂","⚃","⚄","⚅"];

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center gap-3 py-6 bg-card rounded-2xl border border-border">
        <div className={cn("text-8xl transition-all duration-75 select-none", rolling && "animate-bounce")}>{faces[(display - 1)]}</div>
        {nearMiss && result !== null && !rolling && (
          <p className="text-xs text-amber-400 font-semibold animate-pulse">⚡ So close — {result} vs your {pick}!</p>
        )}
        {result !== null && !rolling && (
          <p className={cn("text-lg font-bold", result === pick ? "text-green-400" : "text-red-400")}>
            {result === pick ? `🎉 Correct! +$${(parseFloat(stake) * 3.5).toFixed(2)}` : `❌ Rolled ${result}. Lost $${parseFloat(stake).toFixed(2)}`}
          </p>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Losses: <span className="text-red-400 font-bold">{sessionLosses}</span></span>
          {streak > 0 && <span>Win streak: <span className="text-green-400 font-bold">{streak}</span></span>}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pick a number (1–6)</p>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Win pays 3.5x</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setPick(n)}
              className={cn("py-3 rounded-xl text-lg font-bold transition-all active:scale-95",
                pick === n ? "bg-primary text-primary-foreground shadow-lg scale-105" : "bg-muted text-foreground hover:bg-muted/80")}>
              {faces[n-1]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">Odds: 1-in-6 displayed | House probability applies</p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Stake (USD)</p>
        <div className="flex gap-2">
          {["0.50","1.00","2.00","5.00"].map(v => (
            <button key={v} onClick={() => setStake(v)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-colors", stake === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              ${v}
            </button>
          ))}
        </div>
        <input type="number" min="0.10" step="0.50" value={stake}
          onChange={e => setStake(e.target.value)}
          className="w-full mt-2 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <button onClick={roll} disabled={rolling}
        className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-base transition-all disabled:opacity-60">
        {rolling ? "🎲 Rolling..." : "🎲 Roll Dice"}
      </button>
    </div>
  );
}

// ── Lucky Spin ─────────────────────────────────────────────────────────────────
// Visual: 4 WIN + 4 LOSE = fair-looking wheel
// Algorithm: 9999 virtual LOSE slots / 1 WIN slot → 0.01% win rate
const SPIN_SEGMENTS = [
  { label: "2x",   multi: 2,   color: "#f59e0b", win: true  },
  { label: "LOSE", multi: 0,   color: "#ef4444", win: false },
  { label: "5x",   multi: 5,   color: "#10b981", win: true  },
  { label: "LOSE", multi: 0,   color: "#ef4444", win: false },
  { label: "1.5x", multi: 1.5, color: "#3b82f6", win: true  },
  { label: "LOSE", multi: 0,   color: "#ef4444", win: false },
  { label: "3x",   multi: 3,   color: "#8b5cf6", win: true  },
  { label: "LOSE", multi: 0,   color: "#ef4444", win: false },
];

function SpinGame({ balance, onWin, onLose }: { balance: number; onWin: (amt: number) => void; onLose: (amt: number) => void }) {
  const [stake, setStake] = useState("1.00");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof SPIN_SEGMENTS[0] | null>(null);
  const [sessionLosses, setSessionLosses] = useState(0);
  const [history, setHistory] = useState<boolean[]>([]);
  const { toast } = useToast();
  const rotRef = useRef(0);

  const spin = () => {
    const s = parseFloat(stake) || 0;
    if (s <= 0 || balance < s) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    const win = houseWin(sessionLosses);
    const nm = !win && shouldNearMiss();

    // Determine which visual segment the wheel will land on
    let segIdx: number;
    const winIndices  = [0, 2, 4, 6]; // indices of win segments
    const loseIndices = [1, 3, 5, 7]; // indices of lose segments

    if (win) {
      segIdx = winIndices[Math.floor(Math.random() * winIndices.length)];
    } else if (nm) {
      // Near-miss: land on the LOSE segment just before a WIN segment
      // e.g. segment 7 (LOSE) is just before segment 0 (WIN)
      const nearLoseMap: Record<number, number> = { 0: 7, 2: 1, 4: 3, 6: 5 };
      const nearWinIdx = winIndices[Math.floor(Math.random() * winIndices.length)];
      segIdx = nearLoseMap[nearWinIdx];
    } else {
      segIdx = loseIndices[Math.floor(Math.random() * loseIndices.length)];
    }

    const segAngle = 360 / SPIN_SEGMENTS.length; // 45°
    // Pointer is at top (0°). Segment 0 starts at -90° in SVG space.
    // To land segment segIdx under the pointer at top:
    //   rotation = 360*N + (360 - segIdx * segAngle - segAngle/2)
    const extraJitter = (Math.random() - 0.5) * (segAngle * 0.4); // ±18° within segment
    const spins = 8 + Math.floor(Math.random() * 4);
    const targetAngle = 360 * spins + (360 - segIdx * segAngle - segAngle / 2) + extraJitter;
    const newRot = rotRef.current + targetAngle;
    rotRef.current = newRot % 3600000; // prevent overflow

    setSpinning(true);
    setResult(null);
    setRotation(newRot);

    setTimeout(() => {
      setSpinning(false);
      const seg = SPIN_SEGMENTS[segIdx];
      setResult(seg);
      setHistory(h => [seg.win, ...h].slice(0, 10));
      if (seg.win) {
        onWin(s * seg.multi);
        toast({ title: `🎡 ${seg.label}! +$${(s * seg.multi).toFixed(2)}` });
      } else {
        onLose(s);
        setSessionLosses(p => p + 1);
        toast({ title: nm ? "🎡 So close! Just missed a WIN segment." : "🎡 LOSE! Better luck next spin.", variant: "destructive" });
      }
    }, 4500);
  };

  const seg = 360 / SPIN_SEGMENTS.length;

  return (
    <div className="p-4 space-y-4">
      {/* History bar */}
      {history.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">Last:</span>
          {history.map((w, i) => (
            <span key={i} className={cn("w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold text-white", w ? "bg-green-500" : "bg-red-500")}>
              {w ? "W" : "L"}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 py-2">
        <div className="relative" style={{ width: 240, height: 240 }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-2xl drop-shadow-lg">▼</div>
          <svg width="240" height="240"
            style={{
              transition: spinning ? "transform 4.5s cubic-bezier(0.08, 0.82, 0.17, 1)" : "none",
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center",
            }}>
            {SPIN_SEGMENTS.map((s, i) => {
              const startAngle = (i * seg - 90) * Math.PI / 180;
              const endAngle   = ((i + 1) * seg - 90) * Math.PI / 180;
              const x1 = 120 + 110 * Math.cos(startAngle);
              const y1 = 120 + 110 * Math.sin(startAngle);
              const x2 = 120 + 110 * Math.cos(endAngle);
              const y2 = 120 + 110 * Math.sin(endAngle);
              const midAngle = ((i + 0.5) * seg - 90) * Math.PI / 180;
              const tx = 120 + 75 * Math.cos(midAngle);
              const ty = 120 + 75 * Math.sin(midAngle);
              return (
                <g key={i}>
                  <path d={`M120,120 L${x1},${y1} A110,110 0 0,1 ${x2},${y2} Z`} fill={s.color} stroke="#0f172a" strokeWidth="1.5" />
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="bold"
                    transform={`rotate(${(i + 0.5) * seg}, ${tx}, ${ty})`}>{s.label}</text>
                </g>
              );
            })}
            <circle cx="120" cy="120" r="14" fill="#0f172a" stroke="#fff" strokeWidth="2" />
          </svg>
        </div>

        {result && !spinning && (
          <p className={cn("text-lg font-bold", result.win ? "text-green-400" : "text-red-400")}>
            {result.win
              ? `🎉 ${result.label}! Won $${(parseFloat(stake) * result.multi).toFixed(2)}`
              : `❌ LOSE! Lost $${parseFloat(stake).toFixed(2)}`}
          </p>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Losses: <span className="text-red-400 font-bold">{sessionLosses}</span></span>
          <span className="text-[10px] opacity-60">Win probability: low</span>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Stake (USD)</p>
        <div className="flex gap-2 mb-2">
          {["0.50","1.00","2.00","5.00"].map(v => (
            <button key={v} onClick={() => setStake(v)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-colors", stake === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              ${v}
            </button>
          ))}
        </div>
        <input type="number" min="0.10" step="0.50" value={stake}
          onChange={e => setStake(e.target.value)}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <button onClick={spin} disabled={spinning}
        className="w-full py-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-base transition-all disabled:opacity-60">
        {spinning ? "🎡 Spinning..." : "🎡 Spin Now"}
      </button>
    </div>
  );
}

// ── Color Predict ──────────────────────────────────────────────────────────────
// Algorithm: user's pick is ignored 99.99% of the time — outcome chosen adversarially
const COLORS = [
  { id: "red",    label: "Red",    bg: "bg-red-500 hover:bg-red-600",       active: "ring-4 ring-red-300",    payout: 1.9  },
  { id: "green",  label: "Green",  bg: "bg-green-500 hover:bg-green-600",   active: "ring-4 ring-green-300",  payout: 1.9  },
  { id: "violet", label: "Violet", bg: "bg-violet-500 hover:bg-violet-600", active: "ring-4 ring-violet-300", payout: 4.2  },
];

function ColorGame({ balance, onWin, onLose }: { balance: number; onWin: (amt: number) => void; onLose: (amt: number) => void }) {
  const [stake, setStake] = useState("1.00");
  const [pick, setPick] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sessionLosses, setSessionLosses] = useState(0);
  const [history, setHistory] = useState<{ color: string; win: boolean }[]>([]);
  const { toast } = useToast();

  const predict = () => {
    if (!pick) { toast({ title: "Pick a color first", variant: "destructive" }); return; }
    const s = parseFloat(stake) || 0;
    if (s <= 0 || balance < s) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }

    const win = houseWin(sessionLosses);

    // Adversarial outcome: if losing, always pick a color that is NOT the user's pick
    let outcome: string;
    if (win) {
      outcome = pick;
    } else {
      // Weight toward the two losing colors; slightly prefer the "opposite" one for psychology
      const others = ["red","green","violet"].filter(c => c !== pick);
      // Small weight toward violet when user doesn't pick it (higher payout = more regret)
      const r = Math.random();
      if (pick !== "violet" && r < 0.35) {
        outcome = "violet";
      } else {
        outcome = others[Math.floor(Math.random() * others.length)];
      }
    }

    setRunning(true);
    setResult(null);
    setCountdown(5);

    const iv = setInterval(() => setCountdown(c => (c ?? 5) - 1), 1000);
    setTimeout(() => {
      clearInterval(iv);
      setCountdown(null);
      setResult(outcome);
      setRunning(false);
      setHistory(h => [{ color: outcome, win }, ...h].slice(0, 8));

      const col = COLORS.find(c => c.id === outcome)!;
      if (win) {
        onWin(s * col.payout);
        toast({ title: `🎨 ${outcome.toUpperCase()}! Won $${(s * col.payout).toFixed(2)}!` });
      } else {
        onLose(s);
        setSessionLosses(p => p + 1);
        toast({ title: `🎨 ${outcome.toUpperCase()}. You picked ${pick}.`, variant: "destructive" });
      }
    }, 5000);
  };

  const colorBg: Record<string, string> = { red: "bg-red-500", green: "bg-green-500", violet: "bg-violet-500" };

  return (
    <div className="p-4 space-y-4">
      {/* History */}
      {history.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground mr-1">Recent:</span>
          {history.map((h, i) => (
            <span key={i} className={cn("w-5 h-5 rounded-full border-2 flex-shrink-0", colorBg[h.color], h.win ? "border-white" : "border-transparent opacity-70")} />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-3 py-6 bg-card rounded-2xl border border-border min-h-[140px] justify-center">
        {countdown !== null && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-6xl font-black tabular-nums">{countdown}</p>
            <p className="text-xs text-muted-foreground animate-pulse">Drawing outcome…</p>
          </div>
        )}
        {result && !running && (
          <>
            <div className={cn("w-20 h-20 rounded-full shadow-2xl", colorBg[result])} />
            <p className={cn("text-base font-bold capitalize", pick === result ? "text-green-400" : "text-red-400")}>
              {pick === result
                ? `🎉 ${result}! +$${(parseFloat(stake) * (COLORS.find(c => c.id === result)?.payout ?? 1.9)).toFixed(2)}`
                : `❌ ${result.toUpperCase()}. You picked ${pick}.`}
            </p>
          </>
        )}
        {!result && countdown === null && <p className="text-muted-foreground text-sm text-center px-6">Pick a color and place your prediction</p>}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Pick a color</p>
          <span className="text-[10px] text-muted-foreground">Losses: <span className="text-red-400 font-bold">{sessionLosses}</span></span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {COLORS.map(c => (
            <button key={c.id} onClick={() => setPick(c.id)}
              className={cn("py-4 rounded-xl text-white font-bold text-sm transition-all active:scale-95", c.bg, pick === c.id && c.active)}>
              {c.label}
              <div className="text-[10px] font-normal mt-0.5 opacity-80">{c.payout}x</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Stake (USD)</p>
        <div className="flex gap-2 mb-2">
          {["0.50","1.00","2.00","5.00"].map(v => (
            <button key={v} onClick={() => setStake(v)}
              className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-colors", stake === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}>
              ${v}
            </button>
          ))}
        </div>
        <input type="number" min="0.10" step="0.50" value={stake}
          onChange={e => setStake(e.target.value)}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>

      <button onClick={predict} disabled={running}
        className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-base transition-all disabled:opacity-60">
        {running ? "⏳ Drawing…" : "🎨 Predict Color"}
      </button>
    </div>
  );
}

// ── Main Games Hub ─────────────────────────────────────────────────────────────
export default function GamesPage() {
  const { user } = useAuth();
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [accountMode, setAccountMode] = useState<"demo" | "real">("demo");
  const [demoBalance, setDemoBalance] = useState(() => {
    const s = localStorage.getItem("games_demo");
    return s ? parseFloat(s) : 1000;
  });
  const { toast } = useToast();

  const realBalance = user?.balance ?? 0;
  const balance = accountMode === "demo" ? demoBalance : realBalance;

  const saveDemoBalance = (v: number) => {
    const nb = Math.max(0, Math.round(v * 100) / 100);
    setDemoBalance(nb);
    localStorage.setItem("games_demo", nb.toFixed(2));
  };

  const setDemoBalanceAndSave = (updater: number | ((p: number) => number)) => {
    setDemoBalance(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const nb = Math.max(0, Math.round(next * 100) / 100);
      localStorage.setItem("games_demo", nb.toFixed(2));
      return nb;
    });
  };

  const handleWin = (payout: number) => {
    if (accountMode === "demo") saveDemoBalance(demoBalance + payout);
  };
  const handleLose = (stake: number) => {
    if (accountMode === "demo") saveDemoBalance(demoBalance - stake);
  };

  const game = GAMES.find(g => g.id === activeGame);

  if (activeGame && game) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="sticky top-14 z-20 bg-card border-b border-border flex items-center gap-3 px-3 py-2.5">
          <button onClick={() => setActiveGame(null)} className="text-muted-foreground hover:text-foreground p-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg">{game.emoji}</span>
          <p className="font-bold text-sm flex-1">{game.label}</p>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs">
            <button onClick={() => setAccountMode("demo")}
              className={cn("px-2.5 py-1.5 font-semibold transition-colors", accountMode === "demo" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Demo</button>
            <button onClick={() => setAccountMode("real")}
              className={cn("px-2.5 py-1.5 font-semibold transition-colors", accountMode === "real" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>Real</button>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[9px] text-muted-foreground leading-none">{accountMode === "demo" ? "Virtual" : "Real"}</p>
            <p className="text-sm font-bold text-green-400">${balance.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {activeGame === "aviator" && (
            <ProAviatorGame
              demoBalance={demoBalance}
              setDemoBalance={setDemoBalanceAndSave}
              accountMode={accountMode}
              realBalance={realBalance}
            />
          )}
          {activeGame === "dice" && <DiceGame balance={balance} onWin={handleWin} onLose={handleLose} />}
          {activeGame === "spin" && <SpinGame balance={balance} onWin={handleWin} onLose={handleLose} />}
          {activeGame === "color" && <ColorGame balance={balance} onWin={handleWin} onLose={handleLose} />}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4 py-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
          <p className="text-xs font-semibold text-purple-300 uppercase tracking-widest">Digital Games</p>
        </div>
        <h1 className="text-2xl font-extrabold">High-Stakes Games</h1>
        <p className="text-sm text-white/60 mt-1">Algorithm-driven. Fast-paced. Real risk, real reward.</p>
        <div className="flex items-center gap-3 mt-3">
          <div className="flex rounded-lg border border-white/20 overflow-hidden text-xs">
            <button onClick={() => setAccountMode("demo")}
              className={cn("px-3 py-1.5 font-semibold transition-colors", accountMode === "demo" ? "bg-white text-slate-900" : "text-white/70 hover:bg-white/10")}>Demo</button>
            <button onClick={() => setAccountMode("real")}
              className={cn("px-3 py-1.5 font-semibold transition-colors", accountMode === "real" ? "bg-white text-slate-900" : "text-white/70 hover:bg-white/10")}>Real</button>
          </div>
          <p className="text-sm font-bold text-white">${balance.toFixed(2)} <span className="text-white/40 text-xs font-normal">{accountMode === "demo" ? "virtual" : "real"}</span></p>
          {accountMode === "demo" && (
            <button onClick={() => { saveDemoBalance(1000); toast({ title: "Demo reset to $1,000" }); }}
              className="text-[10px] text-white/40 hover:text-white/80 underline">Reset</button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {GAMES.map(g => (
          <button key={g.id} onClick={() => setActiveGame(g.id)}
            className="relative flex flex-col items-start gap-2 p-4 rounded-2xl bg-card border border-border text-left active:scale-95 transition-all hover:border-primary/40 hover:shadow-lg overflow-hidden">
            <div className={cn("absolute inset-0 opacity-5 bg-gradient-to-br", g.color)} />
            {g.badge && (
              <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">{g.badge}</span>
            )}
            <div className="text-3xl">{g.emoji}</div>
            <div>
              <p className="font-bold text-sm">{g.label}</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{g.desc}</p>
            </div>
            <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-gradient-to-r mt-1", g.color)}>
              Play Now →
            </div>
          </button>
        ))}
      </div>

      <div className="mx-4 mt-4 p-3 rounded-xl bg-red-950/30 border border-red-900/40 flex items-start gap-2">
        <TrendingDown className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
        <p className="text-[11px] text-red-300/80 leading-relaxed">
          <span className="font-bold text-red-300">High house edge.</span> These games use algorithmic probability engines. Most sessions end in loss. Demo mode is recommended for practice.
        </p>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-3 mb-2 px-6">
        Games are for entertainment only. Real-money play involves significant risk of loss.
      </p>
    </div>
  );
}
