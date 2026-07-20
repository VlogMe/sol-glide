import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const DexApp = lazy(() =>
  import("@/components/dex/DexApp").then((module) => ({ default: module.DexApp })),
);

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "SOLPITCH SWAP — Fastest Solana DEX Aggregator" },
      {
        name: "description",
        content:
          "Non-custodial Solana DEX aggregator. Best-price swaps routed across 20+ liquidity sources via Jupiter. Sub-second execution, 0.5% flat fee.",
      },
      { property: "og:title", content: "SOLPITCH SWAP — Fastest Solana DEX Aggregator" },
      { property: "og:description", content: "Non-custodial swaps on Solana. Best price, sub-second." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return (
    <ClientOnly fallback={<div className="min-h-screen bg-background" aria-hidden />}>
      <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden />}>
        <DexApp />
      </Suspense>
    </ClientOnly>
  );
}
