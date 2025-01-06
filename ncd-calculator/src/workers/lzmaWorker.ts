// src/workers/lzmaWorker.ts
/// <reference lib="webworker" />

import { lzmaCode } from "@/lib/lzma";
import {
    encodeText,
    processChunk,
    calculateCRC32
} from './shared/utils';
import {
    NCDInput,
    WorkerErrorMessage,
    WorkerReadyMessage,
    WorkerResultMessage,
    WorkerStartMessage
} from "@/types/ncd.ts";

// Initialize LZMA
declare const LZMA: any;
eval(lzmaCode);

if (typeof LZMA === 'undefined') {
    throw new Error('LZMA object not available after script load');
}

async function compressWithLZMA(data: Uint8Array): Promise<number> {
    return new Promise((resolve, reject) => {
        if (!LZMA?.compress) {
            reject(new Error('LZMA compression function not available'));
            return;
        }

        const startTime = performance.now();

        LZMA.compress(data, 9, (result: Uint8Array, error: Error) => {
            if (error) {
                console.error('LZMA Worker: Compression error:', error);
                reject(error);
            } else {
                const duration = performance.now() - startTime;
                console.log(`LZMA Worker: Compressed ${data.length} bytes to ${result.length} bytes in ${duration.toFixed(2)}ms`);
                resolve(result.length);
            }
        });
    });
}

async function compressedSizeSingle(str: string): Promise<number> {
    try {
        console.log('LZMA Worker: Compressing single string of length:', str.length);
        const encoded = encodeText(str);
        return await compressWithLZMA(encoded);
    } catch (error) {
        console.error('LZMA Worker: Single compression error:', error);
        throw error;
    }
}

async function compressedSizePair(str1: string, str2: string): Promise<number> {
    try {
        console.log('LZMA Worker: Processing pair - lengths:', str1.length, str2.length);

        const encoded1 = encodeText(str1);
        const encoded2 = encodeText(str2);
        const delimiter = encodeText('\n###\n');

        const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
        combinedArray.set(encoded1, 0);
        combinedArray.set(delimiter, encoded1.length);
        combinedArray.set(encoded2, encoded1.length + delimiter.length);

        return await compressWithLZMA(combinedArray);
    } catch (error) {
        console.error('LZMA Worker: Pair compression error:', error);
        throw error;
    }
}

function generateCacheKey(content: string): string {
    const encoded = encodeText(content);
    const crc = calculateCRC32(encoded);
    return `lzma:${crc}`;
}

async function handleMessage(event: MessageEvent<NCDInput>) {
    console.log('LZMA Worker: Received message:', {
        contentLength: event.data.contents?.length,
        labelLength: event.data.labels?.length,
        hasCachedSizes: !!event.data.cachedSizes
    });

    try {
        const { labels, contents, cachedSizes } = event.data;
        if (!labels?.length || !contents?.length) {
            throw new Error('Invalid input data');
        }

        const n = contents.length;
        const totalPairs = (n * (n - 1)) / 2;

        self.postMessage({
            type: 'start',
            totalItems: n,
            totalPairs
        } as WorkerStartMessage);

        // Process individual files first
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));
        const allResults = [];

        // Process individual files with cache awareness
        console.log('LZMA Worker: Computing individual compressed sizes');
        for (let i = 0; i < n; i++) {
            const key = generateCacheKey(contents[i]);
            const cached = cachedSizes?.get(key);

            if (cached) {
                console.log(`LZMA Worker: Using cached size for item ${i}`);
                singleCompressedSizes[i] = cached;
            } else {
                try {
                    const startTime = performance.now();
                    singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
                    const duration = performance.now() - startTime;
                    console.log(`LZMA Worker: Item ${i + 1}/${n} compressed in ${duration.toFixed(2)}ms`);
                } catch (error) {
                    console.error(`LZMA Worker: Error processing item ${i}:`, error);
                    singleCompressedSizes[i] = 0;
                }
            }
        }

        // Process pairs in chunks
        const CHUNK_SIZE = 3;  // Smaller chunk size for LZMA due to higher computational cost
        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const startTime = performance.now();

            const chunkResults = await processChunk(
                i, endI, n, contents,
                singleCompressedSizes,
                'lzma',
                cachedSizes,
                compressedSizePair
            );

            allResults.push(...chunkResults);

            const duration = performance.now() - startTime;
            console.log(`LZMA Worker: Chunk ${i}-${endI} processed in ${duration.toFixed(2)}ms`);

            for (const { i, j, ncd } of chunkResults) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd;
            }
        }

        console.log('LZMA Worker: Processing complete, sending results');
        self.postMessage({
            type: 'result',
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
        console.error('LZMA Worker: Fatal error:', error);
        self.postMessage({
            type: 'error',
            message: `LZMA Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } as WorkerErrorMessage);
    }
}

// Initialize the worker
self.onmessage = handleMessage;

// Send ready message
console.log('LZMA Worker: Sending ready message');
self.postMessage({
    type: 'ready',
    message: 'LZMA Worker initialized successfully'
} as WorkerReadyMessage);

export type {};