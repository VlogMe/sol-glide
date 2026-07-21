export async function setupBuffer() {
  if (typeof window === "undefined") return;

  try {
    const { Buffer } = await import("buffer");

    if (typeof globalThis !== "undefined") {
      (globalThis as any).Buffer = Buffer;
    }

    (window as any).Buffer = Buffer;

    console.log("BUFFER SETUP CHECK", {
      Buffer: typeof (globalThis as any).Buffer,
      BufferFrom: typeof (globalThis as any).Buffer?.from,
    });
  } catch (err) {
    console.error("BUFFER SETUP FAILED", err);
  }
}

export async function ensureBuffer() {
  if (typeof window === "undefined") return;
  await setupBuffer();
}
