import { createServerFn } from "@tanstack/react-start";
import {
  getRequestIP,
  getRequestHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";

const JUPITER = () =>
  process.env.JUPITER_BASE ||
  process.env.VITE_JUPITER_BASE ||
  process.env.JUPITER_API_URL ||
  "https://lite-api.jup.ag/swap/v1";

const SOLANA_RPC = () =>
  process.env.SOLANA_RPC_URL;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = 12000,
): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);

  try {
    return await fetch(url, {
      ...init,
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function solanaRpc<T>(
  method: string,
  params: unknown[],
): Promise<T> {
  const rpcUrl = SOLANA_RPC();

  if (!rpcUrl) {
    throw new Error("Solana RPC is not configured");
  }

  const response = await fetchWithTimeout(
    rpcUrl,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Solana RPC failed (${response.status})`);
  }

  const json = await response.json() as {
    result?: T;
    error?: { message?: string };
  };

  if (json.error) {
    throw new Error(
      json.error.message || "Solana RPC request failed",
    );
  }

  return json.result as T;
}

const JUP_UNREACHABLE =
  "Unable to get quote. Please try again.";

// ---------------- RATE LIMIT ----------------

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets =
  new Map<string, Bucket>();

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;


function rateLimit(
  kind: string,
) {
  let ip = "unknown";

  try {
    ip =
      getRequestHeader(
        "cf-connecting-ip",
      ) ||
      getRequestHeader(
        "x-forwarded-for",
      )
        ?.split(",")[0]
        ?.trim() ||
      getRequestIP({
        xForwardedFor: true,
      }) ||
      "unknown";
  } catch {}

  const key =
    `${kind}:${ip}`;

  const now =
    Date.now();

  const bucket =
    buckets.get(key);

  if (
    !bucket ||
    bucket.resetAt < now
  ) {
    buckets.set(key, {
      count: 1,
      resetAt: now + WINDOW_MS,
    });

    return;
  }

  bucket.count++;

  if (
    bucket.count >
    MAX_PER_WINDOW
  ) {
    throw new Error(
      `Rate limit exceeded — try again in ${Math.ceil(
        (bucket.resetAt - now) / 1000,
      )}s`,
    );
  }

  if (
    buckets.size > 5000
  ) {
    for (
      const [
        key,
        value,
      ] of buckets
    ) {
      if (
        value.resetAt < now
      ) {
        buckets.delete(key);
      }
    }
  }
}


// ---------------- VALIDATION ----------------

const base58 =
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const mint =
  z.string().regex(
    base58,
    "Invalid mint address",
  );

const amount =
  z.string()
    .regex(
      /^[0-9]+$/,
      "Amount must be raw units",
    )
    .max(30);


const QuoteSchema =
  z.object({
    inputMint: mint,
    outputMint: mint,
    amount,
    slippageBps:
      z.number()
        .int()
        .min(1)
        .max(5000),

  });


const SwapSchema =
  z.object({
    quoteResponse:
      z.record(
        z.any(),
      ),

    userPublicKey:
      mint,

    wrapAndUnwrapSol:
      z.boolean()
        .optional(),
  });


export type QuoteInput =
  z.infer<typeof QuoteSchema>;

export type SwapInput =
  z.infer<typeof SwapSchema>;

const signature =
  z.string().regex(
    /^[1-9A-HJ-NP-Za-km-z]{64,100}$/,
    "Invalid transaction signature",
  );

const signedTransaction =
  z.string()
    .min(100)
    .max(20_000)
    .regex(
      /^[A-Za-z0-9+/]+={0,2}$/,
      "Invalid signed transaction",
    );

function simulationError(
  err: unknown,
  logs: string[],
) {
  const detail = `${JSON.stringify(err)} ${logs.join(" ")}`;

  if (/AccountNotFound/i.test(detail)) {
    return "The connected Phantom account is not funded on Solana. Switch to the funded account or deposit SOL, then reconnect.";
  }

  if (/InsufficientFundsForFee/i.test(detail)) {
    return "Not enough SOL to cover this swap and its network fees. Reduce the amount or add more SOL.";
  }

  if (/insufficient funds|insufficient lamports/i.test(detail)) {
    return "Insufficient SOL or token balance for this swap and network fees.";
  }

  if (/slippage|0x1771|6001/i.test(detail)) {
    return "The price moved beyond your slippage setting. Refresh the quote and try again.";
  }

  if (/blockhash not found/i.test(detail)) {
    return "The swap quote expired. Refresh the quote and try again.";
  }

  return `Transaction simulation failed: ${JSON.stringify(err)}`;
}

export const getJupiterQuote =
  createServerFn({
    method: "POST",
  })
    .inputValidator(
      (d: unknown) =>
        QuoteSchema.parse(d),
    )
    .handler(
      async ({
        data,
      }) => {
        rateLimit("quote");

        const url =
          new URL(
            `${JUPITER()}/quote`,
          );


        url.searchParams.set(
          "inputMint",
          data.inputMint,
        );

        url.searchParams.set(
          "outputMint",
          data.outputMint,
        );

        url.searchParams.set(
          "amount",
          data.amount,
        );

        url.searchParams.set(
          "slippageBps",
          String(
            data.slippageBps,
          ),
        );

        url.searchParams.set(
          "onlyDirectRoutes",
          "false",
        );

        url.searchParams.set(
          "asLegacyTransaction",
          "false",
        );

        let response: Response;

        try {
          response =
            await fetchWithTimeout(
              url.toString(),
              {
                headers: {
                  accept:
                    "application/json",
                },
              },
            );
        } catch {
          throw new Error(
            JUP_UNREACHABLE,
          );
        }


        if (!response.ok) {
          const text =
            await response.text()
              .catch(() => "");


          if (
            response.status >= 500
          ) {
            throw new Error(
              JUP_UNREACHABLE,
            );
          }


          throw new Error(
            `Jupiter quote failed: ${response.status} ${text.slice(
              0,
              200,
            )}`,
          );
        }


        const json =
          await response.json() as any;

        if (
          !json?.outAmount ||
          !Array.isArray(json.routePlan) ||
          json.routePlan.length === 0
        ) {
          throw new Error(
            "No liquid Jupiter route is available for this pair.",
          );
        }

        return json;
      },
    );


export const getJupiterSwap =
  createServerFn({
    method: "POST",
  })
    .inputValidator(
      (d: unknown) =>
        SwapSchema.parse(d),
    )
    .handler(
      async ({
        data,
      }) => {
        rateLimit("swap");


        if (
          !data.quoteResponse
        ) {
          throw new Error(
            "Missing Jupiter quote response",
          );
        }


        const cleanQuote =
          {
            ...(data.quoteResponse as any),
          };


        if (
          !cleanQuote.inputMint ||
          !cleanQuote.outputMint ||
          !cleanQuote.outAmount ||
          !cleanQuote.routePlan
        ) {
          console.error(
            "Invalid Jupiter quote",
            cleanQuote,
          );

          throw new Error(
            "Invalid Jupiter quote. Refresh and try again.",
          );
        }


        const body =
          {
            quoteResponse:
              cleanQuote,

            userPublicKey:
              data.userPublicKey,

            wrapAndUnwrapSol:
              data.wrapAndUnwrapSol ?? true,

            dynamicComputeUnitLimit:
              true,

            prioritizationFeeLamports:
              "auto",
          };

        let response: Response;


        try {
          response =
            await fetchWithTimeout(
              `${JUPITER()}/swap`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  accept:
                    "application/json",
                },

                body:
                  JSON.stringify(body),
              },
            );
        } catch (e) {
          console.error(
            "Jupiter swap fetch failed",
            e,
          );

          throw new Error(
            JUP_UNREACHABLE,
          );
        }


        const raw =
          await response.text();


        if (
          !response.ok
        ) {
          let detail =
            raw.slice(
              0,
              300,
            );

          try {
            const json =
              JSON.parse(raw);

            detail =
              json.error ||
              json.message ||
              json.errorCode ||
              detail;
          } catch {}


          throw new Error(
            `Jupiter swap failed (${response.status}): ${detail}`,
          );
        }


        let json: any;

        try {
          json =
            JSON.parse(raw);
        } catch {
          throw new Error(
            "Jupiter returned invalid JSON",
          );
        }


        if (
          !json ||
          typeof json.swapTransaction !==
            "string"
        ) {
          throw new Error(
            "Jupiter did not return swapTransaction",
          );
        }


        return json as {
          swapTransaction: string;
          lastValidBlockHeight?: number;
        };
      },
    );

export const sendSignedTransaction =
  createServerFn({
    method: "POST",
  })
    .inputValidator((d: unknown) =>
      z.object({ signedTransaction }).parse(d),
    )
    .handler(async ({ data }) => {
      rateLimit("send-transaction");

      const result = await solanaRpc<string>(
        "sendTransaction",
        [
          data.signedTransaction,
          {
            encoding: "base64",
            skipPreflight: false,
            maxRetries: 3,
          },
        ],
      );

      return { signature: result };
    });

export const simulateSwapTransaction =
  createServerFn({
    method: "POST",
  })
    .inputValidator((d: unknown) =>
      z.object({ swapTransaction: signedTransaction }).parse(d),
    )
    .handler(async ({ data }) => {
      rateLimit("simulate-transaction");

      const result = await solanaRpc<{
        value: {
          err: unknown;
          logs?: string[] | null;
        };
      }>(
        "simulateTransaction",
        [
          data.swapTransaction,
          {
            encoding: "base64",
            sigVerify: false,
            commitment: "processed",
          },
        ],
      );

      const err = result?.value?.err;

      if (err) {
        return {
          ok: false as const,
          error: simulationError(
            err,
            result.value.logs ?? [],
          ),
        };
      }

      return { ok: true as const };
    });

export const getSwapStatus =
  createServerFn({
    method: "POST",
  })
    .inputValidator((d: unknown) =>
      z.object({ signature }).parse(d),
    )
    .handler(async ({ data }) => {
      rateLimit("swap-status");

      const result = await solanaRpc<{
        value: Array<{
          err: unknown;
          confirmationStatus?: string | null;
        } | null>;
      }>(
        "getSignatureStatuses",
        [
          [data.signature],
          { searchTransactionHistory: true },
        ],
      );

      const status = result?.value?.[0] ?? null;

      if (!status) {
        return { state: "pending" as const };
      }

      if (status.err) {
        return {
          state: "failed" as const,
          error: JSON.stringify(status.err),
        };
      }

      if (
        status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized"
      ) {
        return { state: "confirmed" as const };
      }

      return { state: "pending" as const };
    });

export const logSwap =
  createServerFn({
    method: "POST",
  })
    .inputValidator(
      (d: unknown) =>
        z
          .object({
            signature:
              z.string()
                .min(20)
                .max(120),

            inputMint:
              mint,

            outputMint:
              mint,

            inAmount:
              z.string()
                .max(30),

            outAmount:
              z.string()
                .max(30),
          })
          .parse(d),
    )
    .handler(
      async ({
        data,
      }) => {
        console.log(
          JSON.stringify({
            evt:
              "swap_success",

            ts:
              new Date()
                .toISOString(),

            ...data,
          }),
        );

        return {
          ok: true,
        };
      },
    );
