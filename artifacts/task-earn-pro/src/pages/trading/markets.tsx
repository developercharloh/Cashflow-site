import { useState } from "react";
import { Link } from "wouter";
import { Search, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETS, type MarketDef, type ContractType } from "@/lib/trading-engine";

type Tab = "all" | "digits" | "updown" | "highslows";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",       label: "All Markets" },
  { id: "digits",    label: "Digits" },
  { id: "updown",    label: "Up & Down" },
  { id: "highslows", label: "Highs & Lows" },
];

const CONTRACT_META: Record<ContractType, { label: string; desc: string }> = {
  "even-odd":        { label: "Even / Odd",        desc: "Predict whether the last digit will be Even or Odd" },
  "over-under":      { label: "Over / Under",       desc: "Predict whether the last digit will be Over or Under a selected number" },
  "matches-differs": { label: "Matches / Differs",  desc: "Predict whether the last digit matches a selected digit" },
  "rise-fall":       { label: "Rise / Fall",        desc: "Predict if the next tick will rise or fall" },
  "higher-lower":    { label: "Higher / Lower",     desc: "Predict if the last digit will be higher or lower" },
  "touch-notouch":   { label: "Touch / No Touch",   desc: "Predict if price will touch the target" },
};

const SECTION_ORDER: { cat: MarketDef["category"]; label: string }[] = [
  { cat: "digits",    label: "DIGITS" },
  { cat: "updown",    label: "UP & DOWN" },
  { cat: "highslows", label: "HIGHS & LOWS" },
];

// Deduplicate by first contractType so we show one card per market type
function dedupeByContractType(markets: MarketDef[]): MarketDef[] {
  const seen = new Set<ContractType>();
  return markets.filter(m => {
    const key = m.contractTypes[0];
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function MarketCard({ market }: { market: MarketDef }) {
  const ct = market.contractTypes[0];
  const meta = CONTRACT_META[ct];
  return (
    <Link
      href={`/markets/${market.id}`}
      data-testid={`market-card-${market.id}`}
      className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-muted/50 transition-all"
    >
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0", market.iconBg)}>
        {market.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{meta.label}</p>
        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{meta.desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </Link>
  );
}

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");

  const filtered = MARKETS.filter(m => {
    if (tab !== "all" && m.category !== tab) return false;
    if (query && !m.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const sections = tab === "all"
    ? SECTION_ORDER.map(s => ({ ...s, items: dedupeByContractType(filtered.filter(m => m.category === s.cat)) }))
    : [{ cat: tab, label: TABS.find(t => t.id === tab)!.label.toUpperCase(), items: dedupeByContractType(filtered) }];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <h1 className="text-lg font-black text-foreground">Markets</h1>
        <button data-testid="market-search-btn" className="text-muted-foreground">
          <Search className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            data-testid="market-search-input"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search markets…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 px-4 mb-4">
        {TABS.map(t => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all border",
              tab === t.id
                ? "bg-primary/15 text-primary border-primary/40"
                : "bg-muted text-muted-foreground border-transparent hover:bg-accent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="px-4 space-y-5 pb-4">
        {sections.map(s => s.items.length > 0 && (
          <div key={s.cat}>
            <p className="text-[10px] font-black text-muted-foreground tracking-widest mb-2">{s.label}</p>
            <div className="space-y-2">
              {s.items.map(m => <MarketCard key={m.id} market={m} />)}
            </div>
          </div>
        ))}
        {sections.every(s => s.items.length === 0) && (
          <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
            <Search className="w-8 h-8" />
            <p className="text-sm">No markets found</p>
          </div>
        )}
      </div>
    </div>
  );
}
