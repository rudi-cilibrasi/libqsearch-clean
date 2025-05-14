/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
import {calculateCRC32, calculateNCD, encodeText, processChunk} from "./shared/utils";
import type {
  NCDInput,
  WorkerErrorMessage,
  WorkerResultMessage,
  WorkerStartMessage,
  WorkerReadyMessage,
  WorkerProgressMessage
} from "@/types/ncd";
import { LZMA } from '../libs/lzma';

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
          (result) => {
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
        (result) => {
          clearTimeout(timeoutId);
          if (result === false) {
            reject(new Error('LZMA compression failed'));
            return;
          }
          resolve(new Uint8Array(result));
        },
        (percent: number) => {
          console.log(`LZMA compression progress: ${(percent * 100).toFixed(2)}%`);
          
          // Report progress to main thread
          self.postMessage({
            type: 'progress',
            message: `Compressing data: ${(percent * 100).toFixed(0)}%`,
            progress: percent
          } as WorkerProgressMessage);
        }
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
    const delimiter = encodeText("\n###\n");
    
    // Check if combined size exceeds LZMA limit
    const totalSize = encoded1.length + delimiter.length + encoded2.length;
    if (totalSize > COMPRESSION_SETTINGS.MAX_FILE_SIZE) {
      throw new Error(`Combined file size (${totalSize} bytes) exceeds LZMA limit of ${COMPRESSION_SETTINGS.MAX_FILE_SIZE} bytes`);
    }
    
    console.log("LZMA Worker: Processing pair", {
      size1: encoded1.length,
      size2: encoded2.length,
      totalSize,
      dictSize: getOptimalDictionarySize(totalSize)
    });
    
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

// Process input data and compute NCD matrix
async function processInput(input: NCDInput): Promise<void> {
  try {
    if (!isLzmaInitialized) {
      await initializeLzmaWorker();
    }
    
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
    const contentBuffers = contents.map((content) => encodeText(content));
    const crcs = contentBuffers.map(buffer => calculateCRC32(buffer));
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
    
    // Process all pairs of files using chunking for better performance
    const CHUNK_SIZE = 3; // Process 3 pairs at a time
    const allResults = [];
    
    for (let i = 0; i < n; i += CHUNK_SIZE) {
      const endI = Math.min(i + CHUNK_SIZE, n);
      const chunkResults = await processChunk(
        i, endI, n, contents,
        singleCompressedSizes,
        'lzma',
        cachedSizes,
        compressedSizePair,
        self
      );
      
      allResults.push(...chunkResults);
      
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
      newCompressionData: allResults.map(result => ({
        key1: result.key1,
        key2: result.key2,
        size1: result.size1,
        size2: result.size2,
        combinedSize: result.combinedSize
      }))
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
