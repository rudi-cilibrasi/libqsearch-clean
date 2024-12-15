import { CompressedSizeCache } from "@/types/ncd";
import {CRC32Calculator} from "@/functions/crc8.ts";

export interface CacheConfig {
    maxEntries: number;
    expirationTime: number;
    compressionAlgo: 'lzma' | 'gzip';
    localStoragePrefix: string;
}

export class CRCCache {
    private memoryCache: Map<string, CompressedSizeCache>;
    private config: CacheConfig;
    private readonly STORAGE_KEY = 'lzma_compression_cache';

    constructor(config: Partial<CacheConfig> = {}) {
        this.config = {
            maxEntries: 50,
            expirationTime: 24 * 60 * 60 * 1000, // 24 hours
            compressionAlgo: 'lzma',
            localStoragePrefix: 'compression_cache_',
            ...config
        };
        this.memoryCache = new Map();
        this.loadFromLocalStorage();
    }

    private loadFromLocalStorage(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                const now = Date.now();

                // Filter out expired entries and convert to Map structure
                Object.entries(parsed).forEach(([key, value]: [string, any]) => {
                    if (now - value.timestamp < this.config.expirationTime) {
                        this.memoryCache.set(key, {
                            individualSize: value.individualSize,
                            pairSizes: new Map(value.pairSizes),
                            timestamp: value.timestamp
                        });
                    }
                });

                this.saveToLocalStorage(); // Save back filtered entries
            }
        } catch (error) {
            console.warn('Error loading from localStorage:', error);
        }
    }

    private saveToLocalStorage(): void {
        try {
            // Convert Map to serializable object
            const toStore = Object.fromEntries(
                Array.from(this.memoryCache.entries()).map(([key, value]) => [
                    key,
                    {
                        individualSize: value.individualSize,
                        pairSizes: Array.from(value.pairSizes.entries()),
                        timestamp: value.timestamp || Date.now()
                    }
                ])
            );

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
        } catch (error) {
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, clearing old entries');
                this.clearExpired();
                this.saveToLocalStorage(); // Try saving again after cleanup
            } else {
                console.warn('Error saving to localStorage:', error);
            }
        }
    }

    public storeCompressedSize(
        data: Uint8Array,
        compressedSize: number,
        partnerId?: string,
        combinedSize?: number
    ): void {
        const key = CRC32Calculator.generateKey(data, this.config.compressionAlgo);
        let entry = this.memoryCache.get(key);

        if (!entry) {
            entry = {
                individualSize: compressedSize,
                pairSizes: new Map(),
                timestamp: Date.now()
            };

            // Check max entries
            if (this.memoryCache.size >= this.config.maxEntries) {
                const oldestKey = this.findOldestEntry();
                if (oldestKey) {
                    this.memoryCache.delete(oldestKey);
                }
            }

            this.memoryCache.set(key, entry);
        }

        if (partnerId && combinedSize) {
            entry.pairSizes.set(partnerId, combinedSize);
            entry.timestamp = Date.now(); // Update timestamp on modification
        }

        this.saveToLocalStorage();
    }

    public getCompressedSizes(files: Uint8Array[]): Map<string, CompressedSizeCache> {
        this.clearExpired(); // Clean expired entries
        const result = new Map<string, CompressedSizeCache>();

        files.forEach(fileData => {
            const key = CRC32Calculator.generateKey(fileData, this.config.compressionAlgo);
            const entry = this.memoryCache.get(key);
            if (entry) {
                result.set(key, {
                    individualSize: entry.individualSize,
                    pairSizes: new Map(entry.pairSizes),
                    timestamp: entry.timestamp
                });
            }
        });

        return result;
    }

    private findOldestEntry(): string | null {
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, value] of this.memoryCache.entries()) {
            if (value?.timestamp < oldestTime) {
                oldestTime = value.timestamp;
                oldestKey = key;
            }
        }

        return oldestKey;
    }

    public clearExpired(): void {
        const now = Date.now();
        let hasDeleted = false;

        for (const [key, value] of this.memoryCache.entries()) {
            if (now - value?.timestamp > this.config.expirationTime) {
                this.memoryCache.delete(key);
                hasDeleted = true;
            }
        }

        if (hasDeleted) {
            this.saveToLocalStorage();
        }
    }

    public clear(): void {
        this.memoryCache.clear();
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.warn('Error clearing localStorage:', error);
        }
    }
}