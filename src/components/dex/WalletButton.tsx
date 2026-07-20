import { useCallback, useEffect, useState, type ReactNode } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string } | string | null;
  connect: () => Promise<{ publicKey?: PhantomProvider["publicKey"] } | void>;
  disconnect?: () => Promise<void>;
  on?: (event: "connect" | "disconnect" | "accountChanged", handler: (value?: unknown) => void) => void;
  off?: (event: "connect" | "disconnect" | "accountChanged", handler: (value?: unknown) => void) => void;
  removeListener?: (event: "connect" | "disconnect" | "accountChanged", handler: (value?: unknown) => void) => void;
};

type PhantomWindow = typeof window & {
  solana?: PhantomProvider;
  phantom?: { solana?: PhantomProvider };
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as PhantomWindow;
  if (w.solana?.isPhantom) return w.solana;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  return null;
}

function publicKeyToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const key = value as { toBase58?: () => string; toString?: () => string };
    if (typeof key.toBase58 === "function") return key.toBase58();
    if (typeof key.toString === "function") {
      const address = key.toString();
      return address && address !== "[object Object]" ? address : null;
    }
  }
  return null;
}

export function getConnectedPhantomAddress() {
  const provider = getPhantom();
  if (!provider?.isConnected) return null;
  return publicKeyToString(provider.publicKey);
}

export function WalletButton({ children }: { children?: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    const provider = getPhantom();
    const sync = (value?: unknown) => {
      const nextAddress = publicKeyToString(value ?? provider?.publicKey);
      setAddress(nextAddress);
      window.dispatchEvent(new CustomEvent("solpitch:phantom-wallet", { detail: { address: nextAddress } }));
    };
    const clear = () => {
      setAddress(null);
      window.dispatchEvent(new CustomEvent("solpitch:phantom-wallet", { detail: { address: null } }));
    };

    if (provider?.isConnected) sync();
    provider?.on?.("connect", sync);
    provider?.on?.("accountChanged", sync);
    provider?.on?.("disconnect", clear);

    return () => {
      provider?.off?.("connect", sync);
      provider?.off?.("accountChanged", sync);
      provider?.off?.("disconnect", clear);
      provider?.removeListener?.("connect", sync);
      provider?.removeListener?.("accountChanged", sync);
      provider?.removeListener?.("disconnect", clear);
    };
  }, []);

  const connectPhantom = useCallback(() => {
    console.log("Connect Phantom clicked");
    const provider = getPhantom();
    if (!provider) {
      const msg = "Phantom wallet is not installed.";
      setWalletError(msg);
      window.open("https://phantom.app/download", "_blank", "noopener,noreferrer");
      return;
    }

    setConnecting(true);
    setWalletError(null);
    provider
      .connect()
      .then((response) => {
        const nextAddress = publicKeyToString(response?.publicKey ?? provider.publicKey);
        if (!nextAddress) throw new Error("Phantom did not return a wallet address.");
        setAddress(nextAddress);
        window.dispatchEvent(new CustomEvent("solpitch:phantom-wallet", { detail: { address: nextAddress } }));
      })
      .catch((err) => {
        console.error("Phantom connection failed", err);
        const message = err instanceof Error && err.message ? err.message : "Could not connect Phantom. Please try again.";
        setWalletError(message);
      })
      .finally(() => setConnecting(false));
  }, []);

  const label = connecting
    ? "Connecting..."
    : address
      ? shortAddr(address)
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
