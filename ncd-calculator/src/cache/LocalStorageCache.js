export class LocalStorageCache {
    async get(key) {
       return localStorage.getItem(key);
    }

    async set(key, value) {
        return localStorage.setItem(key, value);
    }

    async remove(key) {
        return localStorage.removeItem(key);
    }
}