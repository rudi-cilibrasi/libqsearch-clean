export function encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
}


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

export function calculateCRC32(data: Uint8Array): string {
    const table = getCRC32GeneratedTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xFF];
    }
    return (~crc >>> 0).toString(16).padStart(8, '0');
}

export function calculateNCD(sizeX: number, sizeY: number, sizeXY: number): number {
    if (!isValidCompressionSize(sizeX) || !isValidCompressionSize(sizeY) || !isValidCompressionSize(sizeXY)) {
        console.error('Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1;
    }

    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    return Math.min(Math.max(numerator / denominator, 0), 1);
}

export function isValidCompressionSize(size: number) {
    return size >= 0;
}

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

// Shared worker helper that processes chunks of data
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