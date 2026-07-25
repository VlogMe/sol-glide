import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}
if (typeof window !== "undefined" && typeof (window as any).Buffer === "undefined") {
  (window as any).Buffer = Buffer;
}
