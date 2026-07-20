import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SolpitchWalletRuntimeProvider,
  type SolpitchPublicKey,
  type SolpitchWalletRuntime,
} from "./wallet-runtime";

type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: unknown;
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey?: unknown } | void>;
  disconnect?: () => Promise<void>;
  signTransaction?: (transaction: unknown) => Promise<unknown>;
  on?: (event: "connect" | "disconnect" | "accountChanged", handler: (value?: unknown) => void) => void;
  off?: (event: "connect" | "disconnect" | "accountChanged", handler: (value?: unknown) => void) => void;
  removeListener?: (event: "connect" | "disconnect" | "accountChanged", handler: (value?: unknown) => void) => void;
};

type SolpitchWindow = typeof window & {
  phantom?: { solana?: PhantomProvider };
  solana?: PhantomProvider;
  __solpitchConnectPhantomRequested?: boolean;
};

function normalizeRpcEndpoint(rpcUrl: string) {
  const endpoint = rpcUrl && rpcUrl.trim().length > 0 ? rpcUrl.trim() : "/api/rpc";
  if (endpoint.startsWith("http")) return endpoint;
  if (typeof window !== "undefined") return `${window.location.origin}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  return "https://api.mainnet-beta.solana.com";
}

function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as SolpitchWindow;
  const phantomProvider = w.phantom?.solana;
  if (phantomProvider?.isPhantom) return phantomProvider;
  if (w.solana?.isPhantom) return w.solana;
  return null;
}

function toPublicKey(value: unknown): SolpitchPublicKey | null {
  if (!value) return null;
  if (typeof value === "string" && value.length > 0) {
    return { toBase58: () => value, toString: () => value };
  }
  if (typeof value === "object") {
    const candidate = value as { toBase58?: () => string; toString?: () => string };
    if (typeof candidate.toBase58 === "function") {
      const address = candidate.toBase58();
      return { toBase58: () => address, toString: () => address };
    }
    if (typeof candidate.toString === "function") {
      const address = candidate.toString();
      if (address && address !== "[object Object]") return { toBase58: () => address, toString: () => address };
    }
  }
  return null;
}

export function WalletProviders({
  children,
  rpcUrl,
  onError,
}: {
  children: ReactNode;
  rpcUrl: string;
  onError?: (error: unknown) => void;
}) {
  const endpoint = useMemo(() => normalizeRpcEndpoint(rpcUrl), [rpcUrl]);
  const [connection, setConnection] = useState<any | null>(null);
  const [publicKey, setPublicKey] = useState<SolpitchPublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const connected = !!publicKey;

  useEffect(() => {
    let cancelled = false;

    async function createConnection() {
      try {
        setWalletError(null);
        await import("@/lib/buffer-polyfill");
        const { Connection } = await import("@solana/web3.js");
        if (cancelled) return;
        setConnection(new Connection(endpoint, "confirmed"));
      } catch (err) {
        if (cancelled) return;
        console.error("Solana connection failed to initialize", err);
        onError?.(err);
        setWalletError("Solana connection is still loading. Please try again.");
      }
    }

    createConnection();

    return () => {
      cancelled = true;
    };
  }, [endpoint, onError]);

  const connectPhantom = useCallback(async () => {
    console.log("Connect button clicked");
    setWalletError(null);
    const provider = getPhantomProvider();
    if (!provider) {
      const msg = "Phantom wallet is not installed.";
      setWalletError(msg);
      window.open("https://phantom.app/download", "_blank", "noopener,noreferrer");
      return;
    }

    try {
      setConnecting(true);
      const response = await provider.connect();
      const nextPublicKey = toPublicKey(response?.publicKey ?? provider.publicKey);
      if (!nextPublicKey) throw new Error("Phantom did not return a wallet address.");
      setPublicKey(nextPublicKey);
      console.log("Phantom wallet opened", { connected: true });
    } catch (err) {
      console.error("Phantom connection failed", err);
      const message = err instanceof Error && err.message ? err.message : "Could not connect Phantom. Please try again.";
      setWalletError(message);
      onError?.(err);
    } finally {
      setConnecting(false);
    }
  }, [onError]);

  const disconnectPhantom = useCallback(async () => {
    const provider = getPhantomProvider();
    try {
      await provider?.disconnect?.();
    } catch (err) {
      console.warn("Phantom disconnect failed", err);
    } finally {
      setPublicKey(null);
      setConnecting(false);
    }
  }, []);

  const signTransaction = useCallback(async (transaction: unknown) => {
    const provider = getPhantomProvider();
    if (!provider?.signTransaction) throw new Error("Phantom cannot sign this transaction.");
    return provider.signTransaction(transaction);
  }, []);

  useEffect(() => {
    const provider = getPhantomProvider();
    if (!provider) return;

    const syncPublicKey = (value?: unknown) => {
      const nextPublicKey = toPublicKey(value ?? provider.publicKey);
      if (nextPublicKey) setPublicKey(nextPublicKey);
    };
    const clearPublicKey = () => setPublicKey(null);
    const handleAccountChanged = (value?: unknown) => {
      const nextPublicKey = toPublicKey(value);
      setPublicKey(nextPublicKey);
    };

    provider.on?.("connect", syncPublicKey);
    provider.on?.("disconnect", clearPublicKey);
    provider.on?.("accountChanged", handleAccountChanged);

    provider
      .connect({ onlyIfTrusted: true })
      .then((response) => syncPublicKey(response?.publicKey))
      .catch(() => {
        if (provider.isConnected) syncPublicKey();
      });

    return () => {
      provider.off?.("connect", syncPublicKey);
      provider.off?.("disconnect", clearPublicKey);
      provider.off?.("accountChanged", handleAccountChanged);
      provider.removeListener?.("connect", syncPublicKey);
      provider.removeListener?.("disconnect", clearPublicKey);
      provider.removeListener?.("accountChanged", handleAccountChanged);
    };
  }, []);

  useEffect(() => {
    const openQueued = () => {
      const w = window as SolpitchWindow;
      if (w.__solpitchConnectPhantomRequested) {
        w.__solpitchConnectPhantomRequested = false;
      }
      void connectPhantom();
    };

    const w = window as SolpitchWindow;
    if (w.__solpitchConnectPhantomRequested) window.setTimeout(openQueued, 0);
    window.addEventListener("solpitch:connect-phantom", openQueued);
    return () => window.removeEventListener("solpitch:connect-phantom", openQueued);
  }, [connectPhantom]);

  const runtime = useMemo<SolpitchWalletRuntime>(
    () => ({
      publicKey,
      connected,
      connecting,
      signTransaction,
      connection,
      walletError,
      connect: connectPhantom,
      disconnect: disconnectPhantom,
    }),
    [publicKey, connected, connecting, signTransaction, connection, walletError, connectPhantom, disconnectPhantom],
  );

  return <SolpitchWalletRuntimeProvider value={runtime}>{children}</SolpitchWalletRuntimeProvider>;
}
