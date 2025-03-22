#!/bin/bash
set -e

# Configuration
ZSTD_VERSION="1.5.5"
ZSTD_REPO="https://github.com/facebook/zstd.git"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd)"
BUILD_DIR="$SCRIPT_DIR/src/wasm/build-zstd-wasm"
INSTALL_DIR="$SCRIPT_DIR/src/wasm"
CUSTOM_C_FILE="$BUILD_DIR/zstd_ncd.c"

echo "Creating build directory: $BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Create custom C file with NCD-specific functions
echo "Creating custom C file: $CUSTOM_C_FILE"
cat > "$CUSTOM_C_FILE" << 'EOL'
#include <stddef.h>
#include <emscripten.h>
#include "zstd.h"
#include "zstd_internal.h"

// Get window size for specific compression level and input size
EMSCRIPTEN_KEEPALIVE
size_t ZSTD_getWindowSize(int compressionLevel, size_t inputSize) {
    ZSTD_compressionParameters params = ZSTD_getCParams(compressionLevel, inputSize, 0);
    return (size_t)1 << params.windowLog;
}

// Custom compress function that returns compression info
EMSCRIPTEN_KEEPALIVE
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
EOL

# Clone ZSTD if not exists
if [ ! -d "$BUILD_DIR/zstd" ]; then
    echo "Cloning ZSTD repository..."
    git clone --branch "v${ZSTD_VERSION}" --depth 1 "$ZSTD_REPO" "$BUILD_DIR/zstd"
fi

cd "$BUILD_DIR"

echo "Compiling to WASM..."
emcc -O3 -s WASM=1 \
    -s EXPORTED_FUNCTIONS=['_malloc','_free','_ZSTD_compress','_ZSTD_decompress','_ZSTD_compressBound','_ZSTD_compressWithInfo','_ZSTD_maxCLevel','_ZSTD_getWindowSize'] \
    -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue'] \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s MAXIMUM_MEMORY=4GB \
    -s ENVIRONMENT='web,worker' \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -I ./zstd/lib \
    -I ./zstd/lib/common \
    ./zstd/lib/common/*.c \
    ./zstd/lib/compress/*.c \
    ./zstd/lib/decompress/*.c \
    "$CUSTOM_C_FILE" \
    -o "$INSTALL_DIR/zstd.js"

echo "Build complete! Files available in:"
echo "- $INSTALL_DIR/zstd.js"
echo "- $INSTALL_DIR/zstd.wasm"
