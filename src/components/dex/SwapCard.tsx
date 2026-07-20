import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Loader2, Settings2, Info } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { TOKENS, type Token } from "@/lib/tokens";
import { getJupiterQuote, getJupiterSwap } from "@/lib/jupiter.functions";
import { TokenSelect } from "./TokenSelect";
import { PhantomButton, WALLET_DISCONNECT_EVENT, WALLET_CONNECT_EVENT } from "./PhantomButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const NORMAL_FEE_BPS = 50;

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
  const [from, setFrom] = useState<Token>(TOKENS[initialFrom] ?? TOKENS.SOL);
  const [to, setTo] = useState<Token>(TOKENS[initialTo] ?? TOKENS.USDC);
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState(50);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quoteFn = useServerFn(getJupiterQuote);
  const swapFn = useServerFn(getJupiterSwap);

  const feeBps = NORMAL_FEE_BPS;

  useEffect(() => {
    setQuote(null);
    if (debounce.current) clearTimeout(debounce.current);
    const num = Number(amount);
    if (!amount || !isFinite(num) || num <= 0) return;
    debounce.current = setTimeout(async () => {
      try {
        setLoading(true);
        const raw = BigInt(Math.floor(num * 10 ** from.decimals)).toString();
        const q = await quoteFn({
          data: {
            inputMint: from.mint,
            outputMint: to.mint,
            amount: raw,
            slippageBps,
          },
        });
        setQuote(q);
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
  }, [amount, from.mint, to.mint, slippageBps, quoteFn, from.decimals]);

  // Fully reset swap UI when the wallet disconnects: clear amount, quote,
  // route info, loading flag, and any in-flight debounce.
  useEffect(() => {
    const onDisconnect = () => {
      if (debounce.current) clearTimeout(debounce.current);
      setAmount("");
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

  const feeAmount = amount ? Number(amount) * (feeBps / 10_000) : 0;

  const flip = () => {
    setFrom(to);
    setTo(from);
    setAmount(outAmount || "");
  };

  return (
    <div className="glass rounded-3xl p-5 md:p-6 shadow-[var(--shadow-card)] w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-semibold">Swap</h3>
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
          <span>Low liquidity / bonding-curve token — trade carefully.</span>
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
          <Row label="Platform fee (0.50%)">
            {fmt(feeAmount)} {from.symbol}
          </Row>
          {routeLabels.length > 0 && (
            <Row label="Route">
              <span className="text-right">{routeLabels.join(" → ")}</span>
            </Row>
          )}
        </div>
      )}


      <div className="mt-4">
        <PhantomButton className="w-full py-3 text-base" />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Info className="h-3 w-3" /> Non-custodial · 0.5% Platform Fee
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
