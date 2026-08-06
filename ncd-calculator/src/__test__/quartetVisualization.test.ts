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
});
