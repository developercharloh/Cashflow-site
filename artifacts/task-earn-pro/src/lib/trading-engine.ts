// ────────────────────────────────────────────────────────────
//  Elite Signals Pro – Trading Engine
//  Deriv Volatility Indices · Digit Contracts
// ────────────────────────────────────────────────────────────

export interface MarketDef {
  id: string;
  name: string;
  shortName: string;
  vol: number; // volatility factor
  basePrice: number;
  pips: number;
  color: string;
}

export interface TickStats {
  ticks: number[];
  lastDigit: number;
  digitFreq: number[];       // freq[0..9] = count
  digitPct: number[];        // pct[0..9] = percentage
  evenCount: number;
  oddCount: number;
  evenPct: number;
  oddPct: number;
  mostFrequent: number;
  leastFrequent: number;
  avgDigit: number;
}

export interface AISignal {
  direction: "even" | "odd" | "over" | "under" | "matches" | "differs";
  barrier: number;          // 0-9 (used by over/under and matches/differs)
  contractType: string;     // human readable: "Even/Odd", "Over 5", "Matches 7"
  contractLabel: string;    // full label e.g. "ODD" "OVER 5" "MATCHES 7"
  payout: number;           // multiplier e.g. 1.90
  confidence: number;       // 0-100
  reasoning: string;
}

export interface TradeRecord {
  id: string;
  market: string;
  marketName: string;
  contractType: string;
  contractLabel: string;
  direction: string;
  stake: number;
  payout: number;
  netChange: number;
  win: boolean;
  lastDigit: number;
  timestamp: Date;
  status: "analyzing" | "executing" | "complete";
}

// ─── Deriv Volatility Indices (Digits) ───────────────────────
export const DIGIT_MARKETS: MarketDef[] = [
  { id: "R_10",     name: "Volatility 10 Index",       shortName: "V10",      vol: 0.0010, basePrice: 3215.45, pips: 2, color: "#4ade80" },
  { id: "1HZ10V",   name: "Volatility 10 (1s) Index",  shortName: "V10 (1s)", vol: 0.0010, basePrice: 1245.12, pips: 2, color: "#34d399" },
  { id: "R_25",     name: "Volatility 25 Index",       shortName: "V25",      vol: 0.0025, basePrice: 5672.33, pips: 2, color: "#22d3ee" },
  { id: "1HZ25V",   name: "Volatility 25 (1s) Index",  shortName: "V25 (1s)", vol: 0.0025, basePrice: 2341.67, pips: 2, color: "#38bdf8" },
  { id: "R_50",     name: "Volatility 50 Index",       shortName: "V50",      vol: 0.0050, basePrice: 4823.19, pips: 2, color: "#818cf8" },
  { id: "1HZ50V",   name: "Volatility 50 (1s) Index",  shortName: "V50 (1s)", vol: 0.0050, basePrice: 1987.54, pips: 2, color: "#a78bfa" },
  { id: "R_75",     name: "Volatility 75 Index",       shortName: "V75",      vol: 0.0075, basePrice: 7234.88, pips: 2, color: "#f472b6" },
  { id: "1HZ75V",   name: "Volatility 75 (1s) Index",  shortName: "V75 (1s)", vol: 0.0075, basePrice: 3156.43, pips: 2, color: "#fb7185" },
  { id: "R_100",    name: "Volatility 100 Index",      shortName: "V100",     vol: 0.0100, basePrice: 9412.67, pips: 2, color: "#fb923c" },
  { id: "1HZ100V",  name: "Volatility 100 (1s) Index", shortName: "V100(1s)", vol: 0.0100, basePrice: 4567.21, pips: 2, color: "#fbbf24" },
];

// ─── Tick Simulation ─────────────────────────────────────────
export function buildTicks(market: MarketDef, count = 100): number[] {
  let price = market.basePrice;
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    price = Math.max(0.01, price * (1 + (Math.random() - 0.5) * 2 * market.vol));
    ticks.push(price);
  }
  return ticks;
}

export function getLastDigit(price: number): number {
  return Math.floor(Math.round(price * 100)) % 10;
}

// ─── Tick Statistics ─────────────────────────────────────────
export function computeTickStats(ticks: number[]): TickStats {
  const digits = ticks.map(getLastDigit);
  const digitFreq = Array(10).fill(0);
  let evenCount = 0, oddCount = 0;
  for (const d of digits) {
    digitFreq[d]++;
    if (d % 2 === 0) evenCount++; else oddCount++;
  }
  const total = digits.length || 1;
  const digitPct = digitFreq.map(f => Math.round((f / total) * 100));
  const evenPct = Math.round((evenCount / total) * 100);
  const oddPct = 100 - evenPct;
  const mostFrequent = digitFreq.indexOf(Math.max(...digitFreq));
  const leastFrequent = digitFreq.indexOf(Math.min(...digitFreq));
  const avgDigit = Math.round(digits.reduce((a, b) => a + b, 0) / total * 10) / 10;
  return {
    ticks,
    lastDigit: digits[digits.length - 1],
    digitFreq, digitPct,
    evenCount, oddCount,
    evenPct, oddPct,
    mostFrequent, leastFrequent,
    avgDigit,
  };
}

// ─── Over/Under Payout ───────────────────────────────────────
export function overUnderPayout(dir: "over" | "under", barrier: number): number {
  const winCount = dir === "over" ? 9 - barrier : barrier;
  if (winCount <= 0) return 9.50;
  return Math.round((0.95 / (winCount / 10)) * 100) / 100;
}

// ─── AI Signal Generation ────────────────────────────────────
export function generateAISignal(ticks: number[], _market: MarketDef): AISignal {
  const stats = computeTickStats(ticks.slice(-100));
  const last20 = ticks.slice(-20).map(getLastDigit);
  const last20Even = last20.filter(d => d % 2 === 0).length;
  const last20Odd = 20 - last20Even;
  const avgLast10 = ticks.slice(-10).map(getLastDigit).reduce((a, b) => a + b, 0) / 10;

  // Strategy 1: DIFFERS — pick most frequent digit (high win rate ~90%)
  const mfDigit = stats.mostFrequent;
  const mfPct = stats.digitPct[mfDigit];
  if (mfPct >= 18) {
    return {
      direction: "differs",
      barrier: mfDigit,
      contractType: `Differs`,
      contractLabel: `DIFFERS ${mfDigit}`,
      payout: 1.10,
      confidence: Math.min(94, 72 + mfPct),
      reasoning: `Digit ${mfDigit} dominant at ${mfPct}% — high DIFFERS probability`,
    };
  }

  // Strategy 2: EVEN/ODD contrarian
  const evenImbalance = Math.abs(last20Even - last20Odd);
  if (evenImbalance >= 5) {
    const dir = last20Even > last20Odd ? "odd" : "even"; // contrarian
    const label = dir.toUpperCase();
    const pct = dir === "odd" ? last20Odd : last20Even;
    return {
      direction: dir,
      barrier: 0,
      contractType: "Even/Odd",
      contractLabel: label,
      payout: 1.90,
      confidence: Math.min(91, 68 + evenImbalance * 2),
      reasoning: `${dir === "odd" ? "Even" : "Odd"} dominant (${Math.round((last20Even / 20) * 100)}% even last 20) — contrarian ${label}`,
    };
  }

  // Strategy 3: OVER/UNDER based on digit average
  if (avgLast10 >= 6.5) {
    // High digits dominating → expect reversion → UNDER 5
    return {
      direction: "under",
      barrier: 5,
      contractType: "Under",
      contractLabel: "UNDER 5",
      payout: overUnderPayout("under", 5),
      confidence: Math.min(88, 60 + Math.round((avgLast10 - 5) * 8)),
      reasoning: `High digit avg (${avgLast10.toFixed(1)}) → UNDER 5 reversion play`,
    };
  }
  if (avgLast10 <= 3.5) {
    // Low digits dominating → OVER 4
    return {
      direction: "over",
      barrier: 4,
      contractType: "Over",
      contractLabel: "OVER 4",
      payout: overUnderPayout("over", 4),
      confidence: Math.min(88, 60 + Math.round((5 - avgLast10) * 8)),
      reasoning: `Low digit avg (${avgLast10.toFixed(1)}) → OVER 4 reversion play`,
    };
  }

  // Strategy 4: MATCHES — low frequency digit (rare but 9x payout)
  const lfDigit = stats.leastFrequent;
  const lfPct = stats.digitPct[lfDigit];
  if (lfPct <= 5) {
    return {
      direction: "matches",
      barrier: lfDigit,
      contractType: "Matches",
      contractLabel: `MATCHES ${lfDigit}`,
      payout: 9.00,
      confidence: Math.min(72, 45 + (10 - lfPct) * 2),
      reasoning: `Digit ${lfDigit} underrepresented (${lfPct}%) — MATCHES bounce play`,
    };
  }

  // Fallback: EVEN/ODD based on overall balance
  const dir = stats.evenPct > 50 ? "odd" : "even";
  return {
    direction: dir,
    barrier: 0,
    contractType: "Even/Odd",
    contractLabel: dir.toUpperCase(),
    payout: 1.90,
    confidence: Math.min(85, 65 + Math.abs(stats.evenPct - 50)),
    reasoning: `Default contrarian: ${dir.toUpperCase()} on ${stats.evenPct}% even balance`,
  };
}

// ─── Legacy exports (backward compat) ─────────────────────────
export const MARKETS = DIGIT_MARKETS;
export type { AISignal as Signal };
export const DEMO_START = 10000;

export type AccountMode = "demo" | "real";
export type ContractType = "even-odd" | "over-under" | "matches-differs" | "rise-fall";

export const PAYOUTS: Record<string, number> = {
  even: 1.90, odd: 1.90, matches: 9.00, differs: 1.10, rise: 1.85, fall: 1.85,
};
export const getOverUnderPayout = overUnderPayout;
export const lastDigit = getLastDigit;

/** @deprecated use generateAISignal */
export function generateSignal(stats: TickStats, _market: MarketDef) {
  const dir = stats.evenPct > 50 ? "odd" : "even";
  const imbalance = Math.abs(stats.evenPct - 50);
  return {
    direction: dir as "even" | "odd",
    contractType: "even-odd" as ContractType,
    confidence: Math.min(92, 70 + imbalance * 1.5),
    payout: 1.90,
  };
}

/** next tick price helper */
export function nextPrice(price: number, vol: number): number {
  return Math.max(0.01, price * (1 + (Math.random() - 0.5) * 2 * vol));
}
