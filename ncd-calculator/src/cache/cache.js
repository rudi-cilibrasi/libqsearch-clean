import React from "react";

export const UDHR_CACHE = "udhr_cache";

const clearAllCaches = () => {
    localStorage.removeItem(ACCESSION_CACHE_ID);
    localStorage.removeItem(SEARCH_TERM_CACHE_ID);
    localStorage.removeItem(UDHR_CACHE);
    localStorage.removeItem(FASTA_SUGGESTION_CACHE);
}



export const initCache = () => {
    initUdhrCacheAndGet();
}



const initUdhrCacheAndGet = () => {
    const udhrCache = localStorage.getItem(UDHR_CACHE);
    if (!udhrCache || Object.keys(udhrCache).length === 0) {
        localStorage.setItem(UDHR_CACHE, JSON.stringify({}));
    }
    return localStorage.getItem(UDHR_CACHE);
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

/**
 * Combine states both useState and save to localStorage when state is changed
 * @param key to save in localStorage
 * @param initialState default value for the first time
 */
export const useStorageState = (key, initialState) => {
    const isMounted = React.useRef(false);

    const [value, setValue] = React.useState(() => {
        const storedValue = localStorage.getItem(key);
        if (!storedValue || storedValue === "null") {
            return initialState;
        }
        try {
            return JSON.parse(storedValue);
        } catch (e) {
            console.error(`Error parsing localStorage key "${key}":`, e);
        }
        return initialState;
    });

    React.useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true; // Skip the first render
        } else {
            try {
                if (value) {
                    localStorage.setItem(key, JSON.stringify(value));
                } else {
                    localStorage.setItem(key, null);
                }
            } catch (e) {
                console.error(`Error saving to localStorage key "${key}":`, e);
            }
        }
    }, [value, key]);
    return [value, setValue];
};