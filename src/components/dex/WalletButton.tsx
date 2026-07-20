import { useCallback, useEffect, type ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

type WalletModalWindow = typeof window & {
  __solpitchOpenWalletModalRequested?: boolean;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function WalletButton({ children }: { children?: ReactNode }) {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible, visible } = useWalletModal();

  const openWalletModal = useCallback(() => {
    console.log("Connect button clicked");
    try {
      setVisible(true);
      console.log("Wallet modal opened", { visible: true });
    } catch (err) {
      console.error("Wallet action failed", err);
    }
  }, [setVisible]);

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
      : (children ?? "Connect Wallet");

  return (
    <button
      type="button"
      onClick={openWalletModal}
      aria-haspopup="dialog"
      aria-expanded={visible ? "true" : "false"}
      className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </button>
  );
}
