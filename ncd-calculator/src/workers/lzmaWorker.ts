/// <reference lib="webworker" />

import * as LZMA from 'lzma';
import { encodeText, calculateCRC32 } from "./shared/utils";
import {
  NCDInput,
  WorkerErrorMessage,
  WorkerReadyMessage,
  WorkerResultMessage,
  WorkerStartMessage,
} from "@/types/ncd";

let isInitialized = false;

async function initializelzmaInstance(): Promise<void> {
  if (isInitialized) return;

  return new Promise((resolve, reject) => {
    try {
      // Verify lzmaInstance is available

      // Test compression
      LZMA.compress("test", 1, (result) => {
        if (!result) {
          reject(new Error("lzmaInstance test compression failed"));
          return;
        }
        isInitialized = true;
        console.log("lzmaInstance Worker: Successfully initialized");
        resolve();
      });
    } catch (error) {
      reject(
        new Error(
          "lzmaInstance initialization failed: " +
            (error instanceof Error ? error.message : String(error))
        )
      );
    }
  });
}

function compressWithlzmaInstance(data: Uint8Array): Promise<number> {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();

    LZMA.compress(data, 1, (result) => {
      if (!result) {
        reject(new Error("Compression failed"));
        return;
      }
      const duration = performance.now() - startTime;
      console.log(
        `lzmaInstance Worker: Compressed ${data.length} bytes to ${
          result.length
        } bytes in ${duration.toFixed(2)}ms`
      );
      resolve(result.length);
    });
  });
}

async function compressedSizeSingle(str: string): Promise<number> {
  try {
    console.log(
      "lzmaInstance Worker: Compressing single string of length:",
      str.length
    );
    const encoded = encodeText(str);
    return await compressWithlzmaInstance(encoded);
  } catch (error) {
    console.error("lzmaInstance Worker: Single compression error:", error);
    throw error;
  }
}

async function compressedSizePair(str1: string, str2: string): Promise<number> {
  try {
    console.log(
      "lzmaInstance Worker: Processing pair - lengths:",
      str1.length,
      str2.length
    );
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    const delimiter = encodeText("\n###\n");

    const combinedArray = new Uint8Array(
      encoded1.length + delimiter.length + encoded2.length
    );
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);

    return await compressWithlzmaInstance(combinedArray);
  } catch (error) {
    console.error("lzmaInstance Worker: Pair compression error:", error);
    throw error;
  }
}

function calculateNCD(sizeX: number, sizeY: number, sizeXY: number): number {
  if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
    console.error("Invalid compressed sizes:", { sizeX, sizeY, sizeXY });
    return 1;
  }

  const numerator = sizeXY - Math.min(sizeX, sizeY);
  const denominator = Math.max(sizeX, sizeY);
  return Math.min(Math.max(numerator / denominator, 0), 1);
}

async function handleMessage(event: MessageEvent<NCDInput>) {
  try {
    // Initialize lzmaInstance if not already done
    if (!isInitialized) {
      await initializelzmaInstance();
    }

    const { labels, contents, cachedSizes } = event.data;
    if (!labels?.length || !contents?.length) {
      throw new Error("Invalid input data");
    }

    const n = contents.length;
    const totalPairs = (n * (n - 1)) / 2;

    self.postMessage({
      type: "start",
      totalItems: n,
      totalPairs,
    } as WorkerStartMessage);

    // Calculate all CRCs and encoded contents once
    console.log("lzmaInstance Worker: Preparing content and CRCs");
    const encodedContents = contents.map((content) => encodeText(content));
    const crcs = encodedContents.map((buffer) => calculateCRC32(buffer));

    // Process individual files
    const singleCompressedSizes = new Array(n);
    const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));
    const newCompressionData = [];

    // Process individual files with cache awareness
    console.log("lzmaInstance Worker: Processing individual files");
    for (let i = 0; i < n; i++) {
      const key = `lzma:${crcs[i]}`;
      const cached = cachedSizes?.get(key);

      if (cached !== undefined) {
        console.log(`lzmaInstance Worker: Using cached size for file ${i}`);
        singleCompressedSizes[i] = cached;
      } else {
        console.log(`lzmaInstance Worker: Computing size for file ${i}`);
        singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
      }
    }

    // Process pairs
    console.log("lzmaInstance Worker: Processing pairs");
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pairKey = `lzma:${[crcs[i], crcs[j]].sort().join("-")}`;
        let combinedSize: number;

        const cachedSize = cachedSizes?.get(pairKey);
        if (cachedSize !== undefined) {
          console.log(
            `lzmaInstance Worker: Using cached size for pair ${i},${j}`
          );
          combinedSize = cachedSize;
        } else {
          console.log(`lzmaInstance Worker: Computing size for pair ${i},${j}`);
          combinedSize = await compressedSizePair(contents[i], contents[j]);
        }

        const ncd = calculateNCD(
          singleCompressedSizes[i],
          singleCompressedSizes[j],
          combinedSize
        );

        ncdMatrix[i][j] = ncd;
        ncdMatrix[j][i] = ncd;

        newCompressionData.push({
          key1: crcs[i],
          key2: crcs[j],
          size1: singleCompressedSizes[i],
          size2: singleCompressedSizes[j],
          combinedSize,
        });

        self.postMessage({
          type: "progress",
          i,
          j,
          value: ncd,
          sizeX: singleCompressedSizes[i],
          sizeY: singleCompressedSizes[j],
          sizeXY: combinedSize,
        });
      }
    }

    console.log("lzmaInstance Worker: Processing complete, sending results");
    self.postMessage({
      type: "result",
      labels,
      ncdMatrix,
      newCompressionData,
    } as WorkerResultMessage);
  } catch (error) {
    console.error("lzmaInstance Worker: Fatal error:", error);
    self.postMessage({
      type: "error",
      message: `lzmaInstance Worker error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    } as WorkerErrorMessage);
  }
}

async function initializeWorker() {
  try {
    await initializelzmaInstance();
    console.log("lzmaInstance Worker: Sending ready message");
    self.postMessage({
      type: "ready",
      message: "lzmaInstance Worker initialized successfully",
    } as WorkerReadyMessage);
  } catch (error) {
    console.error("lzmaInstance Worker: Initialization failed:", error);
    self.postMessage({
      type: "error",
      message: `lzmaInstance Worker initialization failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    } as WorkerErrorMessage);
  }
}

// Handle messages
self.onmessage = handleMessage;

// Initialize the worker immediately
initializeWorker();

export type {};
