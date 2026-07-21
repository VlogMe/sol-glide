import { Buffer } from "buffer";

export function setupBuffer() {
  if (typeof globalThis !== "undefined") {
    globalThis.Buffer = Buffer;
  }

  if (typeof window !== "undefined") {
    window.Buffer = Buffer;
  }

  console.log("BUFFER SETUP CHECK", {
    Buffer: typeof globalThis.Buffer,
    BufferFrom: typeof globalThis.Buffer?.from
  });
}

export function ensureBuffer(): true {
  setupBuffer();
  return true;
}

setupBuffer();
