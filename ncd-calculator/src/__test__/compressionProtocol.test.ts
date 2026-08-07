import {describe, expect, test} from "vitest";
import {CompressionCache, COMPRESSION_CACHE_STORAGE_KEY} from "@/cache/CompressionCache";
import {
  COMPRESSION_PIPELINE_VERSION,
  createPairCacheKey,
  createSingleCacheKey,
  reduceDirectedMatrix,
} from "@/services/CompressionProtocol";
import {calculateNCD, processChunk} from "@/workers/shared/utils";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

describe("compression protocol", () => {
  test("preserves pair order in cache keys", () => {
    expect(createPairCacheKey("lzma", "sha256:a", "sha256:b"))
      .not.toBe(createPairCacheKey("lzma", "sha256:b", "sha256:a"));
  });

  test("reduces the complete directed matrix by reflected-cell minimum", () => {
    expect(reduceDirectedMatrix([
      [0, 0.42, 0.71],
      [0.37, 0, 0.55],
      [0.68, 0.61, 0],
    ])).toEqual([
      [0, 0.37, 0.68],
      [0.37, 0, 0.55],
      [0.68, 0.55, 0],
    ]);
    expect(() => reduceDirectedMatrix([[0, Number.NaN], [0.2, 0]]))
      .toThrow("invalid value");
  });

  test("does not hide empirical NCD values above one", () => {
    expect(calculateNCD(100, 100, 205)).toBe(1.05);
    expect(() => calculateNCD(0, 100, 120)).toThrow("Invalid compressed sizes");
  });

  test("clears legacy caches and reloads only the current protocol", () => {
    const storage = new MemoryStorage();
    storage.setItem("compression_cache", JSON.stringify({"lzma:old": 42}));
    storage.setItem("ncd-compression-cache:1", "{}");
    storage.setItem("ncd-compression-cache:2", "{}");
    storage.setItem("ncd-compression-cache:99", "{}");

    const cache = new CompressionCache(storage);
    expect(storage.getItem("compression_cache")).toBeNull();
    expect(storage.getItem("ncd-compression-cache:1")).toBeNull();
    expect(storage.getItem("ncd-compression-cache:2")).toBeNull();
    expect(storage.getItem("ncd-compression-cache:99")).toBeNull();

    cache.storeCompressionRecords(
      "lzma",
      [{contentKey: "sha256:a", compressedSize: 80}],
      [
        {
          sourceContentKey: "sha256:a",
          targetContentKey: "sha256:b",
          compressedSize: 114,
        },
        {
          sourceContentKey: "sha256:b",
          targetContentKey: "sha256:a",
          compressedSize: 110,
        },
      ],
    );
    const serialized = JSON.parse(storage.getItem(COMPRESSION_CACHE_STORAGE_KEY)!);
    expect(serialized.pipelineVersion).toBe(COMPRESSION_PIPELINE_VERSION);

    const reloaded = new CompressionCache(storage).prepareWorkerCache(
      "lzma",
      ["sha256:b", "sha256:a"],
    );
    expect(reloaded.get(createSingleCacheKey("lzma", "sha256:a"))).toBe(80);
    expect(reloaded.get(createPairCacheKey("lzma", "sha256:a", "sha256:b"))).toBe(114);
    expect(reloaded.get(createPairCacheKey("lzma", "sha256:b", "sha256:a"))).toBe(110);
  });

  test("compresses and records both ordered matrix cells independently", async () => {
    const messages: unknown[] = [];
    const worker = {
      postMessage: (message: unknown) => messages.push(message),
    } as unknown as DedicatedWorkerGlobalScope;
    const result = await processChunk(
      0,
      2,
      2,
      ["first", "second"],
      ["sha256:first", "sha256:second"],
      [100, 90],
      "lzma",
      undefined,
      async (source) => source === "first" ? 132 : 125,
      worker,
    );
    expect(result).toHaveLength(4);
    expect(result[1].ncd).toBe(0.42);
    expect(result[1].pairRecord).toMatchObject({
      sourceContentKey: "sha256:first",
      targetContentKey: "sha256:second",
      compressedSize: 132,
    });
    expect(result[2].ncd).toBe(0.35);
    expect(result[2].pairRecord).toMatchObject({
      sourceContentKey: "sha256:second",
      targetContentKey: "sha256:first",
      compressedSize: 125,
    });
    expect(messages).toHaveLength(2);
  });

  test("recomputes only the missing direction of a reflected pair", async () => {
    const cachedSizes = new Map<string, number>([[
      createPairCacheKey("lzma", "sha256:first", "sha256:second"),
      130,
    ]]);
    const compressedOrders: string[] = [];
    const worker = {postMessage: () => undefined} as unknown as DedicatedWorkerGlobalScope;

    const result = await processChunk(
      0,
      1,
      2,
      ["first", "second"],
      ["sha256:first", "sha256:second"],
      [100, 90],
      "lzma",
      cachedSizes,
      async (source, target) => {
        compressedOrders.push(`${source}->${target}`);
        return 125;
      },
      worker,
    );

    expect(compressedOrders).toEqual(["second->first"]);
    expect(result[1]).toMatchObject({i: 0, j: 1, ncd: 0.4, pairRecord: undefined});
    expect(result[2]).toMatchObject({i: 1, j: 0, ncd: 0.35});
  });
});
