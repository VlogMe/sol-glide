import "@/lib/buffer-polyfill";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Loader2, Settings2, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { VersionedTransaction, Connection } from "@solana/web3.js";

import { TOKENS, type Token } from "@/lib/tokens";
import { getJupiterQuote, getJupiterSwap } from "@/lib/jupiter.functions";
import { TokenSelect } from "./TokenSelect";
import { PhantomButton, WALLET_DISCONNECT_EVENT, WALLET_CONNECT_EVENT } from "./PhantomButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Buffer } from "buffer";

const NORMAL_FEE_BPS = 50;
const PLATFORM_FEE_WALLET = "8FsSKh1dhgPvKTmnKvo9VJwshD3gqq7AbNeqUXaWrPp2";

function friendlyError(raw: string): string {
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}

function fmt(n: number, max = 6) {
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
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
    from: TOKENS[initialFrom] ?? TOKENS.SOL ?? Object.values(TOKENS)[0] ?? null,
    to: TOKENS[initialTo] ?? TOKENS.USDC ?? Object.values(TOKENS)[1] ?? Object.values(TOKENS)[0] ?? null,
    fromAmount: "",
    toAmount: "",
  });

  // Strong loading guard — never render token UI until both tokens are resolved.
  if (!swapState || !swapState.from || !swapState.to) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-400">
        Loading tokens and market data...
      </div>
    );
  }

  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quoteFn = useServerFn(getJupiterQuote);
  const swapFn = useServerFn(getJupiterSwap);
  const feeBps = NORMAL_FEE_BPS;

  const { from, to, fromAmount } = swapState;

  useEffect(() => {
    setQuote(null);
    setSwapState((prev) => ({ ...prev, toAmount: "" }));
    if (debounce.current) clearTimeout(debounce.current);
    const num = Number(fromAmount);
    if (!fromAmount || !isFinite(num) || num <= 0) return;
    debounce.current = setTimeout(async () => {
      try {
        setLoading(true);
        const raw = BigInt(Math.floor(num * 10 ** from.decimals)).toString();
        const q = await quoteFn({
          data: { inputMint: from.mint, outputMint: to.mint, amount: raw, slippageBps },
        });
        setQuote(q);
        if (q?.outAmount) {
          setSwapState((prev) => ({
            ...prev,
            toAmount: (Number(q.outAmount) / 10 ** to.decimals).toString(),
          }));
        }
      } catch (e: any) {
        console.error(e);
        toast.error(friendlyError(String(e?.message || "Failed to fetch quote")));
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [fromAmount, from.mint, to.mint, slippageBps, quoteFn, from.decimals, to.decimals]);

  useEffect(() => {
    const onDisconnect = () => {
      if (debounce.current) clearTimeout(debounce.current);
      setSwapState((prev) => ({ ...prev, fromAmount: "" }));
      setQuote(null);
      setLoading(false);
      setSwapping(false);
      setSlippageBps(50);
      setWalletAddress(null);
    };
    const onConnect = (e: Event) => {
      const addr = (e as CustomEvent).detail?.address;
      if (typeof addr === "string") setWalletAddress(addr);
    };
    window.addEventListener(WALLET_DISCONNECT_EVENT, onDisconnect);
    window.addEventListener(WALLET_CONNECT_EVENT, onConnect as EventListener);
    return () => {
      window.removeEventListener(WALLET_DISCONNECT_EVENT, onDisconnect);
      window.removeEventListener(WALLET_CONNECT_EVENT, onConnect as EventListener);
    };
  }, []);

  const outAmount = useMemo(() => {
    if (!quote?.outAmount) return "";
    return (Number(quote.outAmount) / 10 ** to.decimals).toString();
  }, [quote, to.decimals]);

  const priceImpact = quote?.priceImpactPct ? Number(quote.priceImpactPct) * 100 : 0;
  const routeLabels: string[] = Array.isArray(quote?.routePlan)
    ? quote.routePlan
        .map((r: any) => r?.swapInfo?.label)
        .filter((label: unknown): label is string => typeof label === "string" && label.length > 0)
    : [];
  const feeAmount = fromAmount ? Number(fromAmount) * (feeBps / 10_000) : 0;

  const flip = () => {
    setSwapState((prev) => ({
      from: prev.to!,
      to: prev.from!,
      fromAmount: prev.toAmount || "",
      toAmount: prev.fromAmount || "",
    }));
  };

  const executeSwap = async () => {
    if (!quote) {
      toast.error("No quote available");
      return;
    }

    const provider = (window as any).phantom?.solana ?? (window as any).solana;
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
      console.log("STEP 1 - after Jupiter response", res);

      console.log("Jupiter swap response:", res);

      console.log("STEP 2 - before transaction extraction");
      const swapTransaction = res?.swapTransaction;
      if (!swapTransaction || typeof swapTransaction !== "string") {
        throw new Error("Jupiter did not return a valid swap transaction");
      }

      console.log("STEP 3 - web3 imported statically");
      console.log("Before decode", {
        Buffer: typeof Buffer,
        BufferFrom: typeof Buffer?.from,
        globalBuffer: typeof globalThis.Buffer,
        globalBufferFrom: typeof globalThis.Buffer?.from,
        txLength: swapTransaction?.length,
      });
      const txBuffer = Buffer.from(swapTransaction, "base64");
      console.log("Decoded buffer", txBuffer.length);
      console.log("STEP 4 - before deserialize");
      const transaction = VersionedTransaction.deserialize(txBuffer);
      console.log("STEP 5 - after deserialize", transaction);


      let signature: string;
      const rpcUrl = (import.meta as any).env?.VITE_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");

      if (typeof provider.signAndSendTransaction === "function") {
        const result = await provider.signAndSendTransaction(transaction);
        signature = result?.signature ?? result;
      } else {
        const signed = await provider.signTransaction(transaction);
        signature = await connection.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });
      }

      await connection.confirmTransaction(signature, "confirmed");

      toast.success(
        <a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer" className="underline">
          Swap confirmed — view on Solscan
        </a>
      );

      setSwapState((prev) => ({ ...prev, fromAmount: "" }));
      setQuote(null);
    } catch (e: any) {
      console.error("Swap error:", e);
      if (e?.code !== 4001) {
        toast.error(friendlyError(String(e?.message || "Swap failed")));
      }
    } finally {
      setSwapping(false);
    }
  };


  const lowLiquidity = to.symbol === "SPDD" || priceImpact > 3;

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="glass rounded-3xl overflow-hidden shadow-[var(--shadow-card)] p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Swap</h2>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-xl hover:bg-secondary/60 transition-colors"
                aria-label="Slippage settings"
              >
                <Settings2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-card border-border">
              <div className="text-sm font-medium mb-2">Slippage tolerance</div>
              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 200].map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSlippageBps(b)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      slippageBps === b
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary hover:bg-secondary/70 border-border"
                    }`}
                  >
                    {b / 100}%
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={slippageBps}
                  onChange={(e) => setSlippageBps(Number(e.target.value))}
                  className="w-20 rounded-lg bg-input border border-border px-2 py-1 text-sm outline-none focus:border-primary/60"
                />
                <span className="text-xs text-muted-foreground">bps</span>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                You pay
              </span>
              <TokenSelect value={from} onChange={(t) => setSwapState((prev) => ({ ...prev, from: t }))} />
            </div>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.000001}
              value={fromAmount}
              onChange={(e) => setSwapState((prev) => ({ ...prev, fromAmount: e.target.value }))}
              placeholder="0.00"
              className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="flex justify-center -my-3 relative z-10">
            <button
              type="button"
              onClick={flip}
              className="p-2 rounded-xl bg-card border border-border shadow-sm hover:bg-secondary/60 transition-colors"
              aria-label="Flip tokens"
            >
              <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                You receive
              </span>
              <TokenSelect value={to} onChange={(t) => setSwapState((prev) => ({ ...prev, to: t }))} />
            </div>
            <input
              type="text"
              readOnly
              value={outAmount ? fmt(Number(outAmount), 8) : ""}
              placeholder="0.00"
              className="w-full bg-transparent text-3xl font-semibold outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {quote && (
          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Price impact</span>
              <span className={priceImpact > 3 ? "text-yellow-400" : ""}>
                {priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Platform fee</span>
              <span>
                {feeBps / 100}% ({fmt(feeAmount, 6)} {from.symbol})
              </span>
            </div>
            {routeLabels.length > 0 && (
              <div className="flex items-center justify-between">
                <span>Route</span>
                <span className="text-right truncate max-w-[60%]">{routeLabels.join(" → ")}</span>
              </div>
            )}
          </div>
        )}

        {lowLiquidity && (
          <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 flex items-start gap-2 text-xs text-yellow-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Low liquidity — high slippage expected. Trade small amounts.
            </span>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          {!walletAddress ? (
            <PhantomButton className="w-full" />
          ) : (
            <>
              <PhantomButton className="shrink-0" />
              <button
                type="button"
                onClick={executeSwap}
                disabled={!quote || swapping || loading}
                className="flex-1 bg-[linear-gradient(90deg,#9945FF_0%,#14F195_100%)] text-white font-semibold rounded-xl px-4 py-3 shadow-md hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {swapping ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Swapping…
                  </span>
                ) : !quote ? (
                  "Enter an amount"
                ) : (
                  "Swap Now"
                )}
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Swaps execute through Jupiter. A 0.5% platform fee is collected by SOLPITCH. Hold 1M
            $SPDD for 0.3% fee.
          </span>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-3">
        Powered by Jupiter · Platform fee wallet {PLATFORM_FEE_WALLET.slice(0, 6)}…
      </p>
    </div>
  );
}
