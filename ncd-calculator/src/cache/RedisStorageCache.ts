import {StorageBackend} from "@/cache/CacheInterface.ts";

export class RedisStorageCache implements StorageBackend {
    private readonly API_ENDPOINT: string;

    constructor(endpoint: string) {
        this.API_ENDPOINT = endpoint;
    }

    async get(key: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.API_ENDPOINT}/get`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error(`Redis GET failed for key ${key}:`, errorData);
                return null; // Return null instead of throwing to allow cache fallback
            }

            const data = await response.json();
            return data.value;  // This will be null for non-existent keys
        } catch (error) {
            console.error(`Error fetching from Redis for key: ${key}`, error);
            return null; // Return null to allow cache fallback
        }
    }

    async set(key: string, value: string): Promise<void> {
        try {
            const response = await fetch(`${this.API_ENDPOINT}/set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ key, value }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                console.error(`Redis SET failed for key ${key}:`, errorData);
                return; // Continue without throwing
            }
        } catch (error) {
            console.error(`Error setting Redis value for key: ${key}`, error);
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