#include <stddef.h>
#include "zstd.h"
#include "zstd_internal.h"

size_t ZSTD_getWindowSizeFromParams(int compressionLevel, unsigned long long estimatedSrcSize, unsigned long long dictSize) {
    ZSTD_compressionParameters cParams = ZSTD_getCParams(compressionLevel, estimatedSrcSize, dictSize);
    return (size_t)1 << cParams.windowLog;
}

size_t ZSTD_getMaxWindowSizeForLevel(int compressionLevel) {
    return ZSTD_getWindowSizeFromParams(compressionLevel, ZSTD_CONTENTSIZE_UNKNOWN, 0);
}

unsigned int ZSTD_getWindowLog(int compressionLevel, unsigned long long estimatedSrcSize, unsigned long long dictSize) {
    ZSTD_compressionParameters cParams = ZSTD_getCParams(compressionLevel, estimatedSrcSize, dictSize);
    return cParams.windowLog;
}
