export interface TaxonomicMapping {
  id: string;
  group: string;
  commonNames?: string[];
  searchTerms?: string[];
  generalCommonNames?: string[];
}


export interface AnimalGroup {
  genus?: string;
  family: string;
  taxid: string;
  group: string;
  includes?: string[];
  searchTerms?: string[];
}

export interface GroupPattern {
  pattern: RegExp;
  group: string;
  family: string;
  taxId: string;
}

export interface VariantInfo {
  name: string | null;
  type: string;
  source: string;
  additionalNames: string[];
}

export interface GenbankResult {
  accessionId: string | null;
  title: string | null;
  isValid: boolean;
  type: "FASTA";
}

export interface GenBankCacheEntryData {
  suggestions: Suggestion[];
  isComplete: boolean;
  globalLastPage: number;
  lastPage: number;
  pageSize: number;
  totalResults: number;
  taxonomicGroup: string[] | null;
  taxId: string | null;
  metadata?: {
    lastFetched?: number;
    lastAccessTime?: number;
    accessCount?: number;
    [key: string]: any;
  };
}

export interface Suggestion {
  id: string;
  scientificName: string;
  primaryCommonName: string;
  additionalCommonNames: string[];
  type: string;
  source: string;
}

export interface TaxonomicInfo {
  taxId: string | null;
  taxonomicGroup: string[];
  group?: string;
  scientificName?: string;
  family?: string;
  searchContext?: string;
  isSpecificMatch?: boolean;
  isPatternMatch?: boolean;
  isExactMatch?: boolean;
  isCommonNameMatch?: boolean;
  isGroupMatch?: boolean;
  isEmpty?: boolean;
}

export interface VariantResponse {
  nextPage?: number;
  taxId: string | null;
  taxonomicGroup: string[];
  scientificName?: string;
  group?: string;
  searchContext?: string;
  result: Record<string, any>;
  count: number;
  retmax: number;
  retstart: number;
  isComplete: boolean;
  error?: string;
  queryTranslation?: string;
}

export interface ESummaryResult {
  uid: string;
  accessionversion?: string;
  title?: string;
  organism?: string;
  strain?: string;
  subtype?: string;
  subname?: string;
  taxid?: string;
  scientificname?: string;
  commonname?: string;
}
export interface PaginationMetadata {
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  totalSuggestions: number;
  lastPage: number;
  globalLastPage: number;
  isComplete: boolean;
  isPartialPage: boolean;
  taxonomicGroup: string[] | null;
  taxId: string | null;
  lastFetched: number;
  lastFetchedPage: number;
}

export interface PaginatedResults {
  suggestions: Suggestion[];
  metadata?: PaginationMetadata;
}
