import type {EegAsciiEncoding} from "@/types/eeg";
import {EEG_ASCII_SCHEMA} from "@/types/eeg";

export const DEFAULT_EEG_ASCII_ENCODING: EegAsciiEncoding = Object.freeze({
    schemaVersion: EEG_ASCII_SCHEMA,
    quantizationScale: 100,
    integerWidth: 5,
    clipAbsolute: 9999,
    segmentSeparator: "--",
    lineEnding: "LF",
});

const assertEncoding = (encoding: EegAsciiEncoding): void => {
    if (
        encoding.schemaVersion !== EEG_ASCII_SCHEMA
        || !Number.isInteger(encoding.quantizationScale)
        || encoding.quantizationScale <= 0
        || !Number.isInteger(encoding.integerWidth)
        || encoding.integerWidth < 2
        || encoding.integerWidth > 12
        || !Number.isInteger(encoding.clipAbsolute)
        || encoding.clipAbsolute <= 0
        || String(encoding.clipAbsolute).length > encoding.integerWidth
        || encoding.segmentSeparator !== "--"
        || encoding.lineEnding !== "LF"
    ) {
        throw new Error("Invalid deterministic EEG ASCII encoding.");
    }
};

const roundHalfAwayFromZero = (value: number): number => (
    value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5)
);

export const quantizeEegSample = (
    sample: number,
    encoding: EegAsciiEncoding = DEFAULT_EEG_ASCII_ENCODING,
): number => {
    assertEncoding(encoding);
    if (!Number.isFinite(sample)) throw new Error("EEG samples must be finite numbers.");
    const rounded = roundHalfAwayFromZero(sample * encoding.quantizationScale);
    return Math.max(-encoding.clipAbsolute, Math.min(encoding.clipAbsolute, rounded));
};

const formatQuantizedSample = (sample: number, encoding: EegAsciiEncoding): string => {
    const sign = sample < 0 ? "-" : "+";
    return `${sign}${Math.abs(sample).toString(10).padStart(encoding.integerWidth, "0")}`;
};

/**
 * Serializes only signal values and constant segment boundaries. Labels and
 * provenance are intentionally excluded so they cannot leak into NCD.
 */
export const serializeEegSegments = (
    segments: readonly (readonly number[])[],
    encoding: EegAsciiEncoding = DEFAULT_EEG_ASCII_ENCODING,
): string => {
    assertEncoding(encoding);
    if (segments.length === 0) throw new Error("At least one EEG segment is required.");
    const sampleCount = segments[0]?.length ?? 0;
    if (sampleCount === 0 || segments.some(segment => segment.length !== sampleCount)) {
        throw new Error("EEG segments must be non-empty and have equal sample counts.");
    }
    const lines: string[] = [];
    segments.forEach((segment, segmentIndex) => {
        if (segmentIndex > 0) lines.push(encoding.segmentSeparator);
        segment.forEach(sample => lines.push(formatQuantizedSample(quantizeEegSample(sample, encoding), encoding)));
    });
    return `${lines.join("\n")}\n`;
};

export const parseEegSegments = (
    content: string,
    encoding: EegAsciiEncoding = DEFAULT_EEG_ASCII_ENCODING,
): number[][] => {
    assertEncoding(encoding);
    if (!content.endsWith("\n") || content.includes("\r") || /[^\x0A\x2B\x2D\x30-\x39]/u.test(content)) {
        throw new Error("EEG content must use canonical printable ASCII with LF line endings.");
    }
    const samplePattern = new RegExp(`^[+-]\\d{${encoding.integerWidth}}$`, "u");
    const segments: number[][] = [[]];
    for (const line of content.slice(0, -1).split("\n")) {
        if (line === encoding.segmentSeparator) {
            if (segments[segments.length - 1]?.length === 0) throw new Error("EEG segment separators cannot be adjacent.");
            segments.push([]);
            continue;
        }
        if (!samplePattern.test(line)) throw new Error("EEG content contains a non-canonical sample row.");
        const integer = Number.parseInt(line, 10);
        if (Math.abs(integer) > encoding.clipAbsolute) throw new Error("EEG sample exceeds the declared clip limit.");
        segments[segments.length - 1]?.push(integer / encoding.quantizationScale);
    }
    const samplesPerSegment = segments[0]?.length ?? 0;
    if (samplesPerSegment === 0 || segments.some(segment => segment.length !== samplesPerSegment)) {
        throw new Error("EEG content contains unequal or empty segments.");
    }
    return segments;
};
