/// <reference lib="webworker" />

import { init, compress } from '@bokuweb/zstd-wasm';
import type { NCDInput, WorkerMessage } from '../types/ncd';

let isInitialized = false;

// CRC32 table for cache key generation
const crc32Table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
        crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    crc32Table[i] = crc >>> 0;
}

function calculateCRC32(data: Uint8Array): string {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
    }
    return (~crc >>> 0).toString(16).padStart(8, '0');
}

function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}

function getCachedSizes(content1: string, content2: string, cachedSizes?: Map<string, number>) {
    if (!cachedSizes) return null;

    const crc1 = calculateCRC32(encodeText(content1));
    const crc2 = calculateCRC32(encodeText(content2));

    const key1 = `zstd:${crc1}`;
    const key2 = `zstd:${crc2}`;

    const size1 = cachedSizes.get(key1);
    const size2 = cachedSizes.get(key2);

    if (size1 === undefined || size2 === undefined) return null;

    const pairKey = `zstd:${[crc1, crc2].sort().join('-')}`;
    const combinedSize = cachedSizes.get(pairKey);

    if (combinedSize === undefined) return null;

    return { size1, size2, combinedSize, key1: crc1, key2: crc2 };
}

async function initZSTD() {
    if (!isInitialized) {
        try {
            await init();
            isInitialized = true;
            console.log('ZSTD Worker: initialized successfully');
        } catch (error) {
            console.error('ZSTD Worker: initialization failed:', error);
            throw error;
        }
    }
}

async function compressWithZSTD(data: Uint8Array): Promise<number> {
    await initZSTD();

    try {
        const compressedData = compress(data);
        return compressedData.length;
    } catch (error) {
        console.error('ZSTD Worker: Compression error:', error);
        throw error;
    }
}

async function compressedSizeSingle(str: string): Promise<number> {
    const encoded = encodeText(str);
    return await compressWithZSTD(encoded);
}

async function compressedSizePair(str1: string, str2: string): Promise<number> {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    const delimiter = encodeText('\n###\n');

    const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);

    return await compressWithZSTD(combinedArray);
}

function calculateNCD(sizeX: number, sizeY: number, sizeXY: number): number {
    if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
        console.error('Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1;
    }

    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    return Math.min(Math.max(numerator / denominator, 0), 1);
}

async function processChunk(
    startI: number,
    endI: number,
    n: number,
    contents: string[],
    singleCompressedSizes: number[],
    cachedSizes?: Map<string, number>
) {
    const results = [];

    for (let i = startI; i < endI; i++) {
        for (let j = i; j < n; j++) {
            if (i === j) {
                results.push({ i, j, ncd: 0 });
                continue;
            }

            try {
                const cachedResult = getCachedSizes(contents[i], contents[j], cachedSizes);
                let ncd: number, combinedSize: number, key1: string, key2: string;

                if (cachedResult) {
                    ncd = calculateNCD(
                        cachedResult.size1,
                        cachedResult.size2,
                        cachedResult.combinedSize
                    );
                    combinedSize = cachedResult.combinedSize;
                    key1 = cachedResult.key1;
                    key2 = cachedResult.key2;
                } else {
                    combinedSize = await compressedSizePair(contents[i], contents[j]);
                    const encoded1 = encodeText(contents[i]);
                    const encoded2 = encodeText(contents[j]);
                    key1 = calculateCRC32(encoded1);
                    key2 = calculateCRC32(encoded2);
                    ncd = calculateNCD(
                        singleCompressedSizes[i],
                        singleCompressedSizes[j],
                        combinedSize
                    );
                }

                self.postMessage({
                    type: 'progress',
                    i,
                    j,
                    value: ncd,
                    sizeX: singleCompressedSizes[i],
                    sizeY: singleCompressedSizes[j],
                    sizeXY: combinedSize
                } as WorkerMessage);

                results.push({
                    i, j, ncd, key1, key2,
                    size1: singleCompressedSizes[i],
                    size2: singleCompressedSizes[j],
                    combinedSize
                });
            } catch (error) {
                console.error(`Error processing pair (${i},${j}):`, error);
                results.push({ i, j, ncd: 1 });
            }
        }
    }

    return results;
}

async function handleMessage(event: MessageEvent<NCDInput>) {
    try {
        await initZSTD();

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
        } as WorkerMessage);

        // Process individual files first
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));

        for (let i = 0; i < n; i++) {
            const encoded = encodeText(contents[i]);
            const crc = calculateCRC32(encoded);
            const key = `zstd:${crc}`;
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
                cachedSizes
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
        } as WorkerMessage);

    } catch (error) {
        self.postMessage({
            type: 'error',
            message: `ZSTD Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`
        } as WorkerMessage);
    }
}

// Initialize the worker
self.onmessage = handleMessage;

// Send ready message
self.postMessage({
    type: 'ready',
    message: 'ZSTD Worker initialized successfully'
} as WorkerMessage);

export type {};