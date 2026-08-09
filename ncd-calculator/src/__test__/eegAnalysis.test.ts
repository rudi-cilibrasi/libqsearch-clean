import {describe, expect, test} from "vitest";
import {correlationDistance, dtwDistance, euclideanDistance, evaluateNearestNeighbor} from "../services/eegAnalysis";
import type {EegObjectRecord} from "../types/eeg";

const record = (condition: "target" | "standard", index: number): EegObjectRecord => ({
    id: `${condition}-${index}`, label: `Object ${index}`, revealedLabel: `${condition} ${index}`,
    mode: "condition", condition, replicate: index,
    electrode: {name: "Pz", x: 0, y: -0.4, coordinateSource: "test"},
    sampleCount: 8, samplesPerSegment: 8, segmentCount: 1, sha256: "a".repeat(64), utf8Bytes: 56,
    qc: {candidateEpochs: 4, acceptedEpochs: 4, rejectedEpochs: 0, minimum: -1, maximum: 1, rms: 1, peakToPeak: 2, preview: [0, 1, 0, -1, 0, 1, 0, -1]},
});

describe("EEG label-reveal evaluation", () => {
    test("reports a perfectly separated nearest-neighbor scenario", () => {
        const records = [record("target", 1), record("target", 2), record("standard", 3), record("standard", 4)];
        const matrix = [[0, .1, .9, .8], [.1, 0, .8, .9], [.9, .8, 0, .1], [.8, .9, .1, 0]];
        expect(evaluateNearestNeighbor("NCD", matrix, records)).toMatchObject({accuracy: 1, balancedAccuracy: 1, macroF1: 1});
    });

    test("makes deterministic ties visible as a weak evaluation scenario", () => {
        const records = [record("target", 1), record("target", 2), record("standard", 3), record("standard", 4)];
        const matrix = records.map((_row, row) => records.map((_column, column) => row === column ? 0 : 1));
        const result = evaluateNearestNeighbor("NCD", matrix, records);
        expect(result.accuracy).toBe(.5);
        expect(result.balancedAccuracy).toBe(.5);
    });

    test("provides conventional waveform distances", () => {
        expect(euclideanDistance([0, 1], [0, 1])).toBe(0);
        expect(correlationDistance([0, 1, 0], [0, 2, 0])).toBeCloseTo(0);
        expect(correlationDistance([0, 1, 0], [0, -1, 0])).toBeCloseTo(2);
        expect(dtwDistance([0, 1, 0], [0, 1, 0])).toBe(0);
    });

    test("rejects malformed matrices instead of reporting a metric", () => {
        expect(() => evaluateNearestNeighbor("NCD", [[0]], [record("target", 1), record("standard", 2)])).toThrow("shape");
    });
});
