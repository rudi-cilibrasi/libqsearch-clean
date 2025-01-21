Module['onRuntimeInitialized'] = function() {
    // Core ZSTD functions
    Module.compress = Module.cwrap('ZSTD_compress', 'number',
        ['number', 'number', 'number', 'number', 'number']);

    Module.decompress = Module.cwrap('ZSTD_decompress', 'number',
        ['number', 'number', 'number', 'number']);

    // Window size functions
    Module.getWindowSizeFromParams = Module.cwrap('ZSTD_getWindowSizeFromParams', 'number',
        ['number', 'number', 'number']);

    Module.getMaxWindowSizeForLevel = Module.cwrap('ZSTD_getMaxWindowSizeForLevel', 'number',
        ['number']);

    Module.getWindowLog = Module.cwrap('ZSTD_getWindowLog', 'number',
        ['number', 'number', 'number']);

    // Helper function for compression with window size info
    Module.compressWithMetadata = function(data, level = 3) {
        const inSize = data.length;
        const maxSize = Module._ZSTD_compressBound(inSize);

        const inPtr = Module._malloc(inSize);
        const outPtr = Module._malloc(maxSize);

        Module.HEAPU8.set(data, inPtr);

        const compressedSize = Module.compress(outPtr, maxSize, inPtr, inSize, level);
        const windowSize = Module.getWindowSizeFromParams(level, inSize, 0);
        const windowLog = Module.getWindowLog(level, inSize, 0);

        const result = new Uint8Array(Module.HEAPU8.buffer, outPtr, compressedSize);
        const copied = new Uint8Array(result);

        Module._free(inPtr);
        Module._free(outPtr);

        return {
            data: copied,
            size: compressedSize,
            windowSize: windowSize,
            windowLog: windowLog,
            compressionLevel: level
        };
    };

    if (Module.postRun) Module.postRun();
};
