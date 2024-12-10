import { BaseCacheMetadata } from "@/cache/CacheInterface.ts";

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
  currentPage?: number;
  totalSuggestions: number;
  globalLastPage: number;
  lastUpdated: number;
  isComplete?: boolean;
}

export interface PaginatedResults {
  suggestions: Suggestion[];
  metadata?: PaginationMetadata;
}

export type SearchMode = "common" | "scientific" | "accession";

export type CommonNameSearch = string & { __commonNameSearchTag: void };
export type ScientificNameSearch = string & { __scientificNameSearchTag: void };
export type AccessionId = string & { __accessionSearchTag: void };

export const createCommonNameSearch = (searchTerm: string): CommonNameSearch =>
  searchTerm as CommonNameSearch;
export const createScientificNameSearch = (
  searchTerm: string
): ScientificNameSearch => searchTerm as ScientificNameSearch;
export const createAccessionSearch = (searchTerm: string): AccessionId =>
  searchTerm as AccessionId;

export const createCommonSearchCacheKey = (searchTerm: string) =>
  `search:common:${searchTerm}`;
export const createScientificSearchCacheKey = (searchTerm: string) =>
  `search:scientific:${searchTerm}`;
export const createAccessionSearchCacheKey = (searchTerm: string) =>
  `search:accession:${searchTerm}`;

export const CACHE_NAMES = {
  SUGGESTIONS: "fasta_suggestions",
  SUGGESTION_DETAILS: "fasta_suggestion_details",
  ACCESSION_SEQUENCE: "fasta_accession_sequence",
} as const;

export interface SuggestionsCache {
  [key: string]: SuggestionCacheEntry;
}

export interface SuggestionDetailsCache {
  [accessionId: string]: Suggestion;
}

export interface AccessionSequenceCache {
  [accessionId: string]: string;
}

export interface SuggestionCacheEntry {
  accessionIds: (AccessionId | "end")[];
  metadata?: BaseCacheMetadata;
}

export interface CacheTypes {
  [CACHE_NAMES.SUGGESTIONS]: SuggestionsCache;
  [CACHE_NAMES.SUGGESTION_DETAILS]: SuggestionDetailsCache;
  [CACHE_NAMES.ACCESSION_SEQUENCE]: AccessionSequenceCache;
}

export interface SuggestionsResponse {
  suggestions: Suggestion[];
  metadata?: PaginationMetadata;
}

export interface SuggestionAndDetailResponse {
  suggestions: SuggestionCacheEntry;
  details: SuggestionDetailsCache;
}
