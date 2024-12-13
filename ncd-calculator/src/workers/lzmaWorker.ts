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
// Initialize LZMA

// Verify LZMA availability
if (typeof LZMA === 'undefined') {
    throw new Error('LZMA object not available after script load');
}

// Utility functions
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
    const ncd = numerator / denominator;
    
    // Clamp value between 0 and 1
    return Math.min(Math.max(ncd, 0), 1);
}

// Compression functions
async function compressWithLZMA(data) {
    console.log('LZMA Worker: Starting compression of', data.length, 'bytes');
    
    return new Promise((resolve, reject) => {
        if (!LZMA || typeof LZMA.compress !== 'function') {
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
        
        console.log('LZMA Worker: Combined array size:', combinedArray.length);
        return await compressWithLZMA(combinedArray);
    } catch (error) {
        console.error('LZMA Worker: Pair compression error:', error);
        throw error;
    }
}

async function processChunk(startI, endI, n, contents, singleCompressedSizes) {
    console.log(\`LZMA Worker: Processing chunk \${startI}-\${endI} of \${n}\`);
    const results = [];
    
    for (let i = startI; i < endI; i++) {
        for (let j = i; j < n; j++) {
            if (i === j) {
                results.push({ i, j, ncd: 0 });
                continue;
            }
            
            try {
                console.log(\`LZMA Worker: Processing pair (\${i},\${j})\`);
                const sizeXY = await compressedSizePair(contents[i], contents[j]);
                const ncd = calculateNCD(
                    singleCompressedSizes[i],
                    singleCompressedSizes[j],
                    sizeXY
                );
                console.log(\`LZMA Worker: Pair (\${i},\${j}) NCD = \${ncd}\`);
                results.push({ i, j, ncd });
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
        type: e.data.type,
        contentLength: e.data.contents?.length,
        labelLength: e.data.labels?.length
    });
    
    try {
        const { labels, contents } = e.data;
        if (!labels || !contents || labels.length === 0 || contents.length === 0) {
            throw new Error('Invalid input data');
        }
        
        const n = contents.length;
        console.log(\`LZMA Worker: Starting processing of \${n} items\`);
        
        // Initialize arrays
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));

        // Process individual files
        console.log('LZMA Worker: Computing individual compressed sizes');
        for (let i = 0; i < n; i++) {
            try {
                const startTime = performance.now();
                singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
                const duration = performance.now() - startTime;
                console.log(\`LZMA Worker: Item \${i+1}/\${n} compressed in \${duration.toFixed(2)}ms\`);
            } catch (error) {
                console.error(\`LZMA Worker: Error processing item \${i}:\`, error);
                singleCompressedSizes[i] = 0;
            }
        }

        // Process chunks
        const CHUNK_SIZE = 3; // Smaller chunks for better progress updates
        console.log(\`LZMA Worker: Processing in chunks of \${CHUNK_SIZE}\`);
        
        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const startTime = performance.now();
            
            const results = await processChunk(i, endI, n, contents, singleCompressedSizes);
            
            const duration = performance.now() - startTime;
            console.log(\`LZMA Worker: Chunk \${i}-\${endI} processed in \${duration.toFixed(2)}ms\`);
            
            // Update matrix and send progress
            for (const { i, j, ncd } of results) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd;
                self.postMessage({ type: 'progress', i, j, value: ncd });
            }
        }

        console.log('LZMA Worker: Processing complete, sending results');
        self.postMessage({ type: 'result', labels, ncdMatrix });
        
    } catch (error) {
        console.error('LZMA Worker: Fatal error:', error);
        self.postMessage({ 
            type: 'error', 
            message: \`LZMA Worker error: \${error.message}\`
        });
    }
console.log('LZMA Worker: Sending ready message');
self.postMessage({ type: 'ready', message: 'LZMA Worker initialized successfully' });
};
`