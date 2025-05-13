import {CompressionAlgorithm} from "@/services/CompressionService.ts";


export type CRCCacheEntry = {
    key: string;
    value: number
}

export class CRCCache {
    private cache: Map<string, number>;
    private readonly STORAGE_KEY = 'compression_cache';

    constructor() {
        this.cache = new Map();
        this.loadFromLocalStorage();
    }

    public getCompressedSize(compressionAlgo: CompressionAlgorithm, partIds: string[]): number | null {
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        }
        const cacheKey = this.generateCacheKey(compressionAlgo, partIds);
        return this.cache.get(cacheKey) ?? null;
    }

    public getCompressedSizeByKey(key: string): number | null {
       if (!key || key.trim().length === 0) return null;
       return this.cache.get(key) ?? null;
    }

    public getCachedEntry(compressionAlgo: CompressionAlgorithm, partIds: string[]): CRCCacheEntry | null{
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        }
        const key = this.generateCacheKey(compressionAlgo, partIds);
        const size = this.getCompressedSizeByKey(key);
        if (size) {
            return {
                key: key,
                value: size
            } as CRCCacheEntry;
        } else {
            return null;
        }
    }


    public generateCacheKey(compressionAlgo: CompressionAlgorithm, partIds: string[]): string {
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        } else {
            return partIds.length === 1 ? `${compressionAlgo}:${partIds[0]}` : `${compressionAlgo}:${partIds.sort().join("-")}`;
        }
    }

    public storeCompressedSize(compressionAlgo: CompressionAlgorithm, partIds: string[], size: number): void {
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        }
        const cacheKey = this.generateCacheKey(compressionAlgo, partIds);
        const existingCache = this.loadAllCache();
        if (existingCache[cacheKey]) {
            return;
        }
        existingCache[cacheKey] = size;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingCache));
        this.cache.set(cacheKey, size);
    }

    protected loadAllCache(): Record<string, number> {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Error loading from localStorage:', error);
        }
        return {};
    }

    protected loadFromLocalStorage(): void {
        try {
            const cacheObject = this.loadAllCache();
            this.cache = new Map(Object.entries(cacheObject));
        } catch (error) {
            console.warn('Error loading from localStorage:', error);
        }
    }
}
