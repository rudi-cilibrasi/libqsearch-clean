import '@vitest/web-worker'
import { test, expect, beforeEach, afterEach, describe } from "vitest";
import { CompressionService } from "@/services/CompressionService.ts";
import { CRCCache } from "@/cache/CRCCache.ts";
import fs from 'fs';
import path from 'path';
import {TestCRCCache} from "@/__test__/mocks.ts";
import { NCDInput } from '@/types/ncd';

// Test fixtures - we'll use these consistently across all algorithm tests
const FASTA_FILES = [
    "bubalis12.fasta",
    "bubalis13.fasta",
    "bubalis14.fasta",
    "bubalis15.fasta",
    "bubalis16.fasta"
];

const GIF_FILES = [
    "ngaonghe.gif",
    "ngaonghe1.gif",
    "ngaonghe2.gif",
    "ngaonghe3.gif"
];

// Helper function to load test data
async function loadTestData(files: string[]): Promise<NCDInput> {
    const input: NCDInput = {
        labels: files,
        contents: []
    };
    
    input.contents = await Promise.all(
      input.labels.map(async (label) => {
          const filePath = path.join(__dirname, "compression_data", label);
          const fileContent = await fs.promises.readFile(filePath, 'utf-8');
          return fileContent.replace(/\n/g, '').toLowerCase();
      })
    );
    
    return input;
}

// Helper function to validate NCD matrix
function validateNcdMatrix(matrix: number[][], length: number) {
    // Check matrix dimensions
    expect(matrix).toHaveLength(length);
    
    for (let r = 0; r < matrix.length; r++) {
        expect(matrix[r]).toHaveLength(length);
        
        for (let c = 0; c < matrix[r].length; c++) {
            // Diagonal should be zero (comparing file with itself)
            if (r === c) {
                expect(matrix[r][c]).toBe(0);
            } else {
                // NCD values should be between 0 and 1
                expect(matrix[r][c]).toBeGreaterThanOrEqual(0);
                expect(matrix[r][c]).toBeLessThanOrEqual(1);
                
                // Matrix should be symmetric
                expect(matrix[r][c]).toBeCloseTo(matrix[c][r]);
            }
        }
    }
}

describe('Compression Worker Tests', () => {
    let compressionService: CompressionService;
    
    beforeEach(() => {
        // Create a fresh instance for each test
        compressionService = CompressionService.getInstance();
    });
    
    afterEach(() => {
        // Properly clean up after each test
        if (compressionService) {
            compressionService.terminate();
        }
    });
    
    test('LZMA worker correctly calculates NCD for FASTA files', async () => {
        // Load the FASTA test data
        const input = await loadTestData(FASTA_FILES);
        
        console.log(`Testing LZMA compression with ${input.labels.length} FASTA files`);
        console.log(`Total content size: ${input.contents.reduce((sum, content) => sum + content.length, 0)} characters`);
        
        // Prepare cache and compression settings
        const crcCache = new CRCCache();
        const [_, cachedSizes] = CompressionService.preprocessNcdInput(input, crcCache);
        
        console.time('lzma-fasta-compression');
        
        try {
            // Process with LZMA algorithm
            const result = await compressionService.processContent({
                ...input,
                cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
                algorithm: "lzma",
            }, (message) => {
                // Log progress updates
                if (message.type === 'progress') {
                    console.log(`LZMA progress: ${JSON.stringify(message)}`);
                }
            });
            
            console.timeEnd('lzma-fasta-compression');
            
            // Validate result structure
            expect(result.type).toBe("result");
            expect(result.labels).toEqual(input.labels);
            
            // Validate NCD matrix properties
            validateNcdMatrix(result.ncdMatrix, input.labels.length);
            
            // Verify new compression data was generated
            expect(result.newCompressionData).toBeDefined();
            expect(Array.isArray(result.newCompressionData)).toBe(true);
            
            // Check that compression data has the expected structure
            if (result.newCompressionData && result.newCompressionData.length > 0) {
                const firstEntry = result.newCompressionData[0];
                expect(firstEntry).toHaveProperty('key1');
                expect(firstEntry).toHaveProperty('key2');
                expect(firstEntry).toHaveProperty('size1');
                expect(firstEntry).toHaveProperty('size2');
                expect(firstEntry).toHaveProperty('combinedSize');
            }
        } finally {
            compressionService.terminate();
            console.log("LZMA worker terminated after FASTA test");
        }
    }, 600000); // 10 minute timeout to ensure adequate time for compression
    
    test('LZMA worker correctly calculates NCD for binary files', async () => {
        // Load the GIF test data
        const input = await loadTestData(GIF_FILES);
        
        console.log(`Testing LZMA compression with ${input.labels.length} GIF files`);
        console.log(`Total content size: ${input.contents.reduce((sum, content) => sum + content.length, 0)} characters`);
        
        // Prepare cache and compression settings
        const crcCache = new CRCCache();
        const [_, cachedSizes] = CompressionService.preprocessNcdInput(input, crcCache);
        
        console.time('lzma-gif-compression');
        
        try {
            // Process with LZMA algorithm
            const result = await compressionService.processContent({
                ...input,
                cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
                algorithm: "lzma",
            }, (message) => {
                // Log progress updates
                if (message.type === 'progress') {
                    console.log(`LZMA progress: ${JSON.stringify(message)}`);
                }
            });
            
            console.timeEnd('lzma-gif-compression');
            
            // Validate result structure
            expect(result.type).toBe("result");
            expect(result.labels).toEqual(input.labels);
            
            // Validate NCD matrix properties
            validateNcdMatrix(result.ncdMatrix, input.labels.length);
        } finally {
            compressionService.terminate();
            console.log("LZMA worker terminated after GIF test");
        }
    }, 600000); // 10 minute timeout
    
    test('ZSTD worker correctly calculates NCD for FASTA files', async () => {
        // Load the FASTA test data
        const input = await loadTestData(FASTA_FILES);
        
        console.log(`Testing ZSTD compression with ${input.labels.length} FASTA files`);
        console.log(`Total content size: ${input.contents.reduce((sum, content) => sum + content.length, 0)} characters`);
        
        // Prepare cache and compression settings
        const crcCache = new CRCCache();
        const [_, cachedSizes] = CompressionService.preprocessNcdInput(input, crcCache);
        
        console.time('zstd-fasta-compression');
        
        try {
            // Process with ZSTD algorithm
            const result = await compressionService.processContent({
                ...input,
                cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
                algorithm: "zstd",
            }, (message) => {
                // Log progress updates
                if (message.type === 'progress') {
                    console.log(`ZSTD progress: ${JSON.stringify(message)}`);
                }
            });
            
            console.timeEnd('zstd-fasta-compression');
            
            // Validate result structure
            expect(result.type).toBe("result");
            expect(result.labels).toEqual(input.labels);
            
            // Validate NCD matrix properties
            validateNcdMatrix(result.ncdMatrix, input.labels.length);
        } finally {
            compressionService.terminate();
            console.log("ZSTD worker terminated after FASTA test");
        }
    }, 600000); // 10 minute timeout
    
    test('ZSTD worker correctly calculates NCD for binary files', async () => {
        // Load the GIF test data
        const input = await loadTestData(GIF_FILES);
        
        console.log(`Testing ZSTD compression with ${input.labels.length} GIF files`);
        console.log(`Total content size: ${input.contents.reduce((sum, content) => sum + content.length, 0)} characters`);
        
        // Prepare cache and compression settings
        const crcCache = new CRCCache();
        const [_, cachedSizes] = CompressionService.preprocessNcdInput(input, crcCache);
        
        console.time('zstd-gif-compression');
        
        try {
            // Process with ZSTD algorithm
            const result = await compressionService.processContent({
                ...input,
                cachedSizes: cachedSizes.size > 0 ? cachedSizes : undefined,
                algorithm: "zstd",
            }, (message) => {
                // Log progress updates
                if (message.type === 'progress') {
                    console.log(`ZSTD progress: ${JSON.stringify(message)}`);
                }
            });
            
            console.timeEnd('zstd-gif-compression');
            
            // Validate result structure
            expect(result.type).toBe("result");
            expect(result.labels).toEqual(input.labels);
            
            // Validate NCD matrix properties
            validateNcdMatrix(result.ncdMatrix, input.labels.length);
        } finally {
            compressionService.terminate();
            console.log("ZSTD worker terminated after GIF test");
        }
    }, 600000); // 10 minute timeout
    
    test('CompressionService properly handles algorithm switching', async () => {
        // First initialize with LZMA
        await compressionService.initialize("lzma");
        expect(compressionService.getCurrentAlgorithm()).toBe("lzma");
        
        // Then switch to ZSTD
        await compressionService.initialize("zstd");
        expect(compressionService.getCurrentAlgorithm()).toBe("zstd");
        
        // Switch back to LZMA
        await compressionService.initialize("lzma");
        expect(compressionService.getCurrentAlgorithm()).toBe("lzma");
    });
    
    test('CompressionService correctly preprocesses NCD input', async () => {
        // Load the FASTA test data - just a couple files for this test
        const input = await loadTestData(FASTA_FILES.slice(0, 2));
        
        // Initialize a new cache
        const crcCache: TestCRCCache = new TestCRCCache();
        
        // Preprocess the input
        const [compressionDecision, cachedSizes] = CompressionService.preprocessNcdInput(input, crcCache);
        
        // Verify the compression decision
        expect(compressionDecision).toHaveProperty('algorithm');
        expect(CompressionService.getAvailableAlgorithms()).toContain(compressionDecision.algorithm);
        expect(compressionDecision).toHaveProperty('reason');
        
        // Check that we get a valid Map for cached sizes
        expect(cachedSizes instanceof Map).toBe(true);
        
        // Initially, there should be no cached values
        expect(cachedSizes.size).toBe(0);
        
        // Process the content
        const result = await compressionService.processContent({
            ...input,
            cachedSizes: cachedSizes,
            algorithm: compressionDecision.algorithm,
        });
        
        // Manually update the cache with compression results
        if (result.newCompressionData) {
            for (const data of result.newCompressionData) {
                if (data.key1 && data.key2) {
                    // Store the combined compression result
                    crcCache.storeCompressedSize(
                      compressionDecision.algorithm,
                      [data.key1, data.key2],
                      data.combinedSize
                    );
                }
                
                // Store individual file compression results if available
                if (data.key1 && data.size1) {
                    crcCache.storeCompressedSize(
                      compressionDecision.algorithm,
                      [data.key1],
                      data.size1
                    );
                }
                
                if (data.key2 && data.size2) {
                    crcCache.storeCompressedSize(
                      compressionDecision.algorithm,
                      [data.key2],
                      data.size2
                    );
                }
            }
        }
        
        // Now run the preprocess again - we should see cached values
        const [_, newCachedSizes] = CompressionService.preprocessNcdInput(input, crcCache);
        
        // There should be some cached values now
        expect(newCachedSizes.size).toBeGreaterThan(0);
    });
    
    test('CompressionService handles worker errors gracefully', async () => {
        // Create an invalid input to trigger an error
        const invalidInput: NCDInput = {
            labels: ['test1', 'test2'],
            contents: [], // Empty contents should cause an error
        };
        
        // Prepare compression settings
        const [compressionDecision, _] = CompressionService.preprocessNcdInput(
          { ...invalidInput, contents: ['a', 'b'] }, // Add dummy contents for preprocess
          new TestCRCCache()
        );
        
        // Process with invalid data - should throw an error
        await expect(compressionService.processContent({
            ...invalidInput,
            cachedSizes: undefined,
            algorithm: compressionDecision.algorithm,
        })).rejects.toThrow();
        
        // Service should still be in a valid state
        expect(compressionService.hasActiveWorker()).toBe(true);
        
        // We should be able to initialize again without issues
        await compressionService.initialize(compressionDecision.algorithm);
        expect(compressionService.hasActiveWorker()).toBe(true);
    });
});
