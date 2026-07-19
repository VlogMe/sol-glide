import { defineConfig } from "@lovable.dev/vite-tanstack-config";

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
      include: [
        "@solana/web3.js",
        "rpc-websockets",
        "@solana/wallet-adapter-base",
        "@solana/wallet-adapter-react",
        "@solana/wallet-adapter-react-ui",
      ],
    },
    resolve: {
      alias: [
        {
          find: /^rpc-websockets\/dist\/lib\/client$/,
          replacement: "rpc-websockets/dist/index.browser.mjs",
        },
        {
          find: /^rpc-websockets\/dist\/lib\/client\/websocket$/,
          replacement: "rpc-websockets/dist/index.browser.mjs",
        },
      ],
    },
  },
});
