import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { PopularPairs } from "./PopularPairs";
import { Stats } from "./Stats";
import { getRpcUrl } from "@/lib/jupiter.functions";

const WalletProviders = lazy(() => import("./WalletProviders").then((module) => ({ default: module.WalletProviders })));

const Header = lazy(() => import("./Header").then((module) => ({ default: module.Header })));
const SwapCard = lazy(() => import("./SwapCard").then((module) => ({ default: module.SwapCard })));

class WalletRuntimeBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Wallet runtime failed to load", error);
  }

  render() {
    return this.state.failed
      ? this.props.fallback(() => this.setState({ failed: false }))
      : this.props.children;
  }
}

export function DexApp() {
  const [mounted, setMounted] = useState(false);
  const [rpc, setRpc] = useState<string>("https://api.mainnet-beta.solana.com");
  const [pair, setPair] = useState({ from: "SOL", to: "USDC" });
  const [walletAttempt, setWalletAttempt] = useState(0);

  const retryWallet = useCallback(() => {
    setWalletAttempt((attempt) => attempt + 1);
  }, []);

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
    <WalletRuntimeBoundary
      key={walletAttempt}
      fallback={(retry) => (
        <DexLayout
          pair={pair}
          setPair={setPair}
          walletReady={false}
          walletError="Wallet support could not load in this browser session."
          onRetry={() => {
            retry();
            retryWallet();
          }}
        />
      )}
    >
      <Suspense fallback={<DexLayout pair={pair} setPair={setPair} walletReady={false} loadingWallet />}>
        <WalletProviders
          key={walletAttempt}
          rpcUrl={rpc}
          fallback={({ error, retry }) => (
            <DexLayout
              pair={pair}
              setPair={setPair}
              walletReady={false}
              loadingWallet={!error}
              walletError={error}
              onRetry={retry}
            />
          )}
        >
          <Toaster theme="dark" position="bottom-right" richColors />
          <DexLayout pair={pair} setPair={setPair} walletReady />
        </WalletProviders>
      </Suspense>
    </WalletRuntimeBoundary>
  );
}

function DexLayout({
  pair,
  setPair,
  walletReady,
  loadingWallet = false,
  walletError = null,
  onRetry,
}: {
  pair: { from: string; to: string };
  setPair: (pair: { from: string; to: string }) => void;
  walletReady: boolean;
  loadingWallet?: boolean;
  walletError?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header walletReady={walletReady} loadingWallet={loadingWallet} />
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
              {walletReady ? (
                <Suspense fallback={<SwapCardSkeleton />}>
                  <SwapCard key={`${pair.from}-${pair.to}`} initialFrom={pair.from} initialTo={pair.to} />
                </Suspense>
              ) : (
                <SwapUnavailableCard loading={loadingWallet} error={walletError} onRetry={onRetry} />
              )}
            </div>
          </div>
        </section>
        <Stats />
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

function SwapUnavailableCard({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="glass rounded-3xl p-6 shadow-[var(--shadow-card)] w-full max-w-md mx-auto">
      <h3 className="font-display text-lg font-semibold">Swap</h3>
      <p className="mt-3 text-sm text-muted-foreground">
        {loading
          ? "Loading secure wallet support…"
          : error || "Wallet support could not load in this browser session."}
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={loading || !onRetry}
          className="h-11 rounded-2xl border border-border bg-secondary/60 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 rounded-2xl bg-[image:var(--grad-primary)] text-primary-foreground font-semibold"
        >
          Refresh to retry
        </button>
      </div>
    </div>
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
