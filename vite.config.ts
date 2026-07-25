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
        applyToEnvironment: (env: { name: string }) => env.name === "client",
      } as any,
    ],
    ssr: {
      noExternal: ["@solana/web3.js", "rpc-websockets", "buffer", "base64-js", "ieee754"],
    },
    optimizeDeps: {
      include: [
        "buffer",
        "process",
        "@solana/web3.js",
        "rpc-websockets",
      ],
      esbuildOptions: {
        inject: [path.resolve(process.cwd(), "src/lib/global-buffer-shim.ts")],
        define: {
          global: "globalThis",
        },
      },
    },
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: [
        { find: /^process$/, replacement: "process/browser" },
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
      ],
    },
  },
});
