import {StorageBackend} from "@/cache/CacheInterface.ts";

export class RedisStorageCache implements StorageBackend {
    private readonly API_ENDPOINT: string;

    constructor(endpoint: string) {
        this.API_ENDPOINT = endpoint;
    }

    async get(key: string): Promise<any> {
        try {
            const response = await fetch(`${this.API_ENDPOINT}/get`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({key})
            });
            if (!response.ok) {
                throw new Error('Redis fetch failed ' + response.statusText);
            }
            const data = await response.json();
            console.log(`Received redis cached response for: ${key}, value: ${data.value}`);
            return data.value;
        } catch (error) {
            console.error(`Error fetching from Redis for key: ${key}`, error);
            return null;
        }
    }

    async set(key: string, value: any): Promise<void> {
        try {
            const response = await fetch(`${this.API_ENDPOINT}/set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({key, value})
            });
            if (!response.ok) {
                throw new Error('Redis set failed');
            }
            console.log(`Set redis cache for: ${key}, value: ${value}`);
        } catch (error) {
            console.error(`Error setting Redis for key: ${key}`, error);
        }
    }

    async remove(key: string): Promise<void> {
        try {
            const response = await fetch(`${this.API_ENDPOINT}/remove`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({key})
            });
            if (!response.ok) {
                throw new Error('Redis remove failed');
            }
            console.log(`Removed redis cache for: ${key}`);
        } catch (error) {
            console.error(`Error removing from Redis for key: ${key}`, error);
        }
    }
}