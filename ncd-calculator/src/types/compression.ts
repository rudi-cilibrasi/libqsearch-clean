export const COMPRESSION_ALGORITHMS = ["lzma", "zstd", "gzip", "brotli"] as const;
export type CompressionAlgorithm = typeof COMPRESSION_ALGORITHMS[number];
export type CompressionPreference = CompressionAlgorithm | "auto";

export const isCompressionPreference = (value: unknown): value is CompressionPreference => (
  value === "auto" || COMPRESSION_ALGORITHMS.some((algorithm) => algorithm === value)
);

export type DirectedMatrixForm = "ordered";
export type MatrixReduction = "reflected-minimum";

export interface CompressionProvenance {
  readonly source: "computed" | "imported";
  readonly algorithm: CompressionAlgorithm | "unknown";
  readonly compressorRevision: string;
  readonly pipelineVersion: string;
  readonly cacheSchemaVersion: number;
  readonly directedMatrixForm: DirectedMatrixForm | "unknown";
  readonly matrixReduction: MatrixReduction | "unknown";
  readonly pairSeparator: string;
}

export interface PreparedCompressionInput {
  readonly algorithm: CompressionAlgorithm;
  readonly reason: string;
  readonly warning?: string;
  readonly contentKeys: string[];
  readonly cachedSizes: Map<string, number>;
  readonly provenance: CompressionProvenance;
}

export interface SingleCompressionRecord {
  readonly contentKey: string;
  readonly compressedSize: number;
}

export interface PairCompressionRecord {
  readonly sourceContentKey: string;
  readonly targetContentKey: string;
  readonly compressedSize: number;
}
