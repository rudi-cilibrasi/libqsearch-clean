import {describe, expect, test} from "vitest";
import {CompressionCache, COMPRESSION_CACHE_STORAGE_KEY} from "@/cache/CompressionCache";
import {
  COMPRESSION_PIPELINE_VERSION,
  createPairCacheKey,
  createSingleCacheKey,
  symmetrizePairSizes,
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
  test("pair keys and sizes are independent of input order", () => {
    expect(createPairCacheKey("lzma", "sha256:a", "sha256:b"))
      .toBe(createPairCacheKey("lzma", "sha256:b", "sha256:a"));
    expect(symmetrizePairSizes(120, 113)).toBe(113);
  });

  test("does not hide empirical NCD values above one", () => {
    expect(calculateNCD(100, 100, 205)).toBe(1.05);
    expect(() => calculateNCD(0, 100, 120)).toThrow("Invalid compressed sizes");
  });

  test("clears legacy caches and reloads only the current protocol", () => {
    const storage = new MemoryStorage();
    storage.setItem("compression_cache", JSON.stringify({"lzma:old": 42}));
    storage.setItem("ncd-compression-cache:1", "{}");
    storage.setItem("ncd-compression-cache:99", "{}");

    const cache = new CompressionCache(storage);
    expect(storage.getItem("compression_cache")).toBeNull();
    expect(storage.getItem("ncd-compression-cache:1")).toBeNull();
    expect(storage.getItem("ncd-compression-cache:99")).toBeNull();

    cache.storeCompressionRecords(
      "lzma",
      [{contentKey: "sha256:a", compressedSize: 80}],
      [{
        contentKey1: "sha256:a",
        contentKey2: "sha256:b",
        compressedSize: 110,
        forwardSize: 114,
        reverseSize: 110,
      }],
    );
    const serialized = JSON.parse(storage.getItem(COMPRESSION_CACHE_STORAGE_KEY)!);
    expect(serialized.pipelineVersion).toBe(COMPRESSION_PIPELINE_VERSION);

    const reloaded = new CompressionCache(storage).prepareWorkerCache(
      "lzma",
      ["sha256:b", "sha256:a"],
    );
    expect(reloaded.get(createSingleCacheKey("lzma", "sha256:a"))).toBe(80);
    expect(reloaded.get(createPairCacheKey("lzma", "sha256:a", "sha256:b"))).toBe(110);
  });

  test("compresses both pair orders and records their minimum", async () => {
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
      async () => ({forwardSize: 132, reverseSize: 125}),
      worker,
    );
    expect(result[1].ncd).toBe(0.35);
    expect(result[1].pairRecord).toMatchObject({
      compressedSize: 125,
      forwardSize: 132,
      reverseSize: 125,
    });
    expect(messages).toHaveLength(1);
  });
});
