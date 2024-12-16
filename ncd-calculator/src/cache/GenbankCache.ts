import {CacheInterface} from "@/cache/CacheInterface.ts";
import {
    AccessionId,
    CACHE_NAMES,
    CacheTypes,
    CommonNameSearch,
    ScientificNameSearch,
    Suggestion,
    SuggestionAndDetailResponse,
    SuggestionCacheEntry,
    SuggestionDetailsCache,
    SuggestionsResponse,
} from "@/services/genbank.ts";
import {MemoryCache} from "@/cache/MemoryCache.ts";
import {LocalStorageCache} from "@/cache/LocalStorageCache.ts";
import {RedisStorageCache} from "@/cache/RedisStorageCache.ts";
import {VITE_REDIS_ENDPOINT} from "@/config/api.tsx";

export class GenbankCache {
    private readonly memoryCache: CacheInterface<CacheTypes>;
    private readonly localStorageCache: CacheInterface<CacheTypes>;
    private readonly redisCache: CacheInterface<CacheTypes>;
    private readonly CACHE_PAGE_SIZE = 5;

    constructor() {
        this.memoryCache = new CacheInterface(new MemoryCache(), {
            ttl: 30 * 60 * 1000, // 30 mins
        });
        this.localStorageCache = new CacheInterface(new LocalStorageCache(), {
            ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        this.redisCache = new CacheInterface(
            new RedisStorageCache(VITE_REDIS_ENDPOINT),
            {
                ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
            }
        );
    }

    createSearchKey(
        mode: "common" | "scientific" | "accession",
        term: CommonNameSearch | ScientificNameSearch | AccessionId
    ): string {
        return `search:${mode}:${term}`;
    }

    async getSuggestions(
        mode: "common" | "scientific" | "accession",
        term: CommonNameSearch | ScientificNameSearch | AccessionId,
        startIndex: number
    ): Promise<SuggestionAndDetailResponse | null> {
        const suggestionAndDetail: SuggestionAndDetailResponse | null =
            await this.getAllSuggestionsAndDetailsForTerm(mode, term);
        if (!suggestionAndDetail) return null;
        const pageSize = this.CACHE_PAGE_SIZE;
        const suggestions: SuggestionCacheEntry = suggestionAndDetail.suggestions;
        const details: SuggestionDetailsCache = suggestionAndDetail.details;
        const endIndex = Math.min(
            startIndex + pageSize,
            suggestions.accessionIds.length
        );
        const pageAccessionIds = suggestions.accessionIds
            .filter((id) => id !== "end")
            .slice(startIndex, endIndex) as AccessionId[];
        const suggestionDetails: SuggestionDetailsCache = {};
        pageAccessionIds.forEach((id) => {
            suggestionDetails[id] = details[id];
        });
        return {
            suggestions: {
                accessionIds: pageAccessionIds,
                metadata: suggestions.metadata,
            },
            details: suggestionDetails,
        };
    }

    async getAllSuggestionsAndDetailsForTerm(
        mode: "common" | "scientific" | "accession",
        term: CommonNameSearch | ScientificNameSearch | AccessionId
    ): Promise<SuggestionAndDetailResponse> {
        const key = this.createSearchKey(mode, term);
        const cacheEntry = await this.getSuggestionsFromCache(key);
        if (!cacheEntry) {
            return this.getEmptySuggestionAndDetailResponse();
        }
        const pageAccessionIds = cacheEntry.accessionIds.filter(
            (id) => id !== "end"
        ) as AccessionId[];
        const suggestions = await Promise.all(
            pageAccessionIds.map(async (id) => {
                return await this.getSuggestionDetail(id);
            })
        );
        const validSuggestions = suggestions.filter(
            (suggestion) => suggestion !== null
        );
        const suggestionDetails: SuggestionDetailsCache = {};
        validSuggestions.forEach((suggestion) => {
            suggestionDetails[suggestion.id as AccessionId] = suggestion;
        });
        return {
            suggestions: cacheEntry,
            details: suggestionDetails,
        };
    }

    private getEmptySuggestionAndDetailResponse(): SuggestionAndDetailResponse {
        const emptySuggestions: SuggestionCacheEntry = {
            accessionIds: [],
        };
        const emptyDetail: SuggestionDetailsCache = {};
        return {
            suggestions: emptySuggestions,
            details: emptyDetail,
        };
    }

    private async getSuggestionDetail(
        accessionId: AccessionId
    ): Promise<Suggestion | null> {
        try {
            const memResult = await this.memoryCache.getCacheEntry(
                CACHE_NAMES.SUGGESTION_DETAILS,
                accessionId
            );
            if (memResult) return memResult;
            const localStorageResult = await this.localStorageCache.getCacheEntry(
                CACHE_NAMES.SUGGESTION_DETAILS,
                accessionId
            );
            if (localStorageResult)
                return localStorageResult;
            const redisResult = await this.redisCache.getCacheEntry(
                CACHE_NAMES.SUGGESTION_DETAILS,
                accessionId
            );
            if (redisResult) {
                const suggestionDetailCache: SuggestionDetailsCache = {
                    [accessionId]: redisResult,
                }
                await Promise.all([
                    this.localStorageCache.setCacheEntry(
                        CACHE_NAMES.SUGGESTION_DETAILS,
                        accessionId,
                        suggestionDetailCache
                    ),
                    this.memoryCache.setCacheEntry(
                        CACHE_NAMES.SUGGESTION_DETAILS,
                        accessionId,
                        suggestionDetailCache
                    ),
                ]);
                return redisResult;
            }
            return null;
        } catch (error) {
            console.error(
                `Error getting suggestion detail for ${accessionId}`,
                error
            );
            return null;
        }
    }

    private async setAccessionDetail(
        accessionId: AccessionId,
        suggestion: Suggestion
    ): Promise<void> {
        const cacheValue: SuggestionDetailsCache = {
            [accessionId]: suggestion,
        };
        Promise.all([
            this.memoryCache.setCacheEntry(
                CACHE_NAMES.SUGGESTION_DETAILS,
                accessionId,
                cacheValue
            ),
            this.localStorageCache.setCacheEntry(
                CACHE_NAMES.SUGGESTION_DETAILS,
                accessionId,
                cacheValue
            ),
            this.redisCache.setCacheEntry(
                CACHE_NAMES.SUGGESTION_DETAILS,
                accessionId,
                cacheValue
            ),
        ]);
    }

    private async getSuggestionsFromCache(
        key: string
    ): Promise<SuggestionCacheEntry | null> {
        try {
            const memResult = await this.memoryCache.getCacheEntry(
                CACHE_NAMES.SUGGESTIONS,
                key
            );
            if (memResult) {
                return memResult as SuggestionCacheEntry;
            }
            const localStorageResult = await this.localStorageCache.getCacheEntry(
                CACHE_NAMES.SUGGESTIONS,
                key
            );
            if (localStorageResult) {
                return localStorageResult;
            }
            const redisResult = await this.redisCache.getCacheEntry(
                CACHE_NAMES.SUGGESTIONS,
                key
            );
            if (redisResult) {
                return redisResult;
            }
            return null;
        } catch (error) {
            console.error(
                `Error getting cache entry for ${CACHE_NAMES.SUGGESTIONS}:${key}`,
                error
            );
            return null;
        }
    }


    async mergeSuggestionsEntriesAndGet(
        existing: SuggestionCacheEntry,
        newEntry: SuggestionCacheEntry
    ): Promise<SuggestionCacheEntry> {
        const existingIds = existing.accessionIds.filter(id => id !== "end") as AccessionId[];
        const newIds = newEntry.accessionIds.filter(id => id !== "end") as AccessionId[];

        const mergedIds = [...new Set([...existingIds, ...newIds])]; // Use Set for deduplication

        return {
            accessionIds: [
                ...mergedIds,
                ...(newEntry.metadata?.isComplete ? ["end" as const] : [])
            ],
            metadata: {
                ...existing.metadata,
                ...newEntry.metadata,
                lastUpdated: Date.now(),
                isComplete: newEntry.metadata?.isComplete || false,
                globalLastPage: Math.max(
                    existing.metadata?.globalLastPage || 0,
                    newEntry.metadata?.globalLastPage || 0
                )
            }
        };
    }

    async mergeSuggestionsAndGet(
        mode: "common" | "scientific" | "accession",
        term: CommonNameSearch | ScientificNameSearch | AccessionId,
        newSuggestions: SuggestionsResponse
    ): Promise<SuggestionAndDetailResponse> {
        const key = this.createSearchKey(mode, term);
        const existingCache = await this.redisCache.getCacheEntry(CACHE_NAMES.SUGGESTIONS, "") || {};
        const existingEntry = existingCache[key] as SuggestionCacheEntry || {
            accessionIds: [],
            metadata: {lastUpdated: 0}
        };
        const mergedEntry = await this.mergeSuggestionsEntriesAndGet(
            existingEntry,
            {
                accessionIds: newSuggestions.suggestions.map(s => s.id as AccessionId),
                metadata: {
                    ...newSuggestions.metadata,
                    lastUpdated: Date.now(),
                    globalLastPage: (existingEntry?.metadata?.globalLastPage || 0) + 1
                }
            }
        );
        const suggestionCacheValue = {
            [key]: mergedEntry
        };
        await Promise.all([
            this.memoryCache.setCacheEntry(CACHE_NAMES.SUGGESTIONS, key, suggestionCacheValue),
            this.localStorageCache.setCacheEntry(CACHE_NAMES.SUGGESTIONS, key, suggestionCacheValue),
            this.redisCache.setCacheEntry(CACHE_NAMES.SUGGESTIONS, key, suggestionCacheValue)
        ]);
        const existingDetails = await this.redisCache.getCacheEntry(CACHE_NAMES.SUGGESTION_DETAILS, "") || {};
        const newDetails = Object.fromEntries(
            newSuggestions.suggestions.map(s => [s.id, s])
        );
        const mergedDetails = {
            ...existingDetails,
            ...newDetails
        };
        await Promise.all([
            this.memoryCache.setCacheEntry(CACHE_NAMES.SUGGESTION_DETAILS, "", mergedDetails),
            this.localStorageCache.setCacheEntry(CACHE_NAMES.SUGGESTION_DETAILS, "", mergedDetails),
            this.redisCache.setCacheEntry(CACHE_NAMES.SUGGESTION_DETAILS, "", mergedDetails)
        ]);

        return {
            suggestions: mergedEntry,
            details: newDetails
        };
    }
}
