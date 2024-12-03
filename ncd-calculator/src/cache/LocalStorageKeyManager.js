const STORAGE_VERSION_NAME = "complearn_storage_version";
const STORAGE_VERSION = 8;

export const LocalStorageKeys = {
    SUGGESTIONS: () => `fasta_suggestions`,
    LOCAL_PAGE_COUNT: () => `fasta_localPageCount`,
    SEARCH_TERM_ACCESSIONS: () => `fasta_searchTermAccessions`,
    ACCESSION_SEQUENCE: () => `fasta_accessionSequence`,
    GENBANK_RECORD_VALIDATION: () => `fasta_searchTermRecord`,
    CACHE_VERSION: () => STORAGE_VERSION_NAME
}


export class LocalStorageKeyManager {
    constructor() {
        this.patterns = [
            "/^fasta_suggestions:/",
            "/^fasta_localPageCount:/",
            "/^fasta_searchTermAccessions:/",
            "/^fasta_accessionSequence:/"
        ]
    }

    checkVersion() {
        const version = localStorage.getItem(STORAGE_VERSION_NAME);
        if (!version || parseInt(version) !== STORAGE_VERSION) {
            this.clearAllCaches();
            this.initAllKeysWithDefaultVal();
            localStorage.setItem(STORAGE_VERSION_NAME, STORAGE_VERSION);
            console.log(`Storage upgraded from ${version || 'none'} to ${STORAGE_VERSION}`);
        }
    }

    initAllKeysWithDefaultVal() {
        const keys = this.getAllKeys();
        keys.forEach(key => {
            localStorage.setItem(key, JSON.stringify({}));
        })
    }

    clearAllCaches() {
        const keys = this.getAllKeys();
        keys.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${keys.length} cached items`);
    }

    getAllKeysByPattern(pattern) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (pattern.test(key)) {
                keys.push(key);
            }
        }
        return keys;
    }


    getAllKeys() {
        const keys = [];
        Object.values(LocalStorageKeys).forEach(keyFn => {
            const keyVal = keyFn();
            keys.push(keyVal);
        })
        return keys;
    }

    get(cacheName, key) {
        const str = localStorage.getItem(cacheName);
        if (!str) return null;
        const cache = JSON.parse(str);
        if (!cache || Object.keys(cache).length === 0) return null;
        if (!cache[key]) return null;
        return JSON.parse(JSON.stringify(cache[key]));
    }
    getKeysIncluding(searchTerm) {
        return this.getAllKeys().filter(key => key.includes(searchTerm));
    }

    clearKeysIncluding(searchTerm) {
        const keys = this.getKeysIncluding(searchTerm);
        keys.forEach(key => localStorage.removeItem(key));
        return keys.length;
    }


    append(cacheName, key, value) {
        const cache = localStorage.getItem(cacheName);
        if (cache !== null) {
            const json = JSON.parse(cache);
            if (!json || json === {}) {
                json[key] = [value];
            } else {
                const currentVal = json[key];
                if (!currentVal || currentVal.length === 0) {
                    json[key] = [value];
                } else {
                    json[key] = [...currentVal, value];
                }
            }
            const str = JSON.stringify(json);
            localStorage.setItem(cacheName, str);
        }
    }

    set(cacheName, key, value) {
        const cache = localStorage.getItem(cacheName);
        if (cache !== null) {
            const json = JSON.parse(cache);
            json[key] = value;
            const str = JSON.stringify(json);
            localStorage.setItem(cacheName, str);
        }
    }
}



