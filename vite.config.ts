import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

const rpcWebsocketsBrowser = path.resolve(
  process.cwd(),
  "node_modules/rpc-websockets/dist/index.browser.mjs",
);

const bufferShim = path.resolve(process.cwd(), "src/lib/buffer-shim.ts");
const bufferPackage = path.resolve(process.cwd(), "node_modules/buffer/index.js");

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "client-buffer-alias",
        enforce: "pre",
        applyToEnvironment: (env: { name: string }) => env.name === "client",
        resolveId(source: string) {
          if (source === "buffer") {
            return bufferShim;
          }
          return null;
        },
      } as any,
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
    },
    define: {
      global: "globalThis",
    },
    resolve: {
      alias: [
        { find: /^buffer$/, replacement: bufferShim },
        { find: /^buffer\/$/, replacement: bufferPackage },
        { find: /^process$/, replacement: "process/browser" },
        { find: /^rpc-websockets$/, replacement: rpcWebsocketsBrowser },
      ],
    },
  },
});
