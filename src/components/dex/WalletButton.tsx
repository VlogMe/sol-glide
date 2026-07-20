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
  const address = publicKeyToString(response?.publicKey);
  if (!address) throw new Error("Phantom did not approve a wallet connection. Unlock Phantom and approve the request.");
  return address;
}
