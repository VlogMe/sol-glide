import { createFileRoute } from "@tanstack/react-router";
import { DexApp } from "@/components/dex/DexApp";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "solpitch — Fastest Solana DEX Aggregator" },
      {
        name: "description",
        content:
          "Non-custodial Solana DEX aggregator. Best-price swaps routed across 20+ liquidity sources via Jupiter. Sub-second execution, 0.5% flat fee.",
      },
      { property: "og:title", content: "solpitch — Fastest Solana DEX Aggregator" },
      { property: "og:description", content: "Non-custodial swaps on Solana. Best price, sub-second." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  return <DexApp />;
}
