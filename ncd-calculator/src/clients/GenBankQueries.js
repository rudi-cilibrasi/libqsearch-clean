import {sendRequestToProxy} from "../functions/fetchProxy.js";
import {getUri} from "../functions/url.js";
import * as url from "node:url";

export class GenBankQueries {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.DEFAULT_PAGE_SIZE = 5;
        this.baseUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils`;
    }

    TAXONOMIC_GROUPS = {
        MAMMAL: {
            id: "40674",
            searchTerms: ["breed", "strain", "subspecies"]
        },
        BIRD: {
            id: "8782",
            searchTerms: ["breed", "strain", "subspecies"]
        },
        FISH: {
            id: "7898",
            searchTerms: ["strain", "variety", "population"]
        },
        REPTILE: {
            id: "8504",
            searchTerms: ["strain", "subspecies", "population"]
        },
        AMPHIBIAN: {
            id: "8292",
            searchTerms: ["strain", "population", "subspecies"]
        },
        INSECT: {
            id: "50557",
            searchTerms: ["strain", "variety", "ecotype"]
        },
        VERTEBRATE: {
            id: "7742",
            searchTerms: ["breed", "strain", "subspecies"]
        }
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

    buildVariantSearchUri(searchTerm, page = 1, pageSize = this.DEFAULT_PAGE_SIZE) {
        const startIndex = (page - 1) * pageSize;
        const params = new URLSearchParams({
            db: 'nuccore',
            term: `${searchTerm}[Title] AND (breed[Title])`,
            retstart: startIndex.toString(),
            retmax: pageSize.toString(),
            retmode: 'json',
            sort: 'relevance',
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


    getTaxonomyGroupPropertiesSearchCondition(propertyVals, appliedProperty) {
        const mapped = propertyVals.map(property => property + `[${appliedProperty}]`);
        return mapped.join(" OR ");
    }

    buildVariantFetchUri(taxId, taxonomicGroup, page = 1, pageSize = this.DEFAULT_PAGE_SIZE) {
        const startIndex = (page - 1) * pageSize;
        const taxonomyPropertyExpression = this.getTaxonomyGroupPropertiesSearchCondition(taxonomicGroup, "Title");

        const params = new URLSearchParams({
            db: 'nuccore',
            term: `txid${taxId}[Organism] AND (${taxonomyPropertyExpression}) AND (mitochondrion[Title] OR genome[Title])`,
            retstart: startIndex.toString(),
            retmax: pageSize.toString(),
            retmode: 'json',
            sort: 'relevance',
            usehistory: 'y',
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