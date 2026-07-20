import { useEffect, useState, type ComponentType, type ReactNode } from "react";

export function WalletButton({ children }: { children?: ReactNode }) {
  const [Button, setButton] = useState<ComponentType<{ children?: ReactNode }> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadButton() {
      try {
        await import("@/lib/buffer-polyfill");
        const module = await import("@solana/wallet-adapter-react-ui");
        if (!cancelled) setButton(() => module.WalletMultiButton as ComponentType<{ children?: ReactNode }>);
      } catch (error) {
        console.error("Failed to load wallet button", error);
        if (!cancelled) setFailed(true);
      }
    }

    loadButton();

    return () => {
      cancelled = true;
    };
  }, []);

  if (Button) {
    try {
      return <Button>{children}</Button>;
    } catch (err) {
      console.error("WalletMultiButton render failed", err);
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
      onClick={() => failed && window.location.reload()}
      disabled={!failed}
      className="wallet-adapter-button wallet-adapter-button-trigger"
    >
      {failed ? "Refresh to retry" : (children ?? "Select Wallet")}
    </button>
  );
}