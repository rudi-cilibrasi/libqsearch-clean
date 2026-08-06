import React from "react";
import {STORAGE_VERSION, STORAGE_VERSION_NAME} from "@/cache/LocalStorageKeyManager.ts";

export const parseAccessionAndRemoveVersion = (label: string): string | undefined => {
    if (!label || label === '') {
        return undefined;
    }
    if (label.indexOf(".") === -1) return label;
    return label.split(".")[0].trim().toLowerCase();
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
    const [value, setValue] = React.useState<T>(() => {
        // Check version first
        const storedVersion = localStorage.getItem(STORAGE_VERSION_NAME);

        // If version mismatch, return initial state
        if (!storedVersion || storedVersion !== STORAGE_VERSION.toString()) {
            return initialState;
        }

        const storedValue = localStorage.getItem(key);
        if (!storedValue || storedValue === "null") {
            return initialState;
        }
        try {
            const parsedValue = JSON.parse(storedValue);
            return Array.isArray(initialState)
                ? (Array.isArray(parsedValue) ? parsedValue : [] as T)
                : (typeof parsedValue === typeof initialState ? parsedValue : initialState);
        } catch (e) {
            console.error(`Error parsing localStorage key "${key}":`, e);
            return initialState;
        }
    });

    React.useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_VERSION_NAME) {
                setValue(initialState);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [initialState]);

    React.useEffect(() => {
        const currentVersion = localStorage.getItem(STORAGE_VERSION_NAME);
        // Only save if version matches
        if (currentVersion === STORAGE_VERSION.toString()) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error(`Error saving to localStorage key "${key}":`, e);
            }
        }
    }, [value, key]);

    return [value, setValue];
}
