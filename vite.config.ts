import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const rpcWebsocketsBrowser = path.resolve(
  process.cwd(),
  "node_modules/rpc-websockets/dist/index.browser.mjs",
);

const bufferBrowser = path.resolve(process.cwd(), "node_modules/buffer/index.js");

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
        applyToEnvironment: (env: { name: string }) => env.name === "client",
      } as any,
    ],
    ssr: {
      noExternal: ["@solana/web3.js", "rpc-websockets"],
    },
    optimizeDeps: {
      include: ["@solana/web3.js", "rpc-websockets"],
      exclude: ["buffer"],
    },
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: [
        { find: /^buffer$/, replacement: bufferBrowser },
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
      ],
    },
  },
});
