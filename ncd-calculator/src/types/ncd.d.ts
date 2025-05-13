export interface CompressionStats {
    processedPairs: number;
    totalPairs: number;
    bytesProcessed: number;
    startTime: number;
    currentPair: [number, number] | null;
    lastNcdScore: number | null;
}


export interface NCDInput {
    contents: string[];
    labels: string[];
    cachedSizes?: Map<string, number>;
}


export type WorkerMessage =
    WorkerReadyMessage
    | WorkerStartMessage
    | WorkerProgressMessage
    | WorkerResultMessage
    | WorkerErrorMessage;

export type WorkerReadyMessage = {
    type: 'ready';
    message: string;
}

export type WorkerStartMessage = {
    type: 'start';
    totalItems: number;
    totalPairs: number;
    contents: string[];
}


export type WorkerProgressMessage = {
    type: 'progress';
    i: number;
    j: number;
    value: number;
    sizeX: number;
    sizeY: number;
    sizeXY: number;
}

export type WorkerResultMessage = {
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
}


export type WorkerErrorMessage = {
    type: 'error';
    message: string;
}


export type NCDMatrixResponse = {
    labels: string[];
    ncdMatrix: number[][];
}


export interface NCDImportFormat {
    labels: string[];
    distances: number[][];
}
