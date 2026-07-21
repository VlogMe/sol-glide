// SSR-safe Buffer shim.
// On the server (Node), use the built-in Buffer to avoid loading the CJS
// `buffer` package via Vite's ESM module runner (which has no `require`).
// On the client, Vite aliases `buffer/` to node_modules/buffer/index.js
// (bundled by esbuild/rollup, so `require` is handled).

let BufferImpl: any;

if (typeof process !== "undefined" && (process as any).versions?.node) {
  // Server: use Node's built-in Buffer
  BufferImpl = (globalThis as any).Buffer;
} else {
  // Client: load the bundled `buffer` package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("buffer/") as any;
  BufferImpl = mod.Buffer ?? mod.default?.Buffer ?? mod.default ?? mod;
  if (typeof globalThis !== "undefined" && typeof BufferImpl?.from === "function") {
    (globalThis as any).Buffer = BufferImpl;
  }
}

export const Buffer = BufferImpl;
export default { Buffer: BufferImpl };
