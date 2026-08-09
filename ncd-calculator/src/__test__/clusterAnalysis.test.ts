import {describe, expect, test} from "vitest";
import {buildClusterAnalysis} from "@/services/ClusterAnalysis";

const STRONG_MATRIX = [
    [0, 0.10, 0.90, 0.88],
    [0.10, 0, 0.85, 0.90],
    [0.90, 0.85, 0, 0.12],
    [0.88, 0.90, 0.12, 0],
];

const UNIFORM_MATRIX = [
    [0, 0.5, 0.5, 0.5],
    [0.5, 0, 0.5, 0.5],
    [0.5, 0.5, 0, 0.5],
    [0.5, 0.5, 0.5, 0],
];

const THREE_GROUP_MATRIX = [
    [0, 0.08, 0.82, 0.84, 0.88, 0.86],
    [0.08, 0, 0.80, 0.83, 0.87, 0.89],
    [0.82, 0.80, 0, 0.10, 0.81, 0.85],
    [0.84, 0.83, 0.10, 0, 0.84, 0.82],
    [0.88, 0.87, 0.81, 0.84, 0, 0.09],
    [0.86, 0.89, 0.85, 0.82, 0.09, 0],
];

const analyze = (matrix = STRONG_MATRIX, clusterCount?: number) => buildClusterAnalysis({
    objectIds: ["a", "b", "c", "d"],
    displayLabels: ["Alpha", "Beta", "Gamma", "Delta"],
    ncdMatrix: matrix,
    clusterCount,
});

const semanticGroups = (groups: readonly {memberIds: readonly string[]}[]): string[] => (
    groups.map(({memberIds}) => [...memberIds].sort().join("+")).sort()
);

describe("explainable cluster analysis", () => {
    test("recovers two strongly separated pairs and ranks direct evidence", () => {
        const result = analyze();

        expect(result.suggestedClusterCount).toBe(2);
        expect(result.selectedClusterCount).toBe(2);
        expect(result.separation).toBe("strong");
        expect(result.silhouette).toBeGreaterThan(0.8);
        expect(semanticGroups(result.groups)).toEqual(["a+b", "c+d"]);
        expect(result.closestPairs[0]).toMatchObject({
            firstId: "a",
            secondId: "b",
            distance: 0.10,
        });
        expect(result.nearestNeighbors.find(({objectId}) => objectId === "d")).toMatchObject({
            neighborId: "c",
            distance: 0.12,
        });
        expect(result.meanWithinDistance).toBeCloseTo(0.11);
        expect(result.meanBetweenDistance).toBeCloseTo(0.8825);
    });

    test("reports overlapping equal-distance data as weak and deterministic", () => {
        const result = analyze(UNIFORM_MATRIX);

        expect(result.suggestedClusterCount).toBe(2);
        expect(result.silhouette).toBe(0);
        expect(result.separation).toBe("weak");
        expect(semanticGroups(result.groups)).toEqual(["a+b+c", "d"]);
        expect(result.closestPairs[0]).toMatchObject({firstId: "a", secondId: "b"});
    });

    test("distinguishes moderate separation from both strong and ambiguous cases", () => {
        const result = analyze([
            [0, 0.30, 0.50, 0.55],
            [0.30, 0, 0.54, 0.51],
            [0.50, 0.54, 0, 0.30],
            [0.55, 0.51, 0.30, 0],
        ]);

        expect(result.suggestedClusterCount).toBe(2);
        expect(result.separation).toBe("moderate");
        expect(result.silhouette).toBeGreaterThanOrEqual(0.25);
        expect(result.silhouette).toBeLessThan(0.5);
        expect(semanticGroups(result.groups)).toEqual(["a+b", "c+d"]);
    });

    test("identifies the most isolated object without declaring it a ground-truth outlier", () => {
        const result = buildClusterAnalysis({
            objectIds: ["a", "b", "c", "d", "e"],
            displayLabels: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon"],
            ncdMatrix: [
                [0, 0.10, 0.30, 0.34, 0.91],
                [0.10, 0, 0.33, 0.31, 0.90],
                [0.30, 0.33, 0, 0.12, 0.89],
                [0.34, 0.31, 0.12, 0, 0.92],
                [0.91, 0.90, 0.89, 0.92, 0],
            ],
        });

        expect(result.mostIsolatedObject).toMatchObject({
            objectId: "e",
            objectLabel: "Epsilon",
        });
        expect(result.mostIsolatedObject.meanDistance).toBeCloseTo(0.905);
    });

    test("suggests three groups when three compact pairs are present and supports a manual cut", () => {
        const input = {
            objectIds: ["a", "b", "c", "d", "e", "f"],
            displayLabels: ["A", "B", "C", "D", "E", "F"],
            ncdMatrix: THREE_GROUP_MATRIX,
        } as const;
        const suggested = buildClusterAnalysis(input);
        const manual = buildClusterAnalysis({...input, clusterCount: 2});

        expect(suggested.suggestedClusterCount).toBe(3);
        expect(semanticGroups(suggested.groups)).toEqual(["a+b", "c+d", "e+f"]);
        expect(manual.selection).toBe("manual");
        expect(manual.selectedClusterCount).toBe(2);
        expect(manual.groups).toHaveLength(2);
    });

    test("preserves semantic groups when matrix order changes", () => {
        const original = analyze();
        const permutation = [3, 1, 0, 2];
        const ids = ["a", "b", "c", "d"];
        const labels = ["Alpha", "Beta", "Gamma", "Delta"];
        const reordered = buildClusterAnalysis({
            objectIds: permutation.map((index) => ids[index]),
            displayLabels: permutation.map((index) => labels[index]),
            ncdMatrix: permutation.map((row) => permutation.map((column) => STRONG_MATRIX[row][column])),
        });

        expect(reordered.suggestedClusterCount).toBe(original.suggestedClusterCount);
        expect(reordered.silhouette).toBeCloseTo(original.silhouette);
        expect(semanticGroups(reordered.groups)).toEqual(semanticGroups(original.groups));
    });

    test("fails fast on an asymmetric matrix and an invalid manual group count", () => {
        expect(() => analyze([
            [0, 0.1, 0.8, 0.8],
            [0.2, 0, 0.8, 0.8],
            [0.8, 0.8, 0, 0.1],
            [0.8, 0.8, 0.1, 0],
        ])).toThrow(/Matrix must be symmetric/);
        expect(() => analyze(STRONG_MATRIX, 4)).toThrow(/between 2 and 3/);
    });
});
