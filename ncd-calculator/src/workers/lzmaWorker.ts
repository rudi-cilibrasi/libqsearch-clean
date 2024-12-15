import {lzmaCode} from "@/lib/lzma.ts";

export const lzmaWorkerCode = ` 
// Initial logging and setup
console.log('LZMA Worker: Starting initialization');
${lzmaCode}

// Global error handler
self.onerror = function(error) {
    console.error('LZMA Worker: Global error:', error);
    self.postMessage({ 
        type: 'error', 
        message: 'Global worker error: ' + error.message 
    });
};

// Verify LZMA availability
if (typeof LZMA === 'undefined') {
    throw new Error('LZMA object not available after script load');
}

const crc32Table = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let crc = i;
        for (let j = 0; j < 8; j++) {
            crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[i] = crc >>> 0;
    }
    return table;
})();

function calculateCRC32(data) {
    let crc = 0xFFFFFFFF;
    
    for (let i = 0; i < data.length; i++) {
        crc = (crc >>> 8) ^ crc32Table[(crc ^ data[i]) & 0xFF];
    }
    
    return (~crc >>> 0);
}

// Updated cache key generation
function generateCacheKey(content) {
    const encoded = encodeText(content);
    const crc = calculateCRC32(encoded);
    return \`compression:lzma:\${crc.toString(16).padStart(8, '0')}\`;
}

function getCachedSizes(content1, content2, cachedSizes) {
    if (!cachedSizes) return null;
    
    const key1 = generateCacheKey(content1);
    const key2 = generateCacheKey(content2);
    
    console.log(\`LZMA Worker: Checking cache for keys: \${key1}, \${key2}\`);
    
    const cache1 = cachedSizes.get(key1);
    const cache2 = cachedSizes.get(key2);
    
    if (cache1 && cache2) {
        const combinedSize = cache1.pairSizes.get(key2) || cache2.pairSizes.get(key1);
        if (combinedSize) {
            console.log(\`LZMA Worker: Cache hit for pair \${key1}, \${key2}\`);
            return {
                size1: cache1.individualSize,
                size2: cache2.individualSize,
                combinedSize
            };
        }
    }
    
    console.log(\`LZMA Worker: Cache miss for pair \${key1}, \${key2}\`);
    return null;
}



// Encoding and NCD calculation utilities
function encodeText(text) {
    try {
        return new TextEncoder().encode(text);
    } catch (error) {
        console.error('LZMA Worker: Text encoding error:', error);
        throw new Error('Text encoding failed: ' + error.message);
    }
}

function calculateNCD(sizeX, sizeY, sizeXY) {
    if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
        console.error('Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1;
    }
    
    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    return Math.min(Math.max(numerator / denominator, 0), 1);
}

// Compression functions
async function compressWithLZMA(data) {
    console.log('LZMA Worker: Starting compression of', data.length, 'bytes');
    
    return new Promise((resolve, reject) => {
        if (!LZMA?.compress) {
            reject(new Error('LZMA compression function not available'));
            return;
        }

        const startTime = performance.now();
        
        LZMA.compress(data, 9, (result, error) => {
            if (error) {
                console.error('LZMA Worker: Compression error:', error);
                reject(error);
            } else {
                const duration = performance.now() - startTime;
                console.log(\`LZMA Worker: Compressed \${data.length} bytes to \${result.length} bytes in \${duration.toFixed(2)}ms\`);
                resolve(result.length);
            }
        });
    });
}

async function compressedSizeSingle(str) {
    try {
        console.log('LZMA Worker: Compressing single string of length:', str.length);
        const encoded = encodeText(str);
        return await compressWithLZMA(encoded);
    } catch (error) {
        console.error('LZMA Worker: Single compression error:', error);
        throw error;
    }
}

async function compressedSizePair(str1, str2) {
    try {
        console.log('LZMA Worker: Processing pair - lengths:', str1.length, str2.length);
        
        const encoded1 = encodeText(str1);
        const encoded2 = encodeText(str2);
        const delimiter = encodeText('\\n###\\n');
        
        const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
        combinedArray.set(encoded1, 0);
        combinedArray.set(delimiter, encoded1.length);
        combinedArray.set(encoded2, encoded1.length + delimiter.length);
        
        return await compressWithLZMA(combinedArray);
    } catch (error) {
        console.error('LZMA Worker: Pair compression error:', error);
        throw error;
    }
}

// Process data chunks with cache awareness
async function processChunk(startI, endI, n, contents, singleCompressedSizes, cachedSizes) {
    console.log(\`LZMA Worker: Processing chunk \${startI}-\${endI} of \${n}\`);
    const results = [];
    
    for (let i = startI; i < endI; i++) {
        for (let j = i; j < n; j++) {
            if (i === j) {
                results.push({ i, j, ncd: 0 });
                continue;
            }
            
            try {
                // Check cache first
                const cachedResult = getCachedSizes(contents[i], contents[j], cachedSizes);
                let ncd, combinedSize;
                
                if (cachedResult) {
                    console.log(\`LZMA Worker: Using cached result for pair (\${i},\${j})\`);
                    // Use cached result directly without recompressing
                    ncd = calculateNCD(
                        cachedResult.size1,
                        cachedResult.size2,
                        cachedResult.combinedSize
                    );
                    combinedSize = cachedResult.combinedSize;
                } else {
                    // Only compress if not found in cache
                    console.log(\`LZMA Worker: No cache found, computing pair (\${i},\${j})\`);
                    console.log(\`LZMA Worker: Processing pair - lengths:\`, contents[i].length, contents[j].length);
                    combinedSize = await compressedSizePair(contents[i], contents[j]);
                    ncd = calculateNCD(
                        singleCompressedSizes[i],
                        singleCompressedSizes[j],
                        combinedSize
                    );
                }
                
                console.log(\`LZMA Worker: Pair (\${i},\${j}) NCD = \${ncd}\`);
                results.push({ i, j, ncd, combinedSize });
            } catch (error) {
                console.error(\`LZMA Worker: Error processing pair (\${i},\${j}):\`, error);
                results.push({ i, j, ncd: 1 });
            }
        }
    }
    
    return results;
}

// Main message handler
self.onmessage = async function(e) {
    console.log('LZMA Worker: Received message:', {
        contentLength: e.data.contents?.length,
        labelLength: e.data.labels?.length,
        hasCachedSizes: !!e.data.cachedSizes
    });
    
    try {
        const { labels, contents, cachedSizes } = e.data;
        if (!labels?.length || !contents?.length) {
            throw new Error('Invalid input data');
        }
        
        const n = contents.length;
        console.log(\`LZMA Worker: Processing \${n} items\`);
        
        // Initialize arrays
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));
        const allResults = [];  // To collect all compression results

        // Process individual files with cache awareness
        console.log('LZMA Worker: Computing individual compressed sizes');
        for (let i = 0; i < n; i++) {
            const key = generateCacheKey(contents[i]);
            const cached = cachedSizes?.get(key);
            
            if (cached) {
                console.log(\`LZMA Worker: Using cached size for item \${i}\`);
                singleCompressedSizes[i] = cached.individualSize;
            } else {
                try {
                    const startTime = performance.now();
                    singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
                    const duration = performance.now() - startTime;
                    console.log(\`LZMA Worker: Item \${i + 1}/\${n} compressed in \${duration.toFixed(2)}ms\`);
                } catch (error) {
                    console.error(\`LZMA Worker: Error processing item \${i}:\`, error);
                    singleCompressedSizes[i] = 0;
                }
            }
        }

        // Process chunks
        const CHUNK_SIZE = 3;
        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const startTime = performance.now();
            
            const chunkResults = await processChunk(
                i, endI, n, contents, 
                singleCompressedSizes, 
                cachedSizes
            );
            
            // Add chunk results to allResults
            allResults.push(...chunkResults);
            
            const duration = performance.now() - startTime;
            console.log(\`LZMA Worker: Chunk \${i}-\${endI} processed in \${duration.toFixed(2)}ms\`);
            
            // Update matrix and send progress
            for (const { i, j, ncd, combinedSize } of chunkResults) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd;
                self.postMessage({ type: 'progress', i, j, value: ncd });
            }
        }

        console.log('LZMA Worker: Processing complete, sending results');
        self.postMessage({ 
            type: 'result', 
            labels, 
            ncdMatrix,
            newCompressionData: allResults.map(result => ({
                content1: contents[result.i],
                content2: contents[result.j],
                size1: singleCompressedSizes[result.i],
                size2: singleCompressedSizes[result.j],
                combinedSize: result.combinedSize
            }))
        });
        
    } catch (error) {
        console.error('LZMA Worker: Fatal error:', error);
        self.postMessage({ 
            type: 'error', 
            message: \`LZMA Worker error: \${error.message}\`
        });
    }
};



console.log('LZMA Worker: Sending ready message');
self.postMessage({ type: 'ready', message: 'LZMA Worker initialized successfully' });
`;