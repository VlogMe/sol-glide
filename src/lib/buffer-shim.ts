import BufferModule from "buffer/";

export const Buffer = (BufferModule as any).Buffer ?? BufferModule;
export default BufferModule;