/**
 * CompressorCapabilities — tracks window size properties for each compression algorithm.
 *
 * NCD requires the compressor's window to cover the ENTIRE input (both files concatenated).
 * If window < input size, the compressor only "sees" a portion of the data, producing
 * meaningless NCD values (typically showing unrelated files as similar, or vice versa).
 *
 * Window types:
 *   a) FIXED     — compressor has a hardcoded window size that cannot be changed
 *   b) CONFIGURABLE — window size can be set (up to some maximum)
 *   c) INFINITE  — compressor considers all prior input (e.g., PPM, some BWT variants)
 *
 * References:
 *   - Cilibrasi & Vitányi, "Clustering by Compression" (2005)
 *   - https://en.wikipedia.org/wiki/Normalized_compression_distance
 */

export type WindowType = "fixed" | "configurable" | "infinite";

export interface CompressorProfile {
  /** Algorithm identifier */
  algorithm: string;
  /** Human-readable name */
  name: string;
  /** Window type classification */
  windowType: WindowType;
  /**
   * Effective window size in bytes.
   * - For FIXED: the hardcoded window size
   * - For CONFIGURABLE: the currently configured / maximum configurable window
   * - For INFINITE: Infinity
   */
  windowSize: number;
  /**
   * Maximum possible window size (for configurable compressors).
   * Equal to windowSize for fixed/infinite types.
   */
  maxWindowSize: number;
  /** Maximum input size the compressor accepts */
  maxInputSize: number;
  /** Notes about NCD suitability */
  notes: string;
}

/**
 * Known compressor profiles used in this application.
 *
 * LZMA: Dictionary-based, configurable from 4KB to 128MB.
 *   - Our implementation dynamically sizes the dictionary to fit the input.
 *   - At level 9 (max), dictionary = next power of 2 above input size, up to 128MB.
 *   - SAFE for NCD: dictionary always >= input size (up to 128MB limit).
 *
 * ZSTD: Block-based with configurable window, up to ~128MB at level 22.
 *   - Window size depends on compression level and input size.
 *   - At level 22 (our setting), window can reach ~128MB.
 *   - SAFE for NCD if input < window size; needs validation.
 *
 * gzip/zlib (not currently used, but for reference):
 *   - FIXED 32KB window (LZ77). Cannot be changed.
 *   - UNSAFE for NCD with inputs > 32KB — only compares trailing 32KB.
 *   - Should NEVER be used for NCD on genomic data (typically >>32KB).
 *
 * bzip2 (not currently used, but for reference):
 *   - Configurable block size: 100KB to 900KB.
 *   - BWT-based, so within a block it has "infinite" context.
 *   - SAFE for NCD if input fits in one block; warn otherwise.
 */
export const COMPRESSOR_PROFILES: Record<string, CompressorProfile> = {
  lzma: {
    algorithm: "lzma",
    name: "LZMA",
    windowType: "configurable",
    windowSize: 128 * 1024 * 1024, // dynamically set, max 128MB
    maxWindowSize: 128 * 1024 * 1024,
    maxInputSize: 2 * 1024 * 1024, // current app limit
    notes:
      "Dictionary auto-sized to input. Safe for NCD up to 128MB. " +
      "Our app limits LZMA to 2MB inputs for performance.",
  },
  zstd: {
    algorithm: "zstd",
    name: "Zstandard",
    windowType: "configurable",
    windowSize: 128 * 1024 * 1024, // at level 22
    maxWindowSize: 128 * 1024 * 1024,
    maxInputSize: 128 * 1024 * 1024,
    notes:
      "Window size depends on level. At level 22 (max), window up to ~128MB. " +
      "Safe for NCD within this range.",
  },
  gzip: {
    algorithm: "gzip",
    name: "gzip (LZ77)",
    windowType: "fixed",
    windowSize: 32 * 1024, // 32KB, hardcoded in deflate
    maxWindowSize: 32 * 1024,
    maxInputSize: Infinity,
    notes:
      "FIXED 32KB window. UNSAFE for NCD with inputs > 32KB. " +
      "Only compares the last 32KB of input — will produce incorrect NCD " +
      "for genomic sequences, documents, or any file larger than 32KB.",
  },
  bzip2: {
    algorithm: "bzip2",
    name: "bzip2 (BWT)",
    windowType: "configurable",
    windowSize: 900 * 1024, // default max block size
    maxWindowSize: 900 * 1024,
    maxInputSize: Infinity,
    notes:
      "BWT-based with configurable block size (100KB–900KB). " +
      "Effectively infinite context within a block. " +
      "Safe for NCD if combined input fits in one block.",
  },
};

/**
 * Validate that a compressor's window is adequate for the given input sizes.
 *
 * @param algorithm - compressor algorithm key
 * @param size1 - size of first input in bytes
 * @param size2 - size of second input in bytes
 * @returns validation result with warning if window is too small
 */
export function validateWindowForNCD(
  algorithm: string,
  size1: number,
  size2: number
): { valid: boolean; warning?: string } {
  const profile = COMPRESSOR_PROFILES[algorithm];
  if (!profile) {
    return {
      valid: false,
      warning: `Unknown compressor: ${algorithm}. Cannot verify window size adequacy.`,
    };
  }

  // Infinite window is always fine
  if (profile.windowType === "infinite") {
    return { valid: true };
  }

  // The concatenated size is what matters — NCD compresses x+y together
  const combinedSize = size1 + size2;

  if (combinedSize > profile.windowSize) {
    const windowMB = (profile.windowSize / (1024 * 1024)).toFixed(1);
    const inputMB = (combinedSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      warning:
        `${profile.name} has a ${profile.windowType} window of ${windowMB}MB, ` +
        `but the combined input is ${inputMB}MB. NCD results will be unreliable — ` +
        `the compressor can only compare a portion of the data. ` +
        `Use a compressor with a larger window or reduce input size.`,
    };
  }

  // Warn if we're close to the limit (>80% of window)
  if (combinedSize > profile.windowSize * 0.8) {
    const pct = ((combinedSize / profile.windowSize) * 100).toFixed(0);
    return {
      valid: true,
      warning:
        `Combined input uses ${pct}% of ${profile.name}'s window. ` +
        `Results should be valid but consider a compressor with more headroom.`,
    };
  }

  return { valid: true };
}
