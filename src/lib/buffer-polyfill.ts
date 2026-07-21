import * as BufferModule from "buffer";

console.log("BUFFER MODULE DEBUG", BufferModule);

console.log("BUFFER EXPORTS", {
  Buffer: typeof (BufferModule as any).Buffer,
  default: typeof (BufferModule as any).default,
  keys: Object.keys(BufferModule),
});

if ((BufferModule as any).Buffer) {
  (globalThis as any).Buffer = (BufferModule as any).Buffer;
}

if (typeof window !== "undefined" && (BufferModule as any).Buffer) {
  (window as any).Buffer = (BufferModule as any).Buffer;
}

console.log("BUFFER AFTER ASSIGN", {
  Buffer: typeof (globalThis as any).Buffer,
  BufferFrom: typeof (globalThis as any).Buffer?.from,
});

export function ensureBuffer(): true {
  if ((BufferModule as any).Buffer) {
    (globalThis as any).Buffer = (BufferModule as any).Buffer;
    if (typeof window !== "undefined") {
      (window as any).Buffer = (BufferModule as any).Buffer;
    }
  }
  return true;
}
