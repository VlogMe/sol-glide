import { useMemo, type ReactNode } from "react";
import "@/lib/buffer-polyfill";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

import "./wallet-adapter.css";

export function WalletProviders({ children, rpcUrl }: { children: ReactNode; rpcUrl: string }) {
  const wallets = useMemo(() => {
    try {
      return [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()];
    } catch (error) {
      console.error("Failed to initialize wallet adapters", error);
      return [];
    }
  }, []);

  const endpoint = rpcUrl && rpcUrl.trim().length > 0 ? rpcUrl : "/api/rpc";

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
