export type CompressionAlgorithm = "lzma" | "zstd";

export type PairSymmetrization = "minimum-bidirectional";

export interface CompressionProvenance {
  readonly source: "computed" | "imported";
  readonly algorithm: CompressionAlgorithm | "unknown";
  readonly compressorRevision: string;
  readonly pipelineVersion: string;
  readonly cacheSchemaVersion: number;
  readonly pairSymmetrization: PairSymmetrization | "unknown";
  readonly pairSeparator: string;
}

export interface PreparedCompressionInput {
  readonly algorithm: CompressionAlgorithm;
  readonly reason: string;
  readonly contentKeys: string[];
  readonly cachedSizes: Map<string, number>;
  readonly provenance: CompressionProvenance;
}

export interface SingleCompressionRecord {
  readonly contentKey: string;
  readonly compressedSize: number;
}

export interface PairCompressionRecord {
  readonly contentKey1: string;
  readonly contentKey2: string;
  readonly compressedSize: number;
  readonly forwardSize: number;
  readonly reverseSize: number;
}
