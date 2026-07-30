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

const PLATFORM_FEE_BPS = 50;
const VIP_FEE_BPS = 30;

const SPDD_MINT =
  "C99rtU8RADKAUN1f8avP4gkLtZQu3zbZejsCrGBMpump";

const SPDD_VIP_THRESHOLD = 1_000_000;

const PLATFORM_FEE_WALLET = () =>
  process.env.PLATFORM_FEE_WALLET || "";

const RPC = () =>
  process.env.RPC_URL ||
  process.env.VITE_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";


async function getSpddBalance(
  owner: string,
): Promise<number> {
  try {
    const res = await fetch(RPC(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          owner,
          {
            mint: SPDD_MINT,
          },
          {
            encoding: "jsonParsed",
          },
        ],
      }),
    });

    const json: any = await res.json();

    const accounts =
      json?.result?.value ?? [];

    let total = 0;

    for (const account of accounts) {
      const amount =
        account?.account?.data?.parsed?.info
          ?.tokenAmount?.uiAmount;

      if (typeof amount === "number") {
        total += amount;
      }
    }

    return total;
  } catch {
    return 0;
  }
}


async function feeBpsForOwner(
  owner?: string,
): Promise<number> {
  if (!owner) {
    return PLATFORM_FEE_BPS;
  }

  const balance =
    await getSpddBalance(owner);

  return balance >= SPDD_VIP_THRESHOLD
    ? VIP_FEE_BPS
    : PLATFORM_FEE_BPS;
}


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


const VipProofSchema =
  z.object({
    publicKey: mint,

    signature:
      z.string()
        .regex(
          base58,
          "Invalid signature",
        ),

    nonce:
      z.string()
        .min(8)
        .max(128),
  });


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

    vipProof:
      VipProofSchema.optional(),
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

export const VIP_MESSAGE_PREFIX =
  "SOLPITCH-VIP:";
async function verifyVipProof(
  proof: z.infer<typeof VipProofSchema>,
): Promise<string | null> {
  try {
    const nacl =
      (await import("tweetnacl"))
        .default;

    const bs58 =
      (await import("bs58"))
        .default;

    const message =
      new TextEncoder().encode(
        `${VIP_MESSAGE_PREFIX}${proof.nonce}`,
      );

    const signature =
      bs58.decode(
        proof.signature,
      );

    const publicKey =
      bs58.decode(
        proof.publicKey,
      );

    if (
      signature.length !== 64 ||
      publicKey.length !== 32
    ) {
      return null;
    }

    const valid =
      nacl.sign.detached.verify(
        message,
        signature,
        publicKey,
      );

    return valid
      ? proof.publicKey
      : null;
  } catch {
    return null;
  }
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

        const verifiedOwner =
          data.vipProof
            ? await verifyVipProof(
                data.vipProof,
              )
            : null;

        const feeBps =
          await feeBpsForOwner(
            verifiedOwner ?? undefined,
          );


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


        if (
          PLATFORM_FEE_WALLET()
        ) {
          url.searchParams.set(
            "platformFeeBps",
            String(feeBps),
          );
        }


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
          await response.json();


        return {
          ...(json as any),
          _feeBps: feeBps,
        };
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


        delete cleanQuote._feeBps;


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


        if (
          PLATFORM_FEE_WALLET()
        ) {
          body.feeAccount =
            PLATFORM_FEE_WALLET();
        }


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
export const getSpddTier =
  createServerFn({
    method: "POST",
  })
    .inputValidator(
      (d: unknown) =>
        z
          .object({
            userPublicKey: mint,
          })
          .parse(d),
    )
    .handler(
      async ({
        data,
      }) => {
        const balance =
          await getSpddBalance(
            data.userPublicKey,
          );

        const isVip =
          balance >= SPDD_VIP_THRESHOLD;


        return {
          balance,
          isVip,

          feeBps:
            isVip
              ? VIP_FEE_BPS
              : PLATFORM_FEE_BPS,

          threshold:
            SPDD_VIP_THRESHOLD,
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



// Resolve token metadata by mint.
// Uses Jupiter first, then RPC fallback.
export const resolveTokenByMint =
  createServerFn({
    method: "POST",
  })
    .inputValidator(
      (d: unknown) =>
        z
          .object({
            mint,
          })
          .parse(d),
    )
    .handler(
      async ({
        data,
      }) => {
        rateLimit(
          "resolve",
        );


        const headers = {
          accept:
            "application/json",
        };


        const tokenMint =
          data.mint;



        try {
          const response =
            await fetch(
              `https://lite-api.jup.ag/tokens/v1/token/${tokenMint}`,
              {
                headers,
              },
            );


          if (
            response.ok
          ) {
            const json: any =
              await response.json();


            if (
              json?.address
            ) {
              return {
                symbol:
                  json.symbol ||
                  tokenMint.slice(0, 4),

                name:
                  json.name ||
                  "Unknown token",

                mint:
                  json.address,

                decimals:
                  Number(
                    json.decimals ?? 0,
                  ),

                logoURI:
                  json.logoURI ||
                  "",

                warn:
                  false,

                source:
                  "jupiter" as const,
              };
            }
          }
        } catch {}



        try {
          const response =
            await fetch(
              `https://lite-api.jup.ag/tokens/v1/search?query=${encodeURIComponent(
                tokenMint,
              )}`,
              {
                headers,
              },
            );


          if (
            response.ok
          ) {
            const json: any =
              await response.json();


            const list =
              Array.isArray(json)
                ? json
                : (
                    json?.tokens ??
                    json?.data ??
                    []
                  );


            const hit =
              list.find(
                (t: any) =>
                  (
                    t?.address ||
                    t?.mint
                  ) === tokenMint,
              ) ||
              list[0];


            if (
              hit &&
              (
                hit.address ||
                hit.mint
              ) === tokenMint
            ) {
              const address =
                hit.address ||
                hit.mint;


              return {
                symbol:
                  hit.symbol ||
                  tokenMint.slice(0, 4),

                name:
                  hit.name ||
                  "Unknown token",

                mint:
                  address,

                decimals:
                  Number(
                    hit.decimals ?? 0,
                  ),

                logoURI:
                  hit.logoURI ||
                  hit.logo_uri ||
                  "",

                warn:
                  false,

                source:
                  "jupiter" as const,
              };
            }
          }
        } catch {}



        try {
          const response =
            await fetch(
              RPC(),
              {
                method:
                  "POST",

                headers:
                  {
                    "Content-Type":
                      "application/json",
                  },

                body:
                  JSON.stringify({
                    jsonrpc:
                      "2.0",

                    id:
                      1,

                    method:
                      "getTokenSupply",

                    params:
                      [
                        tokenMint,
                      ],
                  }),
              },
            );


          const json: any =
            await response.json();


          const supply =
            json?.result?.value;


          if (
            supply
          ) {
            return {
              symbol:
                tokenMint.slice(
                  0,
                  4,
                ),

              name:
                "Unknown Token",

              mint:
                tokenMint,

              decimals:
                supply.decimals,

              logoURI:
                "",

              warn:
                true,

              source:
                "rpc" as const,
            };
          }
        } catch {}



        throw new Error(
          "Token not found. Check the mint address.",
        );
      },
    );
