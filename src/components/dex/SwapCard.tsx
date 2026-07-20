import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Loader2, Settings2, Info, RefreshCw } from "lucide-react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { TOKENS, type Token } from "@/lib/tokens";
import { getJupiterQuote, getJupiterSwap, logSwap, getSpddTier } from "@/lib/jupiter.functions";
import { TokenSelect } from "./TokenSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WalletButton } from "./WalletButton";

function friendlyError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("rate limit")) return raw;
  if (s.includes("0x1") || s.includes("insufficient") || s.includes("insufficient lamports"))
    return "Insufficient funds for this swap (including network fees).";
  if (s.includes("slippage") || s.includes("6001") || s.includes("0x1771"))
    return "Price moved beyond your slippage tolerance. Increase slippage or try again.";
  if (s.includes("blockhash") || s.includes("expired") || s.includes("block height exceeded"))
    return "Transaction expired before confirmation. Please retry.";
  if (s.includes("timeout") || s.includes("timed out") || s.includes("failed to fetch"))
    return "Network timeout talking to Solana RPC. Please retry.";
  if (s.includes("user rejected") || s.includes("rejected the request"))
    return "You rejected the transaction in your wallet.";
  if (s.includes("could not find any route") || s.includes("no route"))
    return "No route available for this pair right now.";
  return raw.length > 160 ? raw.slice(0, 160) + "…" : raw;
}


const NORMAL_FEE_BPS = 50;
const VIP_FEE_BPS = 30;

const DEBUG_SWAP =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_DEBUG_SWAP === "true") ||
  (typeof window !== "undefined" && (window as any).__SOLPITCH_DEBUG_SWAP === true) ||
  (typeof localStorage !== "undefined" && localStorage.getItem("solpitch:debug-swap") === "1");

function debugLog(label: string, payload: Record<string, unknown>) {
  if (!DEBUG_SWAP) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`[SwapCard:debug] ${label}`, payload);
  } catch {
    /* noop */
  }
}

function fmt(n: number, max = 6) {
  if (!isFinite(n)) return "0";
  if (n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: max });
}

export function SwapCard({ initialFrom = "SOL", initialTo = "USDC" }: { initialFrom?: string; initialTo?: string }) {
  const [from, setFrom] = useState<Token>(TOKENS[initialFrom] ?? TOKENS.SOL);
  const [to, setTo] = useState<Token>(TOKENS[initialTo] ?? TOKENS.USDC);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50); // 0.5%
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { publicKey, signTransaction, connected } = useWallet();
  const connectionState = useConnection();
  const connection = connectionState?.connection ?? null;
  const quoteFn = useServerFn(getJupiterQuote);
  const swapFn = useServerFn(getJupiterSwap);
  const logFn = useServerFn(logSwap);
  const tierFn = useServerFn(getSpddTier);
  const [lastError, setLastError] = useState<string | null>(null);
  const [tier, setTier] = useState<{ isVip: boolean; balance: number; feeBps: number } | null>(null);

  // Check SPDD tier on wallet connect
  useEffect(() => {
    if (!connected || !publicKey) {
      setTier(null);
      return;
    }
    const pk = publicKey.toBase58();
    tierFn({ data: { userPublicKey: pk } })
      .then((t) => setTier(t))
      .catch(() => setTier(null));
  }, [connected, publicKey, tierFn]);

  const feeBps = tier?.feeBps ?? NORMAL_FEE_BPS;
  const isVip = !!tier?.isVip;

  useEffect(() => {
    setQuote(null);
    setLastError(null);
    if (debounce.current) clearTimeout(debounce.current);
    const num = Number(amount);
    if (!amount || !isFinite(num) || num <= 0) return;
    debounce.current = setTimeout(async () => {
      try {
        setLoading(true);
        const raw = BigInt(Math.floor(num * 10 ** from.decimals)).toString();
        debugLog("quote:request", {
          amount,
          rawAmount: raw,
          inputMint: from.mint,
          inputSymbol: from.symbol,
          outputMint: to.mint,
          outputSymbol: to.symbol,
          slippageBps,
          userPublicKey: connected && publicKey ? publicKey.toBase58() : null,
        });
        const q = await quoteFn({
          data: {
            inputMint: from.mint,
            outputMint: to.mint,
            amount: raw,
            slippageBps,
            ...(connected && publicKey ? { userPublicKey: publicKey.toBase58() } : {}),
          },
        });
        debugLog("quote:response", {
          outAmount: q?.outAmount,
          priceImpactPct: q?.priceImpactPct,
          routePlanCount: Array.isArray(q?.routePlan) ? q.routePlan.length : 0,
          hasRoutePlan: Array.isArray(q?.routePlan),
        });
        setQuote(q);
      } catch (e: any) {
        console.error(e);
        const msg = friendlyError(String(e?.message || "Failed to fetch quote"));
        setLastError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [amount, from.mint, to.mint, slippageBps, quoteFn, from.decimals, connected, publicKey, isVip]);

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

  const feeAmount = amount ? Number(amount) * (feeBps / 10_000) : 0;

  const flip = () => {
    setFrom(to);
    setTo(from);
    setAmount(outAmount || "");
  };

  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!connection?.sendRawTransaction || !connection?.getLatestBlockhash || !connection?.confirmTransaction) {
      const msg = "Solana connection is still loading. Please try again.";
      setLastError(msg);
      toast.error(msg);
      return;
    }
    if (!quote) return;
    setLastError(null);
    try {
      setSwapping(true);
      let swapTransaction: string | undefined;
      try {
        const res = await swapFn({
          data: { quoteResponse: quote, userPublicKey: publicKey.toBase58() },
        });
        swapTransaction = res?.swapTransaction;
      } catch (err) {
        console.error("swapFn failed", err);
        throw new Error("Failed to prepare swap. Please try again.");
      }
      if (!swapTransaction || typeof swapTransaction !== "string") {
        throw new Error("Failed to prepare swap. Please try again.");
      }
      let tx: any;
      try {
        await import("@/lib/buffer-polyfill");
        const { VersionedTransaction } = await import("@solana/web3.js");
        const buf = Uint8Array.from(atob(swapTransaction), (c) => c.charCodeAt(0));
        tx = VersionedTransaction.deserialize(buf);
      } catch (err) {
        console.error("deserialize failed", err);
        throw new Error("Failed to prepare swap. Please try again.");
      }
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      toast.success("Swap submitted", {
        description: sig.slice(0, 8) + "…",
        action: {
          label: "View",
          onClick: () => window.open(`https://solscan.io/tx/${sig}`, "_blank"),
        },
      });
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      toast.success("Swap confirmed ✔");
      logFn({
        data: {
          signature: sig,
          inputMint: from.mint,
          outputMint: to.mint,
          inAmount: String(quote.inAmount ?? ""),
          outAmount: String(quote.outAmount ?? ""),
        },
      }).catch(() => {});
      setAmount("");
      setQuote(null);
    } catch (e: any) {
      console.error(e);
      const msg = friendlyError(String(e?.message || "Swap failed"));
      setLastError(msg);
      toast.error(msg);
    } finally {
      setSwapping(false);
    }
  };


  const disabled = !amount || !quote || loading || swapping;

  return (
    <div className="glass rounded-3xl p-5 md:p-6 shadow-[var(--shadow-card)] w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg font-semibold">Swap</h3>
          {isVip ? (
            <span
              title={`SPDD balance: ${tier?.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })} — 0.30% VIP fee active (40% discount)`}
              className="inline-flex items-center gap-1 rounded-full border border-success/50 bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-success shadow-[0_0_12px_hsl(var(--success)/0.35)]"
            >
              ★ VIP · SPDD 0.30%
            </span>
          ) : (
            <span
              title="Hold 100,000+ $SPDD for 0.30% fee (40% discount)"
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground cursor-help"
            >
              Hold 100k SPDD → 0.30%
            </span>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-secondary/60 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-card border-border">
            <div className="text-sm font-medium mb-2">Slippage tolerance</div>
            <div className="flex gap-2">
              {[10, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setSlippageBps(v)}
                  className={`flex-1 py-1.5 rounded-lg text-sm border ${slippageBps === v ? "bg-primary text-primary-foreground border-transparent" : "border-border hover:bg-secondary/60"}`}
                >
                  {v / 100}%
                </button>
              ))}
              <input
                type="number"
                value={slippageBps / 100}
                onChange={(e) => setSlippageBps(Math.max(1, Math.round(Number(e.target.value) * 100)))}
                className="w-16 rounded-lg bg-input border border-border px-2 text-sm"
              />
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {(from.warn || to.warn) && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Low liquidity / bonding-curve token — trade carefully. Price impact and slippage may be high.
          </span>
        </div>
      )}

      <div className="space-y-2">
        <div className="rounded-2xl bg-secondary/40 border border-border p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>You pay</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              placeholder="0.00"
              className="bg-transparent flex-1 text-3xl font-semibold outline-none min-w-0"
            />
            <TokenSelect value={from} onChange={setFrom} />
          </div>
        </div>

        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={flip}
            className="h-10 w-10 grid place-items-center rounded-xl bg-card border border-border hover:border-primary/60 transition-colors"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-2xl bg-secondary/40 border border-border p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>You receive</span>
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>
          <div className="flex items-center gap-3">
            <input
              readOnly
              value={outAmount ? fmt(Number(outAmount)) : ""}
              placeholder="0.00"
              className="bg-transparent flex-1 text-3xl font-semibold outline-none min-w-0"
            />
            <TokenSelect value={to} onChange={setTo} />
          </div>
        </div>
      </div>

      {quote && (
        <div className="mt-4 space-y-2 text-sm">
          <Row label="Rate">
            1 {from.symbol} ≈ {fmt(Number(outAmount) / Number(amount || "1"))} {to.symbol}
          </Row>
          <Row label="Price impact">
            <span className={priceImpact > 1 ? "text-destructive" : "text-success"}>
              {priceImpact < 0.01 ? "<0.01%" : priceImpact.toFixed(2) + "%"}
            </span>
          </Row>
          <Row label="Slippage">{(slippageBps / 100).toFixed(2)}%</Row>
          <Row label={isVip ? "VIP fee (0.30%)" : "Platform fee (0.50%)"}>
            <span className={isVip ? "text-success font-medium" : undefined}>
              {fmt(feeAmount)} {from.symbol}
            </span>
          </Row>
          {routeLabels.length > 0 && (
            <Row label="Route">
              <span className="text-right">{routeLabels.join(" → ")}</span>
            </Row>
          )}
        </div>
      )}

      <div className="mt-5">
        {!connected ? (
          <div className="[&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!h-12 [&_.wallet-adapter-button]:!justify-center [&_.wallet-adapter-button]:!rounded-2xl [&_.wallet-adapter-button]:!bg-[image:var(--grad-primary)] [&_.wallet-adapter-button]:!text-primary-foreground [&_.wallet-adapter-button]:!font-semibold [&_.wallet-adapter-button]:!text-base">
            <WalletButton>Connect Wallet</WalletButton>
          </div>
        ) : (
          <button
            onClick={handleSwap}
            disabled={disabled}
            className="w-full h-12 rounded-2xl bg-[image:var(--grad-primary)] text-primary-foreground font-semibold text-base disabled:opacity-50 disabled:cursor-not-allowed glow transition-transform active:scale-[0.99]"
          >
            {swapping ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Swapping…
              </span>
            ) : loading ? (
              "Fetching best route…"
            ) : !amount ? (
              "Enter an amount"
            ) : !quote ? (
              "No route"
            ) : (
              `Swap ${from.symbol} → ${to.symbol}`
            )}
          </button>
        )}
      </div>

      {lastError && (
        <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="flex-1">{lastError}</div>
          <button
            onClick={() => {
              setLastError(null);
              setAmount((a) => a);
              if (connected && quote) handleSwap();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 hover:bg-destructive/20"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3 w-3" /> Non-custodial ·{" "}
          {isVip ? (
            <span className="text-success font-medium">0.3% VIP Fee (SPDD Holder)</span>
          ) : (
            <>0.5% Platform Fee</>
          )}
        </span>
        <a
          href="https://jup.ag"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-0.5 hover:border-primary/60"
        >
          Powered by Jupiter
        </a>
      </div>

    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}
