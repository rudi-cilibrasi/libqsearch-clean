/// <reference lib="webworker" />

import brotliPromise from "brotli-wasm";
import {startNcdCompressionWorker} from "./shared/createNcdCompressionWorker";

declare const self: DedicatedWorkerGlobalScope;

const BROTLI_QUALITY = 11;
let brotli: Awaited<typeof brotliPromise> | undefined;

void startNcdCompressionWorker({
  algorithm: "brotli",
  displayName: "Brotli",
  initialize: async () => {
    brotli = await brotliPromise;
  },
  compress: (data) => {
    if (!brotli) throw new Error("Brotli WASM is not initialized");
    return brotli.compress(data, {quality: BROTLI_QUALITY}).byteLength;
  },
}, self);

export type {};
