import { createFileRoute } from "@tanstack/react-router";

const RPC = () =>
  process.env.RPC_URL ||
  process.env.VITE_RPC_URL ||
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

export const Route = createFileRoute("/api/rpc")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const upstream = await fetch(RPC(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        return new Response(await upstream.text(), {
          status: upstream.status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
