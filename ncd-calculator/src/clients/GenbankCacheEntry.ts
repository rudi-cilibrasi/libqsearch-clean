import { BaseCacheMetadata } from "@/cache/CacheInterface";

// GenBank specific types and implementation
interface GenBankMetadata extends BaseCacheMetadata {
  lastFetched: number;
}

interface Suggestion {
  id: string;
  scientificName: string;
  primaryCommonName: string;
  additionalCommonNames: string[];
  type: string;
  source: string;
}

export class GenBankCacheEntry {
  suggestions: Suggestion[];
  isValid?: boolean;
  isComplete?: boolean;
  globalLastPage?: number;
  lastPage?: number;
  pageSize?: number;
  totalResults?: number;
  taxonomicGroup?: string[] | null;
  taxId?: string | null;
  metadata?: GenBankMetadata;

  constructor(data: Partial<GenBankCacheEntry> = {}) {
    this.suggestions = data.suggestions || [];
    this.isComplete = data.isComplete || false;
    this.globalLastPage = data.globalLastPage || 0;
    this.lastPage = data.lastPage || 0;
    this.pageSize = data.pageSize || 5;
    this.totalResults = data.totalResults || 0;
    this.taxonomicGroup = data.taxonomicGroup || null;
    this.taxId = data.taxId || null;
    this.metadata = {
      lastFetched: data.metadata?.lastFetched || Date.now(),
      ...data.metadata,
    };
  }
}


export class GenbankSuggestionCacheEntry {

}
