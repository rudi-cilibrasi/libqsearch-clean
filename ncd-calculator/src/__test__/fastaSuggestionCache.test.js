import { vi, describe, test, expect, beforeEach } from 'vitest';
import {cacheSuggestions, getCachedFastaSuggestions} from "../cache/fastaSuggestionCache.js";
import {FASTA_SUGGESTION_CACHE} from "../cache/cache.js";

describe('FASTA Suggestion Cache', () => {
    const localStorageMock = {
        store: {},
        getItem: vi.fn(key => localStorageMock.store[key] || null),
        setItem: vi.fn((key, value) => {
            localStorageMock.store[key] = String(value);
        }),
        clear: vi.fn(() => {
            localStorageMock.store = {};
        })
    };

    const sampleDogSuggestions = [
        {
            id: "MU018714.1",
            scientificName: "Canis lupus familiaris",
            primaryCommonName: "German Shepherd",
            additionalCommonNames: [],
            type: "Breed"
        },
        {
            id: "CM000007.4",
            scientificName: "Canis lupus familiaris",
            primaryCommonName: "Boxer",
            additionalCommonNames: [],
            type: "Breed"
        }
    ];

    const sampleCatSuggestions = [
        {
            id: "GG660245.1",
            scientificName: "Felis catus",
            primaryCommonName: "Mixed",
            additionalCommonNames: [],
            type: "Breed"
        },
        {
            id: "KZ451856.1",
            scientificName: "Felis catus",
            primaryCommonName: "Abyssinian",
            additionalCommonNames: [],
            type: "Breed"
        }
    ];

    beforeEach(() => {
        global.localStorage = localStorageMock;
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('cacheSuggestions', () => {
        test('should cache new suggestions correctly', () => {
            cacheSuggestions('dog', sampleDogSuggestions);

            const expectedCache = {
                'dog': sampleDogSuggestions
            };

            expect(localStorage.setItem).toHaveBeenCalledWith(
                FASTA_SUGGESTION_CACHE,
                JSON.stringify(expectedCache)
            );
        });

        test('should handle multiple animal types in cache', () => {
            cacheSuggestions('dog', sampleDogSuggestions);

            cacheSuggestions('cat', sampleCatSuggestions);

            const expectedCache = {
                'dog': sampleDogSuggestions,
                'cat': sampleCatSuggestions
            };

            expect(JSON.parse(localStorageMock.store[FASTA_SUGGESTION_CACHE]))
                .toEqual(expectedCache);
        });

        test('should update existing suggestions for same animal', () => {
            const initialCache = {
                'dog': [sampleDogSuggestions[0]]
            };
            localStorage.setItem(FASTA_SUGGESTION_CACHE, JSON.stringify(initialCache));

            const newDogSuggestions = [sampleDogSuggestions[1]];
            cacheSuggestions('dog', newDogSuggestions);

            expect(JSON.parse(localStorageMock.store[FASTA_SUGGESTION_CACHE]))
                .toEqual({
                    'dog': newDogSuggestions
                });
        });
    });

    describe('getCachedFastaSuggestions', () => {
        test('should return null for non-existent animal', () => {
            const result = getCachedFastaSuggestions('nonexistent');
            expect(result).toBeNull();
        });

        test('should return correct suggestions for existing animal', () => {
            // Setup cache
            const cache = {
                'dog': sampleDogSuggestions
            };
            localStorage.setItem(FASTA_SUGGESTION_CACHE, JSON.stringify(cache));

            const result = getCachedFastaSuggestions('dog');
            expect(result).toEqual(sampleDogSuggestions);
        });

        test('should handle complete cache format', () => {
            const completeCache = {
                "dog": sampleDogSuggestions,
                "cat": sampleCatSuggestions,
                "chicken": [{
                    id: "GU261674.1",
                    scientificName: "Gallus gallus jabouillei",
                    primaryCommonName: "Red Jungle Fowl",
                    additionalCommonNames: [],
                    type: "Breed"
                }],
                "fish": [{
                    id: "JAWPPI000000000.1",
                    scientificName: "Oncorhynchus mykiss gairdneri",
                    primaryCommonName: "Keithly Creek Breed Interior Columbia Basin Cultivar Redband Trout",
                    additionalCommonNames: [],
                    type: "Strain"
                }]
            };

            localStorage.setItem(FASTA_SUGGESTION_CACHE, JSON.stringify(completeCache));

            expect(getCachedFastaSuggestions('dog')).toEqual(sampleDogSuggestions);
            expect(getCachedFastaSuggestions('cat')).toEqual(sampleCatSuggestions);
            expect(getCachedFastaSuggestions('chicken')).toHaveLength(1);
            expect(getCachedFastaSuggestions('fish')).toHaveLength(1);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle malformed suggestion data', () => {
            const malformedSuggestions = [
                {
                    id: "test123"
                }
            ];
            expect(() => cacheSuggestions('test', malformedSuggestions)).not.toThrow();
        });

        test('should handle corrupted cache data', () => {
            localStorage.setItem(FASTA_SUGGESTION_CACHE, 'invalid-json');
            const result = getCachedFastaSuggestions('dog');
            expect(result).toBeNull();
        });

        test('should handle empty search term', () => {
            const result = getCachedFastaSuggestions('');
            expect(result).toBeUndefined();
        });

        test('should handle null or undefined suggestions', () => {
            expect(() => cacheSuggestions('test', null)).not.toThrow();
            expect(() => cacheSuggestions('test', undefined)).not.toThrow();
        });
    });
});