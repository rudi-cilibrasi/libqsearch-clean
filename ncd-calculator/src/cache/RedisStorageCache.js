
export class RedisStorageCache {
    constructor(endpoint) {
        this.API_ENDPOINT = endpoint;
    }

    async get(key) {
        try {
            const response = await fetch(`${this.API_ENDPOINT}/get`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({key})
            });
            if (!response.ok) {
                throw new Error('Redis fetch failed');
            }
            const data = await response.json();
            console.log(`Received redis cached response for: ${key}, value: ${data.value}`);
            return data.value;
        } catch (error) {
            console.error(`Redis storage cache error for key: ${key}`, error);
            return null;
        }
    }

    async set(key, value, ttl) {
        try {
            const actualValue = typeof value === 'string' ? value : JSON.stringify(value);

            const body = {
                key,
                value: actualValue,
                ttl
            };

            console.log(`Setting value for key: ${key} to ${JSON.stringify(body)}`);

            const response = await fetch(`${this.API_ENDPOINT}/set`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error('Redis set failed');
            }
        } catch (error) {
            console.error(`Redis storage cache set error for key: ${key}`, error);
        }
    }


    async close() {
    }
}