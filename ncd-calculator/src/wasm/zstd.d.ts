export interface ZstdWasmOptions {
  wasmBinary: ArrayBuffer;
  locateFile: (path: string) => string;
}

export default function createZstdModule(options: ZstdWasmOptions): Promise<unknown>;
