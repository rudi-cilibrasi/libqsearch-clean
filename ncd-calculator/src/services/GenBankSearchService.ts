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

export class GenBankSearchService {
  private readonly genbankCache: GenbankCache;
  private readonly genBankQueries: GenBankQueries;
  private readonly taxonomyCache: Map<
    string,
    { data: TaxonomicInfo; timestamp: number }
  >;
  private readonly CACHE_TTL: number = 30 * 60 * 1000;

  constructor() {
    this.genbankCache = new GenbankCache();
    this.genBankQueries = new GenBankQueries(import.meta.env.VITE_NCBI_API_KEY);
    this.taxonomyCache = new Map();
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
    mode: "common" | "scientific" | "accession",
    term: AccessionId | ScientificNameSearch | CommonNameSearch,
    page: number
  ): Promise<SuggestionsResponse> {
    try {
      const searchTerm = this.getQueryFromTermType(mode, term);
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
    mode: "common" | "scientific" | "accession",
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
      const isAccession = this.isAccessionFormat(searchTerm);
      if (isAccession) {
        return await this.searchTaxonomyByAccession(searchTerm);
      } else {
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
      }
    } catch (error) {
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
      const taxId = Object.values(response.result)[0]?.taxid || null;
      if (!taxId) {
        return null;
      }
      return taxId;
    } catch (error) {
      console.error("Error in searchTaxonomyByAccession:", error);
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
