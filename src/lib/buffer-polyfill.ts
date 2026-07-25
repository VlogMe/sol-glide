import { Buffer as RealBuffer } from "buffer/";

export function setupBuffer() {
  if (typeof window === "undefined") return;
  const existing = (globalThis as any).Buffer;
  if (existing && typeof existing.from === "function") {
    console.log("BUFFER SETUP CHECK", { Buffer: typeof existing, BufferFrom: typeof existing.from });
    return;
  }
  if (RealBuffer && typeof RealBuffer.from === "function") {
    (globalThis as any).Buffer = RealBuffer;
    (window as any).Buffer = RealBuffer;
    console.log("BUFFER SETUP CHECK", { Buffer: typeof RealBuffer, BufferFrom: typeof RealBuffer.from });
  } else {
    console.error("BUFFER SETUP FAILED: static import did not yield a valid Buffer", RealBuffer);
  }
}

export function ensureBuffer() {
  if (typeof window === "undefined") return;
  setupBuffer();
}

if (typeof window !== "undefined") {
  setupBuffer();
}
