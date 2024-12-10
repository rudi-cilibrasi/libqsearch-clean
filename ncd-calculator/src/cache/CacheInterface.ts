// Base interfaces for the cache system
import {CACHE_NAMES} from "@/clients/genbank.ts";

export interface CacheOptions {
  ttl?: number;
  [key: string]: unknown;
}

export interface BaseCacheMetadata {
  lastUpdated: number;
  accessCount?: number;
  lastAccessed?: number;
  globalLastPage?: number;
  [key: string]: unknown;
}

export interface StorageBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

// Generic cache entry interface
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  metadata: BaseCacheMetadata;
}

// The generic cache interface
export class CacheInterface<CacheTypes extends Record<string, any>> {
  private storage: StorageBackend;
  private options: CacheOptions;

  constructor(storageBackend: StorageBackend, options: CacheOptions = {}) {
    this.storage = storageBackend;
    this.options = {
      ttl: 24 * 60 * 60 * 1000, // Default 24 hours
      ...options,
    };
  }

  async setCacheEntry<K extends keyof CacheTypes>(
      cacheName: K,
      key: string,
      value: CacheTypes[K]
  ): Promise<void> {
    try {
      const stored = await this.storage.get(cacheName as string);
      let cacheObj: Record<string, any> = {};
      if (typeof stored === 'string') {
        try {
          cacheObj = JSON.parse(stored);
        } catch {
          cacheObj = {};
        }
      } else {
        cacheObj = stored || {};
      }
      if (cacheName === CACHE_NAMES.SUGGESTIONS) {
        let nestedVal;
        if (key in value) {
          nestedVal = value[key];
        } else {
          nestedVal = value;
        }
        if (!cacheObj[key]) {
          cacheObj[key] = nestedVal;
        } else {
          const existingEntry = cacheObj[key];
          const mergedAccessionIds = Array.from(new Set([
            ...existingEntry.accessionIds,
            ...nestedVal.accessionIds
          ]));

          const updatedMetadata = {
            ...existingEntry.metadata,
            ...nestedVal.metadata,
            lastUpdated: Math.max(
                existingEntry.metadata.lastUpdated,
                nestedVal.metadata.lastUpdated
            ),
            currentPage: Math.max(
                existingEntry.metadata.currentPage,
                nestedVal.metadata.currentPage
            ),
            isComplete: existingEntry.metadata.isComplete || nestedVal.metadata.isComplete
          };
          cacheObj[key] = {
            accessionIds: mergedAccessionIds,
            metadata: updatedMetadata
          };
        }
      } else {
        cacheObj = {
          ...cacheObj,
          ...value
        };
      }
      await this.storage.set(cacheName as string, JSON.stringify(cacheObj));
    } catch (error) {
      console.error(`Cache set error for ${cacheName as string}:${key}`, error);
      console.debug('Value causing error:', value);
    }
  }

  async getCacheEntry<K extends keyof CacheTypes>(
      cacheName: K,
      key: string = ""
  ): Promise<CacheTypes[K][string] | null> {
    try {
      const stored = await this.storage.get(cacheName as string);
      if (!stored) return null;
      let parsedCache: CacheTypes[K];
      if (typeof stored === 'string') {
        parsedCache = JSON.parse(stored);
      } else {
        parsedCache = stored;
      }
      if (!key) return parsedCache;

      const entry = parsedCache[key];
      if (!entry || this.isExpired<K>(entry)) {
        return null;
      }

      await this.updateAccessMetadata(cacheName as string, key, entry);
      return entry;
    } catch (error) {
      console.error(`Error getting cache entry for ${cacheName as string}:${key}`, error);
      return null;
    }
  }

  private async updateAccessMetadata<K extends keyof CacheTypes>(
      cacheName: K,
      key: string,
      entry: CacheEntry<CacheTypes[K]>
  ): Promise<void> {
    if ('metadata' in entry) {
      entry.metadata.accessCount = (entry?.metadata?.accessCount || 0) + 1;
      entry.metadata.lastAccessed = Date.now();
    }
    await this.setCacheEntry(cacheName, key, entry as CacheTypes[K]);
  }

  private isExpired<K extends keyof CacheTypes>(
      entry: CacheEntry<CacheTypes[K]>
  ): boolean {
    const now = Date.now();
    return now - entry.timestamp > (this.options.ttl || 0);
  }

  getCacheKey(cacheName: string, key: string): string {
    return `${cacheName}:${key}`;
  }
}
