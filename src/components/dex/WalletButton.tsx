import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string } | string | null;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: PhantomProvider["publicKey"] } | void>;
  request?: (args: { method: string; params?: unknown }) => Promise<{ publicKey?: PhantomProvider["publicKey"] } | void>;
  signTransaction?: (transaction: unknown) => Promise<{ serialize: () => Uint8Array }>;
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

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as PhantomWindow;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

export function publicKeyToString(value: unknown): string | null {
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

export function emitWalletChange(nextAddress: string | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("solpitch:phantom-wallet", { detail: { address: nextAddress } }));
}

/**
 * Connect to Phantom. Tries the newer wallet-standard `request({method:"connect"})`
 * first (which handles the unlock flow cleanly), then falls back to `connect()`.
 * MUST be called synchronously from a user gesture (no awaits before it).
 */
export async function connectPhantomProvider(provider: PhantomProvider): Promise<string | null> {
  // Force a fresh auth prompt: if Phantom previously trusted this site it will
  // silently reconnect without opening the extension. Disconnecting first
  // ensures the user always sees the Phantom popup (unlock + approve).
  if (provider.isConnected && typeof provider.disconnect === "function") {
    try {
      await provider.disconnect();
    } catch {
      // ignore — we'll still attempt to connect below
    }
  }

  let response: any;
  if (typeof provider.connect === "function") {
    try {
      response = await provider.connect();
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === -32603 && typeof provider.request === "function") {
        response = await provider.request({ method: "connect" });
      } else {
        throw err;
      }
    }
  } else if (typeof provider.request === "function") {
    response = await provider.request({ method: "connect" });
  } else {
    throw new Error("Phantom is installed but no connect method is available.");
  }
  return publicKeyToString(response?.publicKey ?? provider.publicKey);
}

export function getConnectedPhantomAddress() {
  const provider = getPhantom();
  if (!provider?.isConnected) return null;
  return publicKeyToString(provider.publicKey);
}

export function WalletButton({ children }: { children?: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pending = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const provider = getPhantom();
    const sync = (value?: unknown) => {
      const nextAddress = publicKeyToString(value ?? provider?.publicKey);
      setAddress(nextAddress);
      emitWalletChange(nextAddress);
    };
    const clear = () => {
      setAddress(null);
      setMenuOpen(false);
      emitWalletChange(null);
    };
    const customSync = (event: Event) => {
      const nextAddress = (event as CustomEvent<{ address?: string | null }>).detail?.address ?? null;
      setAddress(nextAddress);
    };

    // Do NOT auto-sync from provider.isConnected on mount — only reflect state
    // after the user explicitly clicks Connect Phantom.
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const handleDisconnect = useCallback(async () => {
    const provider = getPhantom();
    if (provider?.disconnect) {
      try {
        await provider.disconnect();
      } catch (err) {
        console.error("Phantom disconnect failed", err);
      }
    }
    setAddress(null);
    setMenuOpen(false);
    emitWalletChange(null);
  }, []);

  const onClick = useCallback(() => {
    if (address) {
      setMenuOpen((open) => !open);
      return;
    }
    if (pending.current) return;
    const provider = getPhantom();
    if (!provider) {
      openPhantomInstallOrMobile();
      return;
    }
    pending.current = true;
    setConnecting(true);
    // Kick off connect synchronously from the click. Do NOT await before this line.
    connectPhantomProvider(provider)
      .then((nextAddress) => {
        if (nextAddress) {
          setAddress(nextAddress);
          emitWalletChange(nextAddress);
        }
      })
      .catch((err) => {
        const code = (err as { code?: number })?.code;
        if (code === 4001) return; // user rejected
        console.error("Phantom connect failed", err);
      })
      .finally(() => {
        pending.current = false;
        setConnecting(false);
      });
  }, [address]);

  const label = connecting
    ? "Connecting..."
    : address
      ? shortAddr(address)
      : (children ?? "Connect Phantom");

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onClick}
        aria-label={address ? `Connected Phantom wallet ${address}` : "Connect Phantom wallet"}
        aria-haspopup={address ? "menu" : undefined}
        aria-expanded={address ? menuOpen : undefined}
        className="inline-flex h-11 min-w-[170px] items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#7C3AED] px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/30 transition hover:from-[#9333EA] hover:to-[#6D28D9] hover:shadow-purple-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span aria-live="polite">{label}</span>
      </button>

      {address && menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-border/60 bg-card/95 backdrop-blur-xl p-2 shadow-2xl shadow-black/40 z-50"
        >
          <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border/40 mb-1">
            {address}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleDisconnect}
            className="w-full text-left px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
