import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";

import "./wallet-adapter.css";

type WalletRuntime = {
  ConnectionProvider: ComponentType<any>;
  WalletProvider: ComponentType<any>;
  WalletModalProvider: ComponentType<any>;
  wallets: any[];
};

type WalletFallbackState = {
  error: string | null;
  retry: () => void;
};

function walletErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown wallet error");
  if (message.toLowerCase().includes("failed to fetch dynamically imported module")) {
    return "Wallet support did not finish loading. Try again or refresh this page.";
  }
  return message.length > 180 ? `${message.slice(0, 180)}…` : message;
}

function createWallet(Constructor: unknown) {
  try {
    return typeof Constructor === "function" ? new (Constructor as new () => unknown)() : null;
  } catch (error) {
    console.warn("Wallet adapter unavailable", error);
    return null;
  }
}

export function WalletProviders({
  children,
  rpcUrl,
  fallback,
  onError,
}: {
  children: ReactNode;
  rpcUrl: string;
  fallback?: (state: WalletFallbackState) => ReactNode;
  onError?: (error: unknown) => void;
}) {
  const [runtime, setRuntime] = useState<WalletRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setRuntime(null);
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWalletRuntime() {
      try {
        setError(null);
        await import("@/lib/buffer-polyfill");

        const [reactAdapter, reactUi, phantom, solflare, backpack] = await Promise.all([
          import("@solana/wallet-adapter-react"),
          import("@solana/wallet-adapter-react-ui"),
          import("@solana/wallet-adapter-phantom"),
          import("@solana/wallet-adapter-solflare"),
          import("@solana/wallet-adapter-backpack"),
        ]);

        if (cancelled) return;

        const wallets = [
          createWallet(phantom.PhantomWalletAdapter),
          createWallet(solflare.SolflareWalletAdapter),
          createWallet(backpack.BackpackWalletAdapter),
        ].filter(Boolean);

        setRuntime({
          ConnectionProvider: reactAdapter.ConnectionProvider,
          WalletProvider: reactAdapter.WalletProvider,
          WalletModalProvider: reactUi.WalletModalProvider,
          wallets,
        });
      } catch (caught) {
        if (cancelled) return;
        console.error("Failed to load wallet support", caught);
        setRuntime(null);
        setError(walletErrorMessage(caught));
        onError?.(caught);
      }
    }

    loadWalletRuntime();

    return () => {
      cancelled = true;
    };
  }, [attempt, onError]);

  const endpoint = rpcUrl && rpcUrl.trim().length > 0 ? rpcUrl : "/api/rpc";

  if (!runtime) {
    return <>{fallback?.({ error, retry }) ?? null}</>;
  }

  const { ConnectionProvider, WalletProvider, WalletModalProvider, wallets } = runtime;

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(err: unknown) => console.warn("Wallet error", err)}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
