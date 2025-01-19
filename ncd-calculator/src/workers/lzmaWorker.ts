/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
import { calculateCRC32, encodeText } from "./shared/utils";
import type {
  NCDInput,
  WorkerErrorMessage,
  WorkerResultMessage,
  WorkerStartMessage,
  WorkerReadyMessage
} from "../types/ncd";
import { LZMA } from '../lib/lzma';

// Configuration settings for LZMA compression
// These settings are optimized for NCD computation with files ≤1MB
const COMPRESSION_SETTINGS = {
  // Maximum file size limit for LZMA compression
  // LZMA is most effective for smaller files where compression ratio is critical
  MAX_FILE_SIZE: 1024 * 1024, // 1MB

  // Dictionary size limits for LZMA
  // Minimum: 4KB (2^12) - Suitable for very small files
  // Maximum: 128MB (2^27) - Upper limit for LZMA dictionary
  MIN_DICT_SIZE: Math.pow(2, 12),
  MAX_DICT_SIZE: Math.pow(2, 27),

  // Use maximum compression mode (9) for best compression ratio
  // This is crucial for NCD computation accuracy
  COMPRESSION_MODE: 9
} as const;

// Send ready message immediately on worker initialization
// Unlike WASM-based workers, LZMA worker is ready immediately
self.postMessage({
  type: 'ready',
  message: 'LZMA Worker initialized with maximum compression settings'
} as WorkerReadyMessage);

// Calculate optimal dictionary size based on input data size
// The dictionary should be large enough to capture patterns in the data
function getOptimalDictionarySize(dataSize: number): number {
  // Round up to ensure dictionary can handle the full input
  const minRequiredSize = Math.ceil(dataSize);
  let dictSize = COMPRESSION_SETTINGS.MIN_DICT_SIZE;

  // Double dictionary size until it's sufficient or hits maximum
  // This ensures we use the smallest power-of-2 size that can handle the input
  while (dictSize < minRequiredSize && dictSize < COMPRESSION_SETTINGS.MAX_DICT_SIZE) {
    dictSize *= 2;
  }

  return Math.min(dictSize, COMPRESSION_SETTINGS.MAX_DICT_SIZE);
}

// Compress data using LZMA with optimal settings
function compressData(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const dictSize = getOptimalDictionarySize(data.length);

    // Log compression parameters for debugging and monitoring
    console.log('LZMA Compression Parameters:', {
      inputSize: data.length,
      dictionarySize: dictSize,
      compressionMode: COMPRESSION_SETTINGS.COMPRESSION_MODE
    });

    LZMA.compress(
        data,
        COMPRESSION_SETTINGS.COMPRESSION_MODE,
        (result) => {
          if (result === false) {
            reject(new Error('LZMA compression failed'));
            return;
          }
          resolve(new Uint8Array(result));
        },
        (percent: number) => {
          console.log(`LZMA compression progress: ${(percent * 100).toFixed(2)}%`);
        }
    );
  });
}

// Compress a single string and return its compressed size
async function compressedSizeSingle(str: string): Promise<number> {
  try {
    const encoded = encodeText(str);

    // Log compression details for single string
    console.log(
        "LZMA Worker: Compressing single string",
        {
          inputSize: encoded.length,
          dictSize: getOptimalDictionarySize(encoded.length)
        }
    );

    const compressed = await compressData(encoded);
    return compressed.length;
  } catch (error) {
    console.error("LZMA Worker: Single compression error:", error);
    throw error;
  }
}

// Compress a pair of strings concatenated with a delimiter
async function compressedSizePair(str1: string, str2: string): Promise<number> {
  try {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    const delimiter = encodeText("\n###\n");

    // Check if combined size exceeds LZMA limit
    const totalSize = encoded1.length + delimiter.length + encoded2.length;
    if (totalSize > COMPRESSION_SETTINGS.MAX_FILE_SIZE) {
      throw new Error(`Combined file size (${totalSize} bytes) exceeds LZMA limit of 1MB`);
    }

    // Log compression details for pair
    console.log(
        "LZMA Worker: Processing pair",
        {
          size1: encoded1.length,
          size2: encoded2.length,
          totalSize,
          dictSize: getOptimalDictionarySize(totalSize)
        }
    );

    // Combine files with delimiter for compression
    const combinedArray = new Uint8Array(totalSize);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);

    const compressed = await compressData(combinedArray);
    return compressed.length;
  } catch (error) {
    console.error("LZMA Worker: Pair compression error:", error);
    throw error;
  }
}

// Calculate NCD (Normalized Compression Distance) between two files
function calculateNCD(sizeX: number, sizeY: number, sizeXY: number): number {
  if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
    console.error("Invalid compressed sizes:", { sizeX, sizeY, sizeXY });
    return 1;
  }

  // NCD formula: (C(xy) - min(C(x),C(y))) / max(C(x),C(y))
  // where C(x) is the compressed size of x
  const numerator = sizeXY - Math.min(sizeX, sizeY);
  const denominator = Math.max(sizeX, sizeY);

  // Ensure result is between 0 and 1
  return Math.min(Math.max(numerator / denominator, 0), 1);
}

// Process input data and compute NCD matrix
async function processInput(input: NCDInput): Promise<void> {
  try {
    const { labels, contents, cachedSizes } = input;

    // Validate input
    if (!labels?.length || !contents?.length) {
      throw new Error("Invalid input data");
    }

    const n = contents.length;
    const totalPairs = (n * (n - 1)) / 2;

    // Send start message with total counts
    self.postMessage({
      type: "start",
      totalItems: n,
      totalPairs,
    } as WorkerStartMessage);

    // Initialize data structures
    const crcs = contents.map(content => calculateCRC32(encodeText(content)));
    const singleCompressedSizes = new Array(n);
    const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));
    const newCompressionData = [];

    // Process individual files, using cache when available
    for (let i = 0; i < n; i++) {
      const key = `lzma:${crcs[i]}`;
      const cached = cachedSizes?.get(key);

      if (cached !== undefined) {
        console.log(`LZMA Worker: Using cached size for file ${i}`);
        singleCompressedSizes[i] = cached;
      } else {
        console.log(`LZMA Worker: Computing size for file ${i}`);
        singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
      }
    }

    // Process all pairs of files
    let pairCount = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        // Generate cache key for pair
        const pairKey = `lzma:${[crcs[i], crcs[j]].sort().join("-")}`;
        let combinedSize: number;

        // Check cache for pair compression
        const cachedSize = cachedSizes?.get(pairKey);
        if (cachedSize !== undefined) {
          console.log(`LZMA Worker: Using cached size for pair ${i},${j}`);
          combinedSize = cachedSize;
        } else {
          console.log(`LZMA Worker: Computing size for pair ${i},${j}`);
          combinedSize = await compressedSizePair(contents[i], contents[j]);
        }

        // Calculate NCD and store in matrix
        const ncd = calculateNCD(
            singleCompressedSizes[i],
            singleCompressedSizes[j],
            combinedSize
        );

        // Store NCD value symmetrically
        ncdMatrix[i][j] = ncd;
        ncdMatrix[j][i] = ncd;

        // Store compression data for caching
        newCompressionData.push({
          key1: crcs[i],
          key2: crcs[j],
          size1: singleCompressedSizes[i],
          size2: singleCompressedSizes[j],
          combinedSize,
        });

        pairCount++;
      }
    }

    // Send final results
    self.postMessage({
      type: "result",
      labels,
      ncdMatrix,
      newCompressionData,
    } as WorkerResultMessage);

  } catch (error) {
    // Send error message if processing fails
    self.postMessage({
      type: "error",
      message: `LZMA Worker error: ${
          error instanceof Error ? error.message : String(error)
      }`,
    } as WorkerErrorMessage);
  }
}

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<NCDInput>) => {
  await processInput(event.data);
};

export type {};