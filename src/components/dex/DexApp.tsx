import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { WalletProviders } from "./WalletProviders";
import { Header } from "./Header";
import { SwapCard } from "./SwapCard";
import { PopularPairs } from "./PopularPairs";
import { Stats } from "./Stats";
import { getRpcUrl } from "@/lib/jupiter.functions";

export function DexApp() {
  const [mounted, setMounted] = useState(false);
  const [rpc, setRpc] = useState<string>("https://api.mainnet-beta.solana.com");
  const [pair, setPair] = useState({ from: "SOL", to: "USDC" });

  useEffect(() => {
    setMounted(true);
    getRpcUrl()
      .then((r) => {
        const url = r.url.startsWith("http") ? r.url : `${window.location.origin}${r.url}`;
        setRpc(url);
      })
      .catch(() => {});
  }, []);

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return (
    <WalletProviders rpcUrl={rpc}>
      <Toaster theme="dark" position="bottom-right" richColors />
      <div className="min-h-screen">
        <Header />
        <main>
          <section id="swap" className="mx-auto max-w-7xl px-6 pt-14 md:pt-20 pb-10">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Live on Solana mainnet
                </div>
                <h1 className="mt-5 text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
                  The fastest way to <span className="gradient-text">swap on Solana</span>
                </h1>
                <p className="mt-5 text-lg text-muted-foreground max-w-lg">
                  A non-custodial DEX aggregator that routes across every major Solana liquidity source
                  for the best price — settled in under a second.
                </p>
                <div className="mt-6 flex flex-wrap gap-6 text-sm">
                  <Bullet>Best-price routing via Jupiter</Bullet>
                  <Bullet>0.5% flat platform fee</Bullet>
                  <Bullet>Your keys, your coins</Bullet>
                </div>
              </div>
              <div>
                <SwapCard key={`${pair.from}-${pair.to}`} initialFrom={pair.from} initialTo={pair.to} />
              </div>
            </div>
          </section>
          <Stats />
          <PopularPairs onSelect={(from, to) => {
            setPair({ from, to });
            document.getElementById("swap")?.scrollIntoView({ behavior: "smooth" });
          }} />
        </main>
        <footer className="border-t border-border/50 mt-10">
          <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>© {new Date().getFullYear()} solpitch — Non-custodial Solana DEX aggregator.</div>
            <div>Routing powered by Jupiter</div>
          </div>
        </footer>
      </div>
    </WalletProviders>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span>{children}</span>
    </div>
  );
}
