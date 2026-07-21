import { Buffer as BufferPolyfill } from "buffer";

const Buffer = BufferPolyfill;

if (typeof globalThis !== "undefined") {
  (globalThis as any).Buffer = Buffer;
}

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}

export function ensureBuffer(): true {
  (globalThis as any).Buffer = Buffer;
  if (typeof window !== "undefined") {
    (window as any).Buffer = Buffer;
  }
  return true;
}

console.log("BUFFER POLYFILL LOADED", {
  Buffer: typeof (globalThis as any).Buffer,
  BufferFrom: typeof (globalThis as any).Buffer?.from,
});
