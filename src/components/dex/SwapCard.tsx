import { useEffect, useRef } from "react";

const TERMINAL_SRC = "https://terminal.jup.ag/main-v3.js";
const PLATFORM_FEE_WALLET = "8FsSKh1dhgPvKTmnKvo9VJwshD3gqq7AbNeqUXaWrPp2";

declare global {
  interface Window {
    Jupiter?: any;
  }
}

function loadTerminalScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Jupiter) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${TERMINAL_SRC}"]`,
  );
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve());
      if (window.Jupiter) resolve();
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TERMINAL_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Jupiter Terminal"));
    document.head.appendChild(s);
  });
}

export default function SwapCard() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadTerminalScript()
      .then(() => {
        if (cancelled || !window.Jupiter) return;
        window.Jupiter.init({
          displayMode: "integrated",
          integratedTargetId: "jupiter-terminal",
          endpoint:
            (import.meta as any).env?.VITE_RPC_URL ||
            "https://api.mainnet-beta.solana.com",
          formProps: {
            initialInputMint: "So11111111111111111111111111111111111111112",
            initialOutputMint:
              "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
          },
          platformFeeAndAccounts: {
            feeBps: 50,
            feeAccounts: {},
          },
          containerStyles: {
            maxHeight: "700px",
          },
        });
      })
      .catch((e) => {
        console.error(e);
      });
    return () => {
      cancelled = true;
      try {
        window.Jupiter?.close?.();
      } catch {}
    };
  }, []);

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        id="jupiter-terminal"
        ref={mountRef}
        className="glass rounded-3xl overflow-hidden shadow-[var(--shadow-card)] min-h-[560px]"
      />
      <p className="text-[10px] text-muted-foreground text-center mt-3">
        Powered by Jupiter · Platform fee wallet {PLATFORM_FEE_WALLET.slice(0, 6)}…
      </p>
    </div>
  );
}
