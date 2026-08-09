import "@vitest/web-worker";
import {afterEach, describe, expect, test} from "vitest";
import {createRequire} from "node:module";
import {gzip} from "pako";
import {CompressionCache} from "@/cache/CompressionCache";
import {CompressionService} from "@/services/CompressionService";
import {
  COMPRESSOR_PROFILES,
  validateWindowForNCD,
} from "@/services/CompressorCapabilities";
import type {CompressionAlgorithm} from "@/types/compression";
import type {NCDInput, WorkerResultMessage} from "@/types/ncd";
import {computeNcdWithCodec} from "@/workers/shared/createNcdCompressionWorker";

const service = CompressionService.getInstance();

afterEach(() => service.terminate());

const portfolioInput = (algorithm: CompressionAlgorithm): NCDInput => {
  const biologicalCore = "ACGTTGCAACCTGACTGATCGGATCCTAGGCTAACG".repeat(100);
  const languageCore = "the archive preserves language history evidence context ".repeat(72);
  return {
    labels: ["genome-a", "genome-b", "language-a", "language-b"],
    contents: [
      `${biologicalCore}AACCGGTT`.repeat(2),
      `${biologicalCore}AACCGGTA`.repeat(2),
      `${languageCore}research compression distance`.repeat(2),
      `${languageCore}research compressor similarity`.repeat(2),
    ],
    compression: algorithm,
  };
};

const assertScientificMatrixShape = (result: WorkerResultMessage): void => {
  expect(result.ncdMatrix).toHaveLength(4);
  for (let row = 0; row < 4; row += 1) {
    expect(result.ncdMatrix[row]).toHaveLength(4);
    for (let column = 0; column < 4; column += 1) {
      const value = result.ncdMatrix[row][column];
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeCloseTo(result.ncdMatrix[column][row]);
      if (row === column) expect(value).toBe(0);
    }
  }
  expect(result.ncdMatrix[0][1]).toBeLessThan(result.ncdMatrix[0][2]);
  expect(result.ncdMatrix[2][3]).toBeLessThan(result.ncdMatrix[0][2]);
};

describe("compressor portfolio", () => {
  test("publishes four typed algorithms with reproducibility settings", () => {
    expect(CompressionService.getAvailableAlgorithms()).toEqual(["lzma", "zstd", "gzip", "brotli"]);
    expect(COMPRESSOR_PROFILES.gzip.family).toContain("Huffman");
    expect(COMPRESSOR_PROFILES.brotli.settings).toContain("quality 11");
  });

  test("enforces the compressor history window before computation", () => {
    expect(validateWindowForNCD("gzip", 16_000, 16_000).valid).toBe(true);
    expect(validateWindowForNCD("gzip", 16_384, 16_384)).toMatchObject({valid: false});
    expect(validateWindowForNCD("brotli", 2 * 1024 * 1024, 2 * 1024 * 1024)).toMatchObject({valid: false});
    expect(() => CompressionService.selectCompression("gzip", 20_000, 20_000)).toThrow(
      /32\.0 KiB history window/,
    );
  });

  test("honors an explicit choice in cache and provenance preparation", async () => {
    const prepared = await CompressionService.preprocessNcdInput(
      portfolioInput("gzip"),
      new CompressionCache(null),
    );

    expect(prepared.algorithm).toBe("gzip");
    expect(prepared.provenance.algorithm).toBe("gzip");
    expect(prepared.provenance.compressorRevision).toContain("pako-3.0.1");
  });

  test("gzip worker produces a finite ordered matrix with meaningful nearest pairs", async () => {
    const input = portfolioInput("gzip");
    const prepared = await CompressionService.preprocessNcdInput(input, new CompressionCache(null));
    const result = await service.processContent({
      ...input,
      contentKeys: prepared.contentKeys,
      cachedSizes: undefined,
      algorithm: "gzip",
    });

    expect(result.provenance.algorithm).toBe("gzip");
    expect(result.singleCompressionData).toHaveLength(4);
    expect(result.pairCompressionData).toHaveLength(12);
    assertScientificMatrixShape(result);
  });

  test("Brotli codec is deterministic and follows the shared ordered-matrix pipeline", async () => {
    const nodeBrotli = createRequire(import.meta.url)("brotli-wasm") as {
      compress: (data: Uint8Array, options: {quality: number}) => Uint8Array;
    };
    const input = portfolioInput("brotli");
    const prepared = await CompressionService.preprocessNcdInput(input, new CompressionCache(null));
    const scope = {postMessage: () => undefined} as unknown as DedicatedWorkerGlobalScope;
    const compress = (data: Uint8Array): number => nodeBrotli.compress(data, {quality: 11}).byteLength;

    const sample = new TextEncoder().encode(input.contents[0]);
    expect(compress(sample)).toBe(compress(sample));

    const result = await computeNcdWithCodec(
      {...input, contentKeys: prepared.contentKeys},
      {algorithm: "brotli", displayName: "Brotli", compress},
      scope,
    );
    expect(result.provenance.algorithm).toBe("brotli");
    expect(result.singleCompressionData).toHaveLength(4);
    expect(result.pairCompressionData).toHaveLength(12);
    assertScientificMatrixShape(result);

    const gzipResult = await computeNcdWithCodec(
      {...input, contentKeys: prepared.contentKeys},
      {
        algorithm: "gzip",
        displayName: "gzip / DEFLATE",
        compress: (data) => gzip(data, {level: 9}).byteLength,
      },
      scope,
    );
    expect(result.ncdMatrix).not.toEqual(gzipResult.ncdMatrix);
  });
});
