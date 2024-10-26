const ACCESSION_CACHE_ID = "accession_cache";
const SEARCH_TERM_CACHE_ID = "search_cache";

export const getCachedDataByAccession = accessionNum => {
    let cache = JSON.parse(localStorage.getItem(ACCESSION_CACHE_ID));
    if (!cache) {
        cache = JSON.parse(initAccessionCacheAndGet());
    }
    return cache[accessionNum] || null;
}


export const initCache = () => {
   initSearchTermCacheAndGet();
   initAccessionCacheAndGet();
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

export const getCachedDataBySearchTerm = searchTerm => {
    let cache = JSON.parse(localStorage.getItem(SEARCH_TERM_CACHE_ID));
    if (!cache || Object.keys(cache).length === 0) {
        cache = JSON.parse(initSearchTermCacheAndGet());
    }
    return cache[searchTerm] || null;
}


export const cacheAccessionSequence = async (accession, sequence) => {
    accession = parseAccessionNumber(accession);
    const accessionCache = JSON.parse(localStorage.getItem(ACCESSION_CACHE_ID));
    accessionCache[accession] = sequence;
    const str = JSON.stringify(accessionCache);
    localStorage.setItem(ACCESSION_CACHE_ID, str);
}


export const cacheAccession = async (parsedFastaList) => {
    const { labels, contents } = parsedFastaList;
    let accessions = labels.map(parseAccessionNumber);
    accessions = filterEmptyAccessions(accessions);
    for(let i = 0; i < accessions.length; i++) {
        await cacheAccessionSequence(accessions[i], contents[i]);
    }
}

export const cacheSearchTermAccessions = (searchTerm, accessions) => {
    accessions = filterEmptyAccessions(accessions).map(parseAccessionNumber);
    const term = searchTerm.trim().toLowerCase();
    const cache = localStorage.getItem(SEARCH_TERM_CACHE_ID);
    const searchTermCache = JSON.parse(cache);
    if (!searchTermCache || Object.keys(searchTermCache).length === 0) {
       searchTermCache[searchTerm] = accessions;
    } else {
        const c = searchTermCache[term];
        if (!c) {
            searchTermCache[term] = Array.from(new Set([...accessions]));
        } else {
            searchTermCache[term] = Array.from(new Set([...c, ...accessions]));
        }
    }
    const str = JSON.stringify(searchTermCache);
    localStorage.setItem(SEARCH_TERM_CACHE_ID, str);

}
const filterEmptyAccessions = (accessions) => {
    return accessions.filter(accession => accession != null && accession !== '').map(accession => parseAccessionNumber(accession));
}

export const parseAccessionNumber = label => {
    if (!label || label === '') {
        return null;
    }
    return label.split(".")[0].trim().toLowerCase();
}
