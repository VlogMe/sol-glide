// SSR-safe polyfill setup. Only touches the client; on the server Node
// already provides `Buffer` globally.

export function setupBuffer() {
  if (typeof window === "undefined") return;

  const existing = (globalThis as any).Buffer;
  if (existing && typeof existing.from === "function") {
    console.log("BUFFER SETUP CHECK", { Buffer: typeof existing, BufferFrom: typeof existing.from });
    return;
  }

  void import("buffer/").then((mod: any) => {
    const candidates = [mod.Buffer, mod.default?.Buffer, mod.default, mod];
    const B = candidates.find((c) => c && typeof c.from === "function");
    if (!B) {
      console.error("BUFFER SETUP FAILED: no valid Buffer export found", mod);
      return;
    }
    (globalThis as any).Buffer = B;
    (window as any).Buffer = B;
    console.log("BUFFER SETUP CHECK", { Buffer: typeof B, BufferFrom: typeof B.from });
  });
}


export function ensureBuffer() {
  if (typeof window === "undefined") return;
  setupBuffer();
}

if (typeof window !== "undefined") {
  setupBuffer();
}
