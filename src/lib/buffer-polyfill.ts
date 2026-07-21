import { Buffer as PolyfillBuffer } from "buffer/";

export function setupBuffer() {
  if (typeof window === "undefined") return;

  try {
    if (typeof globalThis !== "undefined") {
      (globalThis as any).Buffer = PolyfillBuffer;
    }

    (window as any).Buffer = PolyfillBuffer;

    console.log("BUFFER SETUP CHECK", {
      Buffer: typeof (globalThis as any).Buffer,
      BufferFrom: typeof (globalThis as any).Buffer?.from,
    });
  } catch (err) {
    console.error("BUFFER SETUP FAILED", err);
  }
}

export function ensureBuffer() {
  if (typeof window === "undefined") return;
  setupBuffer();
}

setupBuffer();
