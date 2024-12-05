import {CacheInterface} from "../cache/CacheInterface.js";
import {MemoryCache} from "../cache/MemoryCache.js";
import {LocalStorageCache} from "../cache/LocalStorageCache.js";
import {RedisStorageCache} from "../cache/RedisStorageCache.js";
import {GenBankQueries} from "./GenBankQueries.js";
import {sendRequestToProxy} from "../functions/fetchProxy.js";
import {LocalStorageKeys} from "../cache/LocalStorageKeyManager.js";
import {animalGroups} from "../constants/taxonomy.js";

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


    animalgroups = {
        // canids
        'fox': {
            genus: 'vulpes',
            family: 'canidae',
            taxid: '9627',
            group: 'mammal',
            includes: ['red fox', 'arctic fox', 'fennec fox']
        },
        'wolf': {
            genus: 'canis',
            family: 'canidae',
            taxid: '9612',
            group: 'mammal',
            includes: ['gray wolf', 'timber wolf']
        },
        'coyote': {
            genus: 'canis',
            family: 'canidae',
            taxid: '9614',
            group: 'mammal'
        },

        // felids
        'lion': {
            genus: 'panthera',
            family: 'felidae',
            taxid: '9689',
            group: 'mammal'
        },
        'tiger': {
            genus: 'panthera',
            family: 'felidae',
            taxid: '9694',
            group: 'mammal',
            includes: ['bengal tiger', 'siberian tiger']
        },
        'leopard': {
            genus: 'panthera',
            family: 'felidae',
            taxid: '9691',
            group: 'mammal'
        },

        // reptiles
        'crocodile': {
            genus: 'crocodylus',
            family: 'crocodylidae',
            taxid: '8496',
            group: 'reptile',
            includes: ['nile crocodile', 'saltwater crocodile'],
            searchTerms: ['species', 'population', 'isolate', 'subspecies']
        },
        'alligator': {
            genus: 'alligator',
            family: 'alligatoridae',
            taxid: '8496',
            group: 'reptile',
            includes: ['american alligator', 'chinese alligator'],
            searchTerms: ['species', 'population', 'isolate', 'subspecies']
        },
        'python': {
            genus: 'python',
            family: 'pythonidae',
            taxid: '8777',
            group: 'reptile'
        },

        // marine mammals
        'dolphin': {
            genus: 'tursiops',
            family: 'delphinidae',
            taxid: '9739',
            group: 'mammal',
            includes: ['bottlenose dolphin']
        },
        'whale': {
            genus: 'balaenoptera',
            family: 'balaenopteridae',
            taxid: '9771',
            group: 'mammal',
            includes: ['blue whale', 'humpback whale']
        },

        // bears
        'bear': {
            genus: 'ursus',
            family: 'ursidae',
            taxid: '9632',
            group: 'mammal',
            includes: ['brown bear', 'black bear', 'polar bear']
        },

        // primates
        'gorilla': {
            genus: 'gorilla',
            family: 'hominidae',
            taxid: '9593',
            group: 'mammal'
        },
        'chimpanzee': {
            genus: 'pan',
            family: 'hominidae',
            taxid: '9598',
            group: 'mammal'
        },
        'orangutan': {
            genus: 'pongo',
            family: 'hominidae',
            taxid: '9600',
            group: 'mammal'
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
    async getSuggestions(searchTerm, page = 1, startIndex) {
        if (!searchTerm?.trim()) return [];
        try {
            const cachedData = await this.getFromCacheHierarchy(searchTerm, page, startIndex);
            if (!cachedData || !cachedData.isComplete) {
                Promise.resolve().then(() => {
                    this.triggerBackgroundTasks(searchTerm, page);
                });
            }
            if (cachedData) {
                return cachedData;
            }
            // if no cache hit, fetch initial data
            return await this.fetchData(searchTerm, page, startIndex);
        } catch (error) {
            console.error('Error in getSuggestions:', error);
            return { suggestions: [], metadata: { error: error.message } };
        }
    }

    async getFromCacheHierarchy(searchTerm, page, startIndex) {
        // Check memory cache
        const memCache = await this.memoryCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (memCache && this.hasPageData(memCache, startIndex)) {
            const result = this.paginateResults(memCache, page, startIndex);
            if (result.suggestions.length > 0) {
                return result;
            }
        }

        // Check localStorage
        const localCache = await this.localStorageCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (localCache && this.hasPageData(localCache, startIndex)) {
            await this.memoryCache.setCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm, localCache);
            const result = this.paginateResults(localCache, page, startIndex);
            if (result.suggestions.length > 0) {
                return result;
            }
        }

        // Check Redis
        const redisCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (redisCache && this.hasPageData(redisCache, startIndex)) {
            await this.distributeToCaches(searchTerm, redisCache);
            const result = this.paginateResults(redisCache, page, startIndex);
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

    async checkAndFetchNewData(searchTerm) {
        const shouldFetch = await this.shouldFetchMoreData(searchTerm);
        if (!shouldFetch) return;
        const redisCache = await this.redisCache.getCacheEntry(LocalStorageKeys.SUGGESTIONS(), searchTerm);
        if (!redisCache) return;
        const nextPage = (redisCache.globalLastPage || 0) + 1;
        try {
            const variantResponse = await this.getVariantsResponse(
                searchTerm,
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
        const seenSuggestions = new Map();
        for(let i = 0; i < existingSuggestions.length; i++) {
            seenSuggestions.set(existingSuggestions[i].id, existingSuggestions[i]);
        }
        const equalAny = (name, names) => {
            for(let i = 0; i < names.length; i++) {
                if (names[i] === name) return true;
            }
            return false;
        }
        const uniqueNewSuggestions = newSuggestions.filter(s => !seenSuggestions.has(s.id) && !equalAny(s.primaryCommonName, Array.from(seenSuggestions.values()).map(v => v.primaryCommonName)));
        return [...existingSuggestions, ...uniqueNewSuggestions];
    }

    async fetchData(searchTerm, page, startIndex) {
        try {
            const data = await this.fetchAndMergeSuggestions(searchTerm, page);
            if (data) {
                await this.distributeToCaches(searchTerm, data);
                return this.paginateResults(data, page, startIndex);
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

    paginateResults(cacheEntry, page, startIndex) {
        const { pageSize = this.genBankQueries.DEFAULT_PAGE_SIZE } = cacheEntry;
        const start = startIndex;
        const end = Math.min(start + pageSize, cacheEntry.suggestions.length);

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
                const animalMatch = animalGroups[searchTerm.toLowerCase()];
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
                searchTerm,
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


    async getVariantsResponse(searchTerm, taxId, taxonomicGroup, nextPage) {
        if (!taxId || !taxonomicGroup) {
            return this.createEmptyVariantResponse();
        }
        try {
            const animalVariantsUri = this.genBankQueries.buildVariantFetchUri(searchTerm, taxId, taxonomicGroup, nextPage);
            const response = await sendRequestToProxy({
                externalUrl: animalVariantsUri
            })
            if (response.esearchresult?.idlist?.length > 0) {
                const summaryUri = this.genBankQueries.buildSequenceSummaryUri(response.esearchresult.idlist);
                const summaryResponse = await sendRequestToProxy({externalUrl: summaryUri});
                return {
                    ...summaryResponse,
                    count: parseInt(response.esearchresult.count),
                    retmax: parseInt(response.esearchresult.retmax),
                    retstart: parseInt(response.esearchresult.retstart),
                    isComplete: (parseInt(response.esearchresult.retstart) + response.esearchresult.idlist.length) >= parseInt(response.esearchresult.count),
                    queryTranslation: response.esearchresult.querytranslation,
                };
            }
            return this.createEmptyVariantResponse();

        } catch (error) {
            console.error('Error in getVariantsResponse:', error);
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
            error: error
        };
    }

    async getTaxonomicGroupInfo(searchTerm, page) {
        try {
            searchTerm = searchTerm.toLowerCase().trim();

            // 1. Check memory cache
            const cached = this.getCachedResult(searchTerm);
            if (cached) return cached;

            // 2. Check specific animal groups first (most specific match)
            const animalMatch = animalGroups[searchTerm];
            if (animalMatch) {
                return this.cacheAndReturn(searchTerm, {
                    taxId: animalMatch.taxId,
                    taxonomicGroup: this.TAXONOMIC_BASE_GROUPS[animalMatch.group].searchTerms,
                    scientificName: animalMatch.genus,
                    group: animalMatch.group,
                    family: animalMatch.family,
                    isSpecificMatch: true
                });
            }

            // 3. Check group patterns for specific families
            for (const pattern of this.groupPatterns) {
                if (pattern.pattern.test(searchTerm)) {
                    return this.cacheAndReturn(searchTerm, {
                        taxId: pattern.taxId,
                        taxonomicGroup: this.TAXONOMIC_BASE_GROUPS[pattern.group].searchTerms,
                        group: pattern.group,
                        family: pattern.family,
                        isPatternMatch: true
                    });
                }
            }

            // 4. Check exact matches in TAXONOMIC_MAPPING
            const exactMatch = this.findExactMatch(searchTerm);
            if (exactMatch) return this.cacheAndReturn(searchTerm, exactMatch);

            // 5. Check common names
            const commonNameMatch = this.findCommonNameMatch(searchTerm);
            if (commonNameMatch) return this.cacheAndReturn(searchTerm, commonNameMatch);

            // 6. Check general group names (least specific match)
            const groupMatch = this.findGroupMatch(searchTerm);
            if (groupMatch) return this.cacheAndReturn(searchTerm, groupMatch);

            // 7. Try comprehensive taxonomy search
            const taxId = await this.findTaxonomyId(searchTerm);
            if (taxId) {
                const taxonomyMatch = this.findTaxonomyMatch(taxId);
                if (taxonomyMatch) return this.cacheAndReturn(searchTerm, taxonomyMatch);
            }

            return this.createEmptyResult(page);

        } catch (error) {
            console.error(`Taxonomy detection error for: ${searchTerm}`, error);
            return this.createEmptyResult(page);
        }
    }


    async findTaxonomyId(searchTerm) {
        try {
            // Run all search strategies in parallel
            const [taxonomyResult, breedResult] = await Promise.all([
                this.searchTaxonomyDirect(searchTerm),
                this.searchVariantBreeds(searchTerm),
            ]);

            return this.getBestTaxIdMatch({
                taxonomyMatch: taxonomyResult,
                breedMatch: breedResult,
                searchTerm
            });
        } catch (error) {
            console.error('Error in findTaxonomyId:', error);
            return null;
        }
    }

    async searchVariantBreeds(searchTerm) {
        const uri = this.genBankQueries.buildAdvancedVariantSearchUri(searchTerm);
        const response = await sendRequestToProxy({externalUrl: uri});

        if (!response.esearchresult?.idlist?.length) return null;

        const summaryUri = this.genBankQueries.buildSequenceSummaryUri(response.esearchresult.idlist);
        const summaryResponse = await sendRequestToProxy({externalUrl: summaryUri});

        return summaryResponse.result;
    }

    getBestTaxIdFromOrganism(results, searchTerm) {
        searchTerm = searchTerm.toLowerCase();
        for (const result of results) {
            const organism = (result.organism || '').toLowerCase();
            if (organism.includes(searchTerm)) {
                return result.taxid;
            }
        }
        return null;
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


    async searchTaxonomyDirect(searchTerm) {
        const uri = this.genBankQueries.buildTaxonomySearchUri(searchTerm);
        const response = await sendRequestToProxy({ externalUrl: uri });

        if (response.esearchresult?.count !== "0") {
            const summaryUri = this.genBankQueries.buildTaxonomicSummaryUri(response.esearchresult.idlist[0]);
            const summaryResponse = await sendRequestToProxy({externalUrl: summaryUri});
            return summaryResponse.result;
        }
        return null;
    }

    getBestTaxIdMatch({taxonomyMatch, breedMatch, genomeMatch, searchTerm}) {
        const matches = [];

        if (taxonomyMatch) {
            const result = Object.values(taxonomyMatch)[0];
            if (this.isRelevantTaxonomyMatch(result, searchTerm)) {
                matches.push({taxId: result.taxid, score: 3, type: 'taxonomy'});
            }
        }

        if (breedMatch) {
            const breedTaxId = this.getBestTaxIdFromBreedName(Object.values(breedMatch), searchTerm);
            if (breedTaxId) matches.push({taxId: breedTaxId, score: 2, type: 'breed'});
        }

        if (genomeMatch) {
            const genomeTaxId = this.getBestTaxIdFromOrganism(Object.values(genomeMatch), searchTerm);
            if (genomeTaxId) matches.push({taxId: genomeTaxId, score: 1, type: 'genome'});
        }

        const bestMatch = matches.sort((a, b) => b.score - a.score)[0];
        return bestMatch?.taxId || null;
    }

    findTaxonomyMatch(taxId) {
        // Check specific matches
        for (const group of Object.values(animalGroups)) {
            if (group.taxId === taxId) {
                return {
                    taxId: group.taxId,
                    taxonomicGroup: this.TAXONOMIC_BASE_GROUPS[group.group].searchTerms,
                    group: group.group,
                    family: group.family,
                    isSpecificMatch: true
                };
            }
        }

        for (const pattern of this.groupPatterns) {
            if (pattern.taxId === taxId) {
                return {
                    taxId: pattern.taxId,
                    taxonomicGroup: this.TAXONOMIC_BASE_GROUPS[pattern.group].searchTerms,
                    group: pattern.group,
                    family: pattern.family,
                    isPatternMatch: true
                };
            }
        }

        return {
            taxId: taxId,
            taxonomicGroup: [],
            group: "",
            family: "",
            isPatternMatch: false
        }
    }


    isRelevantTaxonomyMatch(result, searchTerm) {
        const searchTermLower = searchTerm.toLowerCase();
        const scientificName = (result.scientificname || '').toLowerCase();
        const commonName = (result.commonname || '').toLowerCase();

        return scientificName.includes(searchTermLower) ||
            commonName.includes(searchTermLower) ||
            this.checkRelatedNames(searchTermLower);
    }


    checkRelatedNames(result, searchTerm) {
        for (const group of Object.values(this.TAXONOMIC_MAPPING)) {
            if (group.commonNames?.some(name => name.toLowerCase().includes(searchTerm))) {
                return true;
            }
            if (group.generalCommonNames?.includes(searchTerm)) {
                return true;
            }
        }
        const animalGroup = animalGroups[searchTerm];
        if (animalGroup) {
            return true;
        }
        return this.groupPatterns.some(pattern => pattern.pattern.test(searchTerm));
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


        // 4. use the organism as variant name if it's still null

        if (!variantName || variantName === '' && organism.trim() !== '') {
            variantName = organism;
            variantType = 'species';
            source = 'Scientific';
        }

        // 5. Check for population or geographic variants
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

    hasPageData(result, startIndex) {
        const len = result.suggestions.length;
        return startIndex < len;
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