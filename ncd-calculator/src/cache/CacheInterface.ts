// Base interfaces for the cache system
export interface CacheOptions {
  ttl?: number;
  [key: string]: unknown;
}

export interface BaseCacheMetadata {
  lastUpdated?: number;
  accessCount?: number;
  lastAccessed?: number;
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
export class CacheInterface<T> {
  private storage: StorageBackend;
  private options: CacheOptions;

  constructor(storageBackend: StorageBackend, options: CacheOptions = {}) {
    this.storage = storageBackend;
    this.options = {
      ttl: 24 * 60 * 60 * 1000, // Default 24 hours
      ...options,
    };
  }

  async getCacheEntry(cacheName: string, key: string): Promise<T | null> {
    try {
      const stored = await this.storage.get(cacheName);
      if (!stored) return null;

      const json = JSON.parse(stored) as Record<string, CacheEntry<T>>;
      const entry = json[key];

      if (entry && !this.isExpired(entry)) {
        this.updateAccessMetadata(cacheName, key, entry);
        return entry.data;
      } else if (entry) {
        // Remove expired entry
        const cacheObj = JSON.parse(stored);
        delete cacheObj[key];
        await this.storage.set(cacheName, JSON.stringify(cacheObj));
      }

      return null;
    } catch (error) {
      console.error(`Error getting cache entry for ${cacheName}:${key}`, error);
      return null;
    }
  }

  async setCacheEntry(
    cacheName: string,
    key: string,
    value: T,
    metadata: BaseCacheMetadata = {}
  ): Promise<void> {
    try {
      const cache = await this.storage.get(cacheName);
      let cacheObj: Record<string, CacheEntry<T>>;

      if (!cache) {
        cacheObj = {};
      } else {
        cacheObj = JSON.parse(cache);
      }

      cacheObj[key] = {
        data: value,
        timestamp: Date.now(),
        metadata: {
          ...metadata,
          lastUpdated: Date.now(),
        },
      };

      await this.storage.set(cacheName, JSON.stringify(cacheObj));
    } catch (error) {
      console.error(`Cache set error for ${cacheName}:${key}`, error);
    }
  }

  private async updateAccessMetadata(
    cacheName: string,
    key: string,
    entry: CacheEntry<T>
  ): Promise<void> {
    entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
    entry.metadata.lastAccessed = Date.now();
    await this.setCacheEntry(cacheName, key, entry.data, entry.metadata);
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    return now - entry.timestamp > (this.options.ttl || 0);
  }

  getCacheKey(cacheName: string, key: string): string {
    return `${cacheName}:${key}`;
  }
}
