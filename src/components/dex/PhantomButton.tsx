import { useEffect, useRef, useState } from "react";
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

export const WALLET_DISCONNECT_EVENT = "solpitch:wallet-disconnect";

function broadcastDisconnect() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_DISCONNECT_EVENT));
}

function short(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

const SIGN_IN_MESSAGE = "SOLPITCH SWAP sign-in\nApprove this message to connect Phantom.";

function isSameAddress(a: string, b: string) {
  return a === b;
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
  const approvedAddress = useRef<string | null>(null);

  useEffect(() => {
    const p = getProvider();
    approvedAddress.current = null;
    setAddress(null);
    if (!p) return;
    // Never read provider.publicKey or call trusted auto-connect here. The UI
    // must start disconnected and only show an address after a fresh signature.
    const onDisconnect = () => {
      approvedAddress.current = null;
      setAddress(null);
      broadcastDisconnect();
    };
    const onAccountChanged = (pk: any) => {
      const next = pk?.toString?.() ?? null;
      if (!approvedAddress.current || !next || !isSameAddress(approvedAddress.current, next)) {
        approvedAddress.current = null;
        setAddress(null);
        broadcastDisconnect();
      }
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
      const res = await provider.connect();
      const pk = res?.publicKey?.toString?.() ?? provider.publicKey?.toString?.();
      if (!pk) throw new Error("No public key returned");

      if (typeof provider.signMessage !== "function") {
        throw new Error("Phantom message signing is unavailable");
      }

      const message = new TextEncoder().encode(`${SIGN_IN_MESSAGE}\nWallet: ${pk}`);
      await provider.signMessage(message, "utf8");

      approvedAddress.current = pk;
      setAddress(pk);
      toast.success("Phantom connected");
    } catch (e: any) {
      approvedAddress.current = null;
      setAddress(null);
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
    approvedAddress.current = null;
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
