export const workerCode = `
// Initial logging
console.log('GZIP Worker: Starting initialization');

// Helper to ensure consistent UTF-8 encoding
function encodeText(text) {
    return new TextEncoder().encode(text);
}

async function compressedSize(data) {
    const stream = new Blob([data]).stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = stream.pipeThrough(compressionStream);
    const response = new Response(compressedStream);
    const compressedBlob = await response.blob();
    return compressedBlob.size;
}

async function compressedSizePair(str1, str2) {
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    
    const delimiter = encodeText('\\n###\\n');
    const combinedArray = new Uint8Array(encoded1.length + delimiter.length + encoded2.length);
    combinedArray.set(encoded1, 0);
    combinedArray.set(delimiter, encoded1.length);
    combinedArray.set(encoded2, encoded1.length + delimiter.length);
    
    return await compressedSize(combinedArray);
}

async function compressedSizeSingle(str) {
    const encoded = encodeText(str);
    return await compressedSize(encoded);
}

function calculateNCD(sizeX, sizeY, sizeXY) {
    console.log(\`GZIP Worker: Calculating NCD - size X: \${sizeX} size Y: \${sizeY} size XY: \${sizeXY}\`);
    
    if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
        console.error('GZIP Worker: Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1;
    }
    
    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    const ncd = numerator / denominator;
    
    if (ncd < 0 || ncd > 1) {
        console.warn('GZIP Worker: NCD outside valid range:', ncd, { sizeX, sizeY, sizeXY });
        return Math.min(Math.max(ncd, 0), 1);
    }
    
    return ncd;
}

async function processChunk(startI, endI, n, contents, singleCompressedSizes) {
    console.log(\`GZIP Worker: Processing chunk \${startI}-\${endI} of \${n}\`);
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
                
                // Enhanced progress message with size information
                self.postMessage({
                    type: 'progress',
                    i,
                    j,
                    value: ncd,
                    sizeX: singleCompressedSizes[i],
                    sizeY: singleCompressedSizes[j],
                    sizeXY,
                });
                
                results.push({ i, j, ncd });
                console.log(\`GZIP Worker: Processed pair (\${i},\${j}) with NCD = \${ncd}\`);
            } catch (error) {
                console.error(\`GZIP Worker: Error processing pair (\${i},\${j}): \${error}\`);
                results.push({ i, j, ncd: 1 });
            }
        }
    }
    return results;
}

self.onmessage = async function (e) {
    console.log('GZIP Worker: Received message:', e.data);
    
    try {
        const { labels, contents } = e.data;
        if (!labels || !contents || labels.length === 0 || contents.length === 0) {
            throw new Error('Invalid input data');
        }
        
        const n = contents.length;
        console.log(\`GZIP Worker: Processing \${n} items\`);
        
        // Send initial start message with total size information
        self.postMessage({
            type: 'start',
            totalItems: n,
            totalPairs: (n * (n - 1)) / 2,
            contents: contents // For total size calculation
        });
        
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));

        // Precompute individual compressed sizes
        console.log('GZIP Worker: Computing individual compressed sizes');
        for (let i = 0; i < n; i++) {
            try {
                singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
                console.log(\`GZIP Worker: Computed size for item \${i}: \${singleCompressedSizes[i]}\`);
            } catch (error) {
                console.error(\`GZIP Worker: Error computing single compressed size for index \${i}: \${error}\`);
                singleCompressedSizes[i] = 0;
            }
        }

        // Process in chunks
        const CHUNK_SIZE = 5;
        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const results = await processChunk(i, endI, n, contents, singleCompressedSizes);
            
            for (const { i, j, ncd } of results) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd;
            }
        }

        console.log('GZIP Worker: Processing complete, sending results');
        self.postMessage({ 
            type: 'result', 
            labels, 
            ncdMatrix,
            totalProcessed: (n * (n - 1)) / 2
        });
    } catch (error) {
        console.error('GZIP Worker: Fatal error:', error);
        self.postMessage({ 
            type: 'error', 
            message: \`GZIP Worker error: \${error.message}\`
        });
    }
};

// Send ready message
console.log('GZIP Worker: Sending ready message');
self.postMessage({ type: 'ready', message: 'GZIP Worker initialized successfully' });
`;