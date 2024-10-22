// ncdWorker.js
//
// This web worker computes the Normalized Compression Distance (NCD) matrix for a set of input strings.
// NCD is a similarity metric that estimates how closely related two strings are based on their compressed sizes.
// The worker performs the following tasks:
// 1. Calculates the compressed size of each individual string using Gzip compression.
// 2. Computes the compressed size of each pair of strings combined, building an NCD matrix.
//    - The NCD value between two strings is calculated as: NCD(x, y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y)),
//      where C(x) is the compressed size of string x, and C(xy) is the compressed size of the concatenated strings.
// 3. Sends progress updates for each calculated cell in the NCD matrix.
// 4. After the matrix is fully computed, sends the final NCD matrix along with the associated labels to the main thread.
//
// The worker receives input data as an object with two properties:
// - 'labels': an array of labels for the strings (used for identifying the results).
// - 'contents': an array of string contents to be used in the NCD calculation.
//
// The final output is sent back to the main thread as a message containing:
// - 'type': indicates the type of message ('progress' or 'result').
// - 'labels': the labels corresponding to the input strings (only in the final result).
// - 'ncdMatrix': the computed NCD matrix (only in the final result).
// - 'i', 'j', 'value': indices and NCD value for progress updates.
//
// The worker operates independently from the main UI thread, enabling efficient asynchronous computation
// without blocking the user interface.

// ncdWorker.js

async function compressedSize(blob) {
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
  
    for (let i = 0; i < n; i++) {
      singleCompressedSizes[i] = await compressedSizeSingle(contents[i]);
    }
  
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        let ncd = 0;
        if (i !== j) {
          const sizeXY = await compressedSizePair(contents[i], contents[j]);
          ncd = calculateNCD(singleCompressedSizes[i], singleCompressedSizes[j], sizeXY);
        }
        ncdMatrix[i][j] = ncd;
        ncdMatrix[j][i] = ncd;
  
        self.postMessage({ type: 'progress', i, j, value: ncd });
      }
    }

    self.postMessage({ type: 'result', labels: labels, ncdMatrix: ncdMatrix });
  };
  