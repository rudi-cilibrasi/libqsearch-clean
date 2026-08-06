import {describe, expect, test} from "vitest";
import {calculateCameraFitDistance} from "../components/tree/cameraFit";
import {createPlanarTreeDot} from "../components/tree/planarTree";

describe("quartet tree visualization helpers", () => {
    test("moves the camera farther away for a narrow portrait viewport", () => {
        const extent = {x: 100, y: 60, z: 20};
        const landscapeDistance = calculateCameraFitDistance(extent, 50, 16 / 9);
        const portraitDistance = calculateCameraFitDistance(extent, 50, 9 / 16);

        expect(portraitDistance).toBeGreaterThan(landscapeDistance);
        expect(landscapeDistance).toBeGreaterThan(50);
    });

    test("returns a finite fit distance for empty or invalid viewport inputs", () => {
        expect(calculateCameraFitDistance({x: 0, y: 0, z: 0}, 0, 0)).toBeGreaterThanOrEqual(1);
    });

    test("creates a high-contrast planar tree with unique edges and escaped labels", () => {
        const dot = createPlanarTreeDot({
            nodes: [
                {index: 0, label: 'English "sample"', connections: [2]},
                {index: 1, label: "French", connections: [2]},
                {index: 2, label: "", connections: [0, 1]},
            ],
        });

        expect(dot).toContain('rankdir=LR');
        expect(dot).toContain('color="#315b4b"');
        expect(dot).toContain('label="English \\"sample\\""');
        expect(dot.match(/"2" -> "0"/g)).toHaveLength(1);
        expect(dot.match(/"2" -> "1"/g)).toHaveLength(1);
    });

    test("keeps diagnostics out of the live tree but includes them in explicit exports", () => {
        const tree = {
            nodes: [
                {index: 0, label: "A", connections: [4]},
                {index: 1, label: "B", connections: [4]},
                {index: 2, label: "C", connections: [5]},
                {index: 3, label: "D", connections: [5]},
                {index: 4, label: "", connections: [0, 1, 5]},
                {index: 5, label: "", connections: [2, 3, 4]},
            ],
            edgeSupport: {"4-5": 0.8125},
            search: {
                pipelineVersion: "qsearch-multistart-v2",
                runCount: 16,
                selectedSeed: 1229332020,
                selectedScore: 0.995421,
                selectedTopologyCount: 16,
                selectedTopologySupport: 1,
                uniqueTopologyCount: 1,
            },
            balancedSplit: {edgeKey: "4-5", support: 1},
        };

        const liveDot = createPlanarTreeDot(tree);
        expect(liveDot).not.toContain('xlabel="81%"');
        expect(liveDot).not.toContain("qsearch-multistart-v2");

        const exportedDot = createPlanarTreeDot(tree, {includeDiagnostics: true});
        expect(exportedDot).toContain('xlabel="81%"');
        expect(exportedDot).toContain("// qsearch protocol: qsearch-multistart-v2");
        expect(exportedDot).toContain("// selected seed: 1229332020");
        expect(exportedDot).toContain("// most balanced split: 4-5 (1)");
    });
});
