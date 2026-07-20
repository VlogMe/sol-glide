import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowDownUp, Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { PopularPairs } from "./PopularPairs";
import { Stats } from "./Stats";
import { TokenSelect } from "./TokenSelect";
import { TOKENS, type Token } from "@/lib/tokens";
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
                Fast Non-Custodial <span className="gradient-text">Solana Swaps</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-lg">
                Get the best prices by routing across all major Solana DEXes. Instant, secure, and
                non-custodial swaps with Phantom, Solflare, and Backpack support.
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
                <SwapUnavailableCard loading={loadingWallet} error={walletError} onRetry={onRetry} pair={pair} setPair={setPair} />
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
  pair,
  setPair,
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  pair: { from: string; to: string };
  setPair: (pair: { from: string; to: string }) => void;
}) {
  const from: Token = TOKENS[pair.from] ?? TOKENS.SOL;
  const to: Token = TOKENS[pair.to] ?? TOKENS.USDC;

  return (
    <div className="glass rounded-3xl p-5 md:p-6 shadow-[var(--shadow-card)] w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold">Swap</h3>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading wallet…
          </span>
        )}
      </div>

      <div className="space-y-2">
        <div className="rounded-2xl bg-secondary/40 border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">You pay</div>
          <div className="flex items-center gap-3">
            <input
              inputMode="decimal"
              placeholder="0.00"
              readOnly
              className="bg-transparent flex-1 text-3xl font-semibold outline-none min-w-0 opacity-70"
            />
            <TokenSelect value={from} onChange={(t) => setPair({ from: t.symbol, to: pair.to })} />
          </div>
        </div>

        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={() => setPair({ from: pair.to, to: pair.from })}
            className="h-10 w-10 grid place-items-center rounded-xl bg-card border border-border hover:border-primary/60 transition-colors"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-secondary/40 border border-border p-4">
          <div className="text-xs text-muted-foreground mb-2">You receive</div>
          <div className="flex items-center gap-3">
            <input
              placeholder="0.00"
              readOnly
              className="bg-transparent flex-1 text-3xl font-semibold outline-none min-w-0 opacity-70"
            />
            <TokenSelect value={to} onChange={(t) => setPair({ from: pair.from, to: t.symbol })} />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 text-xs text-destructive">{error}</p>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={loading || !onRetry}
          className="h-11 rounded-2xl border border-border bg-secondary/60 font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Loading…" : "Try again"}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-11 rounded-2xl bg-[image:var(--grad-primary)] text-primary-foreground font-semibold"
        >
          Refresh
        </button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground text-center">
        Connect a wallet to fetch live routes and execute swaps.
      </p>
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
