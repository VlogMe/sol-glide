import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { PopularPairs } from "./PopularPairs";
import { TOKENS } from "@/lib/tokens";
import { searchJupiterToken } from "@/lib/jupiter.functions";

const Header = lazy(() => import("./Header").then((module) => ({ default: module.Header })));
const SwapCard = lazy(() => import("./SwapCard").then((module) => ({ default: module.SwapCard })));

const SELECT_OUTPUT_MINT_MESSAGE = "SOLPITCH_SELECT_OUTPUT_MINT";

export function DexApp() {
  const [mounted, setMounted] = useState(false);
  const [pair, setPair] = useState({ from: "SOL", to: "USDC" });
  const tokenSearchFn = useServerFn(searchJupiterToken);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectOutputMint = useCallback(async (rawMint: string) => {
    const outputMint = rawMint.trim();
    if (!outputMint) return;

    const existingEntry = Object.entries(TOKENS).find(([, token]) => token.mint === outputMint);
    if (existingEntry) {
      setPair({ from: "SOL", to: existingEntry[0] });
      return;
    }

    const token = await tokenSearchFn({ data: { tokenMint: outputMint } });
    const dynamicKey = `MINT:${outputMint}`;
    TOKENS[dynamicKey] = token;
    setPair({ from: "SOL", to: dynamicKey });
  }, [tokenSearchFn]);

  useEffect(() => {
    if (!mounted) return;

    const outputMint = new URLSearchParams(window.location.search).get("outputMint")?.trim();
    if (!outputMint) return;

    void selectOutputMint(outputMint).catch((error) => {
      console.error("Unable to preload output token", error);
    });
  }, [mounted, selectOutputMint]);

  useEffect(() => {
    if (!mounted) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== SELECT_OUTPUT_MINT_MESSAGE || typeof data.mint !== "string") return;

      void selectOutputMint(data.mint).catch((error) => {
        console.error("Unable to select embedded output token", error);
      });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [mounted, selectOutputMint]);

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  const embedded = window.self !== window.top || window.location.pathname.startsWith("/widget");

  if (embedded) {
    return (
      <>
        <Toaster theme="dark" position="bottom-right" richColors />
        <div className="min-h-screen bg-background px-2 py-3">
          <Suspense fallback={<SwapCardSkeleton />}>
            <SwapCard
              key={`${pair.from}-${pair.to}`}
              initialFrom={pair.from}
              initialTo={pair.to}
            />
          </Suspense>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster theme="dark" position="bottom-right" richColors />
      <DexLayout pair={pair} setPair={setPair} />
    </>
  );
}

function DexLayout({
  pair,
  setPair,
}: {
  pair: { from: string; to: string };
  setPair: (pair: { from: string; to: string }) => void;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main>
        <section id="swap" className="mx-auto max-w-7xl px-6 pt-14 md:pt-20 pb-10">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="mt-5 text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight">
                Fast <span className="gradient-text">Solana Swaps</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground max-w-lg">
                Get the best prices by routing across all major Solana DEXes. Instant, secure
                swaps.
              </p>
              <div className="mt-6 flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full animate-pulse bg-green-500 shadow-lg shadow-green-500/50" />
                  <span>Liquid routes powered by Jupiter</span>
                </div>
              </div>
            </div>
            <div>
              <Suspense fallback={<SwapCardSkeleton />}>
                <SwapCard
                  key={`${pair.from}-${pair.to}`}
                  initialFrom={pair.from}
                  initialTo={pair.to}
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
