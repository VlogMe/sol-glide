import "@/lib/buffer-polyfill";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Loader2,
  Settings2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { TOKENS, type Token } from "@/lib/tokens";
import {
  getJupiterQuote,
  getJupiterSwap,
  logSwap,
} from "@/lib/jupiter.functions";
import { TokenSelect } from "./TokenSelect";
import {
  PhantomButton,
  WALLET_DISCONNECT_EVENT,
  WALLET_CONNECT_EVENT,
} from "./PhantomButton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PLATFORM_FEE_WALLET =
  "8FsSKh1dhgPvKTmnKvo9VJwshD3gqq7AbNeqUXaWrPp2";

function friendlyError(raw: string) {
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}

function fmt(n: number, max = 6) {
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";

  if (n < 0.0001) {
    return n.toExponential(2);
  }

  return n.toLocaleString(undefined, {
    maximumFractionDigits: max,
  });
}

export function SwapCard({
  initialFrom = "SOL",
  initialTo = "USDC",
}: {
  initialFrom?: string;
  initialTo?: string;
}) {
  const [swapState, setSwapState] = useState<{
    from: Token | null;
    to: Token | null;
    fromAmount: string;
    toAmount: string;
  }>({
    from:
      TOKENS[initialFrom] ??
      TOKENS.SOL ??
      Object.values(TOKENS)[0] ??
      null,

    to:
      TOKENS[initialTo] ??
      TOKENS.USDC ??
      Object.values(TOKENS)[1] ??
      Object.values(TOKENS)[0] ??
      null,

    fromAmount: "",
    toAmount: "",
  });

  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [walletAddress, setWalletAddress] =
    useState<string | null>(null);

  const debounce =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const quoteFn = useServerFn(getJupiterQuote);
  const swapFn = useServerFn(getJupiterSwap);
  const logSwapFn = useServerFn(logSwap);

  const { from, to, fromAmount } = swapState;

  useEffect(() => {
    if (!from || !to) return;

    setQuote(null);

    setSwapState((prev) => ({
      ...prev,
      toAmount: "",
    }));

    if (debounce.current) {
      clearTimeout(debounce.current);
    }

    const num = Number(fromAmount);

    if (!fromAmount || !isFinite(num) || num <= 0) {
      return;
    }

    debounce.current = setTimeout(async () => {
      try {
        setLoading(true);

        const raw = BigInt(
          Math.floor(num * 10 ** from.decimals),
        ).toString();

        const q = await quoteFn({
          data: {
            inputMint: from.mint,
            outputMint: to.mint,
            amount: raw,
            slippageBps,
          },
        });

        setQuote(q);

        if (q?.outAmount) {
          setSwapState((prev) => ({
            ...prev,
            toAmount: (
              Number(q.outAmount) /
              10 ** to.decimals
            ).toString(),
          }));
        }
      } catch (e: any) {
        toast.error(
          friendlyError(
            String(
              e?.message ||
              "Failed to fetch quote",
            ),
          ),
        );
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounce.current) {
        clearTimeout(debounce.current);
      }
    };
  }, [
    from,
    to,
    fromAmount,
    slippageBps,
    quoteFn,
  ]);
    useEffect(() => {
    const onDisconnect = () => {
      setWalletAddress(null);
      setQuote(null);
      setSwapping(false);
    };

    const onConnect = (e: Event) => {
      const addr =
        (e as CustomEvent).detail?.address;

      if (typeof addr === "string") {
        setWalletAddress(addr);
      }
    };

    window.addEventListener(
      WALLET_DISCONNECT_EVENT,
      onDisconnect,
    );

    window.addEventListener(
      WALLET_CONNECT_EVENT,
      onConnect,
    );

    return () => {
      window.removeEventListener(
        WALLET_DISCONNECT_EVENT,
        onDisconnect,
      );

      window.removeEventListener(
        WALLET_CONNECT_EVENT,
        onConnect,
      );
    };
  }, []);

  const outAmount = useMemo(() => {
    if (!quote?.outAmount || !to) {
      return "";
    }

    return (
      Number(quote.outAmount) /
      10 ** to.decimals
    ).toString();
  }, [quote, to]);

  const priceImpact =
    quote?.priceImpactPct
      ? Number(quote.priceImpactPct) * 100
      : 0;

  const executeSwap = async () => {
    if (!quote) {
      toast.error("No quote available");
      return;
    }

    if (!from || !to) {
      toast.error("Tokens not loaded");
      return;
    }

    const provider =
      (window as any).phantom?.solana ??
      (window as any).solana;

    if (!provider || !walletAddress) {
      toast.error("Connect Phantom first");
      return;
    }

    setSwapping(true);

    try {
      const res = await swapFn({
        data: {
          quoteResponse: quote,
          userPublicKey: walletAddress,
          wrapAndUnwrapSol: true,
        },
      });

      const swapTransaction =
        res?.swapTransaction;

      if (!swapTransaction) {
        throw new Error(
          "Jupiter did not return a swap transaction",
        );
      }

      const {
        VersionedTransaction,
        Connection,
      } = await import("@solana/web3.js");

      const txBytes = new Uint8Array(
        (globalThis as any).Buffer.from(
          swapTransaction,
          "base64",
        ),
      );

      const tx =
        VersionedTransaction.deserialize(
          txBytes,
        );

      const connection =
        new Connection(
          (import.meta as any).env
            ?.VITE_RPC_URL ??
            "https://api.mainnet-beta.solana.com",
          "confirmed",
        );

      let signature: string;

      if (
        typeof provider.signAndSendTransaction ===
        "function"
      ) {
        const result =
          await provider.signAndSendTransaction(
            tx,
          );

        signature =
          result?.signature ??
          result;
      } else {
        const signed =
          await provider.signTransaction(tx);

        signature =
          await connection.sendRawTransaction(
            signed.serialize(),
            {
              skipPreflight: false,
              maxRetries: 3,
            },
          );
      }

      await connection.confirmTransaction(
        signature,
        "confirmed",
      );

      await logSwapFn({
        data: {
          signature,
          inputMint: from.mint,
          outputMint: to.mint,
          inAmount: String(
            quote.inAmount ?? "",
          ),
          outAmount: String(
            quote.outAmount ?? "",
          ),
        },
      });

      toast.success(
        <a
          href={`https://solscan.io/tx/${signature}`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Swap confirmed — view on Solscan
        </a>,
      );

      setSwapState((prev) => ({
        ...prev,
        fromAmount: "",
        toAmount: "",
      }));

      setQuote(null);

    } catch (e: any) {
      console.error(
        "Swap error:",
        e,
      );

      if (e?.code !== 4001) {
        toast.error(
          friendlyError(
            String(
              e?.message ||
              "Swap failed",
            ),
          ),
        );
      }
    } finally {
      setSwapping(false);
    }
  };

  if (!from || !to) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        Loading tokens and market data...
      </div>
    );
  }

  const lowLiquidity =
    to.symbol === "SPDD" ||
    priceImpact > 3;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="glass rounded-3xl overflow-hidden shadow-[var(--shadow-card)] p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Swap
          </h2>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-secondary/60"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>

            <PopoverContent className="w-64 bg-card border-border">
              <div className="text-sm font-medium mb-2">
                Slippage tolerance
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 200].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSlippageBps(b)}
                    className="px-2 py-1.5 rounded-lg text-xs border"
                  >
                    {b / 100}%
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <TokenSelect
          value={from}
          onChange={(t) =>
            setSwapState((p) => ({
              ...p,
              from: t,
            }))
          }
        />

        <input
          type="number"
          value={fromAmount}
          onChange={(e) =>
            setSwapState((p) => ({
              ...p,
              fromAmount: e.target.value,
            }))
          }
          className="w-full text-3xl bg-transparent"
          placeholder="0.00"
        />

        <button
          type="button"
          onClick={() =>
            setSwapState((p) => ({
              from: p.to,
              to: p.from,
              fromAmount: p.toAmount,
              toAmount: p.fromAmount,
            }))
          }
        >
          <ArrowDownUp />
        </button>

        <TokenSelect
          value={to}
          onChange={(t) =>
            setSwapState((p) => ({
              ...p,
              to: t,
            }))
          }
        />

        <div className="text-3xl mt-3">
          {outAmount
            ? fmt(Number(outAmount), 8)
            : "0.00"}
        </div>

        {lowLiquidity && (
          <div className="mt-4 text-xs text-yellow-200">
            <AlertTriangle className="inline h-4 w-4" />
            {" "}
            Low liquidity
          </div>
        )}

        <div className="mt-5 flex gap-3">
          {!walletAddress ? (
            <PhantomButton className="w-full" />
          ) : (
            <>
              <PhantomButton />

              <button
                onClick={executeSwap}
                disabled={
                  !quote ||
                  swapping ||
                  loading
                }
                className="flex-1"
              >
                {swapping ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Swap Now"
                )}
              </button>
            </>
          )}
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          <Info className="inline h-3 w-3" />
          {" "}
          Powered by Jupiter.
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-3">
        Platform fee wallet{" "}
        {PLATFORM_FEE_WALLET.slice(0, 6)}
        …
      </p>
    </div>
  );
}
