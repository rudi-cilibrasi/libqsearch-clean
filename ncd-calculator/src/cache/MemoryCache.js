export class MemoryCache {
    constructor() {
        this.cache = new Map();
    }

    async get(key) {
        return this.cache.get(key);
    }

    async remove(key) {
        return this.cache.delete(key);
    }

    async set(key, value) {
        return this.cache.set(key, value);
    }
}