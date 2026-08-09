import { GenBankQueries } from "./GenBankQueries";
import { sendRequestToProxy } from "../functions/fetchProxy";
import {
  GROUP_PATTERNS,
  GroupEntry,
  TaxonomicGroupKey,
} from "../constants/taxonomy.js";
import {
  ANIMAL_GROUPS,
  TAXONOMIC_BASE_GROUPS,
  TAXONOMIC_MAPPING,
} from "../constants/taxonomy";
import {
  AccessionId,
  CommonNameSearch,
  createAccessionSearch,
  createCommonNameSearch,
  createScientificNameSearch,
  GenBankRecordSearchPage,
  GenBankRecordSearchRequest,
  GenBankRecordSuggestion,
  GenBankSearchError,
  GenBankSearchScope,
  PaginatedResults,
  Suggestion,
  SuggestionAndDetailResponse,
  SuggestionCacheEntry,
  SuggestionsResponse,
  VariantResponse,
} from "./genbank.js";
import { TaxonomicInfo } from "./genbank";
import { GenbankCache } from "@/cache/GenbankCache.js";
import { ScientificNameSearch } from "./genbank";

const DIRECT_RECORD_PATTERN = /^(?:\d+|[A-Z]{1,6}_?\d+(?:\.\d+)?)$/iu;
const REFSEQ_ACCESSION_PATTERN = /^(?:NC_|NG_|NM_|NR_|NT_|NW_|NZ_|XM_|XR_)/u;

interface TaxonomyLookupOptions {
  readonly signal?: AbortSignal;
  readonly strict?: boolean;
}

const sendNcbiRequest = (externalUrl: string, signal?: AbortSignal): Promise<any> => signal
  ? sendRequestToProxy({externalUrl}, {signal})
  : sendRequestToProxy({externalUrl});

const parseRecordLength = (value: unknown, accessionVersion: string): number => {
  const length = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(length) || length <= 0) {
    throw new GenBankSearchError("MALFORMED_RESPONSE", `NCBI returned an invalid length for ${accessionVersion}.`);
  }
  return length;
};

const inferRecordScope = (title: string): GenBankSearchScope | "unknown" => {
  const normalized = title.toLowerCase();
  if (/(mitochondrion|mitochondrial).*(complete genome)|complete.*(mitochondrion|mitochondrial)/u.test(normalized)) {
    return "mitochondrial-genome";
  }
  if (/\b(coi|cox1)\b|cytochrome c oxidase subunit i\b/u.test(normalized)) return "coi";
  if (/\bcytb\b|cytochrome b\b/u.test(normalized)) return "cytb";
  return "unknown";
};

export class GenBankSearchService {
  private readonly genbankCache: GenbankCache;
  private readonly genBankQueries: GenBankQueries;
  private readonly taxonomyCache: Map<
    string,
    { data: TaxonomicInfo; timestamp: number }
  >;
  private readonly recordSearchCache = new Map<string, {expiresAt: number; page: GenBankRecordSearchPage}>();
  private readonly CACHE_TTL: number = 30 * 60 * 1000;
  private readonly RECORD_CACHE_TTL = 15 * 60 * 1000;
  private readonly MAX_RECORD_CACHE_ENTRIES = 100;

  constructor() {
    this.genbankCache = new GenbankCache();
    this.genBankQueries = new GenBankQueries();
    this.taxonomyCache = new Map();
  }

  async searchRecords(request: GenBankRecordSearchRequest): Promise<GenBankRecordSearchPage> {
    const query = request.query.trim();
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? this.genBankQueries.DEFAULT_PAGE_SIZE;
    if (query.length < 2 || query.length > 200) {
      throw new GenBankSearchError("INVALID_QUERY", "Enter an animal name or accession between 2 and 200 characters.");
    }
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 20) {
      throw new GenBankSearchError("INVALID_QUERY", "The requested GenBank result page is invalid.");
    }
    if (request.signal?.aborted) throw new DOMException("GenBank search was cancelled.", "AbortError");
    const cacheKey = `${query.toUpperCase()}\u0000${request.scope}\u0000${page}\u0000${pageSize}`;
    const cached = this.recordSearchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.page;
    if (cached) this.recordSearchCache.delete(cacheKey);

    try {
      if (DIRECT_RECORD_PATTERN.test(query)) {
        const summaryUri = this.genBankQueries.buildSequenceSummaryUri(query);
        const response = await sendNcbiRequest(summaryUri, request.signal);
        const records = this.parseRecordSummaries(response, request.scope, [], false);
        if (records.length === 0) {
          throw new GenBankSearchError("NO_MATCH", `NCBI did not return the requested record ${query}.`);
        }
        const exactRecord = records[0];
        if (query.includes(".") && exactRecord.accessionVersion !== query.toUpperCase()) {
          throw new GenBankSearchError(
            "NO_MATCH",
            `NCBI resolved ${query} as ${exactRecord.accessionVersion}; CompLearn will not substitute a different sequence version.`,
          );
        }
        return this.cacheRecordSearchPage(cacheKey, {
          records: [exactRecord], page: 1, pageSize: 1, total: 1, hasMore: false,
        });
      }

      const taxonomy = await this.getTaxonomicGroupInfo(query, {signal: request.signal, strict: true});
      if (!taxonomy.taxId) {
        throw new GenBankSearchError("NO_MATCH", `No unambiguous NCBI animal taxonomy match was found for “${query}”.`);
      }
      const searchUri = this.genBankQueries.buildRecordSearchUri(taxonomy.taxId, request.scope, page, pageSize);
      const searchResponse = await sendNcbiRequest(searchUri, request.signal);
      const searchResult = searchResponse?.esearchresult;
      const identifiers = Array.isArray(searchResult?.idlist)
        ? searchResult.idlist.filter((value: unknown): value is string => typeof value === "string" && /^\d+$/u.test(value))
        : [];
      const total = Number.parseInt(String(searchResult?.count ?? "0"), 10);
      if (!Number.isSafeInteger(total) || total < 0) {
        throw new GenBankSearchError("MALFORMED_RESPONSE", "NCBI returned malformed search metadata.");
      }
      if (identifiers.length === 0) {
        return this.cacheRecordSearchPage(cacheKey, {
          records: [], page, pageSize, total, hasMore: false, resolvedTaxId: taxonomy.taxId,
        });
      }

      const summaryUri = this.genBankQueries.buildSequenceSummaryUri(identifiers);
      const summaryResponse = await sendNcbiRequest(summaryUri, request.signal);
      const records = this.parseRecordSummaries(summaryResponse, request.scope, taxonomy.taxonomicGroup, true);
      const consumed = (page - 1) * pageSize + identifiers.length;
      return this.cacheRecordSearchPage(cacheKey, {
        records,
        page,
        pageSize,
        total,
        hasMore: consumed < total,
        resolvedTaxId: taxonomy.taxId,
      });
    } catch (error) {
      if (request.signal?.aborted) throw new DOMException("GenBank search was cancelled.", "AbortError");
      if (error instanceof GenBankSearchError) throw error;
      throw new GenBankSearchError(
        "UPSTREAM_UNAVAILABLE",
        "GenBank search is temporarily unavailable. Please try again.",
        error,
      );
    }
  }

  private cacheRecordSearchPage(
    key: string,
    page: GenBankRecordSearchPage,
  ): GenBankRecordSearchPage {
    if (this.recordSearchCache.size >= this.MAX_RECORD_CACHE_ENTRIES) {
      const oldestKey = this.recordSearchCache.keys().next().value as string | undefined;
      if (oldestKey) this.recordSearchCache.delete(oldestKey);
    }
    this.recordSearchCache.set(key, {expiresAt: Date.now() + this.RECORD_CACHE_TTL, page});
    return page;
  }

  private parseRecordSummaries(
    response: unknown,
    requestedScope: GenBankSearchScope,
    taxonomicGroup: readonly string[],
    trustRequestedScope: boolean,
  ): readonly GenBankRecordSuggestion[] {
    if (!response || typeof response !== "object" || !("result" in response)) {
      throw new GenBankSearchError("MALFORMED_RESPONSE", "NCBI returned a malformed record summary.");
    }
    const result = (response as {result?: unknown}).result;
    if (!result || typeof result !== "object") {
      throw new GenBankSearchError("MALFORMED_RESPONSE", "NCBI returned a malformed record summary.");
    }

    return Object.entries(result as Record<string, unknown>).flatMap(([key, raw]) => {
      if (key === "uids" || !raw || typeof raw !== "object") return [];
      const summary = raw as Record<string, unknown>;
      const uid = String(summary.uid ?? key).trim();
      const accessionVersion = String(summary.accessionversion ?? "").trim().toUpperCase();
      if (!/^\d+$/u.test(uid) || !DIRECT_RECORD_PATTERN.test(accessionVersion) || /^\d+$/u.test(accessionVersion)) {
        throw new GenBankSearchError("MALFORMED_RESPONSE", "NCBI returned a record without a stable accession version.");
      }
      const title = String(summary.title ?? "").trim();
      const organism = String(summary.organism ?? "").trim();
      if (!title || !organism) {
        throw new GenBankSearchError("MALFORMED_RESPONSE", `NCBI returned incomplete metadata for ${accessionVersion}.`);
      }
      const inferredScope = inferRecordScope(title);
      const scope = inferredScope === "unknown" && trustRequestedScope
        ? requestedScope
        : inferredScope;
      const lowerTitle = title.toLowerCase();
      const variant = this.extractVariantInfo(summary, [...taxonomicGroup]);
      return [{
        uid,
        accession: accessionVersion.split(".")[0],
        accessionVersion,
        title,
        organism,
        taxId: String(summary.taxid ?? "").trim(),
        length: parseRecordLength(summary.slen, accessionVersion),
        scope,
        isComplete: scope === "mitochondrial-genome"
          ? lowerTitle.includes("complete") && !lowerTitle.includes("partial")
          : !lowerTitle.includes("partial"),
        sourceDatabase: REFSEQ_ACCESSION_PATTERN.test(accessionVersion) ? "RefSeq" : "GenBank",
        updatedAt: String(summary.updatedate ?? "").trim() || undefined,
        recordUrl: `https://www.ncbi.nlm.nih.gov/nuccore/${encodeURIComponent(accessionVersion)}`,
        variantName: variant.name && variant.name !== organism ? variant.name : undefined,
      } satisfies GenBankRecordSuggestion];
    });
  }

  /**
   * The basic steps here are as follows:
   * - First, check in the cache whether the search term has valid suggestions, if there are, then return
   * - At the same time, if there are still suggestions available for the search term on Genbank, then fetching them in the background.
   * and add them back to the cache.
   * - If the desired page the search term is not available, then starting fetching on Genbank and then populate all cache layers.
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
    startIndex: number,
    displayMode: "common" | "scientific" | "accession" = "common"
  ): Promise<PaginatedResults> {
    if (!searchTerm?.trim()) {
      return { suggestions: [] };
    }

    try {
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();
      const mode = displayMode as "common" | "scientific" | "accession";
      const typedSearchTerm =
        displayMode === "accession"
          ? createAccessionSearch(normalizedSearchTerm)
          : displayMode === "scientific"
          ? createScientificNameSearch(normalizedSearchTerm)
          : createCommonNameSearch(normalizedSearchTerm);
      const cachedResult = await this.genbankCache.getSuggestions(
        mode,
        typedSearchTerm,
        startIndex
      );
      if (cachedResult && this.hasCachedSuggestions(cachedResult)) {
        const isComplete = cachedResult.suggestions.metadata
          ?.isComplete as boolean;
        const lastUpdated = cachedResult.suggestions.metadata?.lastUpdated || 0;
        const globalLastPage =
          cachedResult.suggestions.metadata?.globalLastPage || 0;
        const paginatedResult: PaginatedResults = {
          suggestions: Object.values(cachedResult.details),
          metadata: {
            currentPage: page,
            totalSuggestions: cachedResult.suggestions.accessionIds.length,
            lastUpdated,
            globalLastPage,
            isComplete: isComplete,
          },
        };
        // Only trigger background fetch if:
        // 1. No isComplete flag
        // 2. Cache is not too fresh (to avoid hammering the API)
        if (!isComplete && Date.now() - lastUpdated > 60 * 1000) {
          this.fetchMoreSuggestionsInBackground(typedSearchTerm, mode);
        }
        return paginatedResult;
      }
      const newSuggestionsResponse = await this.fetchSuggestionsFromGenbank(
        mode,
        typedSearchTerm,
        page
      );
      const mergedResult = await this.genbankCache.mergeSuggestionsAndGet(
        mode,
        typedSearchTerm,
        newSuggestionsResponse
      );

      return {
        suggestions: Object.values(mergedResult.details),
        metadata: {
          currentPage: page,
          totalSuggestions: mergedResult.suggestions.accessionIds.length,
          lastUpdated:
            mergedResult.suggestions.metadata?.lastUpdated || Date.now(),
          globalLastPage:
            mergedResult.suggestions.metadata?.globalLastPage || page,
          isComplete:
            (mergedResult.suggestions.metadata?.isComplete as boolean) || false,
        },
      };
    } catch (error) {
      console.error("Error in getSuggestions:", error);
      return { suggestions: [] };
    }
  }

  private hasCachedSuggestions(suggestions: SuggestionAndDetailResponse): boolean {
    return suggestions.suggestions.accessionIds.length != 0;
  }

  private async fetchMoreSuggestionsInBackground(
    searchTerm: CommonNameSearch | ScientificNameSearch | AccessionId,
    mode: "common" | "scientific" | "accession"
  ) {
    try {
      const cache: SuggestionAndDetailResponse =
        await this.genbankCache.getAllSuggestionsAndDetailsForTerm(
          mode,
          searchTerm
        );
      const suggestions: SuggestionCacheEntry = cache.suggestions;
      if (!suggestions || suggestions.metadata?.isComplete) {
        return;
      }
      const nextPage = (suggestions?.metadata?.globalLastPage || 0) + 1;
      this.fetchAndMergeSuggestions(mode, searchTerm, nextPage);
    } catch (error) {
      console.error(
        `Error fetching more suggestions for ${mode}:${searchTerm}`,
        error
      );
    }
  }

  async fetchSuggestionsFromGenbank(
    _mode: "common" | "scientific" | "accession",
    term: AccessionId | ScientificNameSearch | CommonNameSearch,
    page: number
  ): Promise<SuggestionsResponse> {
    try {
      const searchTerm = this.getQueryFromTermType(term);
      const variantResponse = await this.getVariantsResponseFromSearchTerm(
        searchTerm,
        page
      );
      if (!variantResponse || !variantResponse.result) {
        return {
          suggestions: [],
        };
      }
      const newSuggestions: Suggestion[] = this.processVariantResults(
        Object.values(variantResponse.result),
        variantResponse.taxonomicGroup
      );
      return {
        suggestions: newSuggestions,
        metadata: {
          totalSuggestions: newSuggestions.length,
          globalLastPage: page,
          lastUpdated: Date.now(),
          currentPage: page,
          isComplete: variantResponse.isComplete,
        },
      };
    } catch (error) {
      console.error(
        `Error while fetching new suggestions for: ${term as string}`,
        error
      );
      return {
        suggestions: [],
      };
    }
  }

  getQueryFromTermType = (
    term: AccessionId | ScientificNameSearch | CommonNameSearch
  ): string => {
    return term as string;
  };

  async fetchAndMergeSuggestions(
    mode: "common" | "scientific" | "accession",
    searchTerm: CommonNameSearch | ScientificNameSearch | AccessionId,
    page: number
  ): Promise<SuggestionAndDetailResponse> {
    const newSuggestionsResponse: SuggestionsResponse =
      await this.fetchSuggestionsFromGenbank(mode, searchTerm, page);
    return this.genbankCache.mergeSuggestionsAndGet(
      mode,
      searchTerm,
      newSuggestionsResponse
    );
  }

  private async getVariantsResponseFromSearchTerm(
    searchTerm: string,
    page: number
  ): Promise<VariantResponse> {
    try {
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
                taxonomicGroup:
                  TAXONOMIC_BASE_GROUPS[pattern.group as TaxonomicGroupKey]
                    .searchTerms || [],
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
        taxonomicInfo.taxId || "",
        taxonomicInfo.taxonomicGroup,
        page
      );

      return {
        nextPage: page,
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

  async getTaxonomicGroupInfo(
    searchTerm: string,
    options: TaxonomyLookupOptions = {},
  ): Promise<TaxonomicInfo> {
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

      // 3. Check exact matches in TAXONOMIC_MAPPING
      const exactMatch = this.findExactMatch(normalizedSearchTerm);
      if (exactMatch)
        return this.cacheAndReturn(normalizedSearchTerm, exactMatch);

      // 4. Check group patterns for specific families
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

      // 5. Check common names
      const commonNameMatch = this.findCommonNameMatch(normalizedSearchTerm);
      if (commonNameMatch)
        return this.cacheAndReturn(normalizedSearchTerm, commonNameMatch);

      // 6. Check general group names (least specific match)
      const groupMatch = this.findGroupMatch(normalizedSearchTerm);
      if (groupMatch)
        return this.cacheAndReturn(normalizedSearchTerm, groupMatch);

      // 7. Try comprehensive taxonomy search
      const taxId = await this.findTaxonomyId(normalizedSearchTerm, options);
      if (taxId) {
        const taxonomyMatch = this.findTaxonomyMatch(String(taxId));
        if (taxonomyMatch)
          return this.cacheAndReturn(normalizedSearchTerm, taxonomyMatch);
      }

      return this.createEmptyResult();
    } catch (error) {
      if (options.strict) throw error;
      console.error(`Taxonomy detection error for: ${searchTerm}`, error);
      return this.createEmptyResult();
    }
  }

  async findTaxonomyId(searchTerm: string, options: TaxonomyLookupOptions = {}) {
    try {
      const isAccession = this.isAccessionFormat(searchTerm);
      if (isAccession) {
        return await this.searchTaxonomyByAccession(searchTerm);
      } else {
        const [taxonomyResult, breedResult] = await Promise.all([
          this.searchTaxonomyDirect(searchTerm, options),
          this.searchVariantBreeds(searchTerm, options),
        ]);

        return this.getBestTaxIdMatch(
            {
              taxonomyMatch: taxonomyResult,
              breedMatch: breedResult,
            },
            searchTerm
        );
      }
    } catch (error) {
      if (options.strict) throw error;
      console.error("Error in findTaxonomyId:", error);
      return null;
    }
  }

  private isAccessionFormat(searchTerm: string): boolean {
    const accessionPatterns = [
      /^[A-Za-z]{1,2}\d{5,6}(\.\d+)?$/,
      /^[A-Za-z]{2}_\d{6,}(\.\d+)?$/,
      /^[A-Za-z]{3}\d{5}(\.\d+)?$/,
      /^[A-Za-z]{4}\d{8}(\.\d+)?$/,
      /^[A-Za-z]{6}\d{9,}(\.\d+)?$/
    ];

    return accessionPatterns.some(pattern => pattern.test(searchTerm));
  }

  private async searchTaxonomyByAccession(accessionId: string) {
    try {
      const uri = this.genBankQueries.buildSequenceSummaryUri([accessionId]);
      const response = await sendRequestToProxy({ externalUrl: uri });

      if (!response?.result || Object.values(response?.result).length === 0) {
        return null;
      }
      const summary = Object.values(response.result as Record<string, unknown>)
        .find((value): value is {taxid?: unknown} => value !== null && typeof value === "object" && "taxid" in value);
      const taxId = typeof summary?.taxid === "string" || typeof summary?.taxid === "number"
        ? summary.taxid
        : null;
      if (!taxId) {
        return null;
      }
      return taxId;
    } catch (error) {
      console.error("Error in searchTaxonomyByAccession:", error);
      return null;
    }
  }

  async searchVariantBreeds(
    searchTerm: string,
    options: TaxonomyLookupOptions = {},
  ): Promise<any | null> {
    try {
      const uri = this.genBankQueries.buildAdvancedVariantSearchUri(searchTerm);
      const response = await sendNcbiRequest(uri, options.signal);

      if (!response.esearchresult?.idlist?.length) return null;

      const summaryUri = this.genBankQueries.buildSequenceSummaryUri(
          response.esearchresult.idlist
      );
      const summaryResponse = await sendNcbiRequest(summaryUri, options.signal);
      return summaryResponse.result || null;
    } catch (error) {
      if (options.strict) throw error;
      console.error("Error while search variant breeds:", error);
      return null;
    }
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

  createEmptyResult(): TaxonomicInfo {
    return {
      taxId: null,
      taxonomicGroup: TAXONOMIC_BASE_GROUPS.VERTEBRATES.searchTerms,
      group: "VERTEBRATE",
      isEmpty: true,
    };
  }

  async searchTaxonomyDirect(
    searchTerm: string,
    options: TaxonomyLookupOptions = {},
  ): Promise<any | null> {
    try {
      const uri = this.genBankQueries.buildTaxonomySearchUri(searchTerm);
      const response = await sendNcbiRequest(uri, options.signal);

      if (response.esearchresult?.count !== "0") {
        const summaryUri = this.genBankQueries.buildTaxonomicSummaryUri(
            response.esearchresult.idlist[0]
        );
        const summaryResponse = await sendNcbiRequest(summaryUri, options.signal);
        return summaryResponse.result || null;
      } else {
        return null;
      }
    } catch (error) {
      if (options.strict) throw error;
      return null;
    }
  }

  getBestTaxIdMatch(
    { taxonomyMatch, breedMatch }: { taxonomyMatch: any; breedMatch: any },
    searchTerm: string
  ) {
    const matches: Array<{
      taxId: string;
      score: number;
      type: string;
      isScientific: boolean;
    }> = [];

    const isScientificSearch = this.looksLikeScientificName(searchTerm);
    if (taxonomyMatch) {
      const result: any = Object.values(taxonomyMatch)[0];
      if (this.isRelevantTaxonomyMatch(result, searchTerm)) {
        matches.push({
          taxId: result?.taxid,
          score: 3,
          type: "taxonomy",
          isScientific: true,
        });
      }
    }

    if (breedMatch) {
      const breedTaxId = this.getBestTaxIdFromBreedName(
        Object.values(breedMatch),
        searchTerm
      );
      if (breedTaxId)
        matches.push({
          taxId: breedTaxId,
          score: 2,
          type: "breed",
          isScientific: false,
        });
    }

    const bestMatch = matches.sort((a, b) => {
      if (isScientificSearch && a.isScientific !== b.isScientific) {
        return a.isScientific ? -1 : 1;
      }
      return b.score - a.score;
    })[0];
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

  processVariantResults(
    results: any[],
    taxonomicGroup: string[]
  ): Suggestion[] {
    const uniqueVariants = new Map();

    Object.values(results).forEach((result) => {
      const organism = result.organism || "";

      // Extract variant information from different fields
      const variantInfo = this.extractVariantInfo(result, taxonomicGroup);

      if (variantInfo.name && this.isValidVariantName(variantInfo.name)) {
        uniqueVariants.set(result.accessionversion || result.id, {
          id: result.accessionversion || result.uid,
          scientificName: organism,
          primaryCommonName: variantInfo.name,
          additionalCommonNames: variantInfo.additionalNames || [],
          type: variantInfo.type,
          source: variantInfo.source,
        });
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
    if (
      strain &&
      this.isValidVariantName(this.cleanVariantName(strain) || "")
    ) {
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
          this.isValidVariantName(this.cleanVariantName(name) || "")
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
          const cleaned = this.cleanVariantName(match[1]) || "";
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
        this.isValidVariantName(this.cleanVariantName(locationName) || "")
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

  async hasAnyValidCacheEntry(searchTerm: string): Promise<boolean> {
    const accessionId = createAccessionSearch(searchTerm);
    const commonNameSearch = createCommonNameSearch(searchTerm);
    const ScientificNameSearch = createScientificNameSearch(searchTerm);
    const accessionCache = await this.genbankCache.getSuggestions(
      "accession",
      accessionId,
      0
    );
    if (accessionCache && accessionCache.suggestions.accessionIds.length > 0) {
      return true;
    }
    const commonNameCache = await this.genbankCache.getSuggestions(
      "common",
      commonNameSearch,
      0
    );
    if (
      commonNameCache &&
      commonNameCache.suggestions.accessionIds.length > 0
    ) {
      return true;
    }
    const scientificNameCache = await this.genbankCache.getSuggestions(
      "scientific",
      ScientificNameSearch,
      0
    );
    return !!(scientificNameCache &&
        scientificNameCache.suggestions.accessionIds.length > 0);

  }

  private looksLikeScientificName(searchTerm: string): boolean {
    const normalizedTerm = searchTerm.trim();
    // Check for typical scientific name patterns
    const hasLatinFormat = /^[A-Z][a-z]+ [a-z]+/.test(normalizedTerm);
    const wordCount = normalizedTerm.split(/\s+/).length;
    const hasSpecialChars = /[0-9!@#$%^&*(),.?":{}|<>]/.test(normalizedTerm);

    return hasLatinFormat && wordCount >= 2 && !hasSpecialChars;
  }


  async hasGenbankRecordForSearchTerm(searchTerm: string) {
    if (!searchTerm?.trim()) return false;
    try {
      const cachedResult = await this.hasAnyValidCacheEntry(searchTerm);
      if (cachedResult) {
        return cachedResult;
      }
      const requestUri =
          this.genBankQueries.buildGenbankRecordCheckUri(searchTerm);
      const response = await sendRequestToProxy({
        externalUrl: requestUri,
      });
      return response.esearchresult.count !== "0";
    } catch (error) {
      console.error("Error checking GenBank record:", error);
      return false;
    }
  }
}
