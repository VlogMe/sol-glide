import "@/lib/buffer-polyfill";
import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

import "./wallet-adapter.css";

function safeAdapter<T>(Ctor: new () => T): T | null {
  try {
    return new Ctor();
  } catch (err) {
    console.warn("Wallet adapter unavailable", err);
    return null;
  }
}

export function WalletProviders({
  children,
  rpcUrl,
}: {
  children: ReactNode;
  rpcUrl: string;
  fallback?: (state: { error: string | null; retry: () => void }) => ReactNode;
  onError?: (error: unknown) => void;
}) {
  const endpoint = rpcUrl && rpcUrl.trim().length > 0 ? rpcUrl : "/api/rpc";
  const wallets = useMemo(
    () =>
      [
        safeAdapter(PhantomWalletAdapter),
        safeAdapter(SolflareWalletAdapter),
        safeAdapter(BackpackWalletAdapter),
      ].filter(Boolean) as any[],
    [],
  );

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
