import { CRCCache } from "@/cache/CRCCache";
import {CompressionAlgorithm} from "@/services/CompressionService.ts";

export class TestCRCCache extends CRCCache {
	private testCache: Map<string, number> = new Map();
	
	constructor() {
		super();
		// Override the internal cache with our test cache
		this.testCache = new Map();
	}
	
	public getCompressedSize(compressionAlgo: CompressionAlgorithm, partIds: string[]): number | null {
		if (partIds.length < 1 || partIds.length > 2) {
			throw new Error('Must provide 1 or 2 IDs for compression');
		}
		const cacheKey = this.generateCacheKey(compressionAlgo, partIds);
		return this.testCache.get(cacheKey) ?? null;
	}
	
	public getCompressedSizeByKey(key: string): number | null {
		if (!key || key.trim().length === 0) return null;
		return this.testCache.get(key) ?? null;
	}
	
	public storeCompressedSize(compressionAlgo: CompressionAlgorithm, partIds: string[], size: number): void {
		if (partIds.length < 1 || partIds.length > 2) {
			throw new Error('Must provide 1 or 2 IDs for compression');
		}
		const cacheKey = this.generateCacheKey(compressionAlgo, partIds);
		this.testCache.set(cacheKey, size);
	}
	
	// Override localStorage methods to do nothing
	protected loadFromLocalStorage(): void {
		// Do nothing - we don't want to use localStorage in tests
	}
	
	protected saveToLocalStorage(): void {
		// Do nothing - we don't want to use localStorage in tests
	}
}
