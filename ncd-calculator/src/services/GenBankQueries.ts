import { getUri } from "../functions/url.js";
import {
  ANIMAL_GROUPS,
} from "../constants/taxonomy.js";

export class GenBankQueries {
  apiKey: string;
  DEFAULT_PAGE_SIZE: number;
  baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.DEFAULT_PAGE_SIZE = 5;
    this.baseUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`;
  }

  buildVariantFetchUri(
    searchTerm: string,
    taxId: string,
    taxonomicGroup: string[],
    page = 1,
    pageSize = this.DEFAULT_PAGE_SIZE
  ): string {
    const startIndex = (page - 1) * pageSize;

    // Build optimized query using group-specific strategy
    const query = this.buildOptimizedQuery(searchTerm, taxonomicGroup, taxId);

    const params = new URLSearchParams({
      db: "nuccore",
      term: query,
      retstart: startIndex.toString(),
      retmax: pageSize.toString(),
      retmode: "json",
      sort: "relevance",
      usehistory: "y",
    });

    return getUri(this.baseUrl, "esearch.fcgi", params);
  }

  buildAdvancedVariantSearchUri(
    searchTerm: string,
    page = 1,
    pageSize = this.DEFAULT_PAGE_SIZE
  ) {
    const startIndex = (page - 1) * pageSize;

    const searchConditions = [
      // Main search terms
      `"${searchTerm}"[Title] OR "${searchTerm}"[Organism]`,

      // Variant/breed related terms
      "(breed[Title] OR strain[Title] OR variant[Title] OR subspecies[Title] OR population[Title])",

      // Genetic material terms
      "(genome[Title] OR mitochondrion[Title] OR chromosome[Title] OR complete genome[Title])",
    ];

    const params = new URLSearchParams({
      db: "nuccore",
      term: searchConditions.join(" AND "),
      retstart: startIndex.toString(),
      retmax: pageSize.toString(),
      retmode: "json",
      sort: "relevance",
      usehistory: "y",
    });

    return getUri(this.baseUrl, "esearch.fcgi", params);
  }


  buildOptimizedQuery(
    searchTerm: string,
    taxonomicGroup: string[],
    taxId: string
  ): string {
    const animalMatch = Object.entries(ANIMAL_GROUPS).find(([key, value]) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        key === searchLower ||
        value.includes?.some((name) => name.toLowerCase() === searchLower)
      );
    });

    if (animalMatch) {
      const [_, animal] = animalMatch;

      // Get appropriate search terms for this animal
      const searchTerms = animal.searchTerms || taxonomicGroup;

      // Build search terms based on animal type
      const variantTerms = searchTerms
        .map((term) => `"${term}"[Title]`)
        .join(" OR ");

      const sequenceTerms = [
        'mitochondrial genome[Title]',
        'mitochondrion complete genome[Title]',
        'mitochondrial DNA[Title]',
        'mtDNA complete genome[Title]'
      ].join(' OR ');

      // Build query with both terms but connected with OR
      return `txid${taxId}[Organism] AND ((${sequenceTerms}) OR (${variantTerms})) NOT (scaffold[Title] OR "whole genome shotgun"[Title] OR chromosome[Title] OR contig[Title] OR "genomic sequence"[Title] OR "unplaced"[Title])`;
    }

    // Default case for unknown animals
    return `txid${taxId}[Organism] AND ("complete genome"[Title] OR "mitochondrial genome"[Title]) NOT (scaffold[Title] OR "whole genome shotgun"[Title] OR chromosome[Title] OR contig[Title] OR "genomic sequence"[Title] OR "unplaced"[Title])`;
  }

  buildTaxonomySearchUri(
    searchTerm: any,
    page = 1,
    pageSize = this.DEFAULT_PAGE_SIZE
  ) {
    const startIndex = (page - 1) * pageSize;
    const params = new URLSearchParams({
      db: "taxonomy",
      term: `${searchTerm}`,
      retstart: startIndex.toString(),
      retmax: pageSize.toString(),
      retmode: "json",
      usehistory: "y",
    });
    return getUri(this.baseUrl, "esearch.fcgi", params);
  }

  buildTaxonomicSummaryUri(taxIds: string | any[]) {
    const params = new URLSearchParams({
      db: "taxonomy",
      id: Array.isArray(taxIds) ? taxIds.join(",") : taxIds,
      retmode: "json",
    }).toString();
    return getUri(this.baseUrl, "esummary.fcgi", params);
  }

  buildGenbankRecordCheckUri(searchTerm: string) {
    const params = new URLSearchParams({
      db: "nuccore",
      sort: "relevance",
      term: `${searchTerm} AND mitochondrion[title] AND genome[title]`,
      retmax: "1",
      retmode: "json",
    });
    return getUri(this.baseUrl, "esearch.fcgi", params);
  }


  buildSequenceSummaryUri(ids: string | string[]) {
    const params = new URLSearchParams({
      db: "nuccore",
      id: Array.isArray(ids) ? ids.join(",") : ids,
      retmode: "json",
    }).toString();
    return getUri(this.baseUrl, "esummary.fcgi", params);
  }
}
