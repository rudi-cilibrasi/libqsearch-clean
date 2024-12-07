export class MemoryCache {
    private cache: Map<string, any>;

    constructor() {
        this.cache = new Map();
    }

    async get(key: string): Promise<any> {
        return this.cache.get(key);
    }

    async remove(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }

    async set(key: string, value: any): Promise<void> {
        this.cache.set(key, value);
    }
}