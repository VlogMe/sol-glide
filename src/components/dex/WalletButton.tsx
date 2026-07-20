import { useCallback, useEffect, type ReactNode } from "react";
import { useSolpitchWallet } from "./wallet-runtime";

type WalletModalWindow = typeof window & {
  __solpitchOpenWalletModalRequested?: boolean;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WalletButton({ children }: { children?: ReactNode }) {
  const { publicKey, connected, connecting, walletModal } = useSolpitchWallet();

  const openWalletModal = useCallback(() => {
    try {
      walletModal.show();
    } catch (err) {
      console.error("Wallet action failed", err);
    }
  }, [walletModal]);

  // Handle queued open request from static header button (before providers mounted).
  useEffect(() => {
    const w = window as WalletModalWindow;
    const openQueued = () => {
      w.__solpitchOpenWalletModalRequested = false;
      openWalletModal();
    };
    if (w.__solpitchOpenWalletModalRequested) {
      window.setTimeout(openQueued, 0);
    }
    window.addEventListener("solpitch:open-wallet-modal", openQueued);
    return () => window.removeEventListener("solpitch:open-wallet-modal", openQueued);
  }, [openWalletModal]);

  const label = connecting
    ? "Connecting..."
    : connected && publicKey
      ? shortAddr(publicKey.toBase58())
      : (children ?? "Connect Phantom");

  return (
    <button
      type="button"
      onClick={openWalletModal}
      aria-haspopup="dialog"
      aria-expanded={walletModal.visible ? "true" : "false"}
      className="inline-flex h-11 min-w-[170px] items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:from-[#9333EA] hover:to-[#6D28D9] hover:shadow-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </button>
  );
}
