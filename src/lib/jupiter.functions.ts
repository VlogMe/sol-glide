import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const JUPITER = () =>
  process.env.JUPITER_BASE ||
  process.env.VITE_JUPITER_BASE ||
  process.env.JUPITER_API_URL ||
  "https://lite-api.jup.ag/swap/v1";

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

const JUP_UNREACHABLE = "Unable to get quote. Please try again.";

const PLATFORM_FEE_BPS = 50; // 0.5%
const VIP_FEE_BPS = 30; // 0.3% for SPDD holders
const SPDD_MINT = "C99rtU8RADKAUN1f8avP4gkLtZQu3zbZejsCrGBMpump";
const SPDD_VIP_THRESHOLD = 1_000_000; // whole tokens
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

// VIP proof: caller must sign a fixed message with their wallet to prove
// ownership of the address whose SPDD balance is checked. Without this, any
// caller could reference a whale wallet to claim the discounted fee.
const VipProofSchema = z.object({
  publicKey: mint,
  // ed25519 signature over the message, base58-encoded (64 bytes)
  signature: z.string().regex(base58, "Invalid signature"),
  // Client-supplied nonce/timestamp incorporated into the signed message
  nonce: z.string().min(8).max(128),
});

const QuoteSchema = z.object({
  inputMint: mint,
  outputMint: mint,
  amount,
  slippageBps: z.number().int().min(1).max(5000),
  vipProof: VipProofSchema.optional(),
});

const SwapSchema = z.object({
  quoteResponse: z.record(z.any()),
  userPublicKey: mint,
  wrapAndUnwrapSol: z.boolean().optional(),
});

export type QuoteInput = z.infer<typeof QuoteSchema>;
export type SwapInput = z.infer<typeof SwapSchema>;

export const VIP_MESSAGE_PREFIX = "SOLPITCH-VIP:";

async function verifyVipProof(proof: z.infer<typeof VipProofSchema>): Promise<string | null> {
  try {
    const nacl = (await import("tweetnacl")).default;
    const bs58 = (await import("bs58")).default;
    const message = new TextEncoder().encode(`${VIP_MESSAGE_PREFIX}${proof.nonce}`);
    const sig = bs58.decode(proof.signature);
    const pub = bs58.decode(proof.publicKey);
    if (sig.length !== 64 || pub.length !== 32) return null;
    const ok = nacl.sign.detached.verify(message, sig, pub);
    return ok ? proof.publicKey : null;
  } catch {
    return null;
  }
}

export const getJupiterQuote = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => QuoteSchema.parse(d))
  .handler(async ({ data }) => {
    rateLimit("quote");
    const verifiedOwner = data.vipProof ? await verifyVipProof(data.vipProof) : null;
    const feeBps = await feeBpsForOwner(verifiedOwner ?? undefined);
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
    let res: Response;
    try {
      res = await fetchWithTimeout(url.toString(), { headers: { accept: "application/json" } });
    } catch {
      throw new Error(JUP_UNREACHABLE);
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status >= 500) throw new Error(JUP_UNREACHABLE);
      throw new Error(`Jupiter quote failed: ${res.status} ${t.slice(0, 200)}`);
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
    let res: Response;
    try {
      res = await fetchWithTimeout(`${JUPITER()}/swap`, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      console.error("jupiter swap fetch failed", e?.message || e);
      throw new Error(JUP_UNREACHABLE);
    }
    const raw = await res.text();
    if (!res.ok) {
      console.error("jupiter swap non-ok", res.status, raw.slice(0, 500));
      if (res.status >= 500) throw new Error(JUP_UNREACHABLE);
      // Surface Jupiter's error message (e.g. simulation failure, insufficient funds)
      let detail = raw.slice(0, 300);
      try {
        const j = JSON.parse(raw);
        detail = j.error || j.message || j.errorCode || detail;
      } catch {}
      throw new Error(`Jupiter swap failed (${res.status}): ${detail}`);
    }
    let json: any;
    try {
      json = JSON.parse(raw);
    } catch {
      console.error("jupiter swap invalid JSON", raw.slice(0, 500));
      throw new Error("Jupiter returned invalid response. Please try again.");
    }
    if (!json?.swapTransaction || typeof json.swapTransaction !== "string") {
      console.error("jupiter swap missing swapTransaction", json);
      throw new Error(
        `Jupiter did not return a swap transaction${json?.error ? `: ${json.error}` : ""}. Please try again.`,
      );
    }
    return json as { swapTransaction: string; lastValidBlockHeight: number };
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


// Resolve any Solana token by mint. Tries Jupiter token metadata first,
// then falls back to RPC getTokenSupply so bonding-curve / low-liq mints still work.
export const resolveTokenByMint = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ mint: mint }).parse(d))
  .handler(async ({ data }) => {
    rateLimit("resolve");
    const headers = { accept: "application/json" };

    // 1) Jupiter Lite token metadata (current endpoint)
    try {
      const r = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${data.mint}`, { headers });
      if (r.ok) {
        const j: any = await r.json();
        const addr = j?.address || j?.mint;
        if (addr) {
          return {
            symbol: j.symbol || data.mint.slice(0, 4),
            name: j.name || "Unknown token",
            mint: addr,
            decimals: Number(j.decimals ?? 0),
            logoURI: j.logoURI || j.logo_uri || "",
            warn: false,
            source: "jupiter" as const,
          };
        }
      }
    } catch {}

    // 2) Jupiter Lite search fallback
    try {
      const r = await fetch(
        `https://lite-api.jup.ag/tokens/v1/search?query=${encodeURIComponent(data.mint)}`,
        { headers },
      );
      if (r.ok) {
        const j: any = await r.json();
        const list: any[] = Array.isArray(j) ? j : (j?.tokens ?? j?.data ?? []);
        const hit = list.find((t) => (t?.address || t?.mint) === data.mint) || list[0];
        const addr = hit?.address || hit?.mint;
        if (hit && addr === data.mint) {
          return {
            symbol: hit.symbol || data.mint.slice(0, 4),
            name: hit.name || "Unknown token",
            mint: addr,
            decimals: Number(hit.decimals ?? 0),
            logoURI: hit.logoURI || hit.logo_uri || "",
            warn: false,
            source: "jupiter" as const,
          };
        }
      }
    } catch {}

    // 3) RPC fallback — decimals only, treat as untrusted / low-liquidity
    try {
      const res = await fetch(RPC(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenSupply",
          params: [data.mint],
        }),
      });
      const j: any = await res.json();
      const decimals = j?.result?.value?.decimals;
      if (typeof decimals === "number") {
        return {
          symbol: data.mint.slice(0, 4).toUpperCase(),
          name: `Custom ${data.mint.slice(0, 4)}…${data.mint.slice(-4)}`,
          mint: data.mint,
          decimals,
          logoURI: "",
          warn: true,
          source: "rpc" as const,
        };
      }
    } catch {}

    throw new Error("Token not found. Check the mint address.");
  });
