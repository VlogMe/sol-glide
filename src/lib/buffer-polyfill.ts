// Polyfill Buffer + process for Solana / rpc-websockets browser builds.
// The rpc-websockets browser ESM references Buffer.from at module init,
// which throws "Cannot read properties of undefined (reading 'from')"
// when Buffer isn't on the global object.
import { Buffer } from "buffer";
import process from "process";

if (typeof globalThis !== "undefined") {
  const g = globalThis as unknown as {
    Buffer?: typeof Buffer;
    process?: typeof process;
    global?: unknown;
  };
  if (!g.Buffer) g.Buffer = Buffer;
  if (!g.process) g.process = process;
  if (!g.global) g.global = globalThis;
}
