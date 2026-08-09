import type {
    CompressionPreference,
    CompressionProvenance,
    PairCompressionRecord,
    SingleCompressionRecord,
} from "./compression";
import type {ExperimentInputObjectMetadata} from "./experiment";
import type {EegExperimentContext} from "./eeg";

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
    /** Source and presentation metadata in the same order as `labels`. */
    objectMetadata?: ExperimentInputObjectMetadata[];
    /** Original filename when `kind` is an imported distance matrix. */
    sourceFileName?: string;
    /** Requested compressor. Auto-selection remains the default when omitted. */
    compression?: CompressionPreference;
    /** Present only for a verified, single-mode EEG comparison. */
    eeg?: EegExperimentContext;
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
}

export type WorkerResultMessage = {
    type: 'result';
    labels: string[];
    /** Full ordered matrix where [i][j] may differ from [j][i]. */
    directedNcdMatrix: number[][];
    /** Reflected-minimum reduction used by symmetric downstream algorithms. */
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
    directedNcdMatrix?: number[][];
    ncdMatrix: number[][];
    provenance: CompressionProvenance;
}


export interface NCDImportFormat {
    labels: string[];
    distances: number[][];
}
