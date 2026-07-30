import path from "node:path";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import type { PluginOption, UserConfig } from "vite";

/**
 * Vendor-neutral Vite config for this TanStack Start app.
 *
 * It builds and runs with ONLY open-source packages:
 *   @tanstack/react-start, @vitejs/plugin-react, @tailwindcss/vite,
 *   vite-tsconfig-paths, nitro, vite-plugin-node-polyfills
 *
 * `@lovable.dev/vite-tanstack-config` is used opportunistically when it is
 * installed (it adds editor-preview HMR niceties). If the package is absent —
 * e.g. after exporting to GitHub and removing it from package.json — the
 * standard plugin stack below is used instead and the build is identical.
 */

const rpcWebsocketsBrowser = path.resolve(
  process.cwd(),
  "node_modules/rpc-websockets/dist/index.browser.mjs",
);

/** Deploy target for the Nitro server build. Override with NITRO_PRESET. */
const NITRO_PRESET = process.env.NITRO_PRESET || "cloudflare-module";

/** App-owned Vite settings. Shared by both the Lovable and the standalone path. */
const appViteConfig = {
  plugins: [
    {
      ...nodePolyfills({
        include: ["buffer", "process", "util", "stream", "events"],
        globals: { Buffer: true, global: true, process: true },
        protocolImports: false,
      }),
      applyToEnvironment: (env: { name: string }) => env.name === "client",
    } as unknown as PluginOption,
  ],
  ssr: {
    noExternal: ["@solana/web3.js", "rpc-websockets", "buffer", "base64-js", "ieee754"],
  },
  optimizeDeps: {
    force: true,
    include: ["buffer", "process", "@solana/web3.js", "rpc-websockets"],
    esbuildOptions: {
      inject: [path.resolve(process.cwd(), "src/lib/global-buffer-shim.ts")],
      define: { global: "globalThis" },
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
} satisfies UserConfig;

async function loadLovableConfig() {
  try {
    return (await import("@lovable.dev/vite-tanstack-config")).defineConfig;
  } catch {
    return null;
  }
}

export default async function config({ command }: { command: "build" | "serve" }) {
  const lovableDefineConfig = await loadLovableConfig();

  if (lovableDefineConfig) {
    return lovableDefineConfig({
      tanstackStart: { server: { entry: "server" } },
      vite: appViteConfig,
    });
  }

  // ---- Standalone (no Lovable packages installed) ----
  const [{ tanstackStart }, react, tailwindcss, tsConfigPaths] = await Promise.all([
    import("@tanstack/react-start/plugin/vite"),
    import("@vitejs/plugin-react").then((m) => m.default),
    import("@tailwindcss/vite").then((m) => m.default),
    import("vite-tsconfig-paths").then((m) => m.default),
  ]);

  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
  ];

  // Nitro produces the deployable server bundle. Only needed at build time.
  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        preset: NITRO_PRESET,
        output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
        cloudflare: { nodeCompat: true, deployConfig: true },
      }),
    );
  }

  plugins.push(react());

  return {
    ...appViteConfig,
    plugins: [...plugins, ...appViteConfig.plugins],
  } satisfies UserConfig;
}
