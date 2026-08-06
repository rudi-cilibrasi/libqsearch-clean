import type {
  CompressionAlgorithm,
  CompressionProvenance,
  PairSymmetrization,
} from "@/types/compression";

export const COMPRESSION_PIPELINE_VERSION = "ncd-pipeline-v2";
export const COMPRESSION_CACHE_SCHEMA_VERSION = 2;
export const PAIR_SEPARATOR = "\n###\n";
export const PAIR_SYMMETRIZATION: PairSymmetrization = "minimum-bidirectional";

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
  contentKey1: string,
  contentKey2: string,
): string => {
  const [first, second] = [contentKey1, contentKey2].sort();
  return `${cachePrefix(algorithm)}:pair:${PAIR_SYMMETRIZATION}:${first}:${second}`;
};

export const symmetrizePairSizes = (forwardSize: number, reverseSize: number): number => {
  if (
    !Number.isFinite(forwardSize)
    || !Number.isFinite(reverseSize)
    || forwardSize <= 0
    || reverseSize <= 0
  ) {
    throw new Error("Pair compression produced an invalid size");
  }
  return Math.min(forwardSize, reverseSize);
};

export const getCompressionProvenance = (
  algorithm: CompressionAlgorithm,
): CompressionProvenance => Object.freeze({
  source: "computed",
  algorithm,
  compressorRevision: COMPRESSOR_REVISIONS[algorithm],
  pipelineVersion: COMPRESSION_PIPELINE_VERSION,
  cacheSchemaVersion: COMPRESSION_CACHE_SCHEMA_VERSION,
  pairSymmetrization: PAIR_SYMMETRIZATION,
  pairSeparator: PAIR_SEPARATOR,
});

export const IMPORTED_MATRIX_PROVENANCE: CompressionProvenance = Object.freeze({
  source: "imported",
  algorithm: "unknown",
  compressorRevision: "not provided",
  pipelineVersion: "external",
  cacheSchemaVersion: COMPRESSION_CACHE_SCHEMA_VERSION,
  pairSymmetrization: "unknown",
  pairSeparator: "unknown",
});
