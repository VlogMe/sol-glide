export function setupBuffer() {
  if (typeof window === "undefined") return;
  const existing = (globalThis as any).Buffer;
  console.log("BUFFER SETUP CHECK", {
    Buffer: typeof existing,
    BufferFrom: typeof existing?.from,
  });
}

if (typeof window !== "undefined") {
  setupBuffer();
}
