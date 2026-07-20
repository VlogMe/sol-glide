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
      {
        ...nodePolyfills({
          include: ["buffer", "process", "util", "stream", "events"],
          globals: { Buffer: true, global: true, process: true },
          protocolImports: false,
        }),
        // Scope to the client environment only — the Cloudflare/Nitro SSR
        // build fails on the plugin's node:buffer shim.
        applyToEnvironment: (env: any) => env.name === "client",
      } as any,
    ],
    ssr: {
      noExternal: [
        "@solana/web3.js",
        "@solana/wallet-adapter-base",
        "@solana/wallet-adapter-react",
        "@solana/wallet-adapter-react-ui",
        "@solana/wallet-adapter-phantom",
        "@solana/wallet-adapter-solflare",
        "@solana/wallet-adapter-backpack",
        "rpc-websockets",
      ],
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
