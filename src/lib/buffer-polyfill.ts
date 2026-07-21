import BufferModule from "buffer";

const Buffer =
  (BufferModule as any).Buffer ||
  BufferModule;

globalThis.Buffer = Buffer;

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}

console.log("BUFFER POLYFILL FIXED", {
  Buffer: typeof globalThis.Buffer,
  BufferFrom: typeof (globalThis as any).Buffer?.from,
  keys: Object.keys(BufferModule),
});

export function ensureBuffer(): true {
  if (!globalThis.Buffer) {
    globalThis.Buffer = Buffer;
  }
  if (typeof window !== "undefined" && !(window as any).Buffer) {
    (window as any).Buffer = Buffer;
  }
  return true;
}
