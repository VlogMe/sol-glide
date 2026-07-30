import { Buffer } from "buffer";

(globalThis as any).Buffer = Buffer;

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}
