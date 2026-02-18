/**
 * @module workers/shared/utils
 *
 * Core NCD (Normalized Compression Distance) math utilities shared across
 * compression web workers. This module provides:
 * - Text encoding helpers for concatenating string pairs before compression
 * - CRC32 hashing for content-addressable compression caching
 * - The NCD formula: NCD(x,y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
 * - Cache lookup logic for skipping already-computed compression pairs
 * - A generic chunk processor that drives the pairwise NCD computation loop
 *
 * Used by lzmaWorker.ts and zstdWorker.ts.
 */

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
export async function getPairFileConcatenated(str1: string, str2: string): Promise<Uint8Array> {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    const delimiter = encodeText('\n###\n');
    const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);
    return combinedArray;
}

/**
 * Generate the CRC32 lookup table using the standard polynomial 0xEDB88320.
 *
 * @returns 256-entry lookup table for CRC32 computation
 */
export function getCRC32GeneratedTable(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[i] = crc >>> 0;
    }
    return table;
}

/**
 * Compute a CRC32 checksum of binary data, returned as an 8-character hex string.
 * Used as a content-addressable key for caching compression results.
 *
 * @param data - Binary data to hash
 * @returns 8-character lowercase hex string (e.g., "a1b2c3d4")
 */
export function calculateCRC32(data: Uint8Array): string {
    const table = getCRC32GeneratedTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    return (~crc >>> 0).toString(16).padStart(8, '0');
}

/**
 * Calculate the Normalized Compression Distance from pre-computed compressed sizes.
 *
 * Formula: NCD(x,y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
 *
 * Result is clamped to [0, 1]. Returns 1 on invalid input sizes.
 *
 * @param sizeX - Compressed size of input x alone
 * @param sizeY - Compressed size of input y alone
 * @param sizeXY - Compressed size of x concatenated with y
 * @returns NCD value between 0 (identical) and 1 (maximally different)
 */
export function calculateNCD(sizeX: number, sizeY: number, sizeXY: number): number {
    if (!isValidCompressionSize(sizeX) || !isValidCompressionSize(sizeY) || !isValidCompressionSize(sizeXY)) {
        console.error('Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1;
    }

    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    return Math.min(Math.max(numerator / denominator, 0), 1);
}

/** Check that a compressed size is non-negative (valid). */
export function isValidCompressionSize(size: number) {
    return size >= 0;
}

/**
 * Look up cached individual and pairwise compressed sizes for a content pair.
 * Cache keys are `{algorithm}:{crc32}` for singles and `{algorithm}:{crc1}-{crc2}` for pairs.
 *
 * @param content1 - First input string
 * @param content2 - Second input string
 * @param algorithm - Compression algorithm name (e.g., "lzma", "zstd")
 * @param cachedSizes - Map of cache keys to compressed sizes
 * @returns Cached sizes if all three are found, or null if any is missing
 */
export function getCachedSizes(
    content1: string,
    content2: string,
    algorithm: string,
    cachedSizes?: Map<string, number>
) {
    if (!cachedSizes) return null;

    const crc1 = calculateCRC32(encodeText(content1));
    const crc2 = calculateCRC32(encodeText(content2));

    const key1 = `${algorithm}:${crc1}`;
    const key2 = `${algorithm}:${crc2}`;

    const size1 = cachedSizes.get(key1);
    const size2 = cachedSizes.get(key2);

    if (size1 === undefined || size2 === undefined) return null;

    const pairKey = `${algorithm}:${[crc1, crc2].sort().join('-')}`;
    const combinedSize = cachedSizes.get(pairKey);

    if (combinedSize === undefined) return null;

    return { size1, size2, combinedSize, key1: crc1, key2: crc2 };
}

/**
 * Process a chunk of pairwise NCD computations within a web worker.
 * Iterates over pairs (i, j) where startI ≤ i < endI and i ≤ j < n,
 * computing NCD for each pair either from cache or by compressing.
 * Sends progress messages back to the main thread via `self.postMessage`.
 *
 * @param startI - Starting row index (inclusive)
 * @param endI - Ending row index (exclusive)
 * @param n - Total number of items
 * @param contents - Array of input strings
 * @param singleCompressedSizes - Pre-computed compressed sizes for each individual input
 * @param algorithm - Compression algorithm name
 * @param cachedSizes - Optional cache of previously computed sizes
 * @param compressPair - Function to compress a concatenated pair and return its size
 * @param self - The worker's global scope for posting messages
 * @returns Array of results with NCD values and metadata for each pair
 */
export async function processChunk(
    startI: number,
    endI: number,
    n: number,
    contents: string[],
    singleCompressedSizes: number[],
    algorithm: string,
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

            try {
                const cachedResult = getCachedSizes(contents[i], contents[j], algorithm, cachedSizes);
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
                    combinedSize = await compressPair(contents[i], contents[j]);
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
                });

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