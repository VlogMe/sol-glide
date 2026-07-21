import * as BufferModule from "buffer";

const Buffer =
  (BufferModule as any).Buffer ||
  (BufferModule as any).default?.Buffer ||
  (BufferModule as any).default;

if (!Buffer || typeof Buffer.from !== "function") {
  throw new Error("Buffer constructor not found");
}

globalThis.Buffer = Buffer;

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}

console.log("BUFFER FINAL CHECK", {
  Buffer: typeof globalThis.Buffer,
  BufferFrom: typeof (globalThis as any).Buffer?.from,
});

export function ensureBuffer(): true {
  globalThis.Buffer = Buffer;
  if (typeof window !== "undefined") {
    (window as any).Buffer = Buffer;
  }
  return true;
}
