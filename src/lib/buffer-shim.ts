import * as BufferNamespace from "buffer/";

const BufferModule =
  (BufferNamespace as any).Buffer != null
    ? BufferNamespace
    : ((BufferNamespace as any).default ?? BufferNamespace);

export const Buffer = (BufferModule as any).Buffer ?? BufferModule;
export const SlowBuffer = (BufferModule as any).SlowBuffer;
export const INSPECT_MAX_BYTES = (BufferModule as any).INSPECT_MAX_BYTES;
export const kMaxLength = (BufferModule as any).kMaxLength;
export default BufferModule;