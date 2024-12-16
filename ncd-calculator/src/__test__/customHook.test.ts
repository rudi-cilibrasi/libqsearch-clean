import { renderHook, act } from '@testing-library/react';
import { useStorageState } from '../cache/cache.ts';

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
    });

    it('should initialize with the value from localStorage or initialState', () => {
        localStorageMock.setItem("testKey", "\"storedValue\"");
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));

        expect(result.current[0]).toBe('storedValue');
    });

    it('should initialize with initialState if no localStorage value exists', () => {
        const { result } = renderHook(() => useStorageState('newKey', 'initialValue'));

        expect(result.current[0]).toBe('initialValue');
    });

    it('should not update localStorage on the first render', () => {
        renderHook(() => useStorageState('testKey', 'initialValue'));

        expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should update localStorage when value changes after first render', () => {
        const { result } = renderHook(() => useStorageState('testKey', 'initialValue'));

        act(() => {
            result.current[1]('newValue');
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith("testKey", "\"newValue\"");
    });

    it('should handle multiple renders and updates correctly', () => {
        const { result, rerender } = renderHook(
            ({ key, initialState }) => useStorageState(key, initialState),
            { initialProps: { key: 'testKey', initialState: 'initialValue' } }
        );

        act(() => {
            result.current[1]('updatedValue');
        });

        expect(localStorageMock.setItem).toHaveBeenCalledWith('testKey', "\"updatedValue\"");

        rerender({ key: 'testKey', initialState: 'newInitialValue' });
        expect(result.current[0]).toBe("updatedValue");
    });
});
