import {describe, expect, test} from "vitest";
import {
    DEFAULT_EEG_ASCII_ENCODING,
    parseEegSegments,
    quantizeEegSample,
    serializeEegSegments,
} from "../services/eegSerializer";

describe("deterministic EEG ASCII serialization", () => {
    test("uses fixed-width signed rows, LF boundaries, and symmetric rounding", () => {
        expect(serializeEegSegments([[0, 0.005, -0.005], [1.234, -100, 0]])).toBe(
            "+00000\n+00001\n-00001\n--\n+00123\n-09999\n+00000\n",
        );
        expect(quantizeEegSample(0.005)).toBe(1);
        expect(quantizeEegSample(-0.005)).toBe(-1);
    });

    test("round-trips canonical content", () => {
        const serialized = serializeEegSegments([[0.1, -0.2], [0.3, -0.4]]);
        expect(parseEegSegments(serialized)).toEqual([[0.1, -0.2], [0.3, -0.4]]);
    });

    test("fails fast for non-finite, ragged, or non-canonical input", () => {
        expect(() => serializeEegSegments([[Number.NaN]])).toThrow("finite");
        expect(() => serializeEegSegments([[1], [1, 2]])).toThrow("equal sample counts");
        expect(() => parseEegSegments("+00001\r\n")).toThrow("canonical printable ASCII");
        expect(() => parseEegSegments("+00001\n--\n")).toThrow("unequal or empty");
        expect(DEFAULT_EEG_ASCII_ENCODING.schemaVersion).toBe("complearn-eeg-ascii-v1");
    });
});
