import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";

const SwapCard = lazy(() =>
  import("@/components/dex/SwapCard").then((module) => ({ default: module.SwapCard })),
);

export const Route = createFileRoute("/widget")({
  component: SwapWidget,
  head: () => ({
    meta: [
      { title: "SolPitch Swap Widget" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function SwapWidget() {
  return (
    <ClientOnly fallback={<WidgetSkeleton />}>
      <main className="min-h-screen bg-transparent p-0 overflow-hidden">
        <Toaster theme="dark" position="bottom-right" richColors />
        <Suspense fallback={<WidgetSkeleton />}>
          <SwapCard initialFrom="SOL" initialTo="USDC" />
        </Suspense>
      </main>
    </ClientOnly>
  );
}

function WidgetSkeleton() {
  return <div className="glass h-[620px] w-full rounded-3xl" aria-hidden />;
}
