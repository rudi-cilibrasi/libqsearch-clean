import {PAIR_SEPARATOR} from "@/services/CompressionProtocol";
import type {CompressionAlgorithm} from "@/types/compression";

export type WindowType = "fixed" | "configurable";

export interface CompressorProfile {
  readonly algorithm: CompressionAlgorithm;
  readonly name: string;
  readonly family: string;
  readonly windowType: WindowType;
  /** Effective history window used by the pinned application settings. */
  readonly windowSize: number;
  /** Maximum ordered-pair input accepted by this application. */
  readonly maxInputSize: number;
  readonly description: string;
  readonly settings: string;
  readonly ncdNotes: string;
}

const MEBIBYTE = 1024 * 1024;

/**
 * The active compressor portfolio and its reproducibility-critical settings.
 *
 * The input limit is a scientific guardrail, not merely a memory limit: NCD
 * needs the compressor history window to cover x + separator + y. Algorithms
 * with a smaller window are rejected before a worker starts.
 */
export const COMPRESSOR_PROFILES: Readonly<Record<CompressionAlgorithm, CompressorProfile>> = Object.freeze({
  lzma: Object.freeze({
    algorithm: "lzma",
    name: "LZMA",
    family: "Lempel–Ziv dictionary coding with range coding",
    windowType: "configurable",
    windowSize: 128 * MEBIBYTE,
    maxInputSize: 2 * MEBIBYTE,
    description: "High-ratio baseline for text and compact research objects up to 2 MiB per pair.",
    settings: "nmrugg LZMA mode 9",
    ncdNotes: "The application limit stays below the compressor dictionary and bounds browser CPU cost.",
  }),
  zstd: Object.freeze({
    algorithm: "zstd",
    name: "Zstandard",
    family: "LZ77 with entropy coding",
    windowType: "configurable",
    windowSize: 128 * MEBIBYTE,
    maxInputSize: 128 * MEBIBYTE,
    description: "Large-window default for datasets with ordered pairs up to 128 MiB.",
    settings: "zstd-wasm level 22",
    ncdNotes: "Level 22 provides the largest window in the bundled Zstandard build.",
  }),
  gzip: Object.freeze({
    algorithm: "gzip",
    name: "gzip / DEFLATE",
    family: "LZ77 with Huffman coding",
    windowType: "fixed",
    windowSize: 32 * 1024,
    maxInputSize: 32 * 1024,
    description: "Classical, widely understood NCD baseline for ordered pairs no larger than 32 KiB.",
    settings: "pako 3, gzip framing, DEFLATE level 9",
    ncdNotes: "DEFLATE has a fixed 32 KiB history window, so larger pairs are rejected as unreliable.",
  }),
  brotli: Object.freeze({
    algorithm: "brotli",
    name: "Brotli",
    family: "LZ77 with context modeling, Huffman coding, and a static dictionary",
    windowType: "configurable",
    windowSize: 4 * MEBIBYTE,
    maxInputSize: 4 * MEBIBYTE,
    description: "Modern high-ratio comparison codec for text-oriented ordered pairs up to 4 MiB.",
    settings: "brotli-wasm 3, quality 11, default lgwin 22",
    ncdNotes: "The 4 MiB limit matches the encoder's default 2^22-byte history window.",
  }),
});

export interface CompressorValidation {
  readonly valid: boolean;
  readonly combinedSize: number;
  readonly warning?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MEBIBYTE) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / MEBIBYTE).toFixed(2)} MiB`;
};

/** Validate the largest ordered pair against the selected compressor window. */
export function validateWindowForNCD(
  algorithm: CompressionAlgorithm,
  size1: number,
  size2: number,
): CompressorValidation {
  if (![size1, size2].every((size) => Number.isFinite(size) && size >= 0)) {
    throw new Error("Compression input sizes must be finite, non-negative byte counts");
  }

  const profile = COMPRESSOR_PROFILES[algorithm];
  const separatorSize = new TextEncoder().encode(PAIR_SEPARATOR).length;
  const combinedSize = size1 + size2 + separatorSize;

  if (combinedSize > profile.maxInputSize || combinedSize > profile.windowSize) {
    return {
      valid: false,
      combinedSize,
      warning:
        `${profile.name} cannot produce a reliable NCD for this set: the largest ordered pair is `
        + `${formatBytes(combinedSize)}, above its ${formatBytes(profile.windowSize)} history window. `
        + "Choose a larger-window compressor or reduce the object sizes.",
    };
  }

  if (combinedSize > profile.windowSize * 0.8) {
    return {
      valid: true,
      combinedSize,
      warning:
        `The largest ordered pair uses ${Math.round((combinedSize / profile.windowSize) * 100)}% `
        + `of the ${profile.name} history window.`,
    };
  }

  return {valid: true, combinedSize};
}
