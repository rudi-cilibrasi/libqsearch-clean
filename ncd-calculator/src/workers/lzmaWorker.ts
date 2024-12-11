export const lzmaWorkerCode = `
importScripts('https://cdn.jsdelivr.net/npm/lzma-wasm@1.0.0/dist/lzma-wasm.js');

// Initialize LZMA with default settings for good compression
let lzma;
self.Module.onRuntimeInitialized = () => {
    lzma = new self.Module.LZMA();
};

// Helper for UTF-8 encoding
function encodeText(text) {
    return new TextEncoder().encode(text);
}

// Compress data using LZMA
async function compressWithLZMA(data) {
    try {
        // Ensure LZMA is initialized
        while (!lzma) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // Convert input to Uint8Array if it isn't already
        const inputArray = data instanceof Uint8Array ? data : encodeText(data);
        
        // Compress with LZMA
        const compressed = lzma.compress(inputArray, 9); // Level 9 = maximum compression
        return compressed.length;
    } catch (error) {
        console.error('LZMA compression error:', error);
        throw error;
    }
}

// Compress a pair of strings
async function compressedSizePair(str1, str2) {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    
    // Use a null byte as delimiter to ensure consistent separation
    const delimiter = new Uint8Array([0]);
    
    // Combine the encoded strings with delimiter
    const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);
    
    return await compressWithLZMA(combinedArray);
}

// Compress a single string
async function compressedSizeSingle(str) {
    const encoded = encodeText(str);
    return await compressWithLZMA(encoded);
}

// Calculate NCD (same as in gzip worker)
function calculateNCD(sizeX, sizeY, sizeXY) {
    if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
        console.error('Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1;
    }
    
    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    const ncd = numerator / denominator;
    
    return Math.min(Math.max(ncd, 0), 1);
}

// Process chunks of the matrix
async function processChunk(startI, endI, n, contents, singleCompressedSizes) {
    const results = [];
    for (let i = startI; i < endI; i++) {
        for (let j = i; j < n; j++) {
            if (i === j) {
                results.push({ i, j, ncd: 0 });
                continue;
            }
            
            try {
                const sizeXY = await compressedSizePair(contents[i], contents[j]);
                const ncd = calculateNCD(
                    singleCompressedSizes[i],
                    singleCompressedSizes[j],
                    sizeXY
                );
                results.push({ i, j, ncd });
            } catch (error) {
                console.error(\`Error processing pair (\${i},\${j}): \${error}\`);
                results.push({ i, j, ncd: 1 });
            }
        }
    }
    return results;
}

// Main worker message handler
self.onmessage = async function (e) {
    try {
        const { labels, contents } = e.data;
        const n = contents.length;
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));

        // Precompute single compressed sizes
        for (let i = 0; i < n; i++) {
            try {
                singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
            } catch (error) {
                console.error(\`Error computing single compressed size for index \${i}: \${error}\`);
                singleCompressedSizes[i] = 0;
            }
        }

        // Process in smaller chunks to manage memory
        const CHUNK_SIZE = 3; // Smaller chunk size for LZMA due to higher memory usage
        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const results = await processChunk(i, endI, n, contents, singleCompressedSizes);
            
            for (const { i, j, ncd } of results) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd;
                self.postMessage({ type: 'progress', i, j, value: ncd });
            }
        }

        self.postMessage({ type: 'result', labels, ncdMatrix });
    } catch (error) {
        self.postMessage({ 
            type: 'error', 
            message: \`LZMA Worker error: \${error.message}\` 
        });
    }
};
`;
