import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const JUPITER = () =>
  process.env.JUPITER_BASE ||
  process.env.VITE_JUPITER_BASE ||
  process.env.JUPITER_API_URL ||
  "https://quote-api.jup.ag/v6";

const PLATFORM_FEE_BPS = 50; // 0.5%
const VIP_FEE_BPS = 30; // 0.3% for SPDD holders
const SPDD_MINT = "C99rtU8RADKAUN1f8avP4gkLtZQu3zbZejsCrGBMpump";
const SPDD_VIP_THRESHOLD = 100_000; // whole tokens
const PLATFORM_FEE_WALLET = () => process.env.PLATFORM_FEE_WALLET || "";

const RPC = () =>
  process.env.RPC_URL ||
  process.env.VITE_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

async function getSpddBalance(owner: string): Promise<number> {
  try {
    const res = await fetch(RPC(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [owner, { mint: SPDD_MINT }, { encoding: "jsonParsed" }],
      }),
    });
    const j: any = await res.json();
    const accounts = j?.result?.value ?? [];
    let total = 0;
    for (const a of accounts) {
      const ui = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof ui === "number") total += ui;
    }
    return total;
  } catch {
    return 0;
  }
}

async function feeBpsForOwner(owner?: string): Promise<number> {
  if (!owner) return PLATFORM_FEE_BPS;
  const bal = await getSpddBalance(owner);
  return bal >= SPDD_VIP_THRESHOLD ? VIP_FEE_BPS : PLATFORM_FEE_BPS;
}

// -------- Rate limiting (in-memory, per worker instance) --------
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

function rateLimit(kind: string) {
  let ip = "unknown";
  try {
    ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      getRequestIP({ xForwardedFor: true }) ||
      "unknown";
  } catch {}
  const key = `${kind}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  b.count += 1;
  if (b.count > MAX_PER_WINDOW) {
    throw new Error(`Rate limit exceeded — try again in ${Math.ceil((b.resetAt - now) / 1000)}s`);
  }
  // Opportunistic cleanup
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }
}

// -------- Validation --------
const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const mint = z.string().regex(base58, "Invalid mint address");
const amount = z.string().regex(/^[0-9]+$/, "Amount must be a positive integer (raw units)").max(30);

const QuoteSchema = z.object({
  inputMint: mint,
  outputMint: mint,
  amount,
  slippageBps: z.number().int().min(1).max(5000),
  userPublicKey: mint.optional(),
});

const SwapSchema = z.object({
  quoteResponse: z.record(z.any()),
  userPublicKey: mint,
  wrapAndUnwrapSol: z.boolean().optional(),
});

export type QuoteInput = z.infer<typeof QuoteSchema>;
export type SwapInput = z.infer<typeof SwapSchema>;

export const getJupiterQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => QuoteSchema.parse(d))
  .handler(async ({ data }) => {
    rateLimit("quote");
    const feeBps = await feeBpsForOwner(data.userPublicKey);
    const url = new URL(`${JUPITER()}/quote`);
    url.searchParams.set("inputMint", data.inputMint);
    url.searchParams.set("outputMint", data.outputMint);
    url.searchParams.set("amount", data.amount);
    url.searchParams.set("slippageBps", String(data.slippageBps));
    url.searchParams.set("onlyDirectRoutes", "false");
    url.searchParams.set("asLegacyTransaction", "false");
    if (PLATFORM_FEE_WALLET()) {
      url.searchParams.set("platformFeeBps", String(feeBps));
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Jupiter quote failed: ${res.status} ${t}`);
    }
    const json = (await res.json()) as any;
    return { ...json, _feeBps: feeBps };
  });

export const getJupiterSwap = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SwapSchema.parse(d))
  .handler(async ({ data }) => {
    rateLimit("swap");
    // Strip our internal marker before forwarding to Jupiter
    const { _feeBps, ...cleanQuote } = data.quoteResponse as any;
    const body: Record<string, unknown> = {
      quoteResponse: cleanQuote,
      userPublicKey: data.userPublicKey,
      wrapAndUnwrapSol: data.wrapAndUnwrapSol ?? true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    };
    if (PLATFORM_FEE_WALLET()) {
      body.feeAccount = PLATFORM_FEE_WALLET();
    }
    const res = await fetch(`${JUPITER()}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Jupiter swap failed: ${res.status} ${t}`);
    }
    return (await res.json()) as { swapTransaction: string; lastValidBlockHeight: number };
  });

export const getSpddTier = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ userPublicKey: mint }).parse(d))
  .handler(async ({ data }) => {
    const balance = await getSpddBalance(data.userPublicKey);
    const isVip = balance >= SPDD_VIP_THRESHOLD;
    return {
      balance,
      isVip,
      feeBps: isVip ? VIP_FEE_BPS : PLATFORM_FEE_BPS,
      threshold: SPDD_VIP_THRESHOLD,
    };
  });


export const logSwap = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        signature: z.string().min(20).max(120),
        inputMint: mint,
        outputMint: mint,
        inAmount: z.string().max(30),
        outAmount: z.string().max(30),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    console.log(
      JSON.stringify({
        evt: "swap_success",
        ts: new Date().toISOString(),
        ...data,
      }),
    );
    return { ok: true };
  });

export const rpcProxy = createServerFn({ method: "POST" })
  .inputValidator((d: { body: string }) => d)
  .handler(async ({ data }) => {
    const res = await fetch(
      process.env.RPC_URL ||
        process.env.VITE_RPC_URL ||
        process.env.SOLANA_RPC_URL ||
        "https://api.mainnet-beta.solana.com",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: data.body },
    );
    const text = await res.text();
    return { status: res.status, body: text };
  });

export const getRpcUrl = createServerFn({ method: "GET" }).handler(async () => {
  return { url: "/api/rpc" };
});
