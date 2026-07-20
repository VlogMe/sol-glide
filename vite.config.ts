import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

const rpcWebsocketsBrowser = path.resolve(
  process.cwd(),
  "node_modules/rpc-websockets/dist/index.browser.mjs",
);

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
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
      include: ["@solana/web3.js", "rpc-websockets"],
    },
    define: {
      "process.env.ANCHOR_BROWSER": "true",
      global: "globalThis",
    },
    resolve: {
      alias: [
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
        { find: "buffer", replacement: "buffer" },
      ],
    },
  },
});
