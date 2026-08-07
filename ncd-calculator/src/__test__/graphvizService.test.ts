import {describe, expect, test, vi} from "vitest";
import {createGraphvizLoader} from "../services/GraphvizService";

describe("Graphviz loader", () => {
    test("shares one renderer initialization across concurrent callers", async () => {
        const renderer = {layout: vi.fn()};
        const load = vi.fn().mockResolvedValue(renderer);
        const importModule = vi.fn().mockResolvedValue({Graphviz: {load}});
        const loadGraphviz = createGraphvizLoader(importModule);

        const firstRequest = loadGraphviz();
        const secondRequest = loadGraphviz();

        expect(firstRequest).toBe(secondRequest);
        await expect(firstRequest).resolves.toBe(renderer);
        expect(importModule).toHaveBeenCalledTimes(1);
        expect(load).toHaveBeenCalledTimes(1);
    });

    test("clears a failed initialization so it can be retried", async () => {
        const renderer = {layout: vi.fn()};
        const load = vi.fn()
            .mockRejectedValueOnce(new Error("temporary module failure"))
            .mockResolvedValueOnce(renderer);
        const importModule = vi.fn().mockResolvedValue({Graphviz: {load}});
        const loadGraphviz = createGraphvizLoader(importModule);

        await expect(loadGraphviz()).rejects.toThrow("temporary module failure");
        await expect(loadGraphviz()).resolves.toBe(renderer);

        expect(importModule).toHaveBeenCalledTimes(2);
        expect(load).toHaveBeenCalledTimes(2);
    });
});
