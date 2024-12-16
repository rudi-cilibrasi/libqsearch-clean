import {GenBankSearchService} from "@/services/GenBankSearchService.ts";
import {sendRequestToProxy} from "@/functions/fetchProxy.ts";
import {beforeEach} from "vitest";

describe("GenbankSearchService test", () => {
    vi.mock("../functions/fetchProxy.ts", () => ({
        sendRequestToProxy: vi.fn(),
    }));

    let service: GenBankSearchService;
    beforeEach(() => {
        service = new GenBankSearchService();
        vi.clearAllMocks();
    })

    describe("Test find taxonomic info by search term", () => {
        it('should return breed data for successful search', async () => {
            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                esearchresult: {
                    idlist: ['12345', '67890'],
                    count: '2'
                }
            });

            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                result: {
                    '12345': {
                        title: 'German Shepherd breed genomic sequence',
                        organism: 'Canis lupus familiaris',
                        strain: 'German Shepherd'
                    },
                    '67890': {
                        title: 'Golden Retriever breed genomic sequence',
                        organism: 'Canis lupus familiaris',
                        strain: 'Golden Retriever'
                    }
                }
            });

            const result = await service.searchVariantBreeds('german shepherd');

            expect(result).toEqual({
                '12345': {
                    title: 'German Shepherd breed genomic sequence',
                    organism: 'Canis lupus familiaris',
                    strain: 'German Shepherd'
                },
                '67890': {
                    title: 'Golden Retriever breed genomic sequence',
                    organism: 'Canis lupus familiaris',
                    strain: 'Golden Retriever'
                }
            });

            // Verify both API calls were made
            expect(sendRequestToProxy).toHaveBeenCalledTimes(2);

            // Verify correct URLs were used
            expect(sendRequestToProxy).toHaveBeenNthCalledWith(1, {
                externalUrl: expect.stringContaining('esearch.fcgi')
            });
            expect(sendRequestToProxy).toHaveBeenNthCalledWith(2, {
                externalUrl: expect.stringContaining('esummary.fcgi')
            });
        });

        it('should return null when no variants found', async () => {
            // Mock first call with empty results
            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                esearchresult: {
                    idlist: [],
                    count: '0'
                }
            });

            const result = await service.searchVariantBreeds('nonexistent breed');

            // Verify result is null
            expect(result).toBeNull();

            // Verify only first API call was made
            expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
        });

        it('should handle first API call failure', async () => {
            // Mock API error
            vi.mocked(sendRequestToProxy).mockRejectedValueOnce(new Error('API Error'));

            const result = await service.searchVariantBreeds('german shepherd');

            // Verify result is null
            expect(result).toBeNull();

            // Verify only one call was attempted
            expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
        });

        it('should handle second API call failure', async () => {
            // Mock successful first call
            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                esearchresult: {
                    idlist: ['12345'],
                    count: '1'
                }
            });

            // Mock failed second call
            vi.mocked(sendRequestToProxy).mockRejectedValueOnce(new Error('API Error'));

            const result = await service.searchVariantBreeds('german shepherd');

            // Verify result is null
            expect(result).toBeNull();

            // Verify both calls were attempted
            expect(sendRequestToProxy).toHaveBeenCalledTimes(2);
        });

        it('should handle malformed response data', async () => {
            // Mock first call with malformed response
            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                esearchresult: null // Malformed response
            });

            const result = await service.searchVariantBreeds('german shepherd');

            expect(result).toBeNull();

            expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple variant ids correctly', async () => {
            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                esearchresult: {
                    idlist: ['123', '456', '789'],
                    count: '3'
                }
            });

            vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                result: {
                    '123': {title: 'Variant 1', organism: 'Species 1'},
                    '456': {title: 'Variant 2', organism: 'Species 1'},
                    '789': {title: 'Variant 3', organism: 'Species 1'}
                }
            });

            const result = await service.searchVariantBreeds('test term');

            expect(Object.keys(result)).toHaveLength(3);

            expect(sendRequestToProxy).toHaveBeenNthCalledWith(2, {
                externalUrl: expect.stringContaining(encodeURIComponent('123,456,789'))
            });
        });

        it('should process breed-specific search terms correctly', async () => {
            // Mock successful calls for breed search
            vi.mocked(sendRequestToProxy)
                .mockResolvedValueOnce({
                    esearchresult: {
                        idlist: ['12345'],
                        count: '1'
                    }
                })
                .mockResolvedValueOnce({
                    result: {
                        '12345': {
                            title: 'Siamese Cat breed genomic sequence',
                            organism: 'Felis catus',
                            strain: 'Siamese',
                            subtype: 'breed',
                            subname: 'Siamese'
                        }
                    }
                });

            const result = await service.searchVariantBreeds('siamese cat');

            expect(result['12345'].strain).toBe('Siamese');
            expect(result['12345'].subtype).toBe('breed');

            expect(sendRequestToProxy).toHaveBeenNthCalledWith(1, {
                externalUrl: expect.stringContaining(encodeURIComponent('breed[Title]'))
            });
        });
    });

    describe("searchTaxonomyDirect test", () => {
        describe('successful searches', () => {
            it('should return taxonomy data for direct match with scientific name', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["9615"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        "9615": {
                            taxid: "9615",
                            scientificname: "Canis lupus familiaris",
                            commonname: "dog",
                            rank: "subspecies",
                            division: "Mammals"
                        }
                    }
                });

                const result = await service.searchTaxonomyDirect("Canis lupus familiaris");

                expect(result).toEqual({
                    "9615": {
                        taxid: "9615",
                        scientificname: "Canis lupus familiaris",
                        commonname: "dog",
                        rank: "subspecies",
                        division: "Mammals"
                    }
                });

                expect(sendRequestToProxy).toHaveBeenCalledTimes(2);
                expect(sendRequestToProxy).toHaveBeenNthCalledWith(1, {
                    externalUrl: expect.stringContaining('esearch.fcgi')
                });
                expect(sendRequestToProxy).toHaveBeenNthCalledWith(2, {
                    externalUrl: expect.stringContaining('esummary.fcgi')
                });
            });

            it('should return taxonomy data for common name search', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["9685"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        "9685": {
                            taxid: "9685",
                            scientificname: "Felis catus",
                            commonname: "cat",
                            rank: "species"
                        }
                    }
                });

                const result = await service.searchTaxonomyDirect("cat");
                expect(result["9685"].commonname).toBe("cat");
                expect(result["9685"].scientificname).toBe("Felis catus");
            });

            it('should handle multiple result ids correctly', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "2",
                        idlist: ["9615", "9685"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        "9615": {
                            taxid: "9615",
                            scientificname: "Canis lupus familiaris"
                        }
                    }
                });

                await service.searchTaxonomyDirect("mammal");
                // Should only use first ID
                expect(sendRequestToProxy).toHaveBeenNthCalledWith(2, {
                    externalUrl: expect.stringContaining('9615')
                });
            });
        });

        describe('error handling', () => {
            it('should return null for zero results', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "0",
                        idlist: []
                    }
                });

                const result = await service.searchTaxonomyDirect("nonexistent");
                expect(result).toBeNull();
                expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
            });

            it('should handle network error in first request', async () => {
                vi.mocked(sendRequestToProxy).mockRejectedValueOnce(
                    new Error('Network error')
                );

                const result = await service.searchTaxonomyDirect("dog");
                expect(result).toBeNull();
                expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
            });

            it('should handle network error in second request', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["9615"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockRejectedValueOnce(
                    new Error('Network error')
                );

                const result = await service.searchTaxonomyDirect("dog");
                expect(result).toBeNull();
                expect(sendRequestToProxy).toHaveBeenCalledTimes(2);
            });

            it('should handle malformed first response', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: null
                });

                const result = await service.searchTaxonomyDirect("dog");
                expect(result).toBeNull();
            });

            it('should handle malformed second response', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["9615"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: null
                });

                const result = await service.searchTaxonomyDirect("dog");
                expect(result).toBeNull();
            });

            it('should handle empty idlist in first response', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: []
                    }
                });

                const result = await service.searchTaxonomyDirect("dog");
                expect(result).toBeNull();
            });
        });

        describe('edge cases', () => {
            it('should handle special characters in search term', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["9615"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        "9615": {
                            taxid: "9615",
                            scientificname: "Canis lupus familiaris"
                        }
                    }
                });

                const result = await service.searchTaxonomyDirect("dog & cat");
                expect(result).toBeTruthy();
                expect(sendRequestToProxy).toHaveBeenNthCalledWith(1, {
                    externalUrl: expect.stringContaining('dog+%26+cat')
                });
            });

            it('should handle extremely long search terms', async () => {
                const longSearchTerm = 'a'.repeat(1000);

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "0",
                        idlist: []
                    }
                });

                const result = await service.searchTaxonomyDirect(longSearchTerm);
                expect(result).toBeNull();
            });

            it('should handle empty search term', async () => {
                const result = await service.searchTaxonomyDirect("");
                expect(result).toBeNull();
            });

            it('should handle whitespace-only search term', async () => {
                const result = await service.searchTaxonomyDirect("   ");
                expect(result).toBeNull();
            });
        });

        describe('response validation', () => {
            it('should validate taxonomy ID format', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["invalid_id"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        "invalid_id": {
                            taxid: "not_a_number",
                            scientificname: "Test Species"
                        }
                    }
                });

                const result = await service.searchTaxonomyDirect("test");
                expect(result?.invalid_id?.taxid).toBe("not_a_number");
            });

            it('should handle missing required fields in taxonomy data', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    esearchresult: {
                        count: "1",
                        idlist: ["9615"]
                    }
                });

                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        "9615": {
                            // Missing taxid and scientificname
                            commonname: "dog"
                        }
                    }
                });

                const result = await service.searchTaxonomyDirect("dog");
                expect(result?.["9615"]?.commonname).toBe("dog");
            });
        });

        describe('performance scenarios', () => {
            it('should handle rapid sequential searches', async () => {
                // First search
                vi.mocked(sendRequestToProxy)
                    .mockResolvedValueOnce({
                        esearchresult: {
                            count: "1",
                            idlist: ["9615"]
                        }
                    })
                    .mockResolvedValueOnce({
                        result: {
                            "9615": {taxid: "9615", scientificname: "Canis lupus familiaris"}
                        }
                    });

                const [result1] = await Promise.all([
                    service.searchTaxonomyDirect("dog"),
                ]);

                expect(result1).toBeTruthy();
                expect(sendRequestToProxy).toHaveBeenCalledTimes(2);
            });
        });
    })


    describe('searchTaxonomyByAccession', () => {
        let service: GenBankSearchService;

        beforeEach(() => {
            service = new GenBankSearchService();
            vi.clearAllMocks();
        });

        describe('successful searches', () => {
            it('should return taxId for valid accession ID', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        'NC_123456': {
                            taxid: '9615',
                            scientificname: 'Canis lupus familiaris'
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBe('9615');
                expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
            });

            it('should handle accession IDs with version numbers', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        'NC_123456.1': {
                            taxid: '9685',
                            scientificname: 'Felis catus'
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456.1');
                expect(result).toBe('9685');
            });

            it('should handle multiple results and take first value', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        'NC_123456': {
                            taxid: '9615',
                            scientificname: 'Canis lupus familiaris'
                        },
                        'NC_789012': {
                            taxid: '9685',
                            scientificname: 'Felis catus'
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBe('9615');
            });
        });

        describe('error handling', () => {
            it('should return null when API returns empty result', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {}
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
            });

            it('should return null when API call fails', async () => {
                vi.mocked(sendRequestToProxy).mockRejectedValueOnce(
                    new Error('API error')
                );

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
                expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
            });

            it('should return null when result is missing taxid', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        'NC_123456': {
                            scientificname: 'Canis lupus familiaris'
                            // missing taxid
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
            });

            it('should return null when response is null', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce(null);

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
            });

            it('should return null when response result is null', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: null
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
            });

            it('should handle network timeout', async () => {
                vi.mocked(sendRequestToProxy).mockRejectedValueOnce(
                    new Error('Network timeout')
                );

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
            });
        });

        describe('input validation', () => {
            it('should handle empty accession ID', async () => {
                const result = await service['searchTaxonomyByAccession']('');
                expect(result).toBeNull();
            });

            it('should handle whitespace accession ID', async () => {
                const result = await service['searchTaxonomyByAccession']('   ');
                expect(result).toBeNull();
            });

            it('should handle invalid accession ID format', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: null
                });

                const result = await service['searchTaxonomyByAccession']('invalid_format');
                expect(result).toBeNull();
            });
        });

        describe('response formats', () => {
            it('should handle string taxid', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        'NC_123456': {
                            taxid: '9615'  // string format
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBe('9615');
            });

            it('should handle numeric taxid', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    result: {
                        'NC_123456': {
                            taxid: 9615  // number format
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBe(9615);
            });

            it('should handle malformed response structure', async () => {
                vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                    wrongKey: {
                        'NC_123456': {
                            taxid: '9615'
                        }
                    }
                });

                const result = await service['searchTaxonomyByAccession']('NC_123456');
                expect(result).toBeNull();
            });
        });

        describe('common accession formats', () => {
            const validAccessions = [
                'NC_123456',
                'NC_123456.1',
                'NM_123456789',
                'NR_123456',
                'XM_123456789',
                'XR_123456789',
                'NP_123456',
                'XP_123456',
                'WP_123456789'
            ];

            validAccessions.forEach(accession => {
                it(`should handle ${accession} format correctly`, async () => {
                    vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
                        result: {
                            [accession]: {
                                taxid: '9615'
                            }
                        }
                    });

                    const result = await service['searchTaxonomyByAccession'](accession);
                    expect(result).toBe('9615');
                    expect(sendRequestToProxy).toHaveBeenCalledWith({
                        externalUrl: expect.stringContaining(accession)
                    });
                });
            });
        });

        describe('performance and edge cases', () => {
            it('should handle concurrent requests', async () => {
                vi.mocked(sendRequestToProxy)
                    .mockResolvedValueOnce({
                        result: {
                            'NC_123456': { taxid: '9615' }
                        }
                    })
                    .mockResolvedValueOnce({
                        result: {
                            'NC_789012': { taxid: '9685' }
                        }
                    });

                const [result1, result2] = await Promise.all([
                    service['searchTaxonomyByAccession']('NC_123456'),
                    service['searchTaxonomyByAccession']('NC_789012')
                ]);

                expect(result1).toBe('9615');
                expect(result2).toBe('9685');
                expect(sendRequestToProxy).toHaveBeenCalledTimes(2);
            });

            it('should handle very long accession IDs', async () => {
                const longAccession = 'NC_' + '1'.repeat(1000);

                const result = await service['searchTaxonomyByAccession'](longAccession);
                expect(result).toBeNull();
            });

            it('should handle special characters in accession IDs', async () => {
                const result = await service['searchTaxonomyByAccession']('NC_123456!@#');
                expect(result).toBeNull();
            });
        });
    });

});
