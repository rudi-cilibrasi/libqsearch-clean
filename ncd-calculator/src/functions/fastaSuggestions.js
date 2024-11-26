import {sendRequestToProxy} from "./fetchProxy.js";
import {FASTA} from "../components/constants/modalConstants.js";

export class FastaSuggestionHandler {
    // Taxonomic IDs and classifications
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
            id: "7898", // Actinopterygii (ray-finned fishes)
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
    };

    FILTER_PROPERTY_TITLE = "Title";

    constructor(apiKey = null) {
        this.PROXY_URL = 'http://localhost:3001/api/ncbi/forward';
        this.apiKey = apiKey;
    }

    EMPTY_GENBANK_RESULT = {
        accessionId: '',
        title: '',
        isValid: false,
        type: FASTA
    }

    async checkGenbankRecordAndGet(searchTerm) {
        try {
            const requestUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&sort=relevance&term=${searchTerm} AND mitochondrion[title] AND genome[title]&retmax=1&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
            const response = await sendRequestToProxy(requestUri);

            if (response.esearchresult.count === "0") {
                return this.EMPTY_GENBANK_RESULT;
            }

            const id = response.esearchresult.idlist[0];

            const summaryUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=${id}&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
            const summaryResponse = await sendRequestToProxy(summaryUri);

            const result = Object.values(summaryResponse.result)[0];
            if (!result) return this.EMPTY_GENBANK_RESULT;

            return {
                accessionId: result.accessionversion || id,
                title: result.title,
                isValid: true,
                type: FASTA
            };

        } catch (error) {
            console.error('Error checking GenBank record:', error);
            return this.EMPTY_GENBANK_RESULT;
        }
    }

    async getSuggestions(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') return [];
        try {
            let taxId = await this.findTaxonomyId(searchTerm);
            if (!taxId) {
                taxId = await this.findTaxonomyIdFromVariant(searchTerm);
            }
            if (!taxId) return [];
            const taxonomicGroup = await this.detectTaxonomicGroup(taxId);
            const variants = await this.findVariants(taxId, taxonomicGroup);
            if (variants && variants.length !== 0) {
                return variants;
            }
            return [];
        } catch (error) {
            console.error('Error in getSuggestions:', error);
            return [];
        }
    }

    async findTaxonomyId(searchTerm) {
        const taxId = this.getMatchedPredefinedTaxonomy(searchTerm);
        if (taxId) return taxId;
        try {
            const requestUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=taxonomy&term="${searchTerm}"[Organism]&retmax=5&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
            const response = await sendRequestToProxy(requestUri);
            if (response.esearchresult.count !== "0") {
                return response.esearchresult.idlist[0];
            }
            return null;
        } catch (error) {
            console.error('Error finding taxonomy ID:', error);
            return null;
        }
    }


    getMatchedPredefinedTaxonomy(searchTerm) {
        for (const [key, value] of Object.entries(this.TAXONOMIC_GROUPS)) {
            if (searchTerm.toLowerCase().includes(key.toLowerCase())) {
                return value.id;
            }
        }
        return null;
    }


    getMergedTaxonomyGroupProperties() {
        const properties = new Set();
        for (let [key, value] of Object.entries(this.TAXONOMIC_GROUPS)) {
            for (let i = 0; i < value.searchTerms.length; i++) {
                properties.add(value.searchTerms[i]);
            }
        }
        return Array.from(properties);
    }

    getTaxonomyGroupPropertiesSearchCondition(appliedProperty) {
        const mapped = this.getMergedTaxonomyGroupProperties().map(property => property + `[${appliedProperty}]`);
        return mapped.join(" OR ");
    }

    and(exp, prop) {
        return exp + " AND " + prop;
    }

    async findTaxonomyIdFromVariant(searchTerm) {
        const exp = this.getTaxonomyGroupPropertiesSearchCondition(this.FILTER_PROPERTY_TITLE) + ` AND (breed[${this.FILTER_PROPERTY_TITLE}])`;
        const requestUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=${exp} AND (${searchTerm}[${this.FILTER_PROPERTY_TITLE}])&retmax=5&sort=relevance&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
        try {
            const response = await sendRequestToProxy(requestUri);
            if (!response.esearchresult.idlist.length) return null;

            const summaryUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=${response.esearchresult.idlist.join(",")}&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
            const summaryResponse = await sendRequestToProxy(summaryUri);
            return this.getBestTaxIdFromBreedName(Object.values(summaryResponse.result), searchTerm);
        } catch (error) {
            console.error('Error finding taxonomy ID from variant:', error);
            return null;
        }
    }


    getBestTaxIdFromBreedName(summaryResults, breedName) {
        for (let i = 0; i < summaryResults.length; i++) {
            if (!summaryResults[i].subtype || !summaryResults[i].subname) {
                continue;
            }
            const subtype = summaryResults[i].subtype.split("|");
            const subname = summaryResults[i].subname.split("|");
            for (let j = 0; j < subtype.length; j++) {
                if (subtype[j] === 'breed') {
                    const score = this.calculateStringSimilarity(breedName, subname[j]);
                    if (score === 100) {
                        return summaryResults[i].taxid;
                    }
                }
            }
        }
        return null;
    }


    calculateStringSimilarity(strA, strB) {
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

    async detectTaxonomicGroup(taxId) {
        const summaryUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=taxonomy&id=${taxId}&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
        try {
            const response = await sendRequestToProxy(summaryUri);
            const result = Object.values(response.result)[0];
            const division = (result?.division || '').toLowerCase();
            const genbankDivision = (result?.genbankdivision || '').toLowerCase();
            const scientificName = (result?.scientificname || '').toLowerCase();
            if (division.includes('mammals') || genbankDivision.includes('mammals')) {
                return this.TAXONOMIC_GROUPS.MAMMAL;
            }
            if (division.includes('birds') || genbankDivision.includes('birds')) {
                return this.TAXONOMIC_GROUPS.BIRD;
            }
            if (division.includes('bony fishes') ||
                division.includes('fish') ||
                scientificName.includes('actinopterygii')) {
                return this.TAXONOMIC_GROUPS.FISH;
            }
            if (division.includes('reptiles') || genbankDivision.includes('reptiles')) {
                return this.TAXONOMIC_GROUPS.REPTILE;
            }
            if (division.includes('amphibians') || genbankDivision.includes('amphibians')) {
                return this.TAXONOMIC_GROUPS.AMPHIBIAN;
            }
            if (division.includes('insects') ||
                genbankDivision.includes('insects') ||
                scientificName.includes('insecta')) {
                return this.TAXONOMIC_GROUPS.INSECT;
            }
            if (genbankDivision.includes('vertebrates')) {
                return this.TAXONOMIC_GROUPS.VERTEBRATE;
            }
            return this.TAXONOMIC_GROUPS.VERTEBRATE;
        } catch (error) {
            console.error('Error detecting taxonomic group:', error);
            return this.TAXONOMIC_GROUPS.VERTEBRATE;
        }
    }

    async findVariants(taxId, taxonomicGroup) {
        // Build search terms based on taxonomic group
        const taxonomyPropertyExpression = this.getTaxonomyGroupPropertiesSearchCondition(this.FILTER_PROPERTY_TITLE);

        const requestUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=txid${taxId}[Organism] 
            AND (${taxonomyPropertyExpression}) AND (mitochondrion[Title] OR genome[Title] OR complete genome[Title] OR whole genome[Title])
            &retmax=100&retmode=json&sort=relevance${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;

        try {
            const response = await sendRequestToProxy(requestUri);
            if (!response.esearchresult.idlist.length) return [];

            const summaryUri = `${`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=${response.esearchresult.idlist.join(',')}&retmode=json${this.apiKey ? '&api_key=' + this.apiKey : ''}`}`;
            const summaryResponse = await sendRequestToProxy(summaryUri);

            return this.processVariantResults(summaryResponse.result, taxonomicGroup);
        } catch (error) {
            console.error('Error finding variants:', error);
            return [];
        }
    }


    processVariantResults(results, taxonomicGroup) {
        const uniqueVariants = new Map();
        const searchTerms = taxonomicGroup.searchTerms;

        Object.values(results).forEach(result => {
            const title = result.title || '';

            let variantName = null;
            for (const term of searchTerms) {
                const match = title.match(new RegExp(`${term}\\s+([^,\\s](?:[^,]*[^,\\s])?)`, 'i'));
                if (match && match[1]) {
                    variantName = this.cleanVariantName(match[1]);
                    break;
                }
            }

            if (variantName && this.isValidVariantName(variantName)) {
                const variantKey = variantName.toLowerCase();
                if (!uniqueVariants.has(variantKey)) {
                    uniqueVariants.set(variantKey, {
                        id: result.accessionversion || result.uid, // Use accession version if available
                        scientificName: result.organism,
                        primaryCommonName: variantName,
                        additionalCommonNames: [],
                        type: this.getVariantType(title, taxonomicGroup)
                    });
                }
            }
        });

        return Array.from(uniqueVariants.values()).slice(0, 5);
    }


    cleanVariantName(name) {
        // Remove technical terms and format name
        name = name.split(/[,([]/, 1)[0].trim()
            .replace(/\s+(chromosome|unplaced|genomic|sequence|dna|assembly|scaffold|contig|isolate|genome|complete|whole|mitochondrial|mitochondrion|sample).*$/i, '')
            .trim();
        return name.split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    isValidVariantName(name) {
        if (!name || name.length < 3) return false;

        const invalidWords = [
            'chromosome', 'unplaced', 'genomic', 'sequence',
            'dna', 'assembly', 'scaffold', 'contig', 'isolate',
            'genome', 'mitochondrial', 'mitochondrion', 'sample',
            'unknown'
        ];

        const lowerName = name.toLowerCase();
        if (invalidWords.some(word => lowerName.includes(word))) return false;

        return /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(name);
    }

    getVariantType(title, taxonomicGroup) {
        for (const term of taxonomicGroup.searchTerms) {
            if (title.toLowerCase().includes(term.toLowerCase())) {
                return term.charAt(0).toUpperCase() + term.slice(1);
            }
        }
        return 'Variant';
    }

}