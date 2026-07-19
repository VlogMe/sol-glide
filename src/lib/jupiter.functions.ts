import { createServerFn } from "@tanstack/react-start";

const JUPITER = () => process.env.JUPITER_API_URL || "https://quote-api.jup.ag/v6";

export type QuoteInput = {
  inputMint: string;
  outputMint: string;
  amount: string; // raw integer string
  slippageBps: number;
};

export const getJupiterQuote = createServerFn({ method: "POST" })
  .inputValidator((d: QuoteInput) => d)
  .handler(async ({ data }) => {
    const url = new URL(`${JUPITER()}/quote`);
    url.searchParams.set("inputMint", data.inputMint);
    url.searchParams.set("outputMint", data.outputMint);
    url.searchParams.set("amount", data.amount);
    url.searchParams.set("slippageBps", String(data.slippageBps));
    url.searchParams.set("onlyDirectRoutes", "false");
    url.searchParams.set("asLegacyTransaction", "false");
    const res = await fetch(url.toString());
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Jupiter quote failed: ${res.status} ${t}`);
    }
    return (await res.json()) as any;
  });

export type SwapInput = {
  quoteResponse: any;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
};

export const getJupiterSwap = createServerFn({ method: "POST" })
  .inputValidator((d: SwapInput) => d)
  .handler(async ({ data }) => {
    const res = await fetch(`${JUPITER()}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: data.quoteResponse,
        userPublicKey: data.userPublicKey,
        wrapAndUnwrapSol: data.wrapAndUnwrapSol ?? true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Jupiter swap failed: ${res.status} ${t}`);
    }
    return (await res.json()) as { swapTransaction: string; lastValidBlockHeight: number };
  });

export const getRpcUrl = createServerFn({ method: "GET" }).handler(async () => {
  return { url: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com" };
});
