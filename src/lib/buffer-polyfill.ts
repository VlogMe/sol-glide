// SSR-safe polyfill setup. Only touches the client; on the server Node
// already provides `Buffer` globally.

export function setupBuffer() {
  if (typeof window === "undefined") return;

  try {
    // Dynamic import so SSR (Vite ESM module runner) never evaluates the
    // CJS `buffer` package (which relies on `require`).
    void import("buffer/").then((mod: any) => {
      const B = mod.Buffer ?? mod.default?.Buffer ?? mod.default ?? mod;
      (globalThis as any).Buffer = B;
      (window as any).Buffer = B;
      console.log("BUFFER SETUP CHECK", {
        Buffer: typeof (globalThis as any).Buffer,
        BufferFrom: typeof (globalThis as any).Buffer?.from,
      });
    });
  } catch (err) {
    console.error("BUFFER SETUP FAILED", err);
  }
}

export function ensureBuffer() {
  if (typeof window === "undefined") return;
  setupBuffer();
}

if (typeof window !== "undefined") {
  setupBuffer();
}
