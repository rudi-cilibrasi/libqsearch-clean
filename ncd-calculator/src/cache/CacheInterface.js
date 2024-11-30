export class CacheInterface {
    constructor(storageBackend, options = {}) {
        this.storage = storageBackend;
        this.options = {
            ttl: 24 * 60 * 60 * 1000,
            ...options
        };
    }

    async getCacheEntry(cacheName, key) {
        try {
            const stored = await this.storage.get(cacheName);
            if (stored) {
                const json = JSON.parse(stored);
                if (!this.isExpired(json)) {
                    const val = json[key];
                    if (!val) {
                        return null;
                    }
                    console.log(`Storage cache hit for ${cacheName}:${key}`);
                    return val;
                } else {
                    console.log(`Cache entry is expired for ${cacheName}:${key}`);
                    return null;
                }
            } else {
                console.log(`Cache miss for ${cacheName}:${key}`);
                return null;
            }
        } catch (error) {
            console.error(`Cache fetch error on storage backend for ${cacheName}:${key}`, error);
            return null;
        }
    }

    getCacheKey(cacheName, key) {
        return `${cacheName}:${key}`;
    }

    isExpired(entry) {
        return Date.now() - entry.timestamp > this.options.ttl;
    }

    async setCacheEntry(cacheName, key, value) {
        try {
            const cache = await this.storage.get(cacheName);
            let cacheObj;
            if (!cache || Object.keys(JSON.parse(cache) || {}).length === 0) {
                cacheObj = {
                    [key]: value
                };
            } else {
                cacheObj = JSON.parse(cache);
                const existingEntry = cacheObj[key];

                if (existingEntry && value.suggestions) {
                    const seenIds = new Set(existingEntry.suggestions.map(s => s.id));
                    const newSuggestions = value.suggestions.filter(s => !seenIds.has(s.id));

                    cacheObj[key] = {
                        ...value,
                        suggestions: [...existingEntry.suggestions, ...newSuggestions],
                        lastPage: Math.max(existingEntry.lastPage, value.lastPage),
                        globalLastPage: Math.max(existingEntry.globalLastPage, value.globalLastPage),
                        metadata: {
                            ...existingEntry.metadata,
                            ...value.metadata,
                            lastUpdated: Date.now(),
                            accessCount: existingEntry.metadata?.accessCount || 0,
                            lastAccessed: existingEntry.metadata?.lastAccessed
                        }
                    };
                } else {
                    cacheObj[key] = value;
                }
            }
            await this.storage.set(cacheName, JSON.stringify(cacheObj));
        } catch (error) {
            console.error(`Cache set error for ${cacheName}:${key}`, error);
        }
    }
}