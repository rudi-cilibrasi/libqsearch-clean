import type {GenBankSequenceRecord} from "./genbankSequencePipeline";

const DATABASE_NAME = "complearn-genbank";
const DATABASE_VERSION = 1;
const RECORD_STORE = "validated-sequences";

export class GenBankSequenceCache {
  private static instance: GenBankSequenceCache | undefined;
  private readonly memory = new Map<string, GenBankSequenceRecord>();
  private databasePromise: Promise<IDBDatabase | null> | null = null;

  static getInstance(): GenBankSequenceCache {
    GenBankSequenceCache.instance ??= new GenBankSequenceCache();
    return GenBankSequenceCache.instance;
  }

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.databasePromise) return this.databasePromise;
    if (!("indexedDB" in globalThis) || !globalThis.indexedDB) return Promise.resolve(null);
    this.databasePromise = new Promise(resolve => {
      const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(RECORD_STORE)) {
          request.result.createObjectStore(RECORD_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.databasePromise;
  }

  async get(requestedId: string): Promise<GenBankSequenceRecord | null> {
    const memoryRecord = this.memory.get(requestedId);
    if (memoryRecord) return memoryRecord;
    const database = await this.openDatabase();
    if (!database) return null;
    return new Promise(resolve => {
      const request = database.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).get(requestedId);
      request.onsuccess = () => {
        const value = request.result as GenBankSequenceRecord | undefined;
        if (value) this.memory.set(requestedId, value);
        resolve(value ?? null);
      };
      request.onerror = () => resolve(null);
    });
  }

  async set(record: GenBankSequenceRecord): Promise<void> {
    const key = record.provenance.requestedId;
    this.memory.set(key, record);
    const database = await this.openDatabase();
    if (!database) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECORD_STORE, "readwrite");
      transaction.objectStore(RECORD_STORE).put(record, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Unable to cache the GenBank sequence."));
      transaction.onabort = () => reject(transaction.error ?? new Error("GenBank sequence cache transaction was aborted."));
    });
  }

  async remove(requestedId: string): Promise<void> {
    this.memory.delete(requestedId);
    const database = await this.openDatabase();
    if (!database) return;
    await new Promise<void>(resolve => {
      const transaction = database.transaction(RECORD_STORE, "readwrite");
      transaction.objectStore(RECORD_STORE).delete(requestedId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    });
  }
}
