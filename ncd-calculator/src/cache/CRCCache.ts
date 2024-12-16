type CompressionType = 'lzma' | 'gzip';

export class CRCCache {
    private cache: Map<string, number>;
    private readonly STORAGE_KEY = 'compression_cache';

    constructor() {
        this.cache = new Map();
        this.loadFromLocalStorage();
    }

    public getCompressedSize(compressionType: CompressionType, partIds: string[]): number | null {
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        }
        const cacheKey = this.generateCacheKey(compressionType, partIds);
        return this.cache.get(cacheKey) ?? null;
    }


    private generateCacheKey(compressionType: CompressionType, partIds: string[]): string {
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        } else {
            return partIds.length === 1 ? `${compressionType}:${partIds[0]}` : `${compressionType}:${partIds.sort().join("-")}`;
        }
    }

    public storeCompressedSize(compressionType: CompressionType, partIds: string[], size: number): void {
        if (partIds.length < 1 || partIds.length > 2) {
            throw new Error('Must provide 1 or 2 IDs for compression');
        }
        const cacheKey = this.generateCacheKey(compressionType, partIds);
        const existingCache = this.loadAllCache();
        if (existingCache[cacheKey]) {
            return;
        }
        existingCache[cacheKey] = size;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingCache));
        this.cache.set(cacheKey, size);
    }

    private loadAllCache(): Record<string, number> {
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

    private loadFromLocalStorage(): void {
        try {
            const cacheObject = this.loadAllCache();
            this.cache = new Map(Object.entries(cacheObject));
        } catch (error) {
            console.warn('Error loading from localStorage:', error);
        }
    }
}