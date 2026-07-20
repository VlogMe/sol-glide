import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string } | string | null;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: PhantomProvider["publicKey"] } | void>;
  request?: (args: { method: "connect"; params?: unknown }) => Promise<{ publicKey?: PhantomProvider["publicKey"] } | void>;
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
  // Phantom's recommended provider path is window.phantom.solana. The legacy
  // window.solana namespace can be shimmed by other wallets and sometimes
  // returns -32603 "Unexpected error" when connect() is invoked against it.
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicKeyToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const maybeResponse = value as { publicKey?: unknown };
    if (maybeResponse.publicKey) return publicKeyToString(maybeResponse.publicKey);
    const key = value as { toBase58?: () => string; toString?: () => string };
    if (typeof key.toBase58 === "function") return key.toBase58();
    if (typeof key.toString === "function") {
      const address = key.toString();
      return address && address !== "[object Object]" ? address : null;
    }
  }
  return null;
}

function isMobileBrowser() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function openPhantomInstallOrMobile() {
  if (typeof window === "undefined") return;
  const currentUrl = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  const target = isMobileBrowser()
    ? `https://phantom.app/ul/browse/${currentUrl}?ref=${ref}`
    : "https://phantom.app/download";
  window.open(target, "_blank", "noopener,noreferrer");
}

function mapPhantomError(error: unknown) {
  const err = error as { code?: number; message?: string };
  const message = typeof err?.message === "string" ? err.message : "";
  if (err?.code === 4001 || /reject/i.test(message)) return "Connection rejected in Phantom.";
  if (err?.code === -32002 || /pending/i.test(message)) return "A Phantom connection request is already open. Check Phantom.";
  if (err?.code === -32603) return "Phantom could not open the approval popup. Unlock Phantom and try again.";
  return message || "Could not connect Phantom. Please try again.";
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
  const pendingConnect = useRef<Promise<unknown> | null>(null);

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
    const customSync = (event: Event) => {
      const nextAddress = (event as CustomEvent<{ address?: string | null }>).detail?.address ?? null;
      setAddress(nextAddress);
    };

    if (provider?.isConnected) sync();
    provider?.on?.("connect", sync);
    provider?.on?.("accountChanged", sync);
    provider?.on?.("disconnect", clear);
    window.addEventListener("solpitch:phantom-wallet", customSync);

    return () => {
      provider?.off?.("connect", sync);
      provider?.off?.("accountChanged", sync);
      provider?.off?.("disconnect", clear);
      provider?.removeListener?.("connect", sync);
      provider?.removeListener?.("accountChanged", sync);
      provider?.removeListener?.("disconnect", clear);
      window.removeEventListener("solpitch:phantom-wallet", customSync);
    };
  }, []);

  const connectPhantom = useCallback(async () => {
    console.log("Connect Phantom clicked");
    if (pendingConnect.current) return;

    const provider = getPhantom();
    if (!provider) {
      setWalletError("Phantom wallet is not installed.");
      openPhantomInstallOrMobile();
      return;
    }

    if (provider.isConnected) {
      const connectedAddress = publicKeyToString(provider.publicKey);
      if (connectedAddress) {
        setAddress(connectedAddress);
        setWalletError(null);
        window.dispatchEvent(new CustomEvent("solpitch:phantom-wallet", { detail: { address: connectedAddress } }));
        return;
      }
    }

    if (typeof provider.connect !== "function") {
      setWalletError("Phantom is installed but unavailable in this browser session. Refresh and try again.");
      return;
    }

    setWalletError(null);
    setConnecting(true);

    // CRITICAL: call connect() synchronously here (no awaits before this line
    // after the user click) so Phantom recognises the user gesture and opens
    // the extension popup — matching Pump.fun / Jupiter behaviour.
    const connectPromise = provider.connect();
    pendingConnect.current = connectPromise as Promise<unknown>;

    try {
      const response = await connectPromise;
      const nextAddress = publicKeyToString(response?.publicKey ?? provider.publicKey);
      if (!nextAddress) throw new Error("Phantom did not return a wallet address.");
      console.log("Phantom connected", nextAddress);
      setAddress(nextAddress);
      window.dispatchEvent(new CustomEvent("solpitch:phantom-wallet", { detail: { address: nextAddress } }));
    } catch (err) {
      const code = (err as { code?: number })?.code;
      // Swallow user-rejection silently (no scary error banner).
      if (code === 4001) {
        console.info("Phantom connection dismissed by user");
        setWalletError(null);
      } else {
        console.error("Phantom connection failed", err);
        setWalletError(mapPhantomError(err));
      }
    } finally {
      pendingConnect.current = null;
      setConnecting(false);
    }
  }, []);

  const label = connecting
    ? "Connecting..."
    : address
      ? shortAddr(address)
      : (children ?? "Connect Phantom");

  return (
    <button
      type="button"
      onClick={() => void connectPhantom()}
      title={walletError ?? undefined}
      aria-label={address ? `Connected Phantom wallet ${address}` : "Connect Phantom wallet"}
      className="inline-flex h-11 min-w-[170px] items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:from-[#9333EA] hover:to-[#6D28D9] hover:shadow-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}

