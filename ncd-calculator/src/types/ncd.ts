export interface CompressedSizeCache {
    individualSize: number;
    pairSizes: Map<string, number>;
    timestamp?: number;
}

export interface NCDInput {
    contents: string[];
    labels: string[];
    cachedSizes?: Map<string, CompressedSizeCache>;
}


export interface NCDCacheResult {
    key: string;
    individualSize: number;
    pairSizes: Map<string, number>;
}

export interface CompressionResult {
    recommendedAlgo: 'gzip' | 'lzma';
    reason: string;
}


export type WorkerMessage = {
    type: 'progress';
    i: number;
    j: number;
    value: number;
} | {
    type: 'result';
    labels: string[];
    ncdMatrix: number[][];
    newCompressionData?: Array<{
        key1: string;
        key2: string;
        size1: number;
        size2: number;
        combinedSize: number;
    }>;
} | {
    type: 'error';
    message: string;
} | {
    type: 'ready';
    message: string;
};