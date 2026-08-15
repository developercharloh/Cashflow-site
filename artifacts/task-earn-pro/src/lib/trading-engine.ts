// ─── Trading Engine: synthetic market data, tick simulation, signal generation ───

export interface MarketDef {
  id: string;
  symbol: string;
  name: string;
  category: "digits" | "updown" | "highslows";
  contractTypes: ContractType[];
  vol: number;
  base: number;
  icon: string;
  iconBg: string;
  pips: number; // decimal places for price display
}

export type ContractType =
  | "even-odd"
  | "over-under"
  | "matches-differs"
  | "rise-fall"
  | "higher-lower"
  | "touch-notouch";

export interface TickStats {
  lastPrice: number;
  lastDigit: number;
  digits: number[]; // last 1000 last-digits
  digitFreq: number[]; // [0..9] count
  digitPct: number[]; // [0..9] percentage
  evenCount: number;
  oddCount: number;
  evenPct: number;
  oddPct: number;
  mostFrequent: { digit: number; pct: number };
  leastFrequent: { digit: number; pct: number };
  ticks: { price: number; idx: number }[];
}

export interface Signal {
  id: string;
  symbol: string;
  market: string;
  contractType: ContractType;
  direction: string;
  confidence: number;
  status: "active" | "won" | "lost" | "pending";
  timestamp: Date;
  payout?: number;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  market: string;
  contractType: ContractType;
  direction: string;
  stake: number;
  payout: number;
  profit: number;
  outcome: "won" | "lost";
  timestamp: Date;
}

// ─── Deriv Synthetic Index catalogue ──────────────────────────────────────────

export const MARKETS: MarketDef[] = [
  // Digits
  { id: "1HZ10V",  symbol: "1HZ10V",  name: "Volatility 10 (1s) Index",  category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0004, base: 5000, icon: "EO", iconBg: "bg-purple-600",  pips: 2 },
  { id: "R_10",    symbol: "R_10",    name: "Volatility 10 Index",        category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0005, base: 5200, icon: "EO", iconBg: "bg-purple-500",  pips: 2 },
  { id: "1HZ25V",  symbol: "1HZ25V",  name: "Volatility 25 (1s) Index",  category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0012, base: 3200, icon: "OU", iconBg: "bg-orange-500",  pips: 2 },
  { id: "R_25",    symbol: "R_25",    name: "Volatility 25 Index",        category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0013, base: 3400, icon: "OU", iconBg: "bg-orange-400",  pips: 2 },
  { id: "1HZ50V",  symbol: "1HZ50V",  name: "Volatility 50 (1s) Index",  category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0025, base: 2100, icon: "MD", iconBg: "bg-yellow-500",  pips: 2 },
  { id: "R_50",    symbol: "R_50",    name: "Volatility 50 Index",        category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0027, base: 2300, icon: "MD", iconBg: "bg-yellow-400",  pips: 2 },
  { id: "1HZ75V",  symbol: "1HZ75V",  name: "Volatility 75 (1s) Index",  category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0040, base: 1400, icon: "MD", iconBg: "bg-red-500",     pips: 2 },
  { id: "R_75",    symbol: "R_75",    name: "Volatility 75 Index",        category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0045, base: 1600, icon: "MD", iconBg: "bg-red-400",     pips: 2 },
  { id: "1HZ100V", symbol: "1HZ100V", name: "Volatility 100 (1s) Index", category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.0065, base: 850,  icon: "MD", iconBg: "bg-pink-600",    pips: 2 },
  { id: "R_100",   symbol: "R_100",   name: "Volatility 100 Index",       category: "digits",    contractTypes: ["even-odd","over-under","matches-differs"], vol: 0.007,  base: 950,  icon: "MD", iconBg: "bg-pink-500",    pips: 2 },
  // Up & Down
  { id: "R_10_RF", symbol: "R_10",    name: "Volatility 10 Index",        category: "updown",    contractTypes: ["rise-fall","higher-lower"], vol: 0.0005, base: 5200, icon: "RF", iconBg: "bg-green-600",  pips: 2 },
  { id: "R_25_RF", symbol: "R_25",    name: "Volatility 25 Index",        category: "updown",    contractTypes: ["rise-fall","higher-lower"], vol: 0.0013, base: 3400, icon: "HL", iconBg: "bg-blue-500",   pips: 2 },
  { id: "R_50_RF", symbol: "R_50",    name: "Volatility 50 Index",        category: "updown",    contractTypes: ["rise-fall","higher-lower"], vol: 0.0027, base: 2300, icon: "RF", iconBg: "bg-teal-500",   pips: 2 },
  { id: "JD10",    symbol: "JD10",    name: "Jump 10 Index",              category: "updown",    contractTypes: ["rise-fall"], vol: 0.003, base: 900,  icon: "RF", iconBg: "bg-indigo-500", pips: 2 },
  { id: "JD25",    symbol: "JD25",    name: "Jump 25 Index",              category: "updown",    contractTypes: ["rise-fall"], vol: 0.005, base: 700,  icon: "RF", iconBg: "bg-indigo-600", pips: 2 },
  { id: "JD50",    symbol: "JD50",    name: "Jump 50 Index",              category: "updown",    contractTypes: ["rise-fall"], vol: 0.008, base: 500,  icon: "RF", iconBg: "bg-violet-500", pips: 2 },
  // Highs & Lows
  { id: "R_10_HL", symbol: "R_10",    name: "Volatility 10 Index",        category: "highslows", contractTypes: ["touch-notouch"], vol: 0.0005, base: 5200, icon: "TN", iconBg: "bg-rose-500",   pips: 2 },
  { id: "R_25_HL", symbol: "R_25",    name: "Volatility 25 Index",        category: "highslows", contractTypes: ["touch-notouch"], vol: 0.0013, base: 3400, icon: "TN", iconBg: "bg-rose-600",   pips: 2 },
  { id: "R_50_HL", symbol: "R_50",    name: "Volatility 50 Index",        category: "highslows", contractTypes: ["touch-notouch"], vol: 0.0027, base: 2300, icon: "TN", iconBg: "bg-fuchsia-600", pips: 2 },
  { id: "stpidx",  symbol: "stpidx",  name: "Step Index",                 category: "highslows", contractTypes: ["touch-notouch","rise-fall"], vol: 0.0010, base: 8000, icon: "TN", iconBg: "bg-cyan-600",   pips: 2 },
  { id: "BOOM300", symbol: "BOOM300", name: "Boom 300 Index",             category: "highslows", contractTypes: ["touch-notouch","rise-fall"], vol: 0.0020, base: 2900, icon: "TN", iconBg: "bg-amber-600",  pips: 2 },
  { id: "BOOM500", symbol: "BOOM500", name: "Boom 500 Index",             category: "highslows", contractTypes: ["touch-notouch","rise-fall"], vol: 0.0015, base: 4000, icon: "TN", iconBg: "bg-amber-500",  pips: 2 },
  { id: "CRASH300",symbol: "CRASH300",name: "Crash 300 Index",            category: "highslows", contractTypes: ["touch-notouch","rise-fall"], vol: 0.0020, base: 2900, icon: "TN", iconBg: "bg-red-700",    pips: 2 },
  { id: "CRASH500",symbol: "CRASH500",name: "Crash 500 Index",            category: "highslows", contractTypes: ["touch-notouch","rise-fall"], vol: 0.0015, base: 4000, icon: "TN", iconBg: "bg-red-600",    pips: 2 },
];

// ─── Payout tables matching Deriv ─────────────────────────────────────────────

export const PAYOUTS: Record<string, number> = {
  even: 1.90, odd: 1.90,
  rise: 1.85, fall: 1.85,
  higher: 1.85, lower: 1.85,
  matches: 9.00, differs: 1.10,
  touch: 1.75, notouch: 1.90,
};

// Over/Under payouts: digits that can win = (9 - barrier) for over, barrier for under
export function getOverUnderPayout(dir: "over" | "under", barrier: number): number {
  const winDigits = dir === "over" ? 9 - barrier : barrier;
  if (winDigits <= 0) return 9.50;
  return Math.round((0.95 / (winDigits / 10)) * 100) / 100;
}

// ─── Tick helpers ─────────────────────────────────────────────────────────────

export function lastDigit(price: number): number {
  return Math.floor(Math.round(price * 100)) % 10;
}

export function nextPrice(p: number, vol: number): number {
  return Math.max(0.01, p * (1 + (Math.random() - 0.5) * 2 * vol));
}

export function buildTicks(base: number, vol: number, n = 60): { price: number; idx: number }[] {
  let p = base;
  return Array.from({ length: n }, (_, i) => { p = nextPrice(p, vol); return { price: p, idx: i }; });
}

// ─── 1000-tick stats ──────────────────────────────────────────────────────────

export function computeTickStats(ticks: { price: number; idx: number }[], lastPrice: number): TickStats {
  // last 1000 digit samples
  const allTicks = ticks.length > 1000 ? ticks.slice(-1000) : ticks;
  const digits = allTicks.map(t => lastDigit(t.price));
  const digitFreq = Array(10).fill(0) as number[];
  for (const d of digits) digitFreq[d]++;
  const n = digits.length || 1;
  const digitPct = digitFreq.map(c => Math.round((c / n) * 1000) / 10);
  const even = digits.filter(d => d % 2 === 0).length;
  const odd  = n - even;
  const ld = lastDigit(lastPrice);
  const maxIdx = digitFreq.indexOf(Math.max(...digitFreq));
  const minIdx = digitFreq.indexOf(Math.min(...digitFreq));
  return {
    lastPrice, lastDigit: ld, digits, digitFreq, digitPct,
    evenCount: even, oddCount: odd,
    evenPct: Math.round((even / n) * 1000) / 10,
    oddPct:  Math.round((odd  / n) * 1000) / 10,
    mostFrequent:  { digit: maxIdx, pct: digitPct[maxIdx] },
    leastFrequent: { digit: minIdx, pct: digitPct[minIdx] },
    ticks: allTicks,
  };
}

// ─── Signal generation (deterministic from tick stats) ────────────────────────

export function generateSignal(stats: TickStats, market: MarketDef): { direction: string; confidence: number; contractType: ContractType } {
  const { evenPct, leastFrequent, digitPct, lastDigit: ld } = stats;
  // Even/Odd: bias toward the side that's been winning less (reversion)
  if (market.contractTypes.includes("even-odd")) {
    const dir = evenPct < 50 ? "EVEN" : "ODD";
    const imbalance = Math.abs(evenPct - 50);
    const conf = Math.min(95, 75 + imbalance * 1.5);
    return { direction: dir, confidence: Math.round(conf), contractType: "even-odd" };
  }
  if (market.contractTypes.includes("rise-fall")) {
    // Use price trend: last vs 5 ticks ago
    const ticks = stats.ticks;
    const trend = ticks.length > 5 ? ticks[ticks.length - 1].price - ticks[ticks.length - 5].price : 0;
    const dir = trend >= 0 ? "RISE" : "FALL";
    const conf = Math.min(93, 70 + Math.abs(trend / ticks[ticks.length - 1].price) * 5000);
    return { direction: dir, confidence: Math.round(conf), contractType: "rise-fall" };
  }
  if (market.contractTypes.includes("touch-notouch")) {
    const dir = ld > 5 ? "NO TOUCH" : "TOUCH";
    return { direction: dir, confidence: 73 + Math.floor(Math.random() * 12), contractType: "touch-notouch" };
  }
  return { direction: "EVEN", confidence: 80, contractType: "even-odd" };
}

export type AccountMode = "demo" | "real";

export const DEMO_START = 10000;
