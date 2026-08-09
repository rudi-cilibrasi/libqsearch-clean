export const EEG_MANIFEST_SCHEMA = "complearn-eeg-manifest-v1" as const;
export const EEG_ASCII_SCHEMA = "complearn-eeg-ascii-v1" as const;

export type EegAnalysisMode = "condition" | "electrode";
export type EegCondition = "target" | "standard";

export interface EegAsciiEncoding {
    readonly schemaVersion: typeof EEG_ASCII_SCHEMA;
    readonly quantizationScale: number;
    readonly integerWidth: number;
    readonly clipAbsolute: number;
    readonly segmentSeparator: "--";
    readonly lineEnding: "LF";
}

export interface EegDatasetSource {
    readonly datasetId: string;
    readonly datasetVersion: string;
    readonly name: string;
    readonly doi: string | null;
    readonly url: string | null;
    readonly license: string;
    readonly subject: string;
    readonly task: string;
    readonly run: string;
    readonly exactPaperReproduction: false;
}

export interface EegPreprocessing {
    readonly software: string;
    readonly bandpassHz: readonly [number, number];
    readonly reference: string;
    readonly sourceSamplingHz: number;
    readonly outputSamplingHz: number;
    readonly epochWindowSeconds: readonly [number, number];
    readonly baselineWindowSeconds: readonly [number, number];
    readonly rejectionPeakToPeakMicrovolts: number;
    readonly averaging: {
        readonly segmentsPerObject: number;
        readonly epochsPerSegment: number;
    };
    readonly normalization: "z-score-each-average";
}

export interface EegElectrodeLocation {
    readonly name: string;
    /** Left (-1) to right (+1), for visualization only. */
    readonly x: number;
    /** Posterior (-1) to anterior (+1), for visualization only. */
    readonly y: number;
    readonly coordinateSource: string;
}

export interface EegWaveformQc {
    readonly candidateEpochs: number;
    readonly acceptedEpochs: number;
    readonly rejectedEpochs: number;
    readonly minimum: number;
    readonly maximum: number;
    readonly rms: number;
    readonly peakToPeak: number;
    readonly preview: readonly number[];
}

export interface EegObjectRecord {
    readonly id: string;
    /** Deliberately condition-blind label used before label reveal. */
    readonly label: string;
    readonly revealedLabel: string;
    readonly mode: EegAnalysisMode;
    readonly condition: EegCondition;
    readonly replicate: number;
    readonly electrode: EegElectrodeLocation;
    readonly sampleCount: number;
    readonly samplesPerSegment: number;
    readonly segmentCount: number;
    readonly asset?: string;
    readonly content?: string;
    readonly sha256: string;
    readonly utf8Bytes: number;
    readonly qc: EegWaveformQc;
}

export interface EegManifest {
    readonly schemaVersion: typeof EEG_MANIFEST_SCHEMA;
    readonly corpusId: string;
    readonly createdAt: string;
    readonly source: EegDatasetSource;
    readonly preprocessing: EegPreprocessing;
    readonly encoding: EegAsciiEncoding;
    readonly records: readonly EegObjectRecord[];
}

export interface EegObjectProvenance {
    readonly manifest: Omit<EegManifest, "records">;
    readonly record: EegObjectRecord;
    readonly imported: boolean;
}

export interface EegExperimentContext {
    readonly manifest: Omit<EegManifest, "records">;
    readonly mode: EegAnalysisMode;
    readonly records: readonly EegObjectRecord[];
}

export interface EegPortablePackage extends EegManifest {
    readonly records: readonly (EegObjectRecord & {readonly content: string})[];
}
