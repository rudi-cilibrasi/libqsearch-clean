export const workerCode = `
// Initial logging
console.log('GZIP Worker: Starting initialization');

// Helper to ensure consistent UTF-8 encoding
function encodeText(text) {
    return new TextEncoder().encode(text);
}

async function compressedSize(data) {
    // Ensure we're working with Uint8Array for consistent compression
    const stream = new Blob([data]).stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = stream.pipeThrough(compressionStream);
    const response = new Response(compressedStream);
    const compressedBlob = await response.blob();
    return compressedBlob.size;
}

async function compressedSizePair(str1, str2) {
    // Encode both strings as UTF-8
    const encoded1 = encodeText(str1);
    const encoded2 = encodeText(str2);
    
    // Create a combined buffer with a delimiter
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
    // Add logging for debugging
    console.log(\`GZIP Worker: Calculating NCD - size X: \${sizeX} size Y: \${sizeY} size XY: \${sizeXY}\`);
    
    // Validate inputs
    if (sizeX <= 0 || sizeY <= 0 || sizeXY <= 0) {
        console.error('GZIP Worker: Invalid compressed sizes:', { sizeX, sizeY, sizeXY });
        return 1; // Return maximum distance for invalid inputs
    }
    
    // Calculate NCD with additional checks
    const numerator = sizeXY - Math.min(sizeX, sizeY);
    const denominator = Math.max(sizeX, sizeY);
    const ncd = numerator / denominator;
    
    // Validate result
    if (ncd < 0 || ncd > 1) {
        console.warn('GZIP Worker: NCD outside valid range:', ncd, { sizeX, sizeY, sizeXY });
        return Math.min(Math.max(ncd, 0), 1); // Clamp to [0,1]
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
                results.push({ i, j, ncd });
                console.log(\`GZIP Worker: Processed pair (\${i},\${j}) with NCD = \${ncd}\`);
            } catch (error) {
                console.error(\`GZIP Worker: Error processing pair (\${i},\${j}): \${error}\`);
                results.push({ i, j, ncd: 1 }); // Use maximum distance for errors
            }
        }
    }
    return results;
}

// Main message handler
self.onmessage = async function (e) {
    console.log('GZIP Worker: Received message:', e.data);
    
    try {
        const { labels, contents } = e.data;
        if (!labels || !contents || labels.length === 0 || contents.length === 0) {
            throw new Error('Invalid input data');
        }
        
        const n = contents.length;
        console.log(\`GZIP Worker: Processing \${n} items\`);
        
        const singleCompressedSizes = new Array(n);
        const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));

        // Step 1: Precompute single compressed sizes
        console.log('GZIP Worker: Computing individual compressed sizes');
        for (let i = 0; i < n; i++) {
            try {
                singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
                console.log(\`GZIP Worker: Computed size for item \${i}: \${singleCompressedSizes[i]}\`);
            } catch (error) {
                console.error(\`GZIP Worker: Error computing single compressed size for index \${i}: \${error}\`);
                singleCompressedSizes[i] = 0; // Use 0 to indicate error
            }
        }

        // Step 2: Process in chunks to avoid memory issues
        console.log('GZIP Worker: Starting chunk processing');
        const CHUNK_SIZE = 5; // Adjust based on your needs
        for (let i = 0; i < n; i += CHUNK_SIZE) {
            const endI = Math.min(i + CHUNK_SIZE, n);
            const results = await processChunk(i, endI, n, contents, singleCompressedSizes);
            
            // Update matrix with chunk results
            for (const { i, j, ncd } of results) {
                ncdMatrix[i][j] = ncd;
                ncdMatrix[j][i] = ncd; // Symmetric matrix
                self.postMessage({ type: 'progress', i, j, value: ncd });
            }
        }

        console.log('GZIP Worker: Processing complete, sending results');
        // Send the final NCD matrix
        self.postMessage({ type: 'result', labels, ncdMatrix });
    } catch (error) {
        console.error('GZIP Worker: Fatal error:', error);
        self.postMessage({ 
            type: 'error', 
            message: \`GZIP Worker error: \${error.message}\`
        });
    }
};

// Send ready message immediately after initialization
console.log('GZIP Worker: Sending ready message');
self.postMessage({ type: 'ready', message: 'GZIP Worker initialized successfully' });
`;