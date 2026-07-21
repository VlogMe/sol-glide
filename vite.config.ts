import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const rpcWebsocketsBrowser = path.resolve(
  process.cwd(),
  "node_modules/rpc-websockets/dist/index.browser.mjs",
);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      nodePolyfills({
        include: ["buffer", "process", "util", "stream", "events"],
        globals: { Buffer: true, global: true, process: true },
        protocolImports: false,
        // Only polyfill in the browser bundle; SSR/Nitro has real node:buffer.
        // Applying to SSR breaks node:buffer imports (crossws, TanStack compiler).
        applyToEnvironment: (env) => env.name === "client",
      }),
    ],
    ssr: {
      noExternal: ["@solana/web3.js", "rpc-websockets"],
    },
    optimizeDeps: {
      include: ["@solana/web3.js", "rpc-websockets", "buffer"],
    },
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: [
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
      ],
    },
  },
});
