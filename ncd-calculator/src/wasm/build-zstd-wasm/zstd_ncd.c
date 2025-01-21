#include <stddef.h>
#include "zstd.h"
#include "zstd_internal.h"

// Get window size for specific compression level and input size
size_t ZSTD_getWindowSize(int compressionLevel, size_t inputSize) {
    ZSTD_compressionParameters params = ZSTD_getCParams(compressionLevel, inputSize, 0);
    return (size_t)1 << params.windowLog;
}

// Custom compress function that returns compression info
size_t ZSTD_compressWithInfo(void* dst, size_t dstCapacity,
                            const void* src, size_t srcSize,
                            int compressionLevel,
                            size_t* windowSize,
                            unsigned int* windowLog) {
    // Get compression parameters based on level and size
    ZSTD_compressionParameters params = ZSTD_getCParams(compressionLevel, srcSize, 0);
    *windowLog = params.windowLog;
    *windowSize = (size_t)1 << params.windowLog;

    // Create context and set parameters
    ZSTD_CCtx* const cctx = ZSTD_createCCtx();
    ZSTD_CCtx_setParameter(cctx, ZSTD_c_compressionLevel, compressionLevel);
    ZSTD_CCtx_setParameter(cctx, ZSTD_c_windowLog, params.windowLog);

    // Perform compression
    size_t const cSize = ZSTD_compress2(cctx, dst, dstCapacity, src, srcSize);

    ZSTD_freeCCtx(cctx);
    return cSize;
}
