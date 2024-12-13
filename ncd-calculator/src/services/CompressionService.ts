
export interface CompressionDecision {
    needsAdvanced: boolean;
    recommendedAlgo: "gzip" | "lzma";
    reason: string;
}

export const GZIP_MAX_WINDOW: number = 32 * 1024 + 2048;
export const MAXIMUM_TOTAL_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export class CompressionService {


    static needsAdvancedCompression(file1Size: number, file2Size: number) {
        const combinedSize = file1Size + file2Size;
        if (combinedSize <= GZIP_MAX_WINDOW) {
            return {
                needsAdvanced: false,
                recommendedAlgo: "gzip",
                reason: `Using GZIP (combined size: ${(combinedSize / 1024).toFixed(1)}KB)`
            } as CompressionDecision;
        }

        return {
            needsAdvanced: true,
            recommendedAlgo: "lzma",
            reason: `Using LZMA (combined size: ${(combinedSize / 1024).toFixed(1)}KB exceeds GZIP window)`
        } as CompressionDecision;
    }

    static validateFiles(fileContents: string[]): {
        isValid: boolean;
        message: string;
        sizes: number[]
    } {
        const sizes = fileContents.map(content => new TextEncoder().encode(content).length);
        const totalSize = sizes.reduce((a, b) => a + b, 0);
        if (totalSize > MAXIMUM_TOTAL_FILE_SIZE) {
            return {
                isValid: false,
                message: "The combined size of the files exceeds the maximum limit of 100MB",
                sizes: sizes
            }
        } else {
            return {
                isValid: true,
                message: `${fileContents.length} files validated, total size: ${(totalSize / 1024).toFixed(1)}KB`,
                sizes: sizes
            }
        }
    }
}