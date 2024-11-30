import {CacheInterface} from "../cache/CacheInterface.js";
import {MemoryCache} from "../cache/MemoryCache.js";
import {LocalStorageCache} from "../cache/LocalStorageCache.js";
import {RedisStorageCache} from "../cache/RedisStorageCache.js";
import {GenBankQueries} from "./GenBankQueries.js";
import {sendRequestToProxy} from "../functions/fetchProxy.js";
import {LocalStorageKeys} from "../cache/LocalStorageKeyManager.js";

export class GenBankSearchService {
    TAXONOMIC_MAPPING = {
        // MAMMALS (40674)
        // Domestic/Pets
        "felis catus": {id: "9685", group: "MAMMAL", commonNames: ["cat", "kitten", "kitty", "domestic cat"]},
        "canis lupus familiaris": {id: "9615", group: "MAMMAL", commonNames: ["dog", "puppy", "domestic dog"]},
        "equus caballus": {id: "9796", group: "MAMMAL", commonNames: ["horse", "pony", "mare", "stallion"]},
        "bos taurus": {id: "9913", group: "MAMMAL", commonNames: ["cow", "cattle", "bull", "calf"]},
        "sus scrofa domesticus": {id: "9825", group: "MAMMAL", commonNames: ["pig", "swine", "hog", "domestic pig"]},
        "ovis aries": {id: "9940", group: "MAMMAL", commonNames: ["sheep", "lamb", "ram", "ewe"]},
        "capra hircus": {id: "9925", group: "MAMMAL", commonNames: ["goat", "domestic goat", "kid"]},
        "oryctolagus cuniculus": {id: "9986", group: "MAMMAL", commonNames: ["rabbit", "bunny", "domestic rabbit"]},

        // Lab Animals
        "mus musculus": {id: "10090", group: "MAMMAL", commonNames: ["mouse", "lab mouse", "house mouse"]},
        "rattus norvegicus": {id: "10116", group: "MAMMAL", commonNames: ["rat", "lab rat", "brown rat"]},

        // Primates
        "pan troglodytes": {id: "9598", group: "MAMMAL", commonNames: ["chimpanzee", "chimp"]},
        "gorilla gorilla": {id: "9593", group: "MAMMAL", commonNames: ["gorilla", "western gorilla"]},
        "pongo abelii": {id: "9601", group: "MAMMAL", commonNames: ["orangutan", "sumatran orangutan"]},

        // Marine Mammals
        "tursiops truncatus": {id: "9739", group: "MAMMAL", commonNames: ["dolphin", "bottlenose dolphin"]},
        "orcinus orca": {id: "9733", group: "MAMMAL", commonNames: ["orca", "killer whale"]},

        // FISH (7898)
        // Commercial Food Fish
        "salmo salar": {id: "8030", group: "FISH", commonNames: ["salmon", "atlantic salmon"]},
        "thunnus thynnus": {id: "8237", group: "FISH", commonNames: ["tuna", "bluefin tuna"]},
        "gadus morhua": {id: "8049", group: "FISH", commonNames: ["cod", "atlantic cod"]},
        "oncorhynchus mykiss": {id: "8022", group: "FISH", commonNames: ["rainbow trout", "trout", "steelhead"]},
        "cyprinus carpio": {id: "7962", group: "FISH", commonNames: ["carp", "common carp"]},
        "oreochromis niloticus": {id: "8128", group: "FISH", commonNames: ["tilapia", "nile tilapia"]},

        // Aquarium Fish
        "danio rerio": {id: "7955", group: "FISH", commonNames: ["zebrafish", "zebra danio"]},
        "carassius auratus": {id: "7957", group: "FISH", commonNames: ["goldfish"]},
        "poecilia reticulata": {id: "8081", group: "FISH", commonNames: ["guppy", "fancy guppy"]},

        // BIRDS (8782)
        "gallus gallus": {id: "9031", group: "BIRD", commonNames: ["chicken", "rooster", "hen"]},
        "meleagris gallopavo": {id: "9103", group: "BIRD", commonNames: ["turkey", "wild turkey"]},
        "anas platyrhynchos": {id: "8839", group: "BIRD", commonNames: ["duck", "mallard", "mallard duck"]},
        "columba livia": {id: "8932", group: "BIRD", commonNames: ["pigeon", "dove", "rock dove"]},

        // Group level mappings for general searches
        "MAMMAL": {
            id: "40674",
            searchTerms: ["breed", "strain", "subspecies"],
            generalCommonNames: [
                "mammal", "wolf", "bear", "lion", "tiger", "elephant", "giraffe",
                "rhinoceros", "hippopotamus", "kangaroo", "koala", "sloth", "bat"
            ]
        },
        "FISH": {
            id: "7898",
            searchTerms: ["strain", "variety", "population"],
            generalCommonNames: [
                "fish", "bass", "barracuda", "swordfish", "catfish", "perch",
                "mackerel", "halibut", "herring", "anchovy", "flounder"
            ]
        },
        "BIRD": {
            id: "8782",
            searchTerms: ["breed", "strain", "subspecies"],
            generalCommonNames: [
                "bird", "eagle", "hawk", "owl", "parrot", "penguin", "flamingo",
                "sparrow", "crow", "raven", "woodpecker", "hummingbird"
            ]
        },
        "REPTILE": {
            id: "8504",
            searchTerms: ["strain", "subspecies", "population"],
            generalCommonNames: [
                "reptile", "snake", "lizard", "turtle", "tortoise", "crocodile",
                "alligator", "gecko", "iguana", "cobra", "python"
            ]
        },
        "AMPHIBIAN": {
            id: "8292",
            searchTerms: ["strain", "population", "subspecies"],
            generalCommonNames: [
                "amphibian", "frog", "toad", "salamander", "newt", "axolotl"
            ]
        },
        "INSECT": {
            id: "50557",
            searchTerms: ["strain", "variety", "ecotype"],
            generalCommonNames: [
                "insect", "bug", "ant", "bee", "wasp", "butterfly", "moth",
                "beetle", "grasshopper", "cricket", "fly", "mosquito", "dragonfly"
            ]
        }
    };



    TAXONOMIC_BASE_GROUPS = {
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
    };


    animalGroups = {
        // Canids
        'fox': {
            genus: 'Vulpes',
            family: 'Canidae',
            taxId: '9627',
            group: 'MAMMAL',
            includes: ['red fox', 'arctic fox', 'fennec fox']
        },
        'wolf': {
            genus: 'Canis',
            family: 'Canidae',
            taxId: '9612',
            group: 'MAMMAL',
            includes: ['gray wolf', 'timber wolf']
        },
        'coyote': {
            genus: 'Canis',
            family: 'Canidae',
            taxId: '9614',
            group: 'MAMMAL'
        },

        // Felids
        'lion': {
            genus: 'Panthera',
            family: 'Felidae',
            taxId: '9689',
            group: 'MAMMAL'
        },
        'tiger': {
            genus: 'Panthera',
            family: 'Felidae',
            taxId: '9694',
            group: 'MAMMAL',
            includes: ['bengal tiger', 'siberian tiger']
        },
        'leopard': {
            genus: 'Panthera',
            family: 'Felidae',
            taxId: '9691',
            group: 'MAMMAL'
        },

        // Reptiles
        'crocodile': {
            genus: 'Crocodylus',
            family: 'Crocodylidae',
            taxId: '8496',
            group: 'REPTILE',
            includes: ['nile crocodile', 'saltwater crocodile']
        },
        'alligator': {
            genus: 'Alligator',
            family: 'Alligatoridae',
            taxId: '8496',
            group: 'REPTILE',
            includes: ['american alligator', 'chinese alligator']
        },
        'python': {
            genus: 'Python',
            family: 'Pythonidae',
            taxId: '8777',
            group: 'REPTILE'
        },

        // Marine Mammals
        'dolphin': {
            genus: 'Tursiops',
            family: 'Delphinidae',
            taxId: '9739',
            group: 'MAMMAL',
            includes: ['bottlenose dolphin']
        },
        'whale': {
            genus: 'Balaenoptera',
            family: 'Balaenopteridae',
            taxId: '9771',
            group: 'MAMMAL',
            includes: ['blue whale', 'humpback whale']
        },

        // Bears
        'bear': {
            genus: 'Ursus',
            family: 'Ursidae',
            taxId: '9632',
            group: 'MAMMAL',
            includes: ['brown bear', 'black bear', 'polar bear']
        },

        // Primates
        'gorilla': {
            genus: 'Gorilla',
            family: 'Hominidae',
            taxId: '9593',
            group: 'MAMMAL'
        },
        'chimpanzee': {
            genus: 'Pan',
            family: 'Hominidae',
            taxId: '9598',
            group: 'MAMMAL'
        },
        'orangutan': {
            genus: 'Pongo',
            family: 'Hominidae',
            taxId: '9600',
            group: 'MAMMAL'
        }
    };

    // Broader pattern matching for animal groups
    groupPatterns = [
        // Mammals - Carnivores
        {
            pattern: /(fox|vixen|kit|fennec)/i,
            group: 'MAMMAL',
            family: 'Canidae',
            taxId: '9627'
        },
        {
            pattern: /(wolf|wolves|canis|coyote|jackal)/i,
            group: 'MAMMAL',
            family: 'Canidae',
            taxId: '9612'
        },
        {
            pattern: /(lion|tiger|leopard|jaguar|panther|puma|cougar|cheetah)/i,
            group: 'MAMMAL',
            family: 'Felidae',
            taxId: '9689'
        },
        {
            pattern: /(bear|ursus|grizzly|polar bear|panda)/i,
            group: 'MAMMAL',
            family: 'Ursidae',
            taxId: '9632'
        },

        // Mammals - Marine
        {
            pattern: /(dolphin|porpoise|orca|killer whale)/i,
            group: 'MAMMAL',
            family: 'Delphinidae',
            taxId: '9739'
        },
        {
            pattern: /(whale|cetacean|baleen)/i,
            group: 'MAMMAL',
            family: 'Cetacea',
            taxId: '9721'
        },
        {
            pattern: /(seal|sea lion|walrus|pinniped)/i,
            group: 'MAMMAL',
            family: 'Pinnipedia',
            taxId: '9700'
        },

        // Mammals - Primates
        {
            pattern: /(ape|gorilla|chimpanzee|orangutan|bonobo)/i,
            group: 'MAMMAL',
            family: 'Hominidae',
            taxId: '9604'
        },
        {
            pattern: /(monkey|macaque|baboon|mandrill|lemur)/i,
            group: 'MAMMAL',
            family: 'Primates',
            taxId: '9443'
        },

        // Reptiles
        {
            pattern: /(crocodile|alligator|caiman|gavial)/i,
            group: 'REPTILE',
            family: 'Crocodylidae',
            taxId: '8496'
        },
        {
            pattern: /(snake|python|cobra|viper|boa|rattlesnake|serpent)/i,
            group: 'REPTILE',
            family: 'Serpentes',
            taxId: '8570'
        },
        {
            pattern: /(lizard|gecko|iguana|monitor|chameleon|skink)/i,
            group: 'REPTILE',
            family: 'Squamata',
            taxId: '8509'
        },
        {
            pattern: /(turtle|tortoise|terrapin)/i,
            group: 'REPTILE',
            family: 'Testudines',
            taxId: '8459'
        },

        // Fish
        {
            pattern: /(shark|ray|skate|dogfish)/i,
            group: 'FISH',
            family: 'Chondrichthyes',
            taxId: '7777'
        },
        {
            pattern: /(fish|bass|trout|salmon|tuna|cod|perch|carp)/i,
            group: 'FISH',
            family: 'Actinopterygii',
            taxId: '7898'
        },

        // Birds
        {
            pattern: /(eagle|hawk|falcon|kite|osprey|vulture)/i,
            group: 'BIRD',
            family: 'Accipitridae',
            taxId: '8892'
        },
        {
            pattern: /(owl|barn owl|eagle owl|horned owl)/i,
            group: 'BIRD',
            family: 'Strigiformes',
            taxId: '8896'
        },
        {
            pattern: /(parrot|macaw|cockatoo|parakeet|budgie)/i,
            group: 'BIRD',
            family: 'Psittaciformes',
            taxId: '8932'
        },

        // Amphibians
        {
            pattern: /(frog|toad|treefrog|bullfrog)/i,
            group: 'AMPHIBIAN',
            family: 'Anura',
            taxId: '8342'
        },
        {
            pattern: /(salamander|newt|axolotl)/i,
            group: 'AMPHIBIAN',
            family: 'Caudata',
            taxId: '8292'
        }
    ];


    constructor() {
        this.EMPTY_GENBANK_RESULT = {
            accessionId: null,
            title: null,
            isValid: false,
            type: 'FASTA'
        };

        this.memoryCache = new CacheInterface(
            new MemoryCache(),
            { ttl: 30 * 60 * 1000 }
        );

        this.localStorageCache = new CacheInterface(
            new LocalStorageCache(),
            { ttl: 24 * 60 * 60 * 1000 }
        );

        this.redisCache = new CacheInterface(
            new RedisStorageCache(import.meta.env.VITE_REDIS_ENDPOINT),
            { ttl: 7 * 24 * 60 * 60 * 1000 }
        );
        this.genBankQueries = new GenBankQueries(import.meta.env.VITE_NCBI_API_KEY);
        this.taxonomyCache = new Map();
        this.CACHE_TTL = 30 * 60 * 1000;
    }


    async getSuggestions(searchTerm, page = 1) {
        if (!searchTerm?.trim()) return [];
        try {
            const cachedData = await this.getFromCacheHierarchy(searchTerm, page);
            if (!cachedData || !cachedData.isComplete) {
                Promise.resolve().then(() => {
                    this.triggerBackgroundTasks(searchTerm, page);
                });
            }
            if (cachedData) {
                return cachedData;
            }
            // if no cache hit, fetch initial data
            return await this.fetchData(searchTerm, page);
        } catch (error) {
            console.error('Error in getSuggestions:', error);
            return { suggestions: [], metadata: { error: error.message } };
        }
    }

    async getFromCacheHierarchy(searchTerm, page) {
        // Check memory cache
        const memCache = await this.memoryCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (memCache && this.hasPageData(memCache, page)) {
            const result = this.paginateResults(memCache, page);
            if (result.suggestions.length > 0) {
                return result;
            }
        }

        // Check localStorage
        const localCache = await this.localStorageCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (localCache && this.hasPageData(localCache, page)) {
            await this.memoryCache.setCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm, localCache);
            const result = this.paginateResults(localCache, page);
            if (result.suggestions.length > 0) {
                return result;
            }
        }

        // Check Redis
        const redisCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (redisCache && this.hasPageData(redisCache, page)) {
            await this.distributeToCaches(searchTerm, redisCache);
            const result = this.paginateResults(redisCache, page);
            if (result.suggestions.length > 0) {
                return result;
            }
        }
        return null;
    }

    // this could fetch more suggestions from genbank, update the cache and populate all cache layers again
    async triggerBackgroundTasks(searchTerm, page) {
        Promise.all([
            this.updateAccessMetrics(searchTerm),
            this.checkAndFetchNewData(searchTerm, page)
        ]).catch(error => {
            console.error('Background task error:', error);
        });
    }

    async updateAccessMetrics(searchTerm) {
        const redisCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (!redisCache) return;

        const updatedCache = {
            ...redisCache,
            metadata: {
                ...redisCache.metadata,
                accessCount: (redisCache.metadata?.accessCount || 0) + 1,
                lastAccessed: Date.now()
            }
        };

        await this.redisCache.setCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm, updatedCache);
    }

    async checkAndFetchNewData(searchTerm, currentPage) {
        const shouldFetch = await this.shouldFetchMoreData(searchTerm);
        if (!shouldFetch) return;
        const redisCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (!redisCache) return;
        const nextPage = (redisCache.globalLastPage || 0) + 1;
        try {
            const variantResponse = await this.getVariantsResponse(
                redisCache.taxId,
                redisCache.taxonomicGroup,
                nextPage
            );

            const newSuggestions = this.processVariantResults(
                Object.values(variantResponse.result),
                redisCache.taxonomicGroup
            );

            const newCacheData = new GenBankCacheEntry({
                suggestions: newSuggestions,
                isComplete: (parseInt(variantResponse.retstart) + newSuggestions.length) >= parseInt(variantResponse.count),
                lastPage: variantResponse.nextPage,
                globalLastPage: nextPage,
                pageSize: this.genBankQueries.DEFAULT_PAGE_SIZE,
                totalResults: parseInt(variantResponse.count),
                taxonomicGroup: redisCache.taxonomicGroup,
                taxId: redisCache.taxId,
                metadata: {
                    lastFetched: Date.now(),
                    lastFetchedPage: nextPage
                }
            });

            const mergedSuggestions = this.mergeSuggestions(
                redisCache.suggestions,
                newCacheData.suggestions
            );
            const mergedData = new GenBankCacheEntry({
                suggestions: mergedSuggestions,
                isComplete: redisCache.isComplete || newCacheData.isComplete,
                lastPage: Math.max(redisCache.lastPage, newCacheData.lastPage),
                globalLastPage: Math.max(redisCache.globalLastPage, newCacheData.globalLastPage),
                pageSize: newCacheData.pageSize,
                totalResults: Math.max(redisCache.totalResults, newCacheData.totalResults),
                taxonomicGroup: newCacheData.taxonomicGroup,
                taxId: newCacheData.taxId,
                metadata: {
                    lastFetched: Date.now(),
                    lastFetchedPage: nextPage,
                    ...redisCache.metadata
                }
            });
            await this.distributeToCaches(searchTerm, mergedData);

        } catch (error) {
            console.error('Error fetching new data:', error);
        }
    }


    mergeSuggestions(existingSuggestions, newSuggestions) {
        const seenIds = new Set(existingSuggestions.map(s => s.id));
        const uniqueNewSuggestions = newSuggestions.filter(s => !seenIds.has(s.id));
        return [...existingSuggestions, ...uniqueNewSuggestions];
    }

    async fetchData(searchTerm, page) {
        try {
            const data = await this.fetchAndMergeSuggestions(searchTerm, page);
            if (data) {
                await this.distributeToCaches(searchTerm, data);
                return this.paginateResults(data, page);
            }
            return { suggestions: [], metadata: { error: 'No data found' } };
        } catch (error) {
            console.error('Error fetching data:', error);
            return { suggestions: [], metadata: { error: error.message } };
        }
    }

    async fetchAndMergeSuggestions(searchTerm, page) {
        const existingCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        const variantResponse = await this.getVariantsResponseFromSearchTerm(searchTerm, page);
        const newSuggestions = this.processVariantResults(Object.values(variantResponse.result), variantResponse.taxonomicGroup);

        const mergedSuggestions = existingCache ?
            this.mergeSuggestions(existingCache.suggestions, newSuggestions) :
            newSuggestions;

        return new GenBankCacheEntry({
            suggestions: mergedSuggestions,
            isComplete: (parseInt(variantResponse.retstart) + newSuggestions.length) >= parseInt(variantResponse.count),
            lastPage: Math.max(existingCache?.lastPage || 0, variantResponse.nextPage),
            globalLastPage: Math.max(existingCache?.globalLastPage || 0, page),
            pageSize: this.genBankQueries.DEFAULT_PAGE_SIZE,
            totalResults: parseInt(variantResponse.count),
            taxonomicGroup: variantResponse.taxonomicGroup,
            taxId: variantResponse.taxId,
            metadata: {
                lastFetched: Date.now(),
                lastFetchedPage: page,
                ...existingCache?.metadata
            }
        });
    }

    async distributeToCaches(searchTerm, mergedData) {
        await Promise.all([
            this.memoryCache.setCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm, mergedData),
            this.localStorageCache.setCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm, mergedData),
            this.redisCache.setCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm, mergedData)
        ]);
    }

    paginateResults(cacheEntry, page) {
        const { pageSize = this.genBankQueries.DEFAULT_PAGE_SIZE } = cacheEntry;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;

        return {
            suggestions: cacheEntry.suggestions.slice(start, end),
            metadata: {
                currentPage: page,
                totalPages: Math.ceil(cacheEntry.suggestions.length / pageSize),
                hasMore: !cacheEntry.isComplete || end < cacheEntry.suggestions.length,
                totalSuggestions: cacheEntry.suggestions.length,
                lastPage: cacheEntry.lastPage,
                globalLastPage: cacheEntry.globalLastPage,
                isComplete: cacheEntry.isComplete,
                isPartialPage: cacheEntry.suggestions.slice(start, end).length < pageSize,
                taxonomicGroup: cacheEntry.taxonomicGroup,
                taxId: cacheEntry.taxId,
                lastFetched: cacheEntry.metadata.lastFetched,
                lastFetchedPage: cacheEntry.metadata.lastFetchedPage
            }
        };
    }

    async shouldFetchMoreData(searchTerm) {
        const redisCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (!redisCache || redisCache.isComplete) return false;
        const accessCount = redisCache.metadata?.accessCount || 0;
        const lastFetched = redisCache.metadata?.lastFetched || 0;
        const hoursSinceLastFetch = (Date.now() - lastFetched) / (1000 * 60 * 60);
        // Fetch if:
        // 1. High frequency term (accessed more than threshold)
        // 2. Not fetched recently (to avoid hammering the API)
        // 3. Has more pages to fetch
        return accessCount >= 3 &&
            hoursSinceLastFetch >= 1 &&
            redisCache.globalLastPage < 5;
    }




    async getVariantsResponseFromSearchTerm(searchTerm, page) {
        try {
            const localCache = await this.localStorageCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
            const nextPage = localCache ? localCache.globalLastPage + 1 : 1;

            // Step 1: Try direct taxonomy lookup
            let taxonomicInfo = await this.getTaxonomicGroupInfo(searchTerm, page);

            // Step 2: If no direct match, try enhanced search
            if (!taxonomicInfo.taxId) {
                // Try specific animal match
                const animalMatch = this.animalGroups[searchTerm.toLowerCase()];
                if (animalMatch) {
                    taxonomicInfo = {
                        taxId: animalMatch.taxId,
                        taxonomicGroup: this.TAXONOMIC_MAPPING[animalMatch.group].searchTerms,
                        group: animalMatch.group,
                        scientificName: animalMatch.genus,
                        searchContext: 'specific'
                    };
                } else {
                    // Try pattern matching
                    for (const pattern of this.groupPatterns) {
                        if (pattern.pattern.test(searchTerm)) {
                            taxonomicInfo = {
                                taxId: pattern.taxId,
                                taxonomicGroup: this.TAXONOMIC_MAPPING[pattern.group].searchTerms,
                                group: pattern.group,
                                scientificName: pattern.family,
                                searchContext: 'pattern'
                            };
                            break;
                        }
                    }
                }
            }

            // Step 3: Get variants using the best available taxonomy info
            const variantResponse = await this.getVariantsResponse(
                taxonomicInfo.taxId,
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
                ...variantResponse
            };

        } catch (error) {
            console.error('Error in getVariantsResponseFromSearchTerm:', error);
            return {
                page,
                taxId: null,
                taxonomicGroup: this.TAXONOMIC_MAPPING.VERTEBRATE.searchTerms,
                group: 'VERTEBRATE',
                result: [],
                count: 0,
                retmax: 0,
                retstart: 0,
                isComplete: true,
                error: error.message
            };
        }
    }

    async getVariantsResponse(taxId, taxonomicGroup, nextPage) {
        // If no valid taxonomy info, return empty response
        if (!taxId || !taxonomicGroup) {
            return {
                result: [],
                count: 0,
                retmax: 0,
                retstart: 0,
                isComplete: true
            };
        }

        try {
            const taxonomyUri = this.genBankQueries.buildVariantFetchUri(taxId, taxonomicGroup, nextPage);
            const response = await sendRequestToProxy({
                externalUrl: taxonomyUri
            });

            if (!response.esearchresult?.idlist?.length) {
                return {
                    result: [],
                    count: parseInt(response.esearchresult?.count || '0'),
                    retmax: parseInt(response.esearchresult?.retmax || '0'),
                    retstart: parseInt(response.esearchresult?.retstart || '0'),
                    isComplete: true
                };
            }

            const summaryUri = this.genBankQueries.buildSequenceSummaryUri(response.esearchresult.idlist);
            const summaryResponse = await sendRequestToProxy({externalUrl: summaryUri});

            return {
                ...summaryResponse,
                count: parseInt(response.esearchresult.count),
                retmax: parseInt(response.esearchresult.retmax),
                retstart: parseInt(response.esearchresult.retstart),
                isComplete: (parseInt(response.esearchresult.retstart) + response.esearchresult.idlist.length) >= parseInt(response.esearchresult.count),
                queryTranslation: response.esearchresult.querytranslation
            };

        } catch (error) {
            console.error('Error in getVariantsResponse:', error);
            return {
                result: [],
                count: 0,
                retmax: 0,
                retstart: 0,
                isComplete: true,
                error: error.message
            };
        }
    }

    async getTaxonomicGroupInfo(searchTerm, page) {
        try {
            searchTerm = searchTerm.toLowerCase().trim();

            // 1. Check memory cache
            const cached = this.getCachedResult(searchTerm);

            if (cached) return cached;

            // 2. Check exact matches in TAXONOMIC_MAPPING
            const exactMatch = this.findExactMatch(searchTerm);
            if (exactMatch) return this.cacheAndReturn(searchTerm, exactMatch);

            // 3. Check common names
            const commonNameMatch = this.findCommonNameMatch(searchTerm);
            if (commonNameMatch) return this.cacheAndReturn(searchTerm, commonNameMatch);

            // 4. Check general group names
            const groupMatch = this.findGroupMatch(searchTerm);
            if (groupMatch) return this.cacheAndReturn(searchTerm, groupMatch);

            // 5. Try taxonomy APIs if no matches found
            const [directTaxId, variantTaxId] = await Promise.all([
                this.findTaxonomyId(searchTerm),
                this.findTaxonomyIdFromVariant(searchTerm)
            ]);

            const taxId = directTaxId || variantTaxId;
            if (taxId) {
                const taxonomyMatch = this.findTaxonomyMatch(taxId);
                if (taxonomyMatch) return this.cacheAndReturn(searchTerm, taxonomyMatch);
            }

            // 6. Fallback to VERTEBRATE group if no match found
            return this.createEmptyResult(page);

        } catch (error) {
            console.error(`Taxonomy detection error for: ${searchTerm}`, error);
            return this.createEmptyResult(page);
        }
    }

    findExactMatch(searchTerm) {
        const exactMatch = Object.entries(this.TAXONOMIC_MAPPING)
            .find(([scientific, _]) => scientific.toLowerCase() === searchTerm);

        if (exactMatch) {
            const [scientific, data] = exactMatch;
            return {
                taxId: data.id,
                taxonomicGroup: this.TAXONOMIC_MAPPING[data.group].searchTerms,
                scientificName: scientific,
                group: data.group,
                isExactMatch: true
            };
        }
        return null;
    }

    findCommonNameMatch(searchTerm) {
        for (const [scientific, data] of Object.entries(this.TAXONOMIC_MAPPING)) {
            if (data.commonNames && data.commonNames.includes(searchTerm)) {
                return {
                    taxId: data.id,
                    taxonomicGroup: this.TAXONOMIC_MAPPING[data.group].searchTerms,
                    scientificName: scientific,
                    group: data.group,
                    isCommonNameMatch: true
                };
            }
        }
        return null;
    }

    findGroupMatch(searchTerm) {
        for (const [group, data] of Object.entries(this.TAXONOMIC_MAPPING)) {
            if (data.generalCommonNames && data.generalCommonNames.includes(searchTerm)) {
                return {
                    taxId: data.id,
                    taxonomicGroup: data.searchTerms,
                    group: group,
                    isGroupMatch: true
                };
            }
        }
        return null;
    }

    getCachedResult(searchTerm) {
        const cached = this.taxonomyCache.get(searchTerm);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    cacheAndReturn(searchTerm, result) {
        this.taxonomyCache.set(searchTerm, {
            data: result,
            timestamp: Date.now()
        });
        return result;
    }


    findTaxonomyMatch(taxId) {
        for (const [scientific, data] of Object.entries(this.TAXONOMIC_MAPPING)) {
            if (data.id === taxId) {
                return {
                    taxId: data.id,
                    taxonomicGroup: this.TAXONOMIC_MAPPING[data.group].searchTerms,
                    scientificName: scientific,
                    group: data.group,
                    isTaxonomyMatch: true
                };
            }
        }
        for (const [group, data] of Object.entries(this.TAXONOMIC_MAPPING)) {
            if (this.isTaxIdInGroup(taxId, data.id)) {
                return {
                    taxId: taxId,
                    taxonomicGroup: data.searchTerms,
                    group: group,
                    isTaxonomyMatch: true,
                    isGroupLevel: true
                };
            }
        }

        return null;
    }

    isTaxIdInGroup(speciesTaxId, groupTaxId) {
        speciesTaxId = speciesTaxId.toString();
        groupTaxId = groupTaxId.toString();

        // Direct match
        if (speciesTaxId === groupTaxId) return true;

        // Check if the species taxId falls under the group's taxonomy hierarchy
        return speciesTaxId.startsWith(groupTaxId.slice(0, 2));
    }

    createEmptyResult() {
        return {
            taxId: null,
            taxonomicGroup: this.TAXONOMIC_BASE_GROUPS.VERTEBRATE.searchTerms,
            group: 'VERTEBRATE',
            isEmpty: true
        };
    }



    async findTaxonomyId(searchTerm) {
        const uri = this.genBankQueries.buildTaxonomySearchUri(searchTerm);
        const response = await sendRequestToProxy({ externalUrl: uri });
        if (response.esearchresult.count !== "0") {
            return response.esearchresult.idlist[0];
        }
        return null;
    }

    async findTaxonomyIdFromVariant(searchTerm) {
        const uri = this.genBankQueries.buildVariantSearchUri(searchTerm);
        const response = await sendRequestToProxy({ externalUrl: uri });

        if (!response.esearchresult.idlist.length) return null;

        const summaryUri = this.genBankQueries.buildSequenceSummaryUri(response.esearchresult.idlist);
        const summaryResponse = await sendRequestToProxy({ externalUrl: summaryUri });

        return this.getBestTaxIdFromBreedName(Object.values(summaryResponse.result), searchTerm);
    }

    processVariantResults(results, taxonomicGroup) {
        const uniqueVariants = new Map();

        Object.values(results).forEach(result => {
            const title = result.title || '';
            const organism = result.organism || '';

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
                        source: variantInfo.source
                    });
                }
            }
        });

        return Array.from(uniqueVariants.values()).slice(0, 5);
    }

    extractVariantInfo(result, taxonomicGroup) {
        const title = result.title || '';
        const organism = result.organism || '';
        const strain = result.strain || '';
        const subtype = result.subtype ? result.subtype.split('|') : [];
        const subname = result.subname ? result.subname.split('|') : [];

        // Try different sources for variant name
        let variantName = null;
        let variantType = 'Variant';
        let source = '';
        let additionalNames = [];

        // 1. Check strain field first
        if (strain && this.isValidVariantName(this.cleanVariantName(strain))) {
            variantName = this.cleanVariantName(strain);
            variantType = 'Strain';
            source = 'strain';
        }

        // 2. Check subtype/subname pairs
        if (!variantName && subtype.length === subname.length) {
            for (let i = 0; i < subtype.length; i++) {
                const type = subtype[i].toLowerCase();
                const name = subname[i];

                if (['strain', 'breed', 'variety', 'subspecies'].includes(type) &&
                    this.isValidVariantName(this.cleanVariantName(name))) {
                    variantName = this.cleanVariantName(name);
                    variantType = type.charAt(0).toUpperCase() + type.slice(1);
                    source = 'subtype';
                    break;
                }
            }
        }

        // 3. Check taxonomic group terms in title
        if (!variantName) {
            for (const term of taxonomicGroup) {
                const match = title.match(new RegExp(`${term}\\s+([^,\\s](?:[^,]*[^,\\s])?)`, 'i'));
                if (match && match[1]) {
                    const cleaned = this.cleanVariantName(match[1]);
                    if (this.isValidVariantName(cleaned)) {
                        variantName = cleaned;
                        variantType = term.charAt(0).toUpperCase() + term.slice(1);
                        source = 'title';
                        break;
                    }
                }
            }
        }

        // 4. Check for population or geographic variants
        if (!variantName && subtype.includes('country')) {
            const countryIndex = subtype.indexOf('country');
            const locationName = subname[countryIndex];
            if (locationName && this.isValidVariantName(this.cleanVariantName(locationName))) {
                variantName = this.cleanVariantName(locationName);
                variantType = 'Geographic Variant';
                source = 'location';
            }
        }

        return {
            name: variantName,
            type: variantType,
            source: source,
            additionalNames
        };
    }

    cleanVariantName(name) {
        if (!name) return null;
        // remove technical names
        name = name.split(/[,([]/, 1)[0].trim()
            .replace(/\s+(chromosome|unplaced|genomic|sequence|dna|assembly|scaffold|contig|isolate|genome|complete|whole|mitochondrial|mitochondrion|sample|strain|type|specimen).*$/i, '')
            .trim();

        if (name.includes(':')) {
            name = name.split(':')[0].trim();
        }

        return name.split(/\s+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    isValidVariantName(name) {
        if (!name || name.length < 2) return false;

        const invalidWords = [
            'chromosome', 'unplaced', 'genomic', 'sequence',
            'dna', 'assembly', 'scaffold', 'contig', 'isolate',
            'genome', 'mitochondrial', 'mitochondrion', 'sample',
            'unknown', 'specimen', 'type', 'strain', 'complete',
            'whole', 'partial'
        ];

        const lowerName = name.toLowerCase();

        if (invalidWords.some(word => lowerName.includes(word))) return false;

        return /^[A-Z][a-zA-Z0-9\s-]+$/.test(name);
    }

    hasPageData(result, page) {
        const { pageSize = this.genBankQueries.DEFAULT_PAGE_SIZE } = result;
        const startIndex = (page - 1) * pageSize;
        return startIndex < result.suggestions.length ||
            (result.isComplete && result.totalResults < startIndex + pageSize);
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



    async hasGenbankRecordForSearchTerm(searchTerm) {
        if (!searchTerm?.trim()) return this.EMPTY_GENBANK_RESULT;
        try {
            const cachedResult = await this.getValidationFromCache(searchTerm);
            if (cachedResult) {
                return cachedResult;
            }
            const requestUri = this.genBankQueries.buildGenbankRecordCheckUri(searchTerm);
            const response = await sendRequestToProxy({
                externalUrl: requestUri
            });
            const result = {
                accessionId: response.esearchresult.idlist?.[0] || null,
                title: searchTerm,
                isValid: response.esearchresult.count !== "0",
                type: 'FASTA'
            };
            return result.isValid;
        } catch (error) {
            console.error('Error checking GenBank record:', error);
            return this.EMPTY_GENBANK_RESULT;
        }
    }

    async getValidationFromCache(searchTerm) {
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

    async updateValidationLocalCaches(searchTerm, data) {
        if (!data.isValid) return;

        await Promise.all([
            this.memoryCache.setCacheEntry(
                LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
                searchTerm,
                data,
            ),
            this.localStorageCache.setCacheEntry(
                LocalStorageKeys.GENBANK_RECORD_VALIDATION(),
                searchTerm,
                data,
            )
        ]).catch(error => {
            console.error('Error updating local validation caches:', error);
        });
    }


    findTaxonomicInfo(searchTerm) {
        searchTerm = searchTerm.toLowerCase().trim();

        for (const [scientificName, data] of Object.entries(this.TAXONOMIC_MAPPING)) {
            if (data.commonNames && data.commonNames.includes(searchTerm)) {
                return {
                    taxId: data.id,
                    group: data.group,
                    scientificName
                };
            }
        }

        for (const [group, data] of Object.entries(this.TAXONOMIC_MAPPING)) {
            if (data.generalCommonNames && data.generalCommonNames.includes(searchTerm)) {
                return {
                    taxId: data.id,
                    group: group,
                    isGeneralMatch: true
                };
            }
        }

        return null;
    }

}

class GenBankCacheEntry {
    constructor(data = {}) {
        this.suggestions = data.suggestions || [];
        this.isComplete = data.isComplete || false;
        this.globalLastPage = data.globalLastPage || 0;
        this.lastPage = data.lastPage || 0;
        this.pageSize = data.pageSize || 5;
        this.totalResults = data.totalResults || 0;
        this.taxonomicGroup = data.taxonomicGroup || null;
        this.taxId = data.taxId || null;
        this.metadata = {
            lastFetched: data.metadata?.lastFetched || Date.now(),
            ...data.metadata
        };
    }

    toJSON() {
        return {
            suggestions: this.suggestions,
            isComplete: this.isComplete,
            globalLastPage: this.globalLastPage,
            lastPage: this.lastPage,
            pageSize: this.pageSize,
            totalResults: this.totalResults,
            taxonomicGroup: this.taxonomicGroup,
            taxId: this.taxId,
            metadata: {
                lastFetched: this.metadata.lastFetched,
                ...this.metadata
            }
        };
    }
}