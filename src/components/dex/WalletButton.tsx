import { useCallback, useEffect, useState, type ReactNode } from "react";

type WalletRuntime = {
  useWallet: () => {
    publicKey: { toBase58: () => string } | null;
    connected: boolean;
    connecting: boolean;
    disconnect: () => Promise<void>;
  };
  useWalletModal: () => { setVisible: (v: boolean) => void };
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function ConnectButtonInner({
  runtime,
  children,
}: {
  runtime: WalletRuntime;
  children?: ReactNode;
}) {
  const { publicKey, connected, connecting, disconnect } = runtime.useWallet();
  const { setVisible } = runtime.useWalletModal();

  const onClick = useCallback(() => {
    try {
      if (connected) {
        void disconnect();
      } else {
        setVisible(true);
      }
    } catch (err) {
      console.error("Wallet action failed", err);
    }
  }, [connected, disconnect, setVisible]);

  const label = connecting
    ? "Connecting…"
    : connected && publicKey
      ? shortAddr(publicKey.toBase58())
      : (children ?? "Connect Wallet");

  return (
    <button
      type="button"
      onClick={onClick}
      className="wallet-adapter-button wallet-adapter-button-trigger"
    >
      {label}
    </button>
  );
}

export function WalletButton({ children }: { children?: ReactNode }) {
  const [runtime, setRuntime] = useState<WalletRuntime | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await import("@/lib/buffer-polyfill");
        const [reactAdapter, reactUi] = await Promise.all([
          import("@solana/wallet-adapter-react"),
          import("@solana/wallet-adapter-react-ui"),
        ]);
        if (cancelled) return;
        setRuntime({
          useWallet: reactAdapter.useWallet as WalletRuntime["useWallet"],
          useWalletModal: reactUi.useWalletModal as WalletRuntime["useWalletModal"],
        });
      } catch (err) {
        console.error("Failed to load wallet button", err);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (runtime) {
    try {
      return <ConnectButtonInner runtime={runtime}>{children}</ConnectButtonInner>;
    } catch (err) {
      console.error("Wallet button render failed", err);
      return (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="wallet-adapter-button wallet-adapter-button-trigger"
        >
          Refresh to retry
        </button>
      );
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (failed) window.location.reload();
        else console.log("Wallet adapter still loading…");
      }}
      className="wallet-adapter-button wallet-adapter-button-trigger"
    >
      {failed ? "Refresh to retry" : (children ?? "Connect Wallet")}
    </button>
  );
}
