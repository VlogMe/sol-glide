import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toBase58?: () => string; toString?: () => string } | string | null;
  connect?: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: PhantomProvider["publicKey"] } | void>;
  signTransaction?: (transaction: unknown) => Promise<{ serialize: () => Uint8Array }>;
  disconnect?: () => Promise<void>;
};

type PhantomWindow = typeof window & {
  solana?: PhantomProvider;
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as PhantomWindow;
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

/**
 * Connect to Phantom from an explicit user click only.
 * This calls window.solana.connect() immediately so Phantom can open its popup.
 */
export async function connectPhantom(): Promise<string> {
  const provider = getPhantom();
  if (!provider) {
    openPhantomInstallOrMobile();
    throw new Error("Phantom wallet is not installed.");
  }
  if (typeof provider.connect !== "function") {
    throw new Error("Phantom is installed but cannot connect. Please update Phantom.");
  }
  const response = await provider.connect({ onlyIfTrusted: false });
  const address = publicKeyToString(response?.publicKey ?? provider.publicKey);
  if (!address) throw new Error("Phantom did not return a wallet address.");
  return address;
}

export async function disconnectPhantom() {
  const provider = getPhantom();
  if (provider?.disconnect) await provider.disconnect();
}

export function WalletButton({
  address,
  onConnect,
  onDisconnect,
  children,
}: {
  address: string | null;
  onConnect: () => Promise<string | null>;
  onDisconnect: () => Promise<void> | void;
  children?: ReactNode;
}) {
  const [connecting, setConnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pending = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    try {
      await onDisconnect();
    } catch (err) {
      console.error("Phantom disconnect failed", err);
    } finally {
      setMenuOpen(false);
    }
  }, [onDisconnect]);

  const onClick = useCallback(() => {
    if (address) {
      setMenuOpen((open) => !open);
      return;
    }
    if (pending.current) return;

    pending.current = true;
    // Kick off connect synchronously from this click through the shared handler.
    const connectPromise = onConnect();
    setConnecting(true);
    connectPromise
      .catch((err) => {
        const code = (err as { code?: number })?.code;
        if (code === 4001) return; // user rejected
        console.error("Phantom connect failed", err);
      })
      .finally(() => {
        pending.current = false;
        setConnecting(false);
      });
  }, [address, onConnect]);

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
