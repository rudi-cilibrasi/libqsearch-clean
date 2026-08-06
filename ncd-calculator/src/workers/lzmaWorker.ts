/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
import {encodeText, getPairFileConcatenated, processChunk} from "./shared/utils";
import type {
  NCDInput,
  WorkerErrorMessage,
  WorkerResultMessage,
  WorkerStartMessage,
  WorkerReadyMessage,
} from "@/types/ncd";
import { LZMA } from '../libs/lzma';
import {createSingleCacheKey, getCompressionProvenance} from "@/services/CompressionProtocol";
import type {PairCompressionRecord, SingleCompressionRecord} from "@/types/compression";

// Configuration settings for LZMA compression
// These settings are optimized for NCD computation with files ≤1MB
const COMPRESSION_SETTINGS = {
  // Maximum file size limit for LZMA compression
  // LZMA is most effective for smaller files where compression ratio is critical
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2MB
  
  // Dictionary size limits for LZMA
  // Minimum: 4KB (2^12) - Suitable for very small files
  // Maximum: 128MB (2^27) - Upper limit for LZMA dictionary
  MIN_DICT_SIZE: Math.pow(2, 12),
  MAX_DICT_SIZE: Math.pow(2, 27),
  
  // Use maximum compression mode (9) for best compression ratio
  // This is crucial for NCD computation accuracy
  COMPRESSION_MODE: 9,
  
  // Timeout for compression operations (ms)
  OPERATION_TIMEOUT: 900000 // 15 minutes
} as const;

let isLzmaInitialized = false;

// Initialize the LZMA worker with proper environment detection
async function initializeLzmaWorker() {
  try {
    // Check if we're in Node.js or browser environment
    const isNode = typeof globalThis.process === 'object' &&
      typeof globalThis.process?.versions === 'object' &&
      typeof globalThis.process?.versions?.node !== 'undefined';
    
    console.log(`LZMA Worker: Initializing in ${isNode ? 'Node.js' : 'browser'} environment`);
    
    // For LZMA, we don't need to load external WASM binaries
    // But we should verify the LZMA object is available and working
    if (!LZMA || typeof LZMA.compress !== 'function') {
      throw new Error('LZMA library not properly loaded');
    }
    
    // Test a minimal compression to ensure the LZMA library works
    await new Promise<void>((resolve, reject) => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      const timeoutId = setTimeout(() => {
        reject(new Error('LZMA initialization timed out'));
      }, 10000);
      
      try {
        LZMA.compress(
          testData,
          1, // Use fastest mode for initialization test
          (result: false | number[]) => {
            clearTimeout(timeoutId);
            if (result === false) {
              reject(new Error('LZMA test compression failed'));
            } else {
              console.log('LZMA test compression successful');
              resolve();
            }
          },
          () => {} // Empty progress callback
        );
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
    
    isLzmaInitialized = true;
    
    console.log('LZMA Worker: Successfully initialized with maximum compression settings');
    
    self.postMessage({
      type: 'ready',
      message: 'LZMA Worker initialized with maximum compression settings'
    } as WorkerReadyMessage);
    
  } catch (error) {
    console.error('LZMA Worker: Initialization failed:', error);
    self.postMessage({
      type: 'error',
      message: `Failed to initialize LZMA worker: ${error instanceof Error ? error.message : String(error)}`
    } as WorkerErrorMessage);
  }
}

// Calculate optimal dictionary size based on input data size
function getOptimalDictionarySize(dataSize: number): number {
  // Round up to ensure dictionary can handle the full input
  const minRequiredSize = Math.ceil(dataSize);
  let dictSize = COMPRESSION_SETTINGS.MIN_DICT_SIZE;
  
  // Double dictionary size until it's sufficient or hits maximum
  while (dictSize < minRequiredSize && dictSize < COMPRESSION_SETTINGS.MAX_DICT_SIZE) {
    dictSize *= 2;
  }
  
  return Math.min(dictSize, COMPRESSION_SETTINGS.MAX_DICT_SIZE);
}

// Compress data using LZMA with optimal settings and timeout protection
function compressData(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const dictSize = getOptimalDictionarySize(data.length);
    
    // Add timeout protection
    const timeoutId = setTimeout(() => {
      reject(new Error(`LZMA compression timed out after ${COMPRESSION_SETTINGS.OPERATION_TIMEOUT/1000} seconds`));
    }, COMPRESSION_SETTINGS.OPERATION_TIMEOUT);
    
    console.log('LZMA Compression Parameters:', {
      inputSize: data.length,
      dictionarySize: dictSize,
      compressionMode: COMPRESSION_SETTINGS.COMPRESSION_MODE
    });
    
    try {
      LZMA.compress(
        data,
        COMPRESSION_SETTINGS.COMPRESSION_MODE,
        (result: false | number[]) => {
          clearTimeout(timeoutId);
          if (result === false) {
            reject(new Error('LZMA compression failed'));
            return;
          }
          resolve(new Uint8Array(result));
        },
        () => undefined
      );
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

// Compress a single string and return its compressed size
async function compressedSizeSingle(str: string): Promise<number> {
  try {
    const encoded = encodeText(str);
    
    if (encoded.length > COMPRESSION_SETTINGS.MAX_FILE_SIZE) {
      throw new Error(`File size (${encoded.length} bytes) exceeds LZMA limit of ${COMPRESSION_SETTINGS.MAX_FILE_SIZE} bytes`);
    }
    
    console.log("LZMA Worker: Compressing single string", {
      inputSize: encoded.length,
      dictSize: getOptimalDictionarySize(encoded.length)
    });
    
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
    const combinedArray = getPairFileConcatenated(str1, str2);

    // Check if combined size exceeds LZMA limit
    const totalSize = combinedArray.length;
    if (totalSize > COMPRESSION_SETTINGS.MAX_FILE_SIZE) {
      throw new Error(`Combined file size (${totalSize} bytes) exceeds LZMA limit of ${COMPRESSION_SETTINGS.MAX_FILE_SIZE} bytes`);
    }
    
    console.log("LZMA Worker: Processing pair", {
      size1: encoded1.length,
      size2: encoded2.length,
      totalSize,
      dictSize: getOptimalDictionarySize(totalSize)
    });
    
    const compressed = await compressData(combinedArray);
    return compressed.length;
  } catch (error) {
    console.error("LZMA Worker: Pair compression error:", error);
    throw error;
  }
}

async function compressedSizePairBoth(
  str1: string,
  str2: string,
): Promise<{forwardSize: number; reverseSize: number}> {
  const forwardSize = await compressedSizePair(str1, str2);
  const reverseSize = await compressedSizePair(str2, str1);
  return {forwardSize, reverseSize};
}

// Process input data and compute NCD matrix
async function processInput(input: NCDInput): Promise<void> {
  try {
    if (!isLzmaInitialized) {
      await initializeLzmaWorker();
    }
    
    const { labels, contents, contentKeys, cachedSizes } = input;
    
    // Validate input
    if (!labels?.length || !contents?.length || contentKeys?.length !== contents.length) {
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
    const singleCompressedSizes: number[] = new Array(n);
    const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));
    const singleCompressionData: SingleCompressionRecord[] = [];
    
    // Process individual files, using cache when available
    for (let i = 0; i < n; i++) {
      const key = createSingleCacheKey("lzma", contentKeys[i]);
      const cached = cachedSizes?.get(key);
      
      if (cached !== undefined) {
        console.log(`LZMA Worker: Using cached size for file ${i}`);
        singleCompressedSizes[i] = cached;
      } else {
        console.log(`LZMA Worker: Computing size for file ${i}`);
        singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
        singleCompressionData.push({
          contentKey: contentKeys[i],
          compressedSize: singleCompressedSizes[i],
        });
      }
    }
    
    // Process all pairs of files using chunking for better performance
    const CHUNK_SIZE = 3; // Process 3 pairs at a time
    const pairCompressionData: PairCompressionRecord[] = [];
    
    for (let i = 0; i < n; i += CHUNK_SIZE) {
      const endI = Math.min(i + CHUNK_SIZE, n);
      const chunkResults = await processChunk(
        i, endI, n, contents, contentKeys,
        singleCompressedSizes,
        'lzma',
        cachedSizes,
        compressedSizePairBoth,
        self
      );

      pairCompressionData.push(
        ...chunkResults.flatMap((result) => result.pairRecord ? [result.pairRecord] : []),
      );
      
      for (const {i, j, ncd} of chunkResults) {
        ncdMatrix[i][j] = ncd;
        ncdMatrix[j][i] = ncd;
      }
    }
    
    // Send final results
    self.postMessage({
      type: "result",
      labels,
      ncdMatrix,
      provenance: getCompressionProvenance("lzma"),
      singleCompressionData,
      pairCompressionData,
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

// Initialize worker immediately
initializeLzmaWorker();

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<NCDInput>) => {
  try {
    await processInput(event.data);
  } catch (error) {
    console.error("LZMA Worker: Uncaught error in message handler:", error);
    self.postMessage({
      type: "error",
      message: `LZMA Worker uncaught error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    } as WorkerErrorMessage);
  }
};

export type {};
