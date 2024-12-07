import {StorageBackend} from "@/cache/CacheInterface.ts";

export class LocalStorageCache implements StorageBackend {
    async get(key: string): Promise<string | null> {
        return localStorage.getItem(key);
    }

    async set(key: string, value: string): Promise<void> {
        return localStorage.setItem(key, value);
    }

    async remove(key: string): Promise<void> {
        return localStorage.removeItem(key);
    }
}
