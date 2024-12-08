const STORAGE_VERSION_NAME = "complearn_storage_version";
const STORAGE_VERSION = 8;

type StorageKeyFunction = () => string;

interface StorageKeyMap {
  SUGGESTIONS: StorageKeyFunction;
  LOCAL_PAGE_COUNT: StorageKeyFunction;
  SEARCH_TERM_ACCESSIONS: StorageKeyFunction;
  ACCESSION_SEQUENCE: StorageKeyFunction;
  GENBANK_RECORD_VALIDATION: StorageKeyFunction;
  CACHE_VERSION: StorageKeyFunction;
}

export const LocalStorageKeys: StorageKeyMap = {
  SUGGESTIONS: () => `fasta_suggestions`,
  LOCAL_PAGE_COUNT: () => `fasta_localPageCount`,
  SEARCH_TERM_ACCESSIONS: () => `fasta_searchTermAccessions`,
  ACCESSION_SEQUENCE: () => `fasta_accessionSequence`,
  GENBANK_RECORD_VALIDATION: () => `fasta_searchTermRecord`,
  CACHE_VERSION: () => STORAGE_VERSION_NAME,
};

export class LocalStorageKeyManager {
  private readonly patterns: ReadonlyArray<string>;

  constructor() {
    this.patterns = [
      "^fasta_suggestions:",
      "^fasta_localPageCount:",
      "^fasta_searchTermAccessions:",
      "^fasta_accessionSequence:",
    ] as const;
  }

  public get<T>(key: StorageKeyFunction, id: string): T | null {
    const storageKey = `${key()}:${id}`;
    const item = localStorage.getItem(storageKey);
    try {
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error(`Error parsing storage item for key ${storageKey}:`, e);
      return null;
    }
  }

  public set<T>(key: StorageKeyFunction, id: string, value: T): void {
    const storageKey = `${key()}:${id}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (e) {
      console.error(`Error setting storage item for key ${storageKey}:`, e);
    }
  }

  public checkVersion(): void {
    const version = localStorage.getItem(STORAGE_VERSION_NAME);
    const currentVersion = parseInt(version || "0", 10);

    if (!version || currentVersion !== STORAGE_VERSION) {
      this.clearAllCaches();
      this.initAllKeysWithDefaultVal();
      localStorage.setItem(STORAGE_VERSION_NAME, STORAGE_VERSION.toString());
      console.log(
        `Storage upgraded from ${version || "none"} to ${STORAGE_VERSION}`
      );
    }
  }

  public initAllKeysWithDefaultVal(): void {
    const keys = this.getAllKeys();
    keys.forEach((key) => {
      try {
        localStorage.setItem(key, JSON.stringify({}));
      } catch (e) {
        console.error(`Error initializing key ${key}:`, e);
      }
    });
  }

  public clearAllCaches(): void {
    this.patterns.forEach((pattern) => {
      try {
        const regex = new RegExp(pattern);
        Object.keys(localStorage).forEach((key) => {
          if (regex.test(key)) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.error(`Error clearing cache for pattern ${pattern}:`, e);
      }
    });
  }

  public getAllKeys(): string[] {
    return Object.keys(localStorage);
  }

  public remove(key: StorageKeyFunction, id: string): void {
    const storageKey = `${key()}:${id}`;
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.error(`Error removing storage item for key ${storageKey}:`, e);
    }
  }

  public clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }
  }
}
