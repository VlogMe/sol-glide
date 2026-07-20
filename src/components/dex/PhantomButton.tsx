import { useEffect, useState } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    solana?: any;
    phantom?: { solana?: any };
  }
}

function getProvider(): any | null {
  if (typeof window === "undefined") return null;
  const p = window.phantom?.solana ?? window.solana;
  return p?.isPhantom ? p : null;
}

function short(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function PhantomButton({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md";
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = getProvider();
    if (!p) return;
    // Ensure we start disconnected on every page load — never trust an
    // eager/cached Phantom session. Only a user-approved connect() below
    // will set the address.
    try {
      p.disconnect?.();
    } catch {}
    const onDisconnect = () => {
      setAddress(null);
      broadcastDisconnect();
    };
    const onAccountChanged = (pk: any) => {
      // Only reflect account changes while we already have an approved session.
      // Prevents Phantom from silently populating an address on mount.
      setAddress((prev) => {
        if (!prev) return null;
        if (!pk) {
          broadcastDisconnect();
          return null;
        }
        return pk.toString();
      });
    };
    p.on?.("disconnect", onDisconnect);
    p.on?.("accountChanged", onAccountChanged);
    return () => {
      p.off?.("disconnect", onDisconnect);
      p.off?.("accountChanged", onAccountChanged);
    };
  }, []);

  const connect = async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://phantom.app/", "_blank", "noopener,noreferrer");
      return;
    }
    try {
      setBusy(true);
      // Force the Phantom approval popup — never trust a cached session.
      const res = await provider.connect({ onlyIfTrusted: false });
      const pk = res?.publicKey?.toString?.();
      if (!pk) throw new Error("No public key returned");
      setAddress(pk);
    } catch (e: any) {
      if (e?.code !== 4001) toast.error(e?.message || "Failed to connect Phantom");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const provider = getProvider();
    try {
      await provider?.disconnect?.();
    } catch {}
    // Best-effort: clear any wallet-adapter localStorage that a prior build may
    // have left behind so a refresh cannot resurrect a "connected" state.
    try {
      if (typeof window !== "undefined") {
        for (const key of Object.keys(window.localStorage)) {
          if (/wallet|phantom|solana/i.test(key)) window.localStorage.removeItem(key);
        }
      }
    } catch {}
    setAddress(null);
    broadcastDisconnect();
    toast.success("Wallet disconnected");
  };

  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  const gradient =
    "bg-[linear-gradient(90deg,#9945FF_0%,#14F195_100%)] text-white font-semibold rounded-xl shadow-md hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60";

  if (address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className={`${gradient} ${pad} ${className}`}
        title="Click to disconnect"
      >
        {short(address)} · Disconnect
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={busy}
      className={`${gradient} ${pad} ${className}`}
    >
      {busy ? "Connecting…" : "Connect Phantom"}
    </button>
  );
}
