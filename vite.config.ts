import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
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
      noExternal: ["@solana/web3.js", "rpc-websockets"],
    },
    optimizeDeps: {
      include: ["@solana/web3.js", "rpc-websockets", "buffer"],
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
        plugins: [
          NodeGlobalsPolyfillPlugin({
            buffer: true,
            process: true,
          }),
        ],
      },
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
