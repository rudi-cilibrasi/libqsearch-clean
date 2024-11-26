import {FASTA_SUGGESTION_CACHE} from "./cache.js";

export const cacheSuggestions = (searchTerm, suggestions) => {
    let suggestionCache = JSON.parse(localStorage.getItem(FASTA_SUGGESTION_CACHE));
    if (!suggestionCache) {
        suggestionCache = JSON.parse(initSuggestionCache());
    }
    suggestionCache[searchTerm] = suggestions;
    const str = JSON.stringify(suggestionCache);
    localStorage.setItem(FASTA_SUGGESTION_CACHE, str);
}


export const getCachedFastaSuggestions = (searchTerm) => {
    if (!searchTerm) {
        return;
    }
    try {
        let suggestionCache = JSON.parse(localStorage.getItem(FASTA_SUGGESTION_CACHE));
        if (!suggestionCache) {
            suggestionCache = JSON.parse(initSuggestionCache());
        }
        return suggestionCache[searchTerm] || null;
    } catch (error) {
        return null;
    }
}


export const initSuggestionCache = () => {
    const suggestionCache = localStorage.getItem(FASTA_SUGGESTION_CACHE);
    if (!suggestionCache || Object.keys(suggestionCache).length === 0) {
        localStorage.setItem(FASTA_SUGGESTION_CACHE, JSON.stringify({}));
    }
    return localStorage.getItem(FASTA_SUGGESTION_CACHE);
}

