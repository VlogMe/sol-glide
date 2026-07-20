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
  const { publicKey, connected, connecting } = runtime.useWallet();
  const { setVisible } = runtime.useWalletModal();

  const onClick = useCallback(() => {
    try {
      setVisible(true);
    } catch (err) {
      console.error("Wallet action failed", err);
    }
  }, [setVisible]);

  const label = connecting
    ? "Connecting..."
    : connected && publicKey
      ? shortAddr(publicKey.toBase58())
      : (children ?? "Connect Wallet");

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
        if (failed) console.log("Wallet adapter failed to load. Refresh the page to retry.");
        else console.log("Wallet adapter still loading...");
      }}
      className="inline-flex h-11 min-w-[150px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {children ?? "Connect Wallet"}
    </button>
  );
}
