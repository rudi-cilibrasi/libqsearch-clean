import {describe, expect, test} from "vitest";
import {normalizeBaseUrl} from "../configs/site";

describe("site base URL", () => {
    test.each([
        ["/", "/"],
        ["./", "/"],
        ["/ncd", "/ncd/"],
        ["/ncd/", "/ncd/"],
        ["https://namvdo.github.io/ncd/", "/ncd/"],
    ])("normalizes %s for routing and navigation", (input, expected) => {
        expect(normalizeBaseUrl(input)).toBe(expected);
    });
});
