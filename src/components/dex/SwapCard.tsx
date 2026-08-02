import "@/lib/buffer-polyfill";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Loader2,
  Settings2,
  Info,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { TOKENS, type Token } from "@/lib/tokens";
import {
  getJupiterQuote,
  getJupiterSwap,
  getSwapStatus,
  getWalletBalance,
  logSwap,
  searchJupiterToken,
  sendSignedTransaction,
  simulateSwapTransaction,
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

function fromRawAmount(raw: string, decimals: number) {
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = decimals
    ? padded.slice(-decimals).replace(/0+$/, "")
    : "";

  return fraction ? `${whole}.${fraction}` : whole;
}

function toRawAmount(value: string, decimals: number) {
  const [whole = "0", fraction = ""] = value.split(".");
  const fractionRaw = fraction
    .slice(0, decimals)
    .padEnd(decimals, "0");

  return (
    BigInt(whole || "0") * (10n ** BigInt(decimals)) +
    BigInt(fractionRaw || "0")
  ).toString();
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
  const [maxLoading, setMaxLoading] = useState(false);
  const [mintSearch, setMintSearch] = useState("");
  const [mintSearching, setMintSearching] = useState(false);

  const debounce =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const quoteFn = useServerFn(getJupiterQuote);
  const swapFn = useServerFn(getJupiterSwap);
  const swapStatusFn = useServerFn(getSwapStatus);
  const walletBalanceFn = useServerFn(getWalletBalance);
  const tokenSearchFn = useServerFn(searchJupiterToken);
  const sendSignedTransactionFn = useServerFn(sendSignedTransaction);
  const simulateSwapTransactionFn = useServerFn(simulateSwapTransaction);
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

        const raw = toRawAmount(
          fromAmount,
          from.decimals,
        );

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

  const useMaxBalance = async () => {
    if (!walletAddress || !from) {
      toast.error("Connect Phantom first");
      return;
    }

    try {
      setMaxLoading(true);
      const balance = await walletBalanceFn({
        data: {
          owner: walletAddress,
          tokenMint: from.mint,
        },
      });

      let rawAmount = BigInt(balance.rawAmount);

      if (from.mint === TOKENS.SOL.mint) {
        const reserve = 10_000_000n;

        if (rawAmount <= reserve) {
          throw new Error(
            "Not enough SOL to use MAX. Keep at least 0.01 SOL available for fees.",
          );
        }

        rawAmount -= reserve;
      } else {
        if (rawAmount === 0n) {
          throw new Error(`No ${from.symbol} balance found in this wallet.`);
        }

        if (BigInt(balance.solLamports) < 3_000_000n) {
          throw new Error(
            "Add at least 0.003 SOL to cover network fees before selling MAX.",
          );
        }
      }

      setSwapState((prev) => ({
        ...prev,
        fromAmount: fromRawAmount(rawAmount.toString(), from.decimals),
      }));
    } catch (e: any) {
      toast.error(friendlyError(String(e?.message || "Unable to load wallet balance")));
    } finally {
      setMaxLoading(false);
    }
  };

  const findTokenByMint = async () => {
    const tokenMint = mintSearch.trim();

    if (!tokenMint) {
      toast.error("Paste a Solana token address first");
      return;
    }

    try {
      setMintSearching(true);
      const token = await tokenSearchFn({
        data: { tokenMint },
      });

      setSwapState((prev) => ({
        ...prev,
        to: token,
        fromAmount: "",
        toAmount: "",
      }));
      setQuote(null);
      setMintSearch("");
      toast.success(`${token.symbol} selected`);
    } catch (e: any) {
      toast.error(friendlyError(String(e?.message || "Token search failed")));
    } finally {
      setMintSearching(false);
    }
  };

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

      const simulation = await simulateSwapTransactionFn({
        data: { swapTransaction },
      });

      if (!simulation.ok) {
        throw new Error(simulation.error);
      }

      const {
        VersionedTransaction,
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

        const sent = await sendSignedTransactionFn({
          data: {
            signedTransaction:
              (globalThis as any).Buffer.from(
                signed.serialize(),
              ).toString("base64"),
          },
        });

        signature = sent.signature;
      }

      let confirmed = false;

      for (let attempt = 0; attempt < 20; attempt++) {
        const status = await swapStatusFn({
          data: { signature },
        });

        if (status.state === "failed") {
          throw new Error(
            `Transaction failed: ${status.error}`,
          );
        }

        if (status.state === "confirmed") {
          confirmed = true;
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1500),
        );
      }

      if (!confirmed) {
        throw new Error(
          `Transaction submitted but confirmation is still pending. Check Solscan: ${signature}`,
        );
      }

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
      const message = String(
        e?.message || "Swap failed",
      );
      const rejected =
        e?.code === 4001 ||
        /user rejected|rejected the request/i.test(message);

      if (!rejected) {
        console.error("Swap error:", e);
        toast.error(
          friendlyError(
            message,
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

        <div className="mb-4">
          <label className="block text-xs text-muted-foreground mb-1.5">
            Paste contract address to find a tradable token
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={mintSearch}
              onChange={(e) => setMintSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void findTokenByMint();
                }
              }}
              placeholder="Solana token address"
              aria-label="Solana token contract address"
              className="min-w-0 flex-1 rounded-xl bg-input border border-border px-3 py-2 text-sm outline-none focus:border-primary/60"
            />
            <button
              type="button"
              onClick={findTokenByMint}
              disabled={mintSearching}
              className="inline-flex items-center justify-center rounded-xl border border-border px-3 hover:bg-secondary/60 disabled:opacity-60"
              aria-label="Search token address"
            >
              {mintSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </button>
          </div>
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

        <div className="relative">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-label="Amount to swap"
            value={fromAmount}
            onChange={(e) => {
              const nextAmount = e.target.value.replace(",", ".");

              if (nextAmount === "" || /^\d*\.?\d*$/.test(nextAmount)) {
                setSwapState((p) => ({
                  ...p,
                  fromAmount: nextAmount,
                }));
              }
            }}
            className="w-full text-3xl bg-transparent pr-16"
            placeholder="0.00"
          />
          {walletAddress && (
            <button
              type="button"
              onClick={useMaxBalance}
              disabled={maxLoading}
              className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
            >
              {maxLoading ? "…" : "MAX"}
            </button>
          )}
        </div>

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

        <div className="mt-5 flex gap-3">
          {!walletAddress ? (
            <PhantomButton className="w-full" />
          ) : (
            <>
              <PhantomButton />

              <button
                type="button"
                onClick={executeSwap}
                disabled={
                  !quote ||
                  swapping ||
                  loading
                }
                className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm bg-[linear-gradient(90deg,#9945FF_0%,#14F195_100%)] text-white font-semibold rounded-xl shadow-md hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
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

    </div>
  );
}
