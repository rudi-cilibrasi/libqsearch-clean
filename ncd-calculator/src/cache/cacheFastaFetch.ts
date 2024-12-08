export const hasAnyValidSequence = (sequences: any[]): boolean => {
    if (!sequences || sequences.length === 0) return false;
    return !(!sequences[0] || sequences[0].trim() === '');
}

export const cacheHit = (checkedResult: any[]): boolean => {
    return !(!checkedResult || checkedResult.length === 0);
}