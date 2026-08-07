import type {
  CompressionAlgorithm,
  CompressionProvenance,
  MatrixReduction,
} from "@/types/compression";

export const COMPRESSION_PIPELINE_VERSION = "ncd-pipeline-v3";
export const COMPRESSION_CACHE_SCHEMA_VERSION = 3;
export const PAIR_SEPARATOR = "\n###\n";
export const MATRIX_REDUCTION: MatrixReduction = "reflected-minimum";

export const COMPRESSOR_REVISIONS: Readonly<Record<CompressionAlgorithm, string>> = Object.freeze({
  lzma: "nmrugg-lzma-mode-9-v1",
  zstd: "zstd-wasm-level-22-v1",
});

const bytesToHex = (bytes: Uint8Array): string => (
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
);

export const fingerprintContent = async (content: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is required for reliable compression caching");
  }
  const bytes = new TextEncoder().encode(content);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
};

const cachePrefix = (algorithm: CompressionAlgorithm): string => (
  `${COMPRESSION_PIPELINE_VERSION}:${COMPRESSOR_REVISIONS[algorithm]}`
);

export const createSingleCacheKey = (
  algorithm: CompressionAlgorithm,
  contentKey: string,
): string => `${cachePrefix(algorithm)}:single:${contentKey}`;

export const createPairCacheKey = (
  algorithm: CompressionAlgorithm,
  sourceContentKey: string,
  targetContentKey: string,
): string => `${cachePrefix(algorithm)}:directed-pair:${sourceContentKey}:${targetContentKey}`;

export const reduceDirectedMatrix = (directedMatrix: readonly (readonly number[])[]): number[][] => {
  const size = directedMatrix.length;
  if (size === 0) throw new Error("Directed NCD matrix must not be empty");

  for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
    const row = directedMatrix[rowIndex];
    if (!Array.isArray(row) || row.length !== size) {
      throw new Error(`Directed NCD matrix row ${rowIndex} must contain ${size} values`);
    }
    for (let columnIndex = 0; columnIndex < size; columnIndex += 1) {
      const value = row[columnIndex];
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Directed NCD matrix contains an invalid value at [${rowIndex}][${columnIndex}]`);
      }
    }
    if (row[rowIndex] !== 0) {
      throw new Error(`Directed NCD matrix diagonal must be zero at [${rowIndex}][${rowIndex}]`);
    }
  }

  return directedMatrix.map((row, rowIndex) => row.map((value, columnIndex) => (
    rowIndex === columnIndex
      ? 0
      : Math.min(value, directedMatrix[columnIndex][rowIndex])
  )));
};

export const getCompressionProvenance = (
  algorithm: CompressionAlgorithm,
): CompressionProvenance => Object.freeze({
  source: "computed",
  algorithm,
  compressorRevision: COMPRESSOR_REVISIONS[algorithm],
  pipelineVersion: COMPRESSION_PIPELINE_VERSION,
  cacheSchemaVersion: COMPRESSION_CACHE_SCHEMA_VERSION,
  directedMatrixForm: "ordered",
  matrixReduction: MATRIX_REDUCTION,
  pairSeparator: PAIR_SEPARATOR,
});

export const IMPORTED_MATRIX_PROVENANCE: CompressionProvenance = Object.freeze({
  source: "imported",
  algorithm: "unknown",
  compressorRevision: "not provided",
  pipelineVersion: "external",
  cacheSchemaVersion: COMPRESSION_CACHE_SCHEMA_VERSION,
  directedMatrixForm: "unknown",
  matrixReduction: "unknown",
  pairSeparator: "unknown",
});
