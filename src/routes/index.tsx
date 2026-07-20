import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const DexApp = lazy(() =>
  import("@/lib/buffer-polyfill")
    .then(() => import("@/components/dex/DexApp"))
    .then((module) => ({ default: module.DexApp }))
    .catch((error) => {
      console.error("Failed to load SOLPITCH SWAP", error);
      return { default: DexLoadFailure };
    }),
);

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "SOLPITCH SWAP — Fast Non-Custodial Solana Swaps" },
      {
        name: "description",
        content:
          "Get the best prices by routing across all major Solana DEXes. Instant, secure, and non-custodial swaps with Phantom, Solflare, and Backpack support.",
      },
      { property: "og:title", content: "SOLPITCH SWAP — Fast Non-Custodial Solana Swaps" },
      { property: "og:description", content: "Get the best prices by routing across all major Solana DEXes. Instant, secure, and non-custodial swaps with Phantom, Solflare, and Backpack support." },
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

function DexLoadFailure() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-xl font-semibold text-foreground">SOLPITCH SWAP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The swap interface could not load in this browser session. Refresh to retry.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Refresh
        </button>
      </div>
    </main>
  );
}
