import { Buffer } from "buffer";

const globalScope = globalThis as any;

globalScope.Buffer = Buffer;
globalScope.global = globalScope;

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}
