// SSR-safe Buffer shim.
// - On the server: Node provides `Buffer` as a global.
// - On the client: vite-plugin-node-polyfills injects `Buffer` as a global.
// Either way we can just read it off `globalThis` without importing the CJS
// `buffer` package (which breaks in Vite's SSR ESM module runner because it
// uses `require`).

const BufferImpl: any = (globalThis as any).Buffer;

export const Buffer = BufferImpl;
export default { Buffer: BufferImpl };
