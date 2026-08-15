import { useState } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis, PieChart, Pie, Cell } from "recharts";
import { cn } from "@/lib/utils";

type Window = "1H" | "6H" | "12H" | "1D" | "7D" | "30D";
const WINDOWS: Window[] = ["1H", "6H", "12H", "1D", "7D", "30D"];

function buildChart(window: Window) {
  const pts: Record<Window, number> = { "1H": 12, "6H": 24, "12H": 24, "1D": 48, "7D": 56, "30D": 60 };
  const n = pts[window];
  let v = 200;
  return Array.from({ length: n }, (_, i) => {
    v = Math.max(0, v + (Math.random() - 0.42) * 40);
    return { i, v };
  });
}

function buildStats(window: Window) {
  const base: Record<Window, { profit: number; trades: number; winRate: number }> = {
    "1H":  { profit: 54.30,   trades: 8,   winRate: 87.5 },
    "6H":  { profit: 198.70,  trades: 31,  winRate: 83.9 },
    "12H": { profit: 321.50,  trades: 52,  winRate: 84.6 },
    "1D":  { profit: 542.30,  trades: 28,  winRate: 86.7 },
    "7D":  { profit: 1256.80, trades: 182, winRate: 85.2 },
    "30D": { profit: 4128.40, trades: 712, winRate: 84.0 },
  };
  const s = base[window];
  const losses = s.trades - Math.round(s.trades * s.winRate / 100);
  return { ...s, losses, lossRate: Math.round((losses / s.trades) * 100 * 10) / 10 };
}

export default function AnalyticsPage() {
  const [window, setWindow] = useState<Window>("1D");
  const chart = buildChart(window);
  const stats = buildStats(window);

  const pieData = [
    { name: "Wins", value: stats.trades - stats.losses, color: "#22c55e" },
    { name: "Losses", value: stats.losses, color: "#ef4444" },
    { name: "Breakeven", value: 0, color: "#6b7280" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-lg font-black text-foreground">Analytics</h1>
      </div>

      {/* Time window */}
      <div className="flex gap-1 px-4 mb-4">
        {WINDOWS.map(w => (
          <button
            key={w}
            data-testid={`window-${w}`}
            onClick={() => setWindow(w)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all",
              window === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {w}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3 pb-4">
        {/* Performance card */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-black text-foreground mb-3">Performance</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Total Profit</p>
              <p data-testid="analytics-profit" className="text-xl font-black text-primary">${stats.profit.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Win Rate</p>
              <p data-testid="analytics-winrate" className="text-xl font-black text-primary">{stats.winRate}%</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Total Trades</p>
              <p data-testid="analytics-trades" className="text-xl font-black text-foreground">{stats.trades}</p>
            </div>
            <div>
              <p className="text-[9px] text-muted-foreground uppercase font-semibold">Loss Rate</p>
              <p data-testid="analytics-lossrate" className="text-xl font-black text-destructive">{stats.lossRate}%</p>
            </div>
          </div>
        </div>

        {/* Profit chart */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-bold text-foreground mb-3">Profit Chart</p>
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, "auto"]} />
                <XAxis dataKey="i" hide />
                <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={1.5}
                  fill="url(#ag)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Trades overview */}
        <div className="rounded-2xl bg-card border border-border p-4">
          <p className="text-xs font-bold text-foreground mb-3">Trades Overview</p>
          <div className="flex items-center gap-4">
            {/* Donut */}
            <div className="relative shrink-0" style={{ width: 90, height: 90 }}>
              <ResponsiveContainer width={90} height={90}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx={40} cy={40} innerRadius={26} outerRadius={42}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-sm font-black text-foreground">{stats.trades}</p>
                <p className="text-[8px] text-muted-foreground">TOTAL</p>
              </div>
            </div>
            {/* Legend */}
            <div className="flex-1 space-y-2">
              {[
                { label: "Wins",      value: stats.trades - stats.losses, pct: stats.winRate,  color: "text-primary",     dot: "bg-primary" },
                { label: "Losses",    value: stats.losses,                pct: stats.lossRate,  color: "text-destructive", dot: "bg-destructive" },
                { label: "Breakeven", value: 0,                           pct: 0,               color: "text-muted-foreground", dot: "bg-muted-foreground" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", r.dot)} />
                    <span className="text-[10px] text-muted-foreground">{r.label}</span>
                  </div>
                  <span className={cn("text-[10px] font-bold", r.color)}>{r.value} ({r.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
