import {initSuggestionCache} from "./fastaSuggestionCache.js";

const CACHE_VERSION = 7;
export const CACHE_VERSION_KEY = "cache_version";
export const ACCESSION_CACHE_ID = "accession_cache";
export const UDHR_CACHE = "udhr_cache";
export const SEARCH_TERM_CACHE_ID = "search_cache";
export const FASTA_SUGGESTION_CACHE = "fasta_suggestion_cache";

const clearAllCaches = () => {
    localStorage.removeItem(ACCESSION_CACHE_ID);
    localStorage.removeItem(SEARCH_TERM_CACHE_ID);
    localStorage.removeItem(UDHR_CACHE);
    localStorage.removeItem(FASTA_SUGGESTION_CACHE);
}

const checkAndUpdateVersion = () => {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (!storedVersion || parseInt(storedVersion) < CACHE_VERSION) {
        clearAllCaches();
        localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION.toString());
    }
}

export const getCachedSequenceByAccession = accessionNum => {
    let cache = JSON.parse(localStorage.getItem(ACCESSION_CACHE_ID));
    if (!cache) {
        cache = JSON.parse(initAccessionCacheAndGet());
    }
    return cache[accessionNum.toLowerCase()] || null;
}

export const initCache = () => {
    checkAndUpdateVersion();
    initSearchTermCacheAndGet();
    initAccessionCacheAndGet();
    initUdhrCacheAndGet();
    initSuggestionCache();
}

const initSearchTermCacheAndGet = () => {
    const searchCache = localStorage.getItem(SEARCH_TERM_CACHE_ID);
    if (!searchCache) {
        localStorage.setItem(SEARCH_TERM_CACHE_ID, JSON.stringify({}));
    }
    return localStorage.getItem(SEARCH_TERM_CACHE_ID);
}

const initAccessionCacheAndGet = () => {
    const accessionCache = localStorage.getItem(ACCESSION_CACHE_ID);
    if (!accessionCache || Object.keys(accessionCache).length === 0) {
        localStorage.setItem(ACCESSION_CACHE_ID, JSON.stringify({}));
    }
    return localStorage.getItem(ACCESSION_CACHE_ID);
}


const initUdhrCacheAndGet = () => {
    const udhrCache = localStorage.getItem(UDHR_CACHE);
    if (!udhrCache || Object.keys(udhrCache).length === 0) {
        localStorage.setItem(UDHR_CACHE, JSON.stringify({}));
    }
    return localStorage.getItem(UDHR_CACHE);
}

export const getCachedAccessionBySearchTerm = searchTerm => {
    let cache = JSON.parse(localStorage.getItem(SEARCH_TERM_CACHE_ID));
    if (!cache || Object.keys(cache).length === 0) {
        cache = JSON.parse(initSearchTermCacheAndGet());
    }
    return cache[searchTerm] || null;
}

export const cacheAccessionSequence = (accession, sequence) => {
    accession = parseAccessionAndRemoveVersion(accession);
    let accessionCache = JSON.parse(localStorage.getItem(ACCESSION_CACHE_ID));
    if (!accessionCache) {
        accessionCache = JSON.parse(initAccessionCacheAndGet());
    }
    accessionCache[accession] = sequence;
    const str = JSON.stringify(accessionCache);
    localStorage.setItem(ACCESSION_CACHE_ID, str);
}

export const cacheAccession = (parsedFastaList) => {
    let {contents, accessions} = parsedFastaList;
    accessions = filterValidAccessionAndParse(accessions);
    for (let i = 0; i < accessions.length; i++) {
        cacheAccessionSequence(accessions[i], contents[i]);
    }
}

export const cacheSearchTermAccessions = (searchTerm, {accessions, labels, commonNames, scientificNames}) => {
    const term = searchTerm.trim().toLowerCase();
    const cache = localStorage.getItem(SEARCH_TERM_CACHE_ID);
    const searchTermCache = JSON.parse(cache);
    const val = [];
    for (let i = 0; i < accessions.length; i++) {
        val.push({
            "label": labels[i],
            "accession": accessions[i],
            "scientificName": scientificNames[i],
            "commonName": commonNames[i]
        })
    }
    if (!searchTermCache || Object.keys(searchTermCache).length === 0) {
        searchTermCache[term] = val;
    } else {
        const c = searchTermCache[term];
        if (!c) {
            searchTermCache[term] = val;
        } else {
            searchTermCache[term] = merge(c, val);
        }
    }
    const str = JSON.stringify(searchTermCache);
    localStorage.setItem(SEARCH_TERM_CACHE_ID, str);
}

const merge = (existingArr, newArr) => {
    let res = existingArr;
    for (let i = 0; i < newArr.length; i++) {
        const exist = res.find(e => e.accession === newArr[i].accession);
        const item = newArr[i];
        if (!exist) {
            res.push(item);
        } else {
            for (let j = 0; j < res.length; j++) {
                if (res[j].accession === item.accession) {
                    res[j] = item;
                    break;
                }
            }
        }
    }
    return res;
}

export const filterValidAccessionAndParse = (accessions) => {
    return accessions.filter(accession => accession != null && accession !== '').map(accession => parseAccessionAndRemoveVersion(accession));
}

export const parseAccessionAndRemoveVersion = label => {
    if (!label || label === '') {
        return null;
    }
    if (label.indexOf(".") === -1) return label;
    return label.split(".")[0].trim().toLowerCase();
}



export const cacheTranslation = (lang, content) => {
    if (!lang || !content || content.trim() === '') {
        return;
    }
    let udhrCache = JSON.parse(localStorage.getItem(UDHR_CACHE));
    if (!udhrCache) {
        udhrCache = JSON.parse(initUdhrCacheAndGet());
    }
    udhrCache[lang] = content;
    const cache = JSON.stringify(udhrCache);
    localStorage.setItem(UDHR_CACHE, cache);
}


export const getTranslationCache = (lang) => {
    let cache = JSON.parse(localStorage.getItem(UDHR_CACHE));
    if (!cache || Object.keys(cache).length === 0) {
        cache = JSON.parse(initUdhrCacheAndGet());
    }
    return cache[lang] || null;
}

