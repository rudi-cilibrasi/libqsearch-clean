import {
  COMPRESSION_CACHE_SCHEMA_VERSION,
  COMPRESSION_PIPELINE_VERSION,
  createPairCacheKey,
  createSingleCacheKey,
  symmetrizePairSizes,
} from "@/services/CompressionProtocol";
import type {
  CompressionAlgorithm,
  PairCompressionRecord,
  SingleCompressionRecord,
} from "@/types/compression";

interface CacheEnvelope {
  readonly schemaVersion: number;
  readonly pipelineVersion: string;
  readonly entries: Record<string, number>;
}

export const COMPRESSION_CACHE_STORAGE_KEY = `ncd-compression-cache:${COMPRESSION_CACHE_SCHEMA_VERSION}`;
export const LEGACY_COMPRESSION_CACHE_KEYS = Object.freeze([
  "compression_cache",
  "ncd-compression-cache:1",
]);

const MAX_CACHE_ENTRIES = 20_000;

const isValidSize = (value: unknown): value is number => (
  typeof value === "number" && Number.isFinite(value) && value > 0
);

/**
 * Versioned, bounded browser cache for deterministic compression lengths.
 *
 * Entries are namespaced by the complete compression protocol. Legacy schemas
 * are removed during construction because reusing an order-dependent pair size
 * would silently change a matrix produced by the v2 symmetric pipeline.
 */
export class CompressionCache {
  private readonly storage: Storage | null;
  private entries = new Map<string, number>();

  public constructor(storage?: Storage | null) {
    this.storage = storage === undefined ? CompressionCache.getBrowserStorage() : storage;
    this.removeLegacyCaches();
    this.load();
  }

  private static getBrowserStorage(): Storage | null {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  public prepareWorkerCache(
    algorithm: CompressionAlgorithm,
    contentKeys: readonly string[],
  ): Map<string, number> {
    const result = new Map<string, number>();

    for (const contentKey of contentKeys) {
      const key = createSingleCacheKey(algorithm, contentKey);
      const value = this.touch(key);
      if (value !== undefined) result.set(key, value);
    }

    for (let i = 0; i < contentKeys.length; i += 1) {
      for (let j = i + 1; j < contentKeys.length; j += 1) {
        const key = createPairCacheKey(algorithm, contentKeys[i], contentKeys[j]);
        const value = this.touch(key);
        if (value !== undefined) result.set(key, value);
      }
    }

    return result;
  }

  public storeCompressionRecords(
    algorithm: CompressionAlgorithm,
    singles: readonly SingleCompressionRecord[],
    pairs: readonly PairCompressionRecord[],
  ): void {
    for (const record of singles) {
      if (!record.contentKey || !isValidSize(record.compressedSize)) {
        throw new Error("Cannot cache an invalid single-object compressed size");
      }
      this.set(createSingleCacheKey(algorithm, record.contentKey), record.compressedSize);
    }

    for (const record of pairs) {
      if (
        !record.contentKey1
        || !record.contentKey2
        || !isValidSize(record.compressedSize)
        || record.compressedSize !== symmetrizePairSizes(record.forwardSize, record.reverseSize)
      ) {
        throw new Error("Cannot cache an invalid symmetric pair compressed size");
      }
      this.set(
        createPairCacheKey(algorithm, record.contentKey1, record.contentKey2),
        record.compressedSize,
      );
    }

    this.evictOverflow();
    this.persist();
  }

  public clear(): void {
    this.entries.clear();
    try {
      this.storage?.removeItem(COMPRESSION_CACHE_STORAGE_KEY);
    } catch (error) {
      console.warn("Unable to clear the compression cache:", error);
    }
  }

  public get size(): number {
    return this.entries.size;
  }

  private touch(key: string): number | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  private set(key: string, value: number): void {
    this.entries.delete(key);
    this.entries.set(key, value);
  }

  private removeLegacyCaches(): void {
    if (!this.storage) return;
    try {
      for (const key of LEGACY_COMPRESSION_CACHE_KEYS) this.storage.removeItem(key);
      const staleVersionedKeys: string[] = [];
      for (let index = 0; index < this.storage.length; index += 1) {
        const key = this.storage.key(index);
        if (
          key?.startsWith("ncd-compression-cache:")
          && key !== COMPRESSION_CACHE_STORAGE_KEY
        ) {
          staleVersionedKeys.push(key);
        }
      }
      for (const key of staleVersionedKeys) this.storage.removeItem(key);
    } catch (error) {
      console.warn("Unable to remove a legacy compression cache:", error);
    }
  }

  private load(): void {
    if (!this.storage) return;
    try {
      const serialized = this.storage.getItem(COMPRESSION_CACHE_STORAGE_KEY);
      if (!serialized) return;
      const parsed = JSON.parse(serialized) as Partial<CacheEnvelope>;
      if (
        parsed.schemaVersion !== COMPRESSION_CACHE_SCHEMA_VERSION
        || parsed.pipelineVersion !== COMPRESSION_PIPELINE_VERSION
        || !parsed.entries
        || typeof parsed.entries !== "object"
      ) {
        this.clear();
        return;
      }

      const validEntries = Object.entries(parsed.entries)
        .filter((entry): entry is [string, number] => isValidSize(entry[1]));
      this.entries = new Map(validEntries.slice(-MAX_CACHE_ENTRIES));
    } catch (error) {
      console.warn("Discarding an unreadable compression cache:", error);
      this.clear();
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) return;
      this.entries.delete(oldestKey);
    }
  }

  private persist(): void {
    if (!this.storage) return;
    const envelope: CacheEnvelope = {
      schemaVersion: COMPRESSION_CACHE_SCHEMA_VERSION,
      pipelineVersion: COMPRESSION_PIPELINE_VERSION,
      entries: Object.fromEntries(this.entries),
    };

    try {
      this.storage.setItem(COMPRESSION_CACHE_STORAGE_KEY, JSON.stringify(envelope));
    } catch (error) {
      // Storage quotas vary by browser. Retain the newest half and retry once.
      const removeCount = Math.ceil(this.entries.size / 2);
      const oldestKeys = Array.from(this.entries.keys()).slice(0, removeCount);
      for (const key of oldestKeys) this.entries.delete(key);
      try {
        const reducedEnvelope: CacheEnvelope = {
          ...envelope,
          entries: Object.fromEntries(this.entries),
        };
        this.storage.setItem(COMPRESSION_CACHE_STORAGE_KEY, JSON.stringify(reducedEnvelope));
      } catch (retryError) {
        console.warn("Compression cache persistence is unavailable:", error, retryError);
      }
    }
  }
}
