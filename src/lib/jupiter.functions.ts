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
