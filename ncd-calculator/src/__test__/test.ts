// Load LZMA library
const loadLZMAScript = async () => {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            console.log(`LZMA Worker: Loading LZMA script (attempt \${retryCount + 1})`);
            importScripts('https://cdn.jsdelivr.net/npm/lzma@2.3.2/src/lzma_worker.js');
            console.log('LZMA Worker: Script loaded successfully');
            return true;
        } catch (error) {
            console.error(`LZMA Worker: Failed to load LZMA script (attempt \${retryCount + 1}):`, error);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    return false;
};

// Initialize LZMA
(async () => {
    if (!await loadLZMAScript()) {
        self.postMessage({ 
            type: 'error', 
            message: 'Failed to load LZMA script after multiple attempts' 
        });
        return;
    }

    // Verify LZMA availability after successful load
    if (typeof LZMA === 'undefined') {
        self.postMessage({ 
            type: 'error', 
            message: 'LZMA object not available after script load' 
        });
        return;
    }

    // Only send ready message once, after successful initialization
    self.postMessage({ type: 'ready', message: 'LZMA Worker initialized successfully' });
})();