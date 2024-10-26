
export const workerCode = `async function compressedSize(blob) {
    const stream = blob.stream();
    const compressionStream = new CompressionStream("gzip");
    const compressedStream = stream.pipeThrough(compressionStream);
    const response = new Response(compressedStream);
    const compressedBlob = await response.blob();
    return compressedBlob.size;
}

async function compressedSizePair(str1, str2) {
    const blob = new Blob([str1, str2]);
    return await compressedSize(blob);
}

async function compressedSizeSingle(str) {
    const blob = new Blob([str]);
    return await compressedSize(blob);
}

function calculateNCD(sizeX, sizeY, sizeXY) {
    return (sizeXY - Math.min(sizeX, sizeY)) / Math.max(sizeX, sizeY);
}

self.onmessage = async function (e) {
    const { labels, contents } = e.data;
    const n = contents.length;
    const singleCompressedSizes = new Array(n);
    const ncdMatrix = Array.from({ length: n }, () => Array(n).fill(0));

    // Step 1: Precompute single compressed sizes
    for (let i = 0; i < n; i++) {
        singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
    }

    // Step 2: Compute pairwise compressed sizes and NCD values
    for (let i = 0; i < n; i++) {
        for (let j = i; j < n; j++) {
            let ncd = 0;
            if (i !== j) {
                const sizeXY = await compressedSizePair(contents[i], contents[j]);
                ncd = calculateNCD(singleCompressedSizes[i], singleCompressedSizes[j], sizeXY);
            }
            ncdMatrix[i][j] = ncd;
            ncdMatrix[j][i] = ncd; // Symmetric matrix

            // Send progress update for the current cell
            self.postMessage({ type: 'progress', i, j, value: ncd });
        }
    }

    // Send the final NCD matrix
    self.postMessage({ type: 'result', labels, ncdMatrix });
};
`;

