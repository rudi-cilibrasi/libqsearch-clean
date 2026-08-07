/**
 * @module workers/shared/utils
 *
 * Core NCD (Normalized Compression Distance) math utilities shared across
 * compression web workers. This module provides:
 * - Text encoding helpers for concatenating string pairs before compression
 * - The NCD formula: NCD(x,y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
 * - Cache lookup logic for skipping already-computed compression pairs
 * - A generic chunk processor that drives the pairwise NCD computation loop
 *
 * Pair compression is directional. The complete ordered NCD matrix is built
 * before a separate reflected-cell matrix reduction is applied downstream.
 */

import {
    createPairCacheKey,
    PAIR_SEPARATOR,
} from "@/services/CompressionProtocol";
import type {CompressionAlgorithm, PairCompressionRecord} from "@/types/compression";

/**
 * Encode a string to a UTF-8 byte array.
 *
 * @param text - The string to encode
 * @returns UTF-8 encoded bytes
 */
export function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}


/**
 * Concatenate two strings with a delimiter for pairwise compression.
 * The delimiter `\n###\n` separates the two inputs so the compressor
 * can detect shared information between them.
 *
 * @param str1 - First input string
 * @param str2 - Second input string
 * @returns Concatenated byte array: [str1] + delimiter + [str2]
 */
export function getPairFileConcatenated(str1: string, str2: string): Uint8Array {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    const delimiter = encodeText(PAIR_SEPARATOR);
    const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);
    return combinedArray;
}

/**
 * Calculate the Normalized Compression Distance from pre-computed compressed sizes.
 *
 * Formula: NCD(x,y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
 *
 * Real compressors can produce values slightly above 1. Those values are kept
 * as diagnostic evidence instead of being silently clamped.
 *
 * @param sizeX - Compressed size of input x alone
 * @param sizeY - Compressed size of input y alone
 * @param sizeXY - Compressed size of x concatenated with y
 * @returns Non-negative empirical NCD value
 */
export function calculateNCD(sizeX: number, sizeY: number, sizeXY: number): number {
    if (!isValidCompressionSize(sizeX) || !isValidCompressionSize(sizeY) || !isValidCompressionSize(sizeXY)) {
        throw new Error(`Invalid compressed sizes: C(x)=${sizeX}, C(y)=${sizeY}, C(xy)=${sizeXY}`);
    }

    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    return Math.max(numerator / denominator, 0);
}

/** Check that a compressed size is finite and strictly positive. */
export function isValidCompressionSize(size: number) {
    return Number.isFinite(size) && size > 0;
}

export function getCachedPairSize(
    sourceContentKey: string,
    targetContentKey: string,
    algorithm: CompressionAlgorithm,
    cachedSizes?: Map<string, number>
): number | undefined {
    return cachedSizes?.get(createPairCacheKey(algorithm, sourceContentKey, targetContentKey));
}

/**
 * Process a chunk of pairwise NCD computations within a web worker.
 * Iterates over one triangular set of object pairs but emits both ordered
 * cells, (i,j) and (j,i), independently. This avoids duplicate scheduling
 * while preserving the complete directional matrix.
 * Sends progress messages back to the main thread via `self.postMessage`.
 *
 * @param startI - Starting row index (inclusive)
 * @param endI - Ending row index (exclusive)
 * @param n - Total number of items
 * @param contents - Array of input strings
 * @param singleCompressedSizes - Pre-computed compressed sizes for each individual input
 * @param algorithm - Compression algorithm name
 * @param cachedSizes - Optional cache of previously computed sizes
 * @param compressPair - Function that compresses one ordered concatenation
 * @param self - The worker's global scope for posting messages
 * @returns Array of results with NCD values and metadata for each pair
 */
export async function processChunk(
    startI: number,
    endI: number,
    n: number,
    contents: string[],
    contentKeys: string[],
    singleCompressedSizes: number[],
    algorithm: CompressionAlgorithm,
    cachedSizes: Map<string, number> | undefined,
    compressPair: (str1: string, str2: string) => Promise<number>,
    self: DedicatedWorkerGlobalScope
) {
    const results = [];

    for (let i = startI; i < endI; i++) {
        for (let j = i; j < n; j++) {
            if (i === j) {
                results.push({ i, j, ncd: 0 });
                continue;
            }

            const orderedPairs = [[i, j], [j, i]] as const;
            for (const [sourceIndex, targetIndex] of orderedPairs) {
                const sourceContentKey = contentKeys[sourceIndex];
                const targetContentKey = contentKeys[targetIndex];
                let combinedSize = getCachedPairSize(
                    sourceContentKey,
                    targetContentKey,
                    algorithm,
                    cachedSizes,
                );
                let pairRecord: PairCompressionRecord | undefined;

                if (combinedSize === undefined) {
                    combinedSize = await compressPair(contents[sourceIndex], contents[targetIndex]);
                    if (!isValidCompressionSize(combinedSize)) {
                        throw new Error(`Pair compression produced an invalid size at [${sourceIndex}][${targetIndex}]`);
                    }
                    pairRecord = {
                        sourceContentKey,
                        targetContentKey,
                        compressedSize: combinedSize,
                    };
                }

                const ncd = calculateNCD(
                    singleCompressedSizes[sourceIndex],
                    singleCompressedSizes[targetIndex],
                    combinedSize,
                );

                self.postMessage({
                    type: 'progress',
                    i: sourceIndex,
                    j: targetIndex,
                    value: ncd,
                    sizeX: singleCompressedSizes[sourceIndex],
                    sizeY: singleCompressedSizes[targetIndex],
                    sizeXY: combinedSize,
                });

                results.push({i: sourceIndex, j: targetIndex, ncd, pairRecord});
            }
        }
    }

    return results;
}
