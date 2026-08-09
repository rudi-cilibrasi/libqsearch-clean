/// <reference lib="webworker" />

import {
  createSingleCacheKey,
  getCompressionProvenance,
  reduceDirectedMatrix,
} from "@/services/CompressionProtocol";
import type {CompressionAlgorithm, PairCompressionRecord, SingleCompressionRecord} from "@/types/compression";
import type {
  NCDInput,
  WorkerErrorMessage,
  WorkerReadyMessage,
  WorkerResultMessage,
  WorkerStartMessage,
} from "@/types/ncd";
import {
  encodeText,
  getPairFileConcatenated,
  isValidCompressionSize,
  processChunk,
} from "./utils";

export type ByteCompressor = (data: Uint8Array) => number | Promise<number>;

export interface NcdCompressionWorkerConfig {
  readonly algorithm: CompressionAlgorithm;
  readonly displayName: string;
  readonly compress: ByteCompressor;
  readonly initialize?: () => void | Promise<void>;
  readonly chunkSize?: number;
}

const getCompressedSize = async (
  compressor: ByteCompressor,
  data: Uint8Array,
): Promise<number> => {
  const compressedSize = await compressor(data);
  if (!isValidCompressionSize(compressedSize)) {
    throw new Error(`Compression produced an invalid size: ${compressedSize}`);
  }
  return compressedSize;
};

/** Compute one complete ordered NCD result with an injected byte compressor. */
export async function computeNcdWithCodec(
  input: NCDInput,
  config: NcdCompressionWorkerConfig,
  scope: DedicatedWorkerGlobalScope,
): Promise<WorkerResultMessage> {
  const {labels, contents, contentKeys, cachedSizes} = input;
  if (
    !labels?.length
    || labels.length !== contents?.length
    || contentKeys?.length !== contents.length
    || contents.length < 2
  ) {
    throw new Error("Labels, contents, and content keys must describe at least two matching objects");
  }

  const n = contents.length;
  scope.postMessage({
    type: "start",
    totalItems: n,
    totalPairs: n * (n - 1),
  } as WorkerStartMessage);

  const singleCompressedSizes: number[] = new Array(n);
  const singleCompressionData: SingleCompressionRecord[] = [];
  for (let index = 0; index < n; index += 1) {
    const cacheKey = createSingleCacheKey(config.algorithm, contentKeys[index]);
    const cachedSize = cachedSizes?.get(cacheKey);
    if (cachedSize !== undefined) {
      if (!isValidCompressionSize(cachedSize)) {
        throw new Error(`Cached compression size is invalid for object ${index}`);
      }
      singleCompressedSizes[index] = cachedSize;
      continue;
    }

    const compressedSize = await getCompressedSize(config.compress, encodeText(contents[index]));
    singleCompressedSizes[index] = compressedSize;
    singleCompressionData.push({contentKey: contentKeys[index], compressedSize});
  }

  const directedNcdMatrix = Array.from({length: n}, () => Array<number>(n).fill(0));
  const pairCompressionData: PairCompressionRecord[] = [];
  const compressPair = async (source: string, target: string): Promise<number> => (
    getCompressedSize(config.compress, getPairFileConcatenated(source, target))
  );
  const chunkSize = config.chunkSize ?? 4;

  for (let startIndex = 0; startIndex < n; startIndex += chunkSize) {
    const results = await processChunk(
      startIndex,
      Math.min(startIndex + chunkSize, n),
      n,
      contents,
      contentKeys,
      singleCompressedSizes,
      config.algorithm,
      cachedSizes,
      compressPair,
      scope,
    );

    for (const result of results) {
      directedNcdMatrix[result.i][result.j] = result.ncd;
      if (result.pairRecord) pairCompressionData.push(result.pairRecord);
    }
  }

  return {
    type: "result",
    labels,
    directedNcdMatrix,
    ncdMatrix: reduceDirectedMatrix(directedNcdMatrix),
    provenance: getCompressionProvenance(config.algorithm),
    singleCompressionData,
    pairCompressionData,
  };
}

/** Initialize a worker, verify its codec, and attach its message handler. */
export async function startNcdCompressionWorker(
  config: NcdCompressionWorkerConfig,
  scope: DedicatedWorkerGlobalScope,
): Promise<void> {
  try {
    await config.initialize?.();
    await getCompressedSize(config.compress, encodeText("ncd-compressor-ready-check"));

    scope.onmessage = async (event: MessageEvent<NCDInput>) => {
      try {
        const result = await computeNcdWithCodec(event.data, config, scope);
        scope.postMessage(result);
      } catch (error) {
        scope.postMessage({
          type: "error",
          message: `${config.displayName} worker error: ${error instanceof Error ? error.message : String(error)}`,
        } as WorkerErrorMessage);
      }
    };

    scope.postMessage({
      type: "ready",
      message: `${config.displayName} worker initialized`,
    } as WorkerReadyMessage);
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: `Failed to initialize ${config.displayName}: ${error instanceof Error ? error.message : String(error)}`,
    } as WorkerErrorMessage);
  }
}
