import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { PopularPairs } from "./PopularPairs";
import { connectPhantom, disconnectPhantom } from "./WalletButton";

const Header = lazy(() => import("./Header").then((module) => ({ default: module.Header })));
const SwapCard = lazy(() => import("./SwapCard").then((module) => ({ default: module.SwapCard })));

export function DexApp() {
  const [mounted, setMounted] = useState(false);
  const [pair, setPair] = useState({ from: "SOL", to: "SPDD" });
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleWalletConnect = useCallback(async () => {
    const address = await connectPhantom();
    setWalletAddress(address);
    return address;
  }, []);

  const handleWalletDisconnect = useCallback(async () => {
    try {
      await disconnectPhantom();
    } finally {
      setWalletAddress(null);
    }
  }, []);

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors />
      <DexLayout
        pair={pair}
        setPair={setPair}
        walletAddress={walletAddress}
        onWalletConnect={handleWalletConnect}
        onWalletDisconnect={handleWalletDisconnect}
      />
    </>
  );
}

function DexLayout({
  pair,
  setPair,
  walletAddress,
  onWalletConnect,
  onWalletDisconnect,
}: {
  pair: { from: string; to: string };
  setPair: (pair: { from: string; to: string }) => void;
  walletAddress: string | null;
  onWalletConnect: () => Promise<string | null>;
  onWalletDisconnect: () => Promise<void> | void;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header
          walletAddress={walletAddress}
          onWalletConnect={onWalletConnect}
          onWalletDisconnect={onWalletDisconnect}
        />
      </Suspense>
      <main>
        <section id="swap" className="mx-auto max-w-7xl px-6 pt-14 md:pt-20 pb-10">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium text-primary bg-primary/10 border border-primary/30 rounded-full px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live on Solana mainnet
              </div>
              <h1 className="mt-5 text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
                Fast Non-Custodial <span className="gradient-text">Solana Swaps</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-lg">
                Get the best prices by routing across all major Solana DEXes. Instant, secure, and
                non-custodial swaps with Phantom support.
              </p>
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                <Bullet>Best-price routing via Jupiter</Bullet>
                <Bullet>0.5% flat platform fee</Bullet>
              </div>
            </div>
            <div>
              <Suspense fallback={<SwapCardSkeleton />}>
                <SwapCard
                  key={`${pair.from}-${pair.to}`}
                  initialFrom={pair.from}
                  initialTo={pair.to}
                  walletAddress={walletAddress}
                  onWalletConnect={onWalletConnect}
                />
              </Suspense>
            </div>
          </div>
        </section>
        <PopularPairs
          onSelect={(from, to) => {
            setPair({ from, to });
            document.getElementById("swap")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </main>
      <footer className="border-t border-border/50 mt-10">
        <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} solpitch — Non-custodial Solana DEX aggregator.</div>
          <div>Routing powered by Jupiter</div>
        </div>
      </footer>
    </div>
  );
}

function HeaderSkeleton() {
  return <div className="h-16 border-b border-border/50 bg-background/60" aria-hidden />;
}

function SwapCardSkeleton() {
  return <div className="glass h-[430px] w-full max-w-md mx-auto rounded-3xl" aria-hidden />;
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span>{children}</span>
    </div>
  );
}
