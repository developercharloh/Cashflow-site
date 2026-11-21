import { CandlestickChart } from "lucide-react";

export default function ForexPage() {
  return (
    <div className="px-4 pb-12 pt-8 sm:px-7 sm:pt-12">
      <section data-testid="status-forex-coming-soon" className="mx-auto max-w-3xl rounded-3xl border border-border bg-card px-6 py-10 text-center sm:px-12 sm:py-14">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-primary"><CandlestickChart className="h-6 w-6" /></div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[.2em] text-primary">LipwaTasks feature</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">Forex</h1>
        <p className="mt-4 font-semibold">Coming soon</p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Forex is not available yet. No forex trades or deposits are available on LipwaTasks.</p>
      </section>
    </div>
  );
}
