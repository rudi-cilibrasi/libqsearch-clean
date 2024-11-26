import {beforeEach, describe, expect, test, vi} from 'vitest';
import {getSearchResult} from "../functions/cacheFastaFetch.js";
import {getFastaAccessionNumbersFromIds, getFastaList} from "../functions/getPublicFasta.js";
import {getGenbankSequences} from "../functions/getPublicGenbank.js";
import {parseFastaAndClean} from "../functions/fasta.js";

vi.mock('../functions/getPublicFasta.js', () => ({
    getFastaAccessionNumbersFromIds: vi.fn(),
    getFastaList: vi.fn(),
}));

vi.mock('../functions/getPublicGenbank.js', () => ({
    getGenbankSequences: vi.fn(),
}));

vi.mock('../functions/fasta.js', () => ({
    parseFastaAndClean: vi.fn(),
}));

describe('getSearchResult', () => {
    const SEARCH_TERM_CACHE_ID = 'search_cache';
    const ACCESSION_CACHE_ID = 'accession_cache';

    // Mock localStorage
    const localStorageMock = {
        store: {},
        getItem: vi.fn(key => {
            // Important: Return the actual stored value, not just the key
            return localStorageMock.store[key] || null;
        }),
        setItem: vi.fn((key, value) => {
            localStorageMock.store[key] = String(value);
        }),
        removeItem: vi.fn(key => {
            delete localStorageMock.store[key];
        }),
        clear: vi.fn(() => {
            localStorageMock.store = {};
        })
    };

    beforeEach(() => {
        // Reset mocks and storage
        global.localStorage = localStorageMock;
        vi.clearAllMocks();
        localStorageMock.clear();

        // Initialize cache with empty objects
        localStorageMock.setItem(SEARCH_TERM_CACHE_ID, JSON.stringify({}));
        localStorageMock.setItem(ACCESSION_CACHE_ID, JSON.stringify({}));
    });

    test('should handle cache hit successfully', async () => {
        const cachedSearchData = [{
            accession: 'NC_123',
            label: 'Sample Label',
            scientificName: 'Scientific Name',
            commonName: 'Common Name'
        }];

        localStorageMock.store[SEARCH_TERM_CACHE_ID] = JSON.stringify({
            'dog': cachedSearchData
        });
        localStorageMock.store[ACCESSION_CACHE_ID] = JSON.stringify({
            'nc_123': 'ATCGATCG'
        });

        const result = await getSearchResult({
            searchTerm: 'dog',
            id: 'some_id'
        });

        expect(localStorageMock.getItem).toHaveBeenCalledWith(SEARCH_TERM_CACHE_ID);
        expect(result.cacheHit).toBe(true);
        expect(result).toEqual({
            searchTerm: 'dog',
            contents: ['ATCGATCG'],
            labels: ['Sample Label'],
            accessions: ['NC_123'],
            scientificNames: ['Scientific Name'],
            commonNames: ['Common Name'],
            cacheHit: true
        });
    });

    test('should handle cache miss and fetch from GenBank', async () => {
        getFastaAccessionNumbersFromIds.mockImplementation(() =>
            Promise.resolve(['NC_123']));

        getGenbankSequences.mockImplementation(() =>
            Promise.resolve({
                contents: ['ATCGATCG'],
                labels: ['Sample Label'],
                accessions: ['NC_123'],
                scientificNames: ['Scientific Name'],
                commonNames: ['Common Name']
            }));

        const result = await getSearchResult({
            searchTerm: 'dog',
            id: 'some_id'
        }, 'mock_api_key');

        expect(getFastaAccessionNumbersFromIds).toHaveBeenCalledWith(['some_id'], 'mock_api_key');
        expect(getGenbankSequences).toHaveBeenCalled();
        expect(result).toEqual({
            searchTerm: 'dog',
            contents: ['ATCGATCG'],
            labels: ['Sample Label'],
            accessions: ['NC_123'],
            scientificNames: ['Scientific Name'],
            commonNames: ['Common Name'],
            cacheHit: false
        });
    });

    test('should handle GenBank empty and FASTA fallback', async () => {
        getFastaAccessionNumbersFromIds.mockImplementation(() =>
            Promise.resolve(['NC_123']));

        getGenbankSequences.mockImplementation(() =>
            Promise.resolve({
                contents: [''],
                labels: ['Sample Label'],
                accessions: ['NC_123'],
                scientificNames: ['Scientific Name'],
                commonNames: ['Common Name']
            }));

        getFastaList.mockImplementation(() =>
            Promise.resolve('>NC_123\nATCGATCG'));

        parseFastaAndClean.mockImplementation(() => [{
            sequence: 'ATCGATCG'
        }]);

        const result = await getSearchResult({
            searchTerm: 'dog',
            id: 'some_id'
        }, 'mock_api_key');

        expect(getFastaList).toHaveBeenCalled();
        expect(result.contents).toEqual(['ATCGATCG']);
    });

    test('should handle API errors', async () => {
        getFastaAccessionNumbersFromIds.mockImplementation(() =>
            Promise.reject(new Error('API Error')));

        const result = await getSearchResult({
            searchTerm: 'dog',
            id: 'some_id'
        }, 'mock_api_key');

        expect(result).toEqual({
            searchTerm: 'dog',
            contents: [],
            labels: [],
            accessions: [],
            commonNames: [],
            scientificNames: [],
            cacheHit: false
        });
    });
});