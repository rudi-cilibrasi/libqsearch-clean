// src/workers/gzipWorker.ts
/// <reference lib="webworker" />

import {
    encodeText,
    processChunk, calculateCRC32
} from './shared/utils';
import {
    NCDInput,
    WorkerErrorMessage,
    WorkerReadyMessage,
    WorkerResultMessage,
    WorkerStartMessage
} from "@/types/ncd.ts";

async function compressedSize(data: Uint8Array): Promise<number> {
    const stream = new Blob([data]).stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = stream.pipeThrough(compressionStream);
    const response = new Response(compressedStream);
    const compressedBlob = await response.blob();
    return compressedBlob.size;
}

async function compressedSizeSingle(str: string): Promise<number> {
    const encoded = encodeText(str);
    return await compressedSize(encoded);
}

async function compressedSizePair(str1: string, str2: string): Promise<number> {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);

    const delimiter = encodeText('\n###\n');
    const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);

    return await compressedSize(combinedArray);
}

async function handleMessage(event: MessageEvent<NCDInput>) {
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

        for (let i = 0; i < n; i++) {
            const encoded = encodeText(contents[i]);
            const crc = calculateCRC32(encoded);
            const key = `gzip:${crc}`;
            const cached = cachedSizes?.get(key);

            if (cached) {
                singleCompressedSizes[i] = cached;
            } else {
                singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
            }
        }

        // Process pairs in chunks
        const CHUNK_SIZE = 5;
        const allResults = [];

        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const chunkResults = await processChunk(
                i, endI, n, contents,
                singleCompressedSizes,
                'gzip',
                cachedSizes,
                compressedSizePair
            );

            allResults.push(...chunkResults);

            for (const { i, j, ncd } of chunkResults) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd;
            }
        }

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
        self.postMessage({
            type: 'error',
            message: `GZIP Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } as WorkerErrorMessage);
    }
}

// Initialize the worker
self.onmessage = handleMessage;

// Send ready message
self.postMessage({
    type: 'ready',
    message: 'GZIP Worker initialized successfully'
} as WorkerReadyMessage);

export type {};