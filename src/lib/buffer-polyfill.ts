import * as BufferModule from "buffer";

console.log("BUFFER MODULE RAW", BufferModule);

const Buffer =
  (BufferModule as any).Buffer ??
  (BufferModule as any).default?.Buffer ??
  (BufferModule as any).default?.default?.Buffer;

if (Buffer && typeof Buffer.from === "function") {
  globalThis.Buffer = Buffer;

  if (typeof window !== "undefined") {
    window.Buffer = Buffer;
  }
}

console.log("BUFFER SAFE CHECK", {
  found: !!Buffer,
  BufferType: typeof globalThis.Buffer,
  BufferFrom: typeof globalThis.Buffer?.from
});

export function ensureBuffer(): true {
  if (Buffer && typeof Buffer.from === "function") {
    globalThis.Buffer = Buffer;
    if (typeof window !== "undefined") {
      window.Buffer = Buffer;
    }
  }
  return true;
}
