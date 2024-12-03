import {sendRequestToProxy} from "../functions/fetchProxy.js";
import {getUri} from "../functions/url.js";
import {animalGroups, TAXONOMIC_SEARCH_STRATEGIES} from "../constants/taxonomy.js";

export class GenBankQueries {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.DEFAULT_PAGE_SIZE = 5;
        this.baseUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`;
    }


    buildVariantFetchUri(searchTerm, taxId, taxonomicGroup, page = 1, pageSize = this.DEFAULT_PAGE_SIZE) {
        const startIndex = (page - 1) * pageSize;

        // Build optimized query using group-specific strategy
        const query = this.buildOptimizedQuery(searchTerm, taxonomicGroup, taxId);

        const params = new URLSearchParams({
            db: 'nuccore',
            term: query,
            retstart: startIndex.toString(),
            retmax: pageSize.toString(),
            retmode: 'json',
            sort: 'relevance',
            usehistory: 'y'
        });

        return getUri(this.baseUrl, "esearch.fcgi", params);
    }


    buildAdvancedVariantSearchUri(searchTerm, page = 1, pageSize = this.DEFAULT_PAGE_SIZE) {
        const startIndex = (page - 1) * pageSize;

        const searchConditions = [
            // Main search terms
            `"${searchTerm}"[Title] OR "${searchTerm}"[Organism]`,

            // Variant/breed related terms
            '(breed[Title] OR strain[Title] OR variant[Title] OR subspecies[Title] OR population[Title])',

            // Genetic material terms
            '(genome[Title] OR mitochondrion[Title] OR chromosome[Title] OR complete genome[Title])'
        ];

        const params = new URLSearchParams({
            db: 'nuccore',
            term: searchConditions.join(' AND '),
            retstart: startIndex.toString(),
            retmax: pageSize.toString(),
            retmode: 'json',
            sort: 'relevance',
            usehistory: 'y',
        });

        return getUri(this.baseUrl, "esearch.fcgi", params);
    }

    determineGroupType(taxId) {
        // Map taxIds to their groups
        const taxIdMap = {
            '40674': 'MAMMAL',  // Mammals
            '8782': 'BIRD',     // Birds
            '7898': 'FISH',     // Fish
            '8504': 'REPTILE',  // Reptiles
            '8292': 'AMPHIBIAN', // Amphibians
            '50557': 'INSECT',   // Insects
            '7742': 'VERTEBRATE' // Vertebrates
        };

        return taxIdMap[taxId] || 'VERTEBRATE'; // Default to VERTEBRATE if unknown
    }

    // buildOptimizedQuery(taxId, strategy) {
    //     // Primary search terms (most important)
    //     const primaryTerms = strategy.primary
    //         .map(term => `"${term}"[Title]`)
    //         .join(" OR ");
    //
    //     // Sequence terms
    //     const sequenceTerms = strategy.sequences
    //         .map(term => `"${term}"[Title]`)
    //         .join(" OR ");
    //
    //     // Exclude terms
    //     const excludeClause = strategy.excludeTerms
    //         .map(term => `NOT "${term}"[Title]`)
    //         .join(" ");
    //
    //     // Build complete query
    //     return `txid${taxId}[Organism] AND (${primaryTerms}) AND (${sequenceTerms}) ${excludeClause}`;
    // }


    buildOptimizedQuery(searchTerm, taxonomicGroup, taxId) {
        const animalMatch = Object.entries(animalGroups)
            .find(([key, value]) => {
                const searchLower = searchTerm.toLowerCase();
                return key === searchLower ||
                    value.includes?.some(name => name.toLowerCase() === searchLower);
            });

        if (animalMatch) {
            const [_, animal] = animalMatch;

            // Get appropriate search terms for this animal
            const searchTerms = animal.searchTerms || taxonomicGroup;

            // Build search terms based on animal type
            const variantTerms = searchTerms
                .map(term => `"${term}"[Title]`)
                .join(" OR ");

            // Core sequence terms that work for all animals
            const sequenceTerms = [
                "complete genome",
                "mitochondrial genome",
                "whole genome",
                "mitochondrion"
            ].map(term => `"${term}"[Title]`).join(" OR ");

            // Build query with both terms but connected with OR
            return `txid${taxId}[Organism] AND ((${sequenceTerms}) OR (${variantTerms})) NOT patent[Title]`;
        }

        // Default case for unknown animals
        return `txid${taxId}[Organism] AND ("complete genome"[Title] OR "mitochondrial genome"[Title]) NOT patent[Title]`;
    }



    buildTaxonomySearchUri(searchTerm, page = 1, pageSize = this.DEFAULT_PAGE_SIZE) {
        const startIndex = (page - 1) * pageSize;
        const params = new URLSearchParams({
            db: 'taxonomy',
            term: `${searchTerm}`,
            retstart: startIndex.toString(),
            retmax: pageSize.toString(),
            retmode: 'json',
            usehistory: 'y',
        });
        return getUri(this.baseUrl, "esearch.fcgi", params);
    }
    buildTaxonomicSummaryUri(taxIds) {
        const params = new URLSearchParams({
            db: 'taxonomy',
            id: Array.isArray(taxIds) ? taxIds.join(',') : taxIds,
            retmode: 'json',
        }).toString();
        return getUri(this.baseUrl, "esummary.fcgi", params);

    }


    buildGenbankRecordCheckUri(searchTerm) {
        const params = new URLSearchParams({
            db: 'nuccore',
            sort: 'relevance',
            term: `${searchTerm} AND mitochondrion[title] AND genome[title]`,
            retmax: '1',
            retmode: 'json'
        });
        return getUri(this.baseUrl, "esearch.fcgi", params);
    }




    buildWebEnvFetchUri(webEnv, queryKey, page = 1, pageSize = this.DEFAULT_PAGE_SIZE) {
        const startIndex = (page - 1) * pageSize;

        const params = new URLSearchParams({
            db: 'nuccore',  // or 'taxonomy' depending on context
            query_key: queryKey,
            WebEnv: webEnv,
            retstart: startIndex.toString(),
            retmax: pageSize.toString(),
            retmode: 'json',
        });
        return getUri(this.baseUrl, "esearch.fcgi", params);
    }

    buildSequenceSummaryUri(ids) {
        const params = new URLSearchParams({
            db: 'nuccore',
            id: Array.isArray(ids) ? ids.join(',') : ids,
            retmode: 'json',
        }).toString();
        return getUri(this.baseUrl, "esummary.fcgi", params);
    }

    // Helper method for handling large result sets using WebEnv
    async fetchWithHistory(initialUri) {
        const response = await sendRequestToProxy({externalUrl: initialUri});

        if (response.esearchresult?.webenv && response.esearchresult?.querykey) {
            return {
                webEnv: response.esearchresult.webenv,
                queryKey: response.esearchresult.querykey,
                count: parseInt(response.esearchresult.count, 10),
                idlist: response.esearchresult.idlist || []
            };
        }

        return {
            count: parseInt(response.esearchresult?.count || '0', 10),
            idlist: response.esearchresult?.idlist || []
        };
    }
}