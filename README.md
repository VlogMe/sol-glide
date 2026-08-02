# SOLPITCH SWAP

A Solana DEX aggregator built on [TanStack Start](https://tanstack.com/start) (React 19 + Vite 7),
routing liquid swaps through the [Jupiter](https://station.jup.ag/) aggregator API with Phantom
wallet support. Platform fees are currently disabled.

---

## Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| Framework  | TanStack Start v1 (file-based routing, SSR, server fns)  |
| Build      | Vite 7 + Nitro (Cloudflare Workers module output)        |
| UI         | React 19, Tailwind CSS v4, shadcn/ui (Radix), lucide     |
| Chain      | `@solana/web3.js` 1.95.8, Phantom via `window.solana`    |
| Validation | Zod                                                      |

There is **no database, no auth, and no Supabase**. All server-side work happens in
TanStack `createServerFn` handlers in `src/lib/jupiter.functions.ts`.

---

## Prerequisites

- Node.js 20+ (or [Bun](https://bun.sh) 1.1+, which the lockfile targets)
- A Solana RPC endpoint (Helius, QuickNode, Triton, Alchemy — the public
  `api.mainnet-beta.solana.com` endpoint is heavily rate limited and not
  suitable for production)

---

## Environment variables

Both are **server-side only** — they are read inside server function handlers
and never shipped to the browser. Do **not** prefix them with `VITE_`.

| Variable              | Required | Description                                                              |
| --------------------- | -------- | ------------------------------------------------------------------------ |
| `SOLANA_RPC_URL`  | Yes      | Solana mainnet RPC endpoint used for transaction confirmation. |
| `JUPITER_API_URL` | Yes      | Jupiter API base URL, e.g. `https://lite-api.jup.ag`.          |

Accepted aliases (checked in order, first non-empty wins):

- RPC: `RPC_URL` → `VITE_RPC_URL` → `SOLANA_RPC_URL`
- Jupiter: `JUPITER_BASE` → `VITE_JUPITER_BASE` → `JUPITER_API_URL`

Copy `.env.example` to `.env` for local development:

```bash
cp .env.example .env
```

`.env` is git-ignored. For deployed environments, set these in your host's
dashboard (Cloudflare Workers secrets, Vercel environment variables, etc.) —
never commit real values.

---

## Install

```bash
bun install
# or
npm install
```

## Develop

```bash
bun run dev        # http://localhost:8080
```

## Build

```bash
bun run build      # production build → dist/
bun run build:dev  # development-mode build (useful for debugging prerender)
bun run preview    # serve the production build locally
```

## Lint / format

```bash
bun run lint
bun run format
```

---

## Build output

`vite build` runs Vite followed by Nitro and produces:

```
dist/
├── client/          static assets (JS, CSS, images) + _headers
├── server/
│   ├── index.mjs    the Worker entry (default export with a fetch handler)
│   └── wrangler.json
└── nitro.json
```

---

## Deployment

The default Nitro preset is `cloudflare-module`. Override it with the
`NITRO_PRESET` environment variable at **build time** to target another host.

### Cloudflare Workers (default, recommended)

`src/server.ts` is already a Workers-compatible module entry — it exports a
default object with an `async fetch(request, env, ctx)` handler and lazily
imports `@tanstack/react-start/server-entry`. Nitro wraps it with the
`cloudflare-module` preset and `nodeCompat: true` (required by
`@solana/web3.js` and the Buffer polyfill). No changes are needed.

```bash
bun run build
npx wrangler deploy            # uses the generated dist/server/wrangler.json
# or
npx nitro deploy --prebuilt
```

Set secrets on the Worker:

```bash
npx wrangler secret put SOLANA_RPC_URL
npx wrangler secret put JUPITER_API_URL
```

> On Cloudflare, `process.env` is populated per-request, not at module load.
> All env reads in this project already happen inside handler bodies — keep it
> that way if you add new server functions.

### Vercel

```bash
NITRO_PRESET=vercel bun run build
```

Vercel project settings:

- Build command: `NITRO_PRESET=vercel npm run build`
- Output directory: leave empty (Nitro writes `.vercel/output`)
- Add the two environment variables above under Settings → Environment Variables

### Node / self-hosted / Docker

```bash
NITRO_PRESET=node-server bun run build
node dist/server/index.mjs
```

Other Nitro presets (`netlify`, `deno-deploy`, `bun`, …) work the same way —
see the [Nitro deployment docs](https://nitro.build/deploy).

---

## Project structure

```
src/
├── routes/
│   ├── __root.tsx          root shell, head metadata, error/404 boundaries
│   └── index.tsx           landing route (client-only mount of the DEX app)
├── components/dex/
│   ├── DexApp.tsx          page composition
│   ├── Header.tsx
│   ├── SwapCard.tsx        quote → sign → send → confirm flow
│   ├── TokenSelect.tsx     curated liquid-token picker
│   ├── PopularPairs.tsx
│   └── PhantomButton.tsx   direct window.solana connect flow
├── lib/
│   ├── jupiter.functions.ts  server functions: quote, swap, route checks, logging
│   ├── tokens.ts             token list and popular pairs
│   ├── buffer-polyfill.ts    Buffer diagnostics
│   └── global-buffer-shim.ts injected into pre-bundled deps via esbuild
├── server.ts               Worker fetch entry
├── start.ts                TanStack Start instance + error middleware
└── styles.css              Tailwind v4 theme tokens
```

`src/routeTree.gen.ts` is generated by the TanStack Router plugin. It is committed
for reproducible builds but regenerates on every `dev`/`build` — never edit it by hand.

---

## Notes on the Buffer polyfill

`@solana/web3.js` requires a global `Buffer` in the browser. This is handled in three
coordinated places — if you touch one, check the others:

1. `vite-plugin-node-polyfills` in `vite.config.ts` (client environment only)
2. `optimizeDeps.esbuildOptions.inject` → `src/lib/global-buffer-shim.ts`, which
   guarantees the global exists inside pre-bundled dependency chunks
3. `ssr.noExternal` for `@solana/web3.js` / `rpc-websockets`, plus a resolve alias
   pointing `rpc-websockets` at its browser ESM build

`optimizeDeps.force: true` is set so the dependency pre-bundle is never reused
across builds.

---

## License

Private.
