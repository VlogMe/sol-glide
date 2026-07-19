import { Gauge, ShieldCheck, TrendingUp } from "lucide-react";

const STATS = [
  { icon: Gauge, value: "0.4s", label: "Avg swap time", sub: "Sub-second execution on Solana" },
  { icon: ShieldCheck, value: "0%", label: "Custody", sub: "Non-custodial, keys stay in your wallet" },
  { icon: TrendingUp, value: "$142M", label: "24h volume routed", sub: "Aggregated across 20+ DEXes" },
];

export function Stats() {
  return (
    <section id="stats" className="mx-auto max-w-7xl px-6 py-16">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATS.map(({ icon: Icon, value, label, sub }) => (
          <div key={label} className="glass rounded-2xl p-6">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="text-3xl font-bold gradient-text">{value}</div>
            </div>
            <div className="mt-3 font-semibold">{label}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
