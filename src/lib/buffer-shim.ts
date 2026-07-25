// SSR-safe Buffer shim.
// Reads globalThis.Buffer lazily on every access/call instead of caching
// it once at import time, so it always sees the real polyfilled Buffer
// no matter what order modules are evaluated in.

function getRealBuffer(): any {
  const real = (globalThis as any).Buffer;
  if (!real || typeof real.from !== "function") {
    throw new Error("Buffer polyfill has not initialized yet.");
  }
  return real;
}

export const Buffer: any = new Proxy(function () {} as any, {
  get(_target, prop) {
    return getRealBuffer()[prop];
  },
  construct(_target, args) {
    const real = getRealBuffer();
    return new real(...args);
  },
  apply(_target, _thisArg, args) {
    const real = getRealBuffer();
    return real(...args);
  },
});

export default { Buffer };
