import { renderHook, act } from '@testing-library/react';
import { useStorageState } from '../cache/cache';
import { STORAGE_VERSION, STORAGE_VERSION_NAME } from '../cache/LocalStorageKeyManager';

describe('useStorageState', () => {
    const localStorageMock = (() => {
        let store: Record<string, any | null> = {}
        return {
            getItem: jest.fn((key: string) => store[key]),
            setItem: jest.fn((key: string, value: string) => (store[key] = value)),
            clear: jest.fn(() => (store = {})),
        };
    })();

    beforeAll(() => {
        Object.defineProperty(window, 'localStorage', {
            value: localStorageMock,
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
        localStorageMock.clear();
        // Set correct version before each test
        localStorageMock.setItem(STORAGE_VERSION_NAME, STORAGE_VERSION.toString());
    });

    it('should initialize with the value from localStorage when version matches', () => {
        localStorageMock.setItem("testKey", "\"storedValue\"");
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));
        expect(result.current[0]).toBe('storedValue');
    });

    it('should initialize with initialState when version does not match', () => {
        localStorageMock.setItem("testKey", "\"storedValue\"");
        localStorageMock.setItem(STORAGE_VERSION_NAME, (STORAGE_VERSION - 1).toString());
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));
        expect(result.current[0]).toBe('initialValue');
    });

    it('should initialize with initialState if no localStorage value exists', () => {
        const { result } = renderHook(() => useStorageState('newKey', 'initialValue'));
        expect(result.current[0]).toBe('initialValue');
    });

    it('should update localStorage when value changes and version matches', () => {
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));

        act(() => {
            result.current[1]('newValue');
        });

        // Wait for the effect to run
        expect(localStorageMock.setItem).toHaveBeenCalledWith("testKey", "\"newValue\"");
    });

    it('should not update localStorage when version mismatch', () => {
        localStorageMock.setItem(STORAGE_VERSION_NAME, (STORAGE_VERSION - 1).toString());
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));

        act(() => {
            result.current[1]('newValue');
        });

        expect(localStorageMock.setItem).not.toHaveBeenCalledWith("testKey", "\"newValue\"");
    });

    it('should handle multiple renders and updates correctly with matching version', () => {
        const { result, rerender } = renderHook(
            ({ key, initialState }) => useStorageState(key, initialState),
            { initialProps: { key: 'testKey', initialState: 'initialValue' } }
        );

        act(() => {
            result.current[1]('updatedValue');
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', "\"updatedValue\"");

        rerender({ key: 'testKey', initialState: 'newInitialValue' });
        expect(result.current[0]).toBe('updatedValue');
    });

    it('should reset to initialState when storage version changes', () => {
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));

        act(() => {
            // Simulate version change
            window.dispatchEvent(new StorageEvent('storage', {
                key: STORAGE_VERSION_NAME,
                newValue: (STORAGE_VERSION - 1).toString()
            }));
        });

        expect(result.current[0]).toBe('initialValue');
    });
});