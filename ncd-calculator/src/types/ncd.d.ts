import type {
    CompressionProvenance,
    PairCompressionRecord,
    SingleCompressionRecord,
} from "./compression";

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
    /** Stable identifiers used by compression, caches, and QSearch. */
    labels: string[];
    /** Human-readable labels in the same order as `labels`. */
    displayLabels?: string[];
    kind?: 'objects' | 'distance-matrix';
    cachedSizes?: Map<string, number>;
    contentKeys?: string[];
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
}


export type WorkerProgressMessage = {
    type: 'progress';
    i: number;
    j: number;
    value: number;
    sizeX: number;
    sizeY: number;
    sizeXY: number;
    sizeXYForward?: number;
    sizeXYReverse?: number;
}

export type WorkerResultMessage = {
    type: 'result';
    labels: string[];
    ncdMatrix: number[][];
    provenance: CompressionProvenance;
    singleCompressionData: SingleCompressionRecord[];
    pairCompressionData: PairCompressionRecord[];
}


export type WorkerErrorMessage = {
    type: 'error';
    message: string;
}


export type NCDMatrixResponse = {
    labels: string[];
    ncdMatrix: number[][];
    provenance: CompressionProvenance;
}


export interface NCDImportFormat {
    labels: string[];
    distances: number[][];
}
