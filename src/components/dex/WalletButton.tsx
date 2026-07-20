import { useCallback, type ReactNode } from "react";
import { useSolpitchWallet } from "./wallet-runtime";

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WalletButton({ children }: { children?: ReactNode }) {
  const { publicKey, connected, connecting, walletError, connect } = useSolpitchWallet();

  const connectPhantom = useCallback(() => {
    try {
      void connect();
    } catch (err) {
      console.error("Wallet action failed", err);
    }
  }, [connect]);

  const label = connecting
    ? "Connecting..."
    : connected && publicKey
      ? shortAddr(publicKey.toBase58())
      : (children ?? "Connect Phantom");

  return (
    <button
      type="button"
      onClick={connectPhantom}
      title={walletError ?? undefined}
      className="inline-flex h-11 min-w-[170px] items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:from-[#9333EA] hover:to-[#6D28D9] hover:shadow-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </button>
  );
}
