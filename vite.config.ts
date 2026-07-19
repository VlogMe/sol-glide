import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const rpcWebsocketsBrowser = require.resolve("rpc-websockets/dist/index.browser.mjs");

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
    resolve: {
      alias: [
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
      ],
    },
  },
});
