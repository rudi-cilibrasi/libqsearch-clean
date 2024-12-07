import { CacheInterface } from "../cache/CacheInterface";
import { MemoryCache } from "../cache/MemoryCache";
import { LocalStorageCache } from "../cache/LocalStorageCache";
import { RedisStorageCache } from "../cache/RedisStorageCache";
import { GenBankQueries } from "./GenBankQueries";
import { sendRequestToProxy } from "../functions/fetchProxy";
import { LocalStorageKeys } from "../cache/LocalStorageKeyManager";
import {
  GROUP_PATTERNS,
  GroupEntry,
  TaxonomicGroupKey,
} from "../constants/taxonomy.js";
import {
  TAXONOMIC_MAPPING,
  TAXONOMIC_BASE_GROUPS,
} from "../constants/taxonomy";
import {
  GenbankResult,
  PaginatedResults,
  PaginationMetadata,
  Suggestion,
  VariantResponse,
} from "./genbank.js";
import { TaxonomicInfo } from "./genbank";
import { GenBankCacheEntry } from "./GenbankCacheEntry.js";
import { ANIMAL_GROUPS } from "../constants/taxonomy";

export class GenBankSearchService {
  private readonly EMPTY_GENBANK_RESULT: GenbankResult = {
    accessionId: null,
    title: null,
    isValid: false,
    type: "FASTA",
  };

  private readonly memoryCache: CacheInterface<GenBankCacheEntry>;
  private readonly localStorageCache: CacheInterface<GenBankCacheEntry>;
  private readonly redisCache: CacheInterface<GenBankCacheEntry>;
  private readonly genBankQueries: GenBankQueries;
  private readonly taxonomyCache: Map<
    string,
    { data: TaxonomicInfo; timestamp: number }
  >;
  private readonly CACHE_TTL: number = 30 * 60 * 1000;

  constructor() {
    this.memoryCache = new CacheInterface(new MemoryCache(), {
      ttl: 30 * 60 * 1000,
    });

    this.localStorageCache = new CacheInterface(new LocalStorageCache(), {
      ttl: 24 * 60 * 60 * 1000,
    });

    this.redisCache = new CacheInterface(
      new RedisStorageCache(import.meta.env.VITE_REDIS_ENDPOINT),
      { ttl: 7 * 24 * 60 * 60 * 1000 }
    );
    this.genBankQueries = new GenBankQueries(import.meta.env.VITE_NCBI_API_KEY);
    this.taxonomyCache = new Map();
  }

  /**
   * The basic steps here are as follows:
   * - First, check in the cache whether the search term has valid suggestions, if there are, then return
   * - At the same time, if there are still suggestions available for the search term on Genbank, then fetching them in the background.
   * and add them back to the cache.
   * - If the desired page the the search term is not available, then starting fetching on Genbank and then populate all cache layers.
   * - We first detect the taxonomic group of the search term, and then finding the summary of relevant animals.
   *
   * - We have a global last page for each search term,
   *   the value for the global last page could possibly be incremented by a successful suggestions fetching from the FE
   * - On the FE, each term has a local last page and will be increased by 1 every time a valid search term is entered again,
   *   and this valid is valid when it's <= global last page of this search term.
   * - Once there is no more suggestion to fetch for a search term, the "complete marker" becomes true, at that time, there will be no more
   *   network route trips to Genbank anymore.
   */
  async getSuggestions(
    searchTerm: string,
    page: number = 1,
    startIndex: number
  ): Promise<PaginatedResults> {
    if (!searchTerm?.trim())
      return {
        suggestions: [],
      };

    try {
      const cachedData = await this.getFromCacheHierarchy(
        searchTerm,
        page,
        startIndex
      );
      if (!cachedData || !cachedData?.metadata?.isComplete) {
        Promise.resolve().then(() => {
          this.triggerBackgroundTasks(searchTerm);
        });
      }
      if (cachedData) {
        return cachedData;
      }
      return await this.fetchData(searchTerm, page, startIndex);
    } catch (error) {
      console.error("Error in getSuggestions:", error);
      return {
        suggestions: [],
      } as PaginatedResults;
    }
  }

  private async getFromCacheHierarchy(
    searchTerm: string,
    page: number,
    startIndex: number
  ): Promise<PaginatedResults | null> {
    // Check memory cache
    const memCache = await this.memoryCache.getCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm
    );
    if (memCache && this.hasPageData(memCache, startIndex)) {
      const result = this.paginateResults(memCache, page, startIndex);
      if (result.suggestions.length > 0) {
        return result;
      }
    }

    // Check localStorage
    const localCache = await this.localStorageCache.getCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm
    );
    if (localCache && this.hasPageData(localCache, startIndex)) {
      await this.memoryCache.setCacheEntry(
        LocalStorageKeys.SUGGESTIONS(),
        searchTerm,
        localCache
      );
      const result = this.paginateResults(localCache, page, startIndex);
      if (result.suggestions.length > 0) {
        return result;
      }
    }

    // Check Redis
    const redisCache = await this.redisCache.getCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm
    );
    if (redisCache && this.hasPageData(redisCache, startIndex)) {
      await this.distributeToCaches(searchTerm, redisCache);
      const result = this.paginateResults(redisCache, page, startIndex);
      if (result.suggestions.length > 0) {
        return result;
      }
    }
    return null;
  }

  private async triggerBackgroundTasks(searchTerm: string): Promise<void> {
    Promise.all([
      this.updateAccessMetrics(searchTerm),
      this.checkAndFetchNewData(searchTerm),
    ]).catch((error) => {
      console.error("Background task error:", error);
    });
  }

  async updateAccessMetrics(searchTerm: string) {
    const redisCache = await this.redisCache.getCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm
    );
    if (!redisCache) return;

    const updatedCache = {
      ...redisCache,
      metadata: {
        ...redisCache.metadata,
        accessCount: (redisCache.metadata?.accessCount || 0) + 1,
        lastAccessed: Date.now(),
      },
    };

    await this.redisCache.setCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm,
      updatedCache
    );
  }

  private async checkAndFetchNewData(searchTerm: string): Promise<void> {
    const shouldFetch = await this.shouldFetchMoreData(searchTerm);
    if (!shouldFetch) return;

    const redisCache = await this.redisCache.getCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm
    );

    if (!redisCache) return;

    const nextPage = (redisCache.globalLastPage || 0) + 1;

    try {
      const variantResponse = await this.getVariantsResponse(
        searchTerm,
        redisCache.taxId || "",
        redisCache.taxonomicGroup || [],
        nextPage
      );

      const newSuggestions = this.processVariantResults(
        Object.values(variantResponse.result),
        redisCache.taxonomicGroup || []
      );

      const newCacheData = new GenBankCacheEntry({
        suggestions: newSuggestions,
        isComplete:
          parseInt(variantResponse.retstart.toString()) +
            newSuggestions.length >=
          parseInt(variantResponse.count.toString()),
        lastPage: variantResponse.nextPage || 0,
        globalLastPage: nextPage,
        pageSize: this.genBankQueries.DEFAULT_PAGE_SIZE,
        totalResults: parseInt(variantResponse.count.toString()),
        taxonomicGroup: redisCache.taxonomicGroup,
        taxId: redisCache.taxId,
        metadata: {
          lastFetched: Date.now(),
          lastFetchedPage: nextPage,
        },
      });

      const mergedSuggestions = this.mergeSuggestions(
        redisCache.suggestions,
        newCacheData.suggestions
      );

      const mergedData = new GenBankCacheEntry({
        suggestions: mergedSuggestions,
        isComplete: redisCache.isComplete || newCacheData.isComplete,
        lastPage: Math.max(redisCache.lastPage, newCacheData.lastPage),
        globalLastPage: Math.max(
          redisCache.globalLastPage,
          newCacheData.globalLastPage
        ),
        pageSize: newCacheData.pageSize,
        totalResults: Math.max(
          redisCache.totalResults,
          newCacheData.totalResults
        ),
        taxonomicGroup: newCacheData.taxonomicGroup,
        taxId: newCacheData.taxId,
        metadata: {
          ...redisCache.metadata,
          lastFetched: Date.now(),
          lastFetchedPage: nextPage,
        },
      });

      await this.distributeToCaches(searchTerm, mergedData);
    } catch (error) {
      console.error("Error fetching new data:", error);
    }
  }

  mergeSuggestions(
    existingSuggestions: Suggestion[],
    newSuggestions: Suggestion[]
  ) {
    const seenSuggestions = new Map();
    for (let i = 0; i < existingSuggestions.length; i++) {
      seenSuggestions.set(existingSuggestions[i].id, existingSuggestions[i]);
    }
    const equalAny = (name: string, names: string[]): boolean => {
      for (let i = 0; i < names.length; i++) {
        if (names[i] === name) return true;
      }
      return false;
    };
    const uniqueNewSuggestions: Suggestion[] = newSuggestions.filter(
      (s) =>
        !seenSuggestions.has(s.id) &&
        !equalAny(
          s.primaryCommonName,
          Array.from(seenSuggestions.values()).map((v) => v.primaryCommonName)
        )
    );
    return [...existingSuggestions, ...uniqueNewSuggestions];
  }

  async fetchData(
    searchTerm: string,
    page: number,
    startIndex: number
  ): Promise<PaginatedResults> {
    try {
      const data = await this.fetchAndMergeSuggestions(searchTerm, page);
      if (data) {
        await this.distributeToCaches(searchTerm, data);
        return this.paginateResults(data, page, startIndex);
      }
      return { suggestions: [] };
    } catch (error) {
      console.error("Error fetching data:", error);
      return { suggestions: [] };
    }
  }

  async fetchAndMergeSuggestions(searchTerm: string, page: number) {
    const existingCache: GenBankCacheEntry | null =
      await this.redisCache.getCacheEntry(
        LocalStorageKeys.SUGGESTIONS(),
        searchTerm
      );
    const variantResponse = await this.getVariantsResponseFromSearchTerm(
      searchTerm,
    );
    const newSuggestions = this.processVariantResults(
      Object.values(variantResponse.result),
      variantResponse.taxonomicGroup
    );

    const mergedSuggestions = existingCache
      ? this.mergeSuggestions(existingCache.suggestions, newSuggestions)
      : newSuggestions;

    return new GenBankCacheEntry({
      suggestions: mergedSuggestions,
      isComplete:
        variantResponse.retstart + newSuggestions.length >=
        variantResponse.count,
      lastPage: Math.max(
        existingCache?.lastPage || 0,
        variantResponse.nextPage || 0
      ),
      globalLastPage: Math.max(existingCache?.globalLastPage || 0, page),
      pageSize: this.genBankQueries.DEFAULT_PAGE_SIZE,
      totalResults: variantResponse.count,
      taxonomicGroup: variantResponse.taxonomicGroup,
      taxId: variantResponse.taxId,
      metadata: {
        lastFetched: Date.now(),
        lastFetchedPage: page,
        ...existingCache?.metadata,
      },
    });
  }

  async distributeToCaches(searchTerm: string, mergedData: GenBankCacheEntry) {
    await Promise.all([
      this.memoryCache.setCacheEntry(
        LocalStorageKeys.SUGGESTIONS(),
        searchTerm,
        mergedData
      ),
      this.localStorageCache.setCacheEntry(
        LocalStorageKeys.SUGGESTIONS(),
        searchTerm,
        mergedData
      ),
      this.redisCache.setCacheEntry(
        LocalStorageKeys.SUGGESTIONS(),
        searchTerm,
        mergedData
      ),
    ]);
  }

  private paginateResults(
    cacheEntry: GenBankCacheEntry,
    page: number,
    startIndex: number
  ): PaginatedResults {
    const pageSize =
      cacheEntry.pageSize ?? this.genBankQueries.DEFAULT_PAGE_SIZE;
    const start = startIndex;
    const end = Math.min(start + pageSize, cacheEntry.suggestions.length);
    const paginatedSuggestions = cacheEntry.suggestions.slice(start, end);

    const metadata: PaginationMetadata = {
      currentPage: page,
      totalPages: Math.ceil(cacheEntry.suggestions.length / pageSize),
      hasMore: !cacheEntry.isComplete || end < cacheEntry.suggestions.length,
      totalSuggestions: cacheEntry.suggestions.length,
      lastPage: cacheEntry.lastPage,
      globalLastPage: cacheEntry.globalLastPage,
      isComplete: cacheEntry.isComplete,
      isPartialPage: paginatedSuggestions.length < pageSize,
      taxonomicGroup: cacheEntry.taxonomicGroup,
      taxId: cacheEntry.taxId,
      lastFetched: cacheEntry.metadata.lastFetched,
      lastFetchedPage: (cacheEntry.metadata?.lastFetchedPage as number) || 0,
    };

    return {
      suggestions: paginatedSuggestions,
      metadata,
    };
  }

  async shouldFetchMoreData(searchTerm: string): Promise<boolean> {
    const redisCache = await this.redisCache.getCacheEntry(
      LocalStorageKeys.SUGGESTIONS(),
      searchTerm
    );
    if (!redisCache || redisCache.isComplete) return false;
    const accessCount = redisCache.metadata?.accessCount || 0;
    const lastFetched = redisCache.metadata?.lastFetched || 0;
    const hoursSinceLastFetch = (Date.now() - lastFetched) / (1000 * 60 * 60);
    // Fetch if:
    // 1. High frequency term (accessed more than threshold)
    // 2. Not fetched recently (to avoid hammering the API)
    // 3. Has more pages to fetch
    return (
      accessCount >= 3 &&
      hoursSinceLastFetch >= 1 &&
      redisCache.globalLastPage < 5
    );
  }

  private async getVariantsResponseFromSearchTerm(
    searchTerm: string,
  ): Promise<VariantResponse> {
    try {
      const localCache = await this.localStorageCache.getCacheEntry(
        LocalStorageKeys.SUGGESTIONS(),
        searchTerm
      );
      const nextPage = localCache ? localCache.globalLastPage + 1 : 1;

      // Step 1: Try direct taxonomy lookup
      let taxonomicInfo = await this.getTaxonomicGroupInfo(searchTerm);

      // Step 2: If no direct match, try enhanced search
      if (!taxonomicInfo.taxId) {
        // Try specific animal match
        const animalMatch =
          ANIMAL_GROUPS[searchTerm.toLowerCase() as keyof typeof ANIMAL_GROUPS];
        if (animalMatch) {
          taxonomicInfo = {
            taxId: animalMatch.taxId,
            taxonomicGroup:
              TAXONOMIC_BASE_GROUPS[animalMatch.group].searchTerms || [],
            group: animalMatch.group,
            scientificName: animalMatch.genus,
            searchContext: "specific" as const,
          };
        } else {
          // Try pattern matching
          for (const pattern of GROUP_PATTERNS) {
            if (pattern.pattern.test(searchTerm)) {
              taxonomicInfo = {
                taxId: pattern.taxId,
                taxonomicGroup: TAXONOMIC_BASE_GROUPS[pattern.group as TaxonomicGroupKey].searchTerms || [],
                group: pattern.group,
                scientificName: pattern.family,
                searchContext: "pattern" as const,
              };
              break;
            }
          }
        }
      }

      // Step 3: Get variants using the best available taxonomy info
      const variantResponse = await this.getVariantsResponse(
        searchTerm,
        taxonomicInfo.taxId || '',
        taxonomicInfo.taxonomicGroup,
        nextPage
      );

      return {
        nextPage,
        taxId: taxonomicInfo.taxId,
        taxonomicGroup: taxonomicInfo.taxonomicGroup,
        scientificName: taxonomicInfo.scientificName,
        group: taxonomicInfo.group,
        searchContext: taxonomicInfo.searchContext,
        ...variantResponse,
      };
    } catch (error) {
      console.error("Error in getVariantsResponseFromSearchTerm:", error);
      return {
        taxId: null,
        taxonomicGroup: TAXONOMIC_BASE_GROUPS.VERTEBRATES.searchTerms || [],
        group: "VERTEBRATE",
        result: {},
        count: 0,
        retmax: 0,
        retstart: 0,
        isComplete: true,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getVariantsResponse(
    searchTerm: string,
    taxId: string,
    taxonomicGroup: string[],
    nextPage: number
  ) {
    if (!taxId || !taxonomicGroup) {
      return this.createEmptyVariantResponse();
    }
    try {
      const animalVariantsUri = this.genBankQueries.buildVariantFetchUri(
        searchTerm,
        taxId,
        taxonomicGroup,
        nextPage
      );
      const response = await sendRequestToProxy({
        externalUrl: animalVariantsUri,
      });
      if (response.esearchresult?.idlist?.length > 0) {
        const summaryUri = this.genBankQueries.buildSequenceSummaryUri(
          response.esearchresult.idlist
        );
        const summaryResponse = await sendRequestToProxy({
          externalUrl: summaryUri,
        });
        return {
          ...summaryResponse,
          count: parseInt(response.esearchresult.count),
          retmax: parseInt(response.esearchresult.retmax),
          retstart: parseInt(response.esearchresult.retstart),
          isComplete:
            parseInt(response.esearchresult.retstart) +
              response.esearchresult.idlist.length >=
            parseInt(response.esearchresult.count),
          queryTranslation: response.esearchresult.querytranslation,
        };
      }
      return this.createEmptyVariantResponse();
    } catch (error: any) {
      console.error("Error in getVariantsResponse:", error);
      return this.createEmptyVariantResponse(error.message);
    }
  }

  createEmptyVariantResponse(error = null) {
    return {
      result: [],
      count: 0,
      retmax: 0,
      retstart: 0,
      isComplete: true,
      error: error,
    };
  }

  async getTaxonomicGroupInfo(searchTerm: string): Promise<TaxonomicInfo> {
    try {
      const normalizedSearchTerm = searchTerm.toLowerCase().trim();

      // 1. Check memory cache
      const cached = this.getCachedResult(normalizedSearchTerm);
      if (cached) return cached;

      // 2. Check specific animal groups first (most specific match)
      const animalMatch =
        ANIMAL_GROUPS[normalizedSearchTerm as keyof typeof ANIMAL_GROUPS];
      if (animalMatch) {
        const taxonomicInfo: TaxonomicInfo = {
          taxId: animalMatch.taxId,
          taxonomicGroup: TAXONOMIC_BASE_GROUPS[animalMatch.group].searchTerms,
          scientificName: animalMatch.genus,
          group: animalMatch.group,
          family: animalMatch.family,
          isSpecificMatch: true,
        };
        return this.cacheAndReturn(normalizedSearchTerm, taxonomicInfo);
      }

      // 3. Check group patterns for specific families
      for (const pattern of GROUP_PATTERNS) {
        if (pattern.pattern.test(normalizedSearchTerm)) {
          const taxonomicInfo: TaxonomicInfo = {
            taxId: pattern.taxId,
            taxonomicGroup:
              TAXONOMIC_BASE_GROUPS[pattern.group as TaxonomicGroupKey]
                .searchTerms,
            group: pattern.group,
            family: pattern.family,
            isPatternMatch: true,
          };
          return this.cacheAndReturn(normalizedSearchTerm, taxonomicInfo);
        }
      }

      // 4. Check exact matches in TAXONOMIC_MAPPING
      const exactMatch = this.findExactMatch(normalizedSearchTerm);
      if (exactMatch)
        return this.cacheAndReturn(normalizedSearchTerm, exactMatch);

      // 5. Check common names
      const commonNameMatch = this.findCommonNameMatch(normalizedSearchTerm);
      if (commonNameMatch)
        return this.cacheAndReturn(normalizedSearchTerm, commonNameMatch);

      // 6. Check general group names (least specific match)
      const groupMatch = this.findGroupMatch(normalizedSearchTerm);
      if (groupMatch)
        return this.cacheAndReturn(normalizedSearchTerm, groupMatch);

      // 7. Try comprehensive taxonomy search
      const taxId = await this.findTaxonomyId(normalizedSearchTerm);
      if (taxId) {
        const taxonomyMatch = this.findTaxonomyMatch(taxId);
        if (taxonomyMatch)
          return this.cacheAndReturn(normalizedSearchTerm, taxonomyMatch);
      }

      return this.createEmptyResult();
    } catch (error) {
      console.error(`Taxonomy detection error for: ${searchTerm}`, error);
      return this.createEmptyResult();
    }
  }

  async findTaxonomyId(searchTerm: string) {
    try {
      // Run all search strategies in parallel
      const [taxonomyResult, breedResult] = await Promise.all([
        this.searchTaxonomyDirect(searchTerm),
        this.searchVariantBreeds(searchTerm),
      ]);

      return this.getBestTaxIdMatch(
        {
          taxonomyMatch: taxonomyResult,
          breedMatch: breedResult,
        },
        searchTerm
      );
    } catch (error) {
      console.error("Error in findTaxonomyId:", error);
      return null;
    }
  }

  async searchVariantBreeds(searchTerm: string) {
    const uri = this.genBankQueries.buildAdvancedVariantSearchUri(searchTerm);
    const response = await sendRequestToProxy({ externalUrl: uri });

    if (!response.esearchresult?.idlist?.length) return null;

    const summaryUri = this.genBankQueries.buildSequenceSummaryUri(
      response.esearchresult.idlist
    );
    const summaryResponse = await sendRequestToProxy({
      externalUrl: summaryUri,
    });

    return summaryResponse.result;
  }

  getBestTaxIdFromOrganism(results: any, searchTerm: string) {
    searchTerm = searchTerm.toLowerCase();
    for (const result of results) {
      const organism = (result.organism || "").toLowerCase();
      if (organism.includes(searchTerm)) {
        return result.taxid;
      }
    }
    return null;
  }

  findExactMatch(searchTerm: string) {
    const exactMatch = Object.entries(TAXONOMIC_MAPPING).find(
      ([key, _]) => key.toLowerCase() === searchTerm
    );

    if (exactMatch) {
      const [scientific, data] = exactMatch as [string, GroupEntry];
      const taxonomicInfo: TaxonomicInfo = {
        taxId: data.id,
        taxonomicGroup:
          TAXONOMIC_BASE_GROUPS[data.group as TaxonomicGroupKey].searchTerms ||
          [],
        scientificName: scientific,
        group: data.group,
        isExactMatch: true,
      };
      return taxonomicInfo;
    }
    return null;
  }

  findCommonNameMatch(searchTerm: string) {
    for (const [scientific, data] of Object.entries(TAXONOMIC_MAPPING)) {
      if ("commonNames" in data && data.commonNames?.includes(searchTerm)) {
        const taxonomicInfo: TaxonomicInfo = {
          taxId: data.id,
          taxonomicGroup:
            TAXONOMIC_BASE_GROUPS[data.group as TaxonomicGroupKey]
              .searchTerms || [],
          scientificName: scientific,
          group: data.group,
          isCommonNameMatch: true,
        };
        return taxonomicInfo;
      }
    }
    return null;
  }

  findGroupMatch(searchTerm: string) {
    for (const [group, data] of Object.entries(TAXONOMIC_MAPPING)) {
      if (
        "generalCommonNames" in data &&
        data.generalCommonNames &&
        data.generalCommonNames.includes(searchTerm)
      ) {
        const taxonomicInfo: TaxonomicInfo = {
          taxId: data.id,
          taxonomicGroup: data.searchTerms || [],
          group: group,
          isGroupMatch: true,
        };
        return taxonomicInfo;
      }
    }
    return null;
  }

  getCachedResult(searchTerm: string) {
    const cached = this.taxonomyCache.get(searchTerm);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    return null;
  }

  cacheAndReturn(searchTerm: string, result: TaxonomicInfo) {
    this.taxonomyCache.set(searchTerm, {
      data: result,
      timestamp: Date.now(),
    });
    return result;
  }

  isTaxIdInGroup(speciesTaxId: string, groupTaxId: string) {
    speciesTaxId = speciesTaxId.toString();
    groupTaxId = groupTaxId.toString();

    // Direct match
    if (speciesTaxId === groupTaxId) return true;

    // Check if the species taxId falls under the group's taxonomy hierarchy
    return speciesTaxId.startsWith(groupTaxId.slice(0, 2));
  }

  createEmptyResult(): TaxonomicInfo {
    return {
      taxId: null,
      taxonomicGroup: TAXONOMIC_BASE_GROUPS.VERTEBRATES.searchTerms,
      group: "VERTEBRATE",
      isEmpty: true,
    };
  }

  async searchTaxonomyDirect(searchTerm: string) {
    const uri = this.genBankQueries.buildTaxonomySearchUri(searchTerm);
    const response = await sendRequestToProxy({ externalUrl: uri });

    if (response.esearchresult?.count !== "0") {
      const summaryUri = this.genBankQueries.buildTaxonomicSummaryUri(
        response.esearchresult.idlist[0]
      );
      const summaryResponse = await sendRequestToProxy({
        externalUrl: summaryUri,
      });
      return summaryResponse.result;
    }
    return null;
  }

  getBestTaxIdMatch(
    { taxonomyMatch, breedMatch }: { taxonomyMatch: any; breedMatch: any },
    searchTerm: string
  ) {
    const matches = [];

    if (taxonomyMatch) {
      const result: any = Object.values(taxonomyMatch)[0];
      if (this.isRelevantTaxonomyMatch(result, searchTerm)) {
        matches.push({ taxId: result?.taxid, score: 3, type: "taxonomy" });
      }
    }

    if (breedMatch) {
      const breedTaxId = this.getBestTaxIdFromBreedName(
        Object.values(breedMatch),
        searchTerm
      );
      if (breedTaxId)
        matches.push({ taxId: breedTaxId, score: 2, type: "breed" });
    }

    const bestMatch = matches.sort((a, b) => b.score - a.score)[0];
    return bestMatch?.taxId || null;
  }

  findTaxonomyMatch(taxId: string) {
    // Check specific matches
    for (const group of Object.values(ANIMAL_GROUPS)) {
      if (group.taxId === taxId) {
        return {
          taxId: group.taxId,
          taxonomicGroup: TAXONOMIC_BASE_GROUPS[group.group].searchTerms,
          group: group.group,
          family: group.family,
          isSpecificMatch: true,
        };
      }
    }

    for (const pattern of GROUP_PATTERNS) {
      if (pattern.taxId === taxId) {
        return {
          taxId: pattern.taxId,
          taxonomicGroup:
            TAXONOMIC_BASE_GROUPS[pattern.group as TaxonomicGroupKey]
              .searchTerms,
          group: pattern.group,
          family: pattern.family,
          isPatternMatch: true,
        };
      }
    }

    return {
      taxId: taxId,
      taxonomicGroup: [],
      group: "",
      family: "",
      isPatternMatch: false,
    };
  }

  isRelevantTaxonomyMatch(result: any, searchTerm: string) {
    const searchTermLower = searchTerm.toLowerCase();
    const scientificName = (result.scientificname || "").toLowerCase();
    const commonName = (result.commonname || "").toLowerCase();

    return (
      scientificName.includes(searchTermLower) ||
      commonName.includes(searchTermLower) ||
      this.checkRelatedNames(searchTermLower)
    );
  }

  checkRelatedNames(searchTerm: string) {
    for (const group of Object.values(TAXONOMIC_MAPPING)) {
      if (
        "commonNames" in group &&
        group.commonNames?.some((name) =>
          name.toLowerCase().includes(searchTerm)
        )
      ) {
        return true;
      }
      if (
        "generalCommonNames" in group &&
        group.generalCommonNames?.includes(searchTerm)
      ) {
        return true;
      }
    }
    const animalGroup = ANIMAL_GROUPS[searchTerm as keyof typeof ANIMAL_GROUPS];
    if (animalGroup) {
      return true;
    }
    return GROUP_PATTERNS.some((pattern) => pattern.pattern.test(searchTerm));
  }

  processVariantResults(results: any[], taxonomicGroup: string[]) {
    const uniqueVariants = new Map();

    Object.values(results).forEach((result) => {
      const organism = result.organism || "";

      // Extract variant information from different fields
      const variantInfo = this.extractVariantInfo(result, taxonomicGroup);

      if (variantInfo.name && this.isValidVariantName(variantInfo.name)) {
        const variantKey = variantInfo.name.toLowerCase();
        if (!uniqueVariants.has(variantKey)) {
          uniqueVariants.set(variantKey, {
            id: result.accessionversion || result.uid,
            scientificName: organism,
            primaryCommonName: variantInfo.name,
            additionalCommonNames: variantInfo.additionalNames || [],
            type: variantInfo.type,
            source: variantInfo.source,
          });
        }
      }
    });

    return Array.from(uniqueVariants.values()).slice(0, 5);
  }

  extractVariantInfo(result: any, taxonomicGroup: string[]) {
    const title = result.title || "";
    const organism = result.organism || "";
    const strain = result.strain || "";
    const subtype = result.subtype ? result.subtype.split("|") : [];
    const subname = result.subname ? result.subname.split("|") : [];

    // Try different sources for variant name
    let variantName = null;
    let variantType = "Variant";
    let source = "";
    let additionalNames: any[] = [];

    // 1. Check strain field first
    if (strain && this.isValidVariantName(this.cleanVariantName(strain) || '')) {
      variantName = this.cleanVariantName(strain);
      variantType = "Strain";
      source = "strain";
    }

    // 2. Check subtype/subname pairs
    if (!variantName && subtype.length === subname.length) {
      for (let i = 0; i < subtype.length; i++) {
        const type = subtype[i].toLowerCase();
        const name = subname[i];

        if (
          ["strain", "breed", "variety", "subspecies"].includes(type) &&
          this.isValidVariantName(this.cleanVariantName(name) || '')
        ) {
          variantName = this.cleanVariantName(name);
          variantType = type.charAt(0).toUpperCase() + type.slice(1);
          source = "subtype";
          break;
        }
      }
    }

    // 3. Check taxonomic group terms in title
    if (!variantName) {
      for (const term of taxonomicGroup) {
        const match = title.match(
          new RegExp(`${term}\\s+([^,\\s](?:[^,]*[^,\\s])?)`, "i")
        );
        if (match && match[1]) {
          const cleaned = this.cleanVariantName(match[1]) || '';
          if (this.isValidVariantName(cleaned)) {
            variantName = cleaned;
            variantType = term.charAt(0).toUpperCase() + term.slice(1);
            source = "title";
            break;
          }
        }
      }
    }

    // 4. use the organism as variant name if it's still null

    if (!variantName || (variantName === "" && organism.trim() !== "")) {
      variantName = organism;
      variantType = "species";
      source = "Scientific";
    }

    // 5. Check for population or geographic variants
    if (!variantName && subtype.includes("country")) {
      const countryIndex = subtype.indexOf("country");
      const locationName = subname[countryIndex];
      if (
        locationName &&
        this.isValidVariantName(this.cleanVariantName(locationName) || '')
      ) {
        variantName = this.cleanVariantName(locationName);
        variantType = "Geographic Variant";
        source = "location";
      }
    }

    return {
      name: variantName,
      type: variantType,
      source: source,
      additionalNames,
    };
  }

  cleanVariantName(name: string): string | undefined {
    if (!name) return undefined;
    // remove technical names
    name = name
      .split(/[,([]/, 1)[0]
      .trim()
      .replace(
        /\s+(chromosome|unplaced|genomic|sequence|dna|assembly|scaffold|contig|isolate|genome|complete|whole|mitochondrial|mitochondrion|sample|strain|type|specimen).*$/i,
        ""
      )
      .trim();

    if (name.includes(":")) {
      name = name.split(":")[0].trim();
    }

    return name
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  isValidVariantName(name: string): boolean {
    if (!name || name.length < 2) return false;

    const invalidWords = [
      "chromosome",
      "unplaced",
      "genomic",
      "sequence",
      "dna",
      "assembly",
      "scaffold",
      "contig",
      "isolate",
      "genome",
      "mitochondrial",
      "mitochondrion",
      "sample",
      "unknown",
      "specimen",
      "type",
      "strain",
      "complete",
      "whole",
      "partial",
    ];

    const lowerName = name.toLowerCase();

    if (invalidWords.some((word) => lowerName.includes(word))) return false;

    return /^[A-Z][a-zA-Z0-9\s-]+$/.test(name);
  }

  hasPageData(result: GenBankCacheEntry, startIndex: number) {
    const len = result.suggestions.length;
    return startIndex < len;
  }

  getBestTaxIdFromBreedName(summaryResults: any[], breedName: string) {
    for (let i = 0; i < summaryResults.length; i++) {
      if (!summaryResults[i].subtype || !summaryResults[i].subname) {
        continue;
      }
      const subtype = summaryResults[i].subtype.split("|");
      const subname = summaryResults[i].subname.split("|");
      for (let j = 0; j < subtype.length; j++) {
        if (subtype[j] === "breed") {
          const score = this.calculateStringSimilarity(breedName, subname[j]);
          if (score === 100) {
            return summaryResults[i].taxid;
          }
        }
      }
    }
    return null;
  }

  calculateStringSimilarity(strA: string, strB: string) {
    const a = strA.toLowerCase().trim();
    const b = strB.toLowerCase().trim();

    if (a === b) return 100;

    if (!a || !b) return 0;

    if (b.includes(a) || a.includes(b)) {
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length <= b.length ? b : a;

      const lengthRatio = shorter.length / longer.length;

      if (longer.includes(shorter)) {
        const baseScore = 80;
        const lengthPenalty = (1 - lengthRatio) * 30;
        return Math.round(baseScore - lengthPenalty);
      }
    }

    let matchCount = 0;
    let maxLength = Math.max(a.length, b.length);

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) matchCount++;
    }
    const similarityScore = (matchCount / maxLength) * 60; // Max 60 for partial matches

    return Math.round(similarityScore);
  }

  async hasGenbankRecordForSearchTerm(searchTerm: string) {
    if (!searchTerm?.trim()) return this.EMPTY_GENBANK_RESULT;
    try {
      const cachedResult = await this.getValidationFromCache(searchTerm);
      if (cachedResult) {
        return cachedResult;
      }
      const requestUri =
        this.genBankQueries.buildGenbankRecordCheckUri(searchTerm);
      const response = await sendRequestToProxy({
        externalUrl: requestUri,
      });
      const result = {
        accessionId: response.esearchresult.idlist?.[0] || null,
        title: searchTerm,
        isValid: response.esearchresult.count !== "0",
        type: "FASTA",
      };
      return result.isValid;
    } catch (error) {
      console.error("Error checking GenBank record:", error);
      return this.EMPTY_GENBANK_RESULT;
    }
  }

  async getValidationFromCache(searchTerm: string) {
    const memCache = await this.memoryCache.getCacheEntry(
      LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
      searchTerm
    );
    if (memCache?.isValid) return memCache;
    const localCache = await this.localStorageCache.getCacheEntry(
      LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
      searchTerm
    );
    if (localCache?.isValid) {
      await this.memoryCache.setCacheEntry(
        LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
        searchTerm,
        localCache
      );
      return localCache;
    }
    const redisCache = await this.redisCache.getCacheEntry(
      LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
      searchTerm
    );
    if (redisCache?.isValid) {
      await this.updateValidationLocalCaches(searchTerm, redisCache);
      return redisCache;
    }

    return null;
  }

  async updateValidationLocalCaches(
    searchTerm: string,
    data: GenBankCacheEntry
  ) {
    if (!data.isValid) return;

    await Promise.all([
      this.memoryCache.setCacheEntry(
        LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
        searchTerm,
        data
      ),
      this.localStorageCache.setCacheEntry(
        LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
        searchTerm,
        data
      ),
    ]).catch((error) => {
      console.error("Error updating local validation caches:", error);
    });
  }
}
