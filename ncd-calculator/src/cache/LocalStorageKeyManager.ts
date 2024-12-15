const STORAGE_VERSION_NAME = "complearn_storage_version";
const STORAGE_VERSION = 16;
const LOG_PREFIX = "[Storage Manager]";

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
  private static instance: LocalStorageKeyManager;
  private readonly patterns: ReadonlyArray<string>;
  private initialized: boolean = false;

  private constructor() {
    this.patterns = [
      "^fasta_suggestions:",
      "^fasta_localPageCount:",
      "^fasta_searchTermAccessions:",
      "^fasta_accessionSequence:",
    ] as const;
  }

  public static getInstance(): LocalStorageKeyManager {
    if (!LocalStorageKeyManager.instance) {
      LocalStorageKeyManager.instance = new LocalStorageKeyManager();
    }
    return LocalStorageKeyManager.instance;
  }

  public initialize(): void {
    if (this.initialized) {
      return;
    }

    console.log(`${LOG_PREFIX} Initializing with required version: ${STORAGE_VERSION}`);

    const storedVersion = localStorage.getItem(STORAGE_VERSION_NAME);
    if (!storedVersion) {
      console.log(`${LOG_PREFIX} Fresh install detected`);
    } else {
      console.log(`${LOG_PREFIX} Found existing storage version: ${storedVersion}`);
    }

    this.checkVersion();
    this.initialized = true;
  }

  public get<T>(key: StorageKeyFunction, id: string): T | null {
    const storageKey = `${key()}:${id}`;
    const item = localStorage.getItem(storageKey);
    try {
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error(`${LOG_PREFIX} Error parsing storage item for key ${storageKey}:`, e);
      return null;
    }
  }

  public set<T>(key: StorageKeyFunction, id: string, value: T): void {
    const storageKey = `${key()}:${id}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch (e) {
      console.error(`${LOG_PREFIX} Error setting storage item for key ${storageKey}:`, e);
    }
  }

  public checkVersion(): void {
    const version = localStorage.getItem(STORAGE_VERSION_NAME);
    const currentVersion = parseFloat(version || "0");

    if (!version || currentVersion < 1 || currentVersion < STORAGE_VERSION) {
      console.log(
          `${LOG_PREFIX} Version mismatch detected:`,
          `Stored: ${version || "none"}`,
          `Required: ${STORAGE_VERSION}`
      );

      this.clearAllCaches();
      this.initAllKeysWithDefaultVal();

      localStorage.setItem(STORAGE_VERSION_NAME, STORAGE_VERSION.toString());

      console.log(
          `${LOG_PREFIX} Storage upgraded from ${version || "none"} to ${STORAGE_VERSION}`
      );
    } else {
      console.log(`${LOG_PREFIX} Storage version check passed: ${currentVersion}`);
    }
  }

  public initAllKeysWithDefaultVal(): void {
    console.log(`${LOG_PREFIX} Initializing all keys with default values`);
    const keys = this.getAllKeys();
    keys.forEach((key) => {
      try {
        localStorage.setItem(key, JSON.stringify({}));
      } catch (e) {
        console.error(`${LOG_PREFIX} Error initializing key ${key}:`, e);
      }
    });
  }
  public clearAllCaches(): void {
    console.log(`${LOG_PREFIX} Clearing all caches`);
    this.patterns.forEach((pattern) => {
      try {
        const regex = new RegExp(pattern);
        Object.keys(localStorage).forEach((key) => {
          if (regex.test(key)) {
            localStorage.removeItem(key);
            console.log(`${LOG_PREFIX} Cleared cache for key: ${key}`);
          }
        });
      } catch (e) {
        console.error(`${LOG_PREFIX} Error clearing cache for pattern ${pattern}:`, e);
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
      console.error(`${LOG_PREFIX} Error removing storage item for key ${storageKey}:`, e);
    }
  }

  public clear(): void {
    try {
      console.log(`${LOG_PREFIX} Clearing entire localStorage`);
      localStorage.clear();
    } catch (e) {
      console.error(`${LOG_PREFIX} Error clearing localStorage:`, e);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getCurrentVersion(): number {
    return STORAGE_VERSION;
  }

  public getStoredVersion(): number {
    const version = localStorage.getItem(STORAGE_VERSION_NAME);
    return version ? parseFloat(version) : 0;
  }
}