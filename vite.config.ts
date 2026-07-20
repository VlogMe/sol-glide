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
        // Only polyfill for the browser build; the Worker SSR runtime
        // provides its own node:* modules via nodejs_compat.
        exclude: [],
        overrides: {},
      }) as any,
    ].filter((p) => {
      // vite-plugin-node-polyfills applies to all environments by default,
      // which breaks the Cloudflare/Nitro SSR build (node:buffer missing
      // from its shim). Scope to the client environment only.
      if (!p) return false;
      const origApply = (p as any).apply;
      (p as any).apply = (_config: any, env: any) => env.command === "build" ? env.isSsrBuild !== true : true;
      return true;
    }),
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
