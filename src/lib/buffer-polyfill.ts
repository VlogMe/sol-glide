console.log("BUFFER SETUP CHECK", {
  Buffer: typeof existing,
  BufferFrom: typeof existing?.from,
  GlobalBuffer: typeof globalThis.Buffer,
  WindowBuffer: typeof window?.Buffer,
});
