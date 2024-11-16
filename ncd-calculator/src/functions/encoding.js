export const detectEncoding = (buffer) => {
    // Check for UTF-8 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        return 'utf-8';
    }
    // Check for UTF-16LE BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        return 'utf-16le';
    }
    // Check for UTF-16BE BOM
    if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        return 'utf-16be';
    }

    // Default to UTF-8 if no BOM is detected
    return 'utf-8';
};


export const decodeText = (buffer, encoding) => {
    try {
        return new TextDecoder(encoding).decode(buffer);
    } catch (error) {
        console.error(`Error decoding with ${encoding}:`, error);
        // Fallback to UTF-8
        return new TextDecoder('utf-8').decode(buffer);
    }
};