import "@/lib/buffer-polyfill";
import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

import { SolpitchWalletRuntimeProvider } from "./wallet-runtime";

import "./wallet-adapter.css";

type WalletRuntime = {
  ConnectionProvider: ComponentType<{ endpoint: string; config?: { commitment: string }; children: ReactNode }>;
  WalletProvider: ComponentType<{
    wallets: unknown[];
    autoConnect?: boolean;
    onError?: (error: unknown) => void;
    children: ReactNode;
  }>;
  WalletModalProvider: ComponentType<{ children: ReactNode }>;
  RuntimeBridge: ComponentType<{ children: ReactNode }>;
  wallets: unknown[];
};

function safeAdapter<T>(Ctor: new () => T, name: string): T | null {
  try {
    return new Ctor();
  } catch (err) {
    console.warn(`${name} wallet adapter unavailable`, err);
    return null;
  }
}

function normalizeRpcEndpoint(rpcUrl: string) {
  const endpoint = rpcUrl && rpcUrl.trim().length > 0 ? rpcUrl.trim() : "/api/rpc";
  if (endpoint.startsWith("http")) return endpoint;
  if (typeof window !== "undefined") return `${window.location.origin}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  return "https://api.mainnet-beta.solana.com";
}

export function WalletProviders({
  children,
  rpcUrl,
  fallback,
  onError,
}: {
  children: ReactNode;
  rpcUrl: string;
  fallback?: (state: { error: string | null; retry: () => void }) => ReactNode;
  onError?: (error: unknown) => void;
}) {
  const endpoint = useMemo(() => normalizeRpcEndpoint(rpcUrl), [rpcUrl]);
  const [runtime, setRuntime] = useState<WalletRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setRuntime(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWalletRuntime() {
      try {
        setError(null);

        // Load the Buffer/global polyfill before any Solana package evaluates.
        await import("@/lib/buffer-polyfill");

        const [reactAdapter, reactUi, phantom] = await Promise.all([
          import("@solana/wallet-adapter-react"),
          import("@solana/wallet-adapter-react-ui"),
          import("@solana/wallet-adapter-phantom"),
        ]);

        if (cancelled) return;

        const wallets = [
          safeAdapter(phantom.PhantomWalletAdapter, "Phantom"),
        ].filter(Boolean) as unknown[];

        const RuntimeBridge: WalletRuntime["RuntimeBridge"] = ({ children }) => {
          const wallet = reactAdapter.useWallet();
          const connectionState = reactAdapter.useConnection();
          const modal = reactUi.useWalletModal();

          const show = () => {
            console.log("Connect button clicked");
            modal.setVisible(true);
            console.log("Wallet modal opened", { visible: true });
          };

          return (
            <SolpitchWalletRuntimeProvider
              value={{
                publicKey: wallet.publicKey,
                connected: wallet.connected,
                connecting: wallet.connecting,
                signTransaction: wallet.signTransaction,
                connection: connectionState?.connection ?? null,
                walletModal: {
                  visible: modal.visible,
                  show,
                },
              }}
            >
              {children}
            </SolpitchWalletRuntimeProvider>
          );
        };

        setRuntime({
          ConnectionProvider: reactAdapter.ConnectionProvider as WalletRuntime["ConnectionProvider"],
          WalletProvider: reactAdapter.WalletProvider as WalletRuntime["WalletProvider"],
          WalletModalProvider: reactUi.WalletModalProvider as WalletRuntime["WalletModalProvider"],
          RuntimeBridge,
          wallets,
        });
      } catch (err) {
        if (cancelled) return;
        console.error("Wallet runtime failed to initialize", err);
        onError?.(err);
        setError("Wallet support could not load in this browser session.");
      }
    }

    loadWalletRuntime();

    return () => {
      cancelled = true;
    };
  }, [attempt, onError]);

  if (!runtime) {
    return fallback ? <>{fallback({ error, retry })}</> : null;
  }

  const { ConnectionProvider, WalletProvider, WalletModalProvider, RuntimeBridge, wallets } = runtime;

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        onError={(err: unknown) => {
          console.warn("Wallet error", err);
          onError?.(err);
        }}
      >
        <WalletModalProvider>
          <RuntimeBridge>{children}</RuntimeBridge>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
