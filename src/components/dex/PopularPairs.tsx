import { ArrowRight } from "lucide-react";
import { POPULAR_PAIRS, TOKENS } from "@/lib/tokens";

export function PopularPairs({ onSelect }: { onSelect: (from: string, to: string) => void }) {
  return (
    <section id="pairs" className="mx-auto max-w-7xl px-6 py-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold">Popular pairs</h2>
          <p className="text-muted-foreground mt-1">Most-traded routes on Solana right now.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {POPULAR_PAIRS.map(({ from, to, vip }) => {
          const a = TOKENS[from];
          const b = TOKENS[to];
          return (
            <button
              key={`${from}-${to}`}
              onClick={() => onSelect(from, to)}
              className={`group glass rounded-2xl p-4 text-left hover:border-primary/50 transition-all hover:-translate-y-0.5 ${vip ? "border-success/40" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <img src={a.logoURI} alt="" className="h-8 w-8 rounded-full ring-2 ring-card bg-muted" />
                  <img src={b.logoURI} alt="" className="h-8 w-8 rounded-full ring-2 ring-card bg-muted" />
                </div>
                <div className="ml-1 font-semibold flex items-center gap-1">
                  {from}
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary" />
                  {to}
                </div>
                {vip && (
                  <span className="ml-auto inline-flex items-center rounded-full bg-success/15 text-success border border-success/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    VIP
                  </span>
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                {vip ? "Hold 100k+ for 0.30% fee" : "Tap to swap"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
