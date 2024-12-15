import React from "react";

export const UDHR_CACHE = "udhr_cache";

export const initCache = () => {
    initUdhrCacheAndGet();
}



const initUdhrCacheAndGet = (): string | null => {
    const udhrCache = localStorage.getItem(UDHR_CACHE);
    if (!udhrCache || Object.keys(udhrCache).length === 0) {
        localStorage.setItem(UDHR_CACHE, JSON.stringify({}));
    }
    return localStorage.getItem(UDHR_CACHE);
}


export const parseAccessionAndRemoveVersion = (label: string): string | undefined => {
    if (!label || label === '') {
        return undefined;
    }
    if (label.indexOf(".") === -1) return label;
    return label.split(".")[0].trim().toLowerCase();
}


export const cacheTranslation = (lang: string, content: string): void => {
    if (!lang || !content || content.trim() === '') {
        return;
    }
    let udhrCache = JSON.parse(localStorage.getItem(UDHR_CACHE) || '{}');
    if (!udhrCache) {
        udhrCache = JSON.parse(initUdhrCacheAndGet() || '{}');
    }
    udhrCache[lang] = content;
    const cache = JSON.stringify(udhrCache);
    localStorage.setItem(UDHR_CACHE, cache);
}


export const getTranslationCache = (lang: string): any => {
    let cache = JSON.parse(localStorage.getItem(UDHR_CACHE) || '{}');
    if (!cache || Object.keys(cache).length === 0) {
        cache = JSON.parse(initUdhrCacheAndGet() || '{}');
    }
    return cache[lang] || null;
}


/**
 * Combine states both useState and save to localStorage when state is changed
 * @param key to save in localStorage
 * @param initialState default value for the first time
 */
/**
 * A custom hook for managing state that persists in localStorage
 * @template T The type of the state value
 * @param {string} key The localStorage key
 * @param {T} initialState The initial state value
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]} A tuple containing the state value and setter function
 */
export function useStorageState<T>(
    key: string,
    initialState: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const isMounted = React.useRef<boolean>(false);
    const [value, setValue] = React.useState<T>(() => {
        const storedValue = localStorage.getItem(key);
        if (!storedValue || storedValue === "null") {
            // If no stored value, return the initialState as-is
            return initialState;
        }
        try {
            const parsedValue = JSON.parse(storedValue);
            if (Array.isArray(initialState) && !Array.isArray(parsedValue)) {
                return [] as T; // Cast empty array to type T
            }
            if (Array.isArray(initialState)) {
                return Array.isArray(parsedValue) ? parsedValue : [] as T;
            }
            return typeof parsedValue === typeof initialState ? parsedValue : initialState;
        } catch (e) {
            console.error(`Error parsing localStorage key "${key}":`, e);
            return Array.isArray(initialState) ? [] as T : initialState;
        }
    });

    React.useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
        } else {
            try {
                if (value !== null && value !== undefined) {
                    localStorage.setItem(key, JSON.stringify(value));
                } else {
                    localStorage.setItem(key, Array.isArray(initialState) ? '[]' : 'null');
                }
            } catch (e) {
                console.error(`Error saving to localStorage key "${key}":`, e);
            }
        }
    }, [value, key, initialState]);

    return [value, setValue];
}