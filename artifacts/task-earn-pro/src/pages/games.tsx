import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import ProAviatorGame from "@/components/pro-aviator-game";
import { Gamepad2, Plane, Dices, RotateCcw, Hash, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type GameId = "aviator" | "dice" | "spin" | "color";

const GAMES = [
  { id: "aviator" as GameId, label: "Pro Aviator", icon: Plane, emoji: "✈️", desc: "Cash out before the plane flies away!", color: "from-blue-600 to-cyan-500", badge: "HOT" },
  { id: "dice" as GameId, label: "Dice Roll", icon: Dices, emoji: "🎲", desc: "Predict the outcome of the dice roll.", color: "from-purple-600 to-pink-500", badge: null },
  { id: "spin" as GameId, label: "Lucky Spin", icon: RotateCcw, emoji: "🎡", desc: "Spin and win multipliers up to 10x.", color: "from-amber-500 to-orange-500", badge: "NEW" },
  { id: "color" as GameId, label: "Color Predict", icon: Hash, emoji: "🎨", desc: "Predict Red, Green or Violet to win.", color: "from-emerald-500 to-teal-500", badge: null },
];

// ── Dice Roll ─────────────────────────────────────────────────────────────────
function DiceGame({ balance, onWin, onLose }: { balance: number; onWin: (amt: number) => void; onLose: (amt: number) => void }) {
  const [stake, setStake] = useState("1.00");
  const [pick, setPick] = useState<number | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState<number>(1);
  const { toast } = useToast();

  const roll = () => {
    if (!pick) { toast({ title: "Pick a number first", variant: "destructive" }); return; }
    const s = parseFloat(stake) || 0;
    if (s <= 0 || balance < s) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setRolling(true);
    setResult(null);
    let count = 0;
    const iv = setInterval(() => {
      setDisplay(Math.ceil(Math.random() * 6));
      count++;
      if (count >= 12) {
        clearInterval(iv);
        const r = Math.ceil(Math.random() * 6);
        setDisplay(r);
        setResult(r);
        setRolling(false);
        if (r === pick) { onWin(s * 5); toast({ title: `🎲 Rolled ${r}! You win $${(s * 5).toFixed(2)}!`, description: "5x payout" }); }
        else { onLose(s); toast({ title: `🎲 Rolled ${r}. Missed!`, description: `You picked ${pick}`, variant: "destructive" }); }
      }
    }, 80);
  };

  const faces = ["⚀","⚁","⚂","⚃","⚄","⚅"];

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center gap-3 py-6 bg-card rounded-2xl border border-border">
        <div className={cn("text-8xl transition-all duration-75 select-none", rolling && "animate-bounce")}>{faces[(display - 1)]}</div>
        {result !== null && !rolling && (
          <p className={cn("text-lg font-bold", result === pick ? "text-green-400" : "text-red-400")}>
            {result === pick ? `🎉 Correct! +$${(parseFloat(stake) * 5).toFixed(2)}` : `❌ Wrong! Lost $${parseFloat(stake).toFixed(2)}`}
          </p>
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Pick a number (1–6)</p>
        <div className="grid grid-cols-6 gap-2">
          {[1,2,3,4,5,6].map(n => (
            <button key={n} onClick={() => setPick(n)}
              className={cn("py-3 rounded-xl text-lg font-bold transition-all active:scale-95",
                pick === n ? "bg-primary text-primary-foreground shadow-lg scale-105" : "bg-muted text-foreground hover:bg-muted/80")}>
              {faces[n-1]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-center">Win 5x if the dice shows your number</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Stake (USD)</p>
        <input type="number" min="0.10" step="0.50" value={stake}
          onChange={e => setStake(e.target.value)}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <button onClick={roll} disabled={rolling}
        className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-base transition-all disabled:opacity-60">
        {rolling ? "🎲 Rolling..." : "🎲 Roll Dice"}
      </button>
    </div>
  );
}

// ── Lucky Spin ────────────────────────────────────────────────────────────────
const SPIN_SEGMENTS = [
  { label: "2x", multi: 2, color: "#f59e0b" }, { label: "LOSE", multi: 0, color: "#ef4444" },
  { label: "5x", multi: 5, color: "#10b981" }, { label: "LOSE", multi: 0, color: "#ef4444" },
  { label: "1.5x", multi: 1.5, color: "#3b82f6" }, { label: "LOSE", multi: 0, color: "#ef4444" },
  { label: "10x", multi: 10, color: "#8b5cf6" }, { label: "LOSE", multi: 0, color: "#ef4444" },
];

function SpinGame({ balance, onWin, onLose }: { balance: number; onWin: (amt: number) => void; onLose: (amt: number) => void }) {
  const [stake, setStake] = useState("1.00");
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<typeof SPIN_SEGMENTS[0] | null>(null);
  const { toast } = useToast();
  const rotRef = useRef(0);

  const spin = () => {
    const s = parseFloat(stake) || 0;
    if (s <= 0 || balance < s) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setSpinning(true);
    setResult(null);
    const segIdx = Math.floor(Math.random() * SPIN_SEGMENTS.length);
    const segAngle = 360 / SPIN_SEGMENTS.length;
    const targetAngle = 360 * 8 + (360 - segIdx * segAngle - segAngle / 2);
    const newRot = rotRef.current + targetAngle;
    rotRef.current = newRot;
    setRotation(newRot);
    setTimeout(() => {
      setSpinning(false);
      const seg = SPIN_SEGMENTS[segIdx];
      setResult(seg);
      if (seg.multi > 0) { onWin(s * seg.multi); toast({ title: `🎡 ${seg.label}! +$${(s * seg.multi).toFixed(2)}` }); }
      else { onLose(s); toast({ title: "🎡 LOSE! Better luck next spin.", variant: "destructive" }); }
    }, 4200);
  };

  const seg = 360 / SPIN_SEGMENTS.length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative" style={{ width: 240, height: 240 }}>
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10 text-2xl">▼</div>
          <svg width="240" height="240" style={{ transition: spinning ? "transform 4s cubic-bezier(0.17,0.67,0.12,0.99)" : "none", transform: `rotate(${rotation}deg)`, transformOrigin: "center" }}>
            {SPIN_SEGMENTS.map((s, i) => {
              const startAngle = (i * seg - 90) * Math.PI / 180;
              const endAngle = ((i + 1) * seg - 90) * Math.PI / 180;
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
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="bold" transform={`rotate(${(i + 0.5) * seg}, ${tx}, ${ty})`}>{s.label}</text>
                </g>
              );
            })}
            <circle cx="120" cy="120" r="14" fill="#0f172a" stroke="#fff" strokeWidth="2" />
          </svg>
        </div>
        {result && !spinning && (
          <p className={cn("text-lg font-bold", result.multi > 0 ? "text-green-400" : "text-red-400")}>
            {result.multi > 0 ? `🎉 ${result.label}! Won $${(parseFloat(stake) * result.multi).toFixed(2)}` : `❌ LOSE! Lost $${parseFloat(stake).toFixed(2)}`}
          </p>
        )}
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Stake (USD)</p>
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

// ── Color Predict ─────────────────────────────────────────────────────────────
const COLORS = [
  { id: "red", label: "Red", bg: "bg-red-500 hover:bg-red-600", active: "ring-4 ring-red-300", payout: 2 },
  { id: "green", label: "Green", bg: "bg-green-500 hover:bg-green-600", active: "ring-4 ring-green-300", payout: 2 },
  { id: "violet", label: "Violet", bg: "bg-violet-500 hover:bg-violet-600", active: "ring-4 ring-violet-300", payout: 4.5 },
];
const OUTCOME_POOL = ["red","red","red","green","green","green","violet","red","green","red","green","red"];

function ColorGame({ balance, onWin, onLose }: { balance: number; onWin: (amt: number) => void; onLose: (amt: number) => void }) {
  const [stake, setStake] = useState("1.00");
  const [pick, setPick] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { toast } = useToast();

  const predict = () => {
    if (!pick) { toast({ title: "Pick a color first", variant: "destructive" }); return; }
    const s = parseFloat(stake) || 0;
    if (s <= 0 || balance < s) { toast({ title: "Insufficient balance", variant: "destructive" }); return; }
    setRunning(true); setResult(null); setCountdown(3);
    const iv = setInterval(() => setCountdown(c => (c ?? 3) - 1), 1000);
    setTimeout(() => {
      clearInterval(iv);
      setCountdown(null);
      const r = OUTCOME_POOL[Math.floor(Math.random() * OUTCOME_POOL.length)];
      setResult(r);
      setRunning(false);
      const col = COLORS.find(c => c.id === r)!;
      if (r === pick) { onWin(s * col.payout); toast({ title: `🎨 ${r.toUpperCase()}! Won $${(s * col.payout).toFixed(2)}!` }); }
      else { onLose(s); toast({ title: `🎨 ${r.toUpperCase()}. Picked ${pick}.`, variant: "destructive" }); }
    }, 3000);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col items-center gap-3 py-6 bg-card rounded-2xl border border-border min-h-[120px] justify-center">
        {countdown !== null && <p className="text-5xl font-black">{countdown}</p>}
        {result && !running && (
          <>
            <div className={cn("w-20 h-20 rounded-full shadow-2xl", result === "red" ? "bg-red-500" : result === "green" ? "bg-green-500" : "bg-violet-500")} />
            <p className={cn("text-base font-bold capitalize", pick === result ? "text-green-400" : "text-red-400")}>
              {pick === result ? `🎉 ${result}! +$${(parseFloat(stake) * (COLORS.find(c => c.id === result)?.payout ?? 2)).toFixed(2)}` : `❌ ${result}. You picked ${pick}.`}
            </p>
          </>
        )}
        {!result && countdown === null && <p className="text-muted-foreground text-sm">Pick a color and predict!</p>}
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Pick a color</p>
        <div className="grid grid-cols-3 gap-3">
          {COLORS.map(c => (
            <button key={c.id} onClick={() => setPick(c.id)}
              className={cn("py-4 rounded-xl text-white font-bold text-sm transition-all active:scale-95", c.bg, pick === c.id && c.active)}>
              {c.label}
              <div className="text-[10px] font-normal mt-0.5 opacity-80">{c.payout}x payout</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1.5 font-medium">Stake (USD)</p>
        <input type="number" min="0.10" step="0.50" value={stake}
          onChange={e => setStake(e.target.value)}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <button onClick={predict} disabled={running}
        className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-base transition-all disabled:opacity-60">
        {running ? "⏳ Drawing..." : "🎨 Predict Color"}
      </button>
    </div>
  );
}

// ── Main Games Hub ────────────────────────────────────────────────────────────
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
        {/* Game header */}
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

        {/* Game content */}
        <div className="flex-1 overflow-y-auto pb-24">
          {activeGame === "aviator" && (
            <ProAviatorGame
              demoBalance={demoBalance}
              setDemoBalance={setDemoBalanceAndSave}
              accountMode={accountMode}
              realBalance={realBalance}
            />
          )}
          {activeGame === "dice" && (
            <DiceGame balance={balance} onWin={handleWin} onLose={handleLose} />
          )}
          {activeGame === "spin" && (
            <SpinGame balance={balance} onWin={handleWin} onLose={handleLose} />
          )}
          {activeGame === "color" && (
            <ColorGame balance={balance} onWin={handleWin} onLose={handleLose} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 px-4 py-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
          <p className="text-xs font-semibold text-purple-300 uppercase tracking-widest">Digital Games</p>
        </div>
        <h1 className="text-2xl font-extrabold">Play &amp; Win Real Cash</h1>
        <p className="text-sm text-white/60 mt-1">Challenge yourself with skill-based games. Demo or real money.</p>
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

      {/* Games grid */}
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

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center mt-6 px-6">
        Games are for entertainment. Real-money play involves risk. Play responsibly.
      </p>
    </div>
  );
}
