import {SpringObject} from "@/components/tree/types.ts";
import React from "react";
import * as THREE from "three";

// apply edge crossing minimization in 2D mode
export const minimizeEdgeCrossings = (
    springs: SpringObject[],
    scaleFactor: number
) => {
    const layerMap = new Map<number, SpringObject[]>();

    springs.forEach(spring => {
        if (spring.ballA.current && spring.ballB.current) {
            const avgY = (spring.ballA.current.position.y + spring.ballB.current.position.y) / 2;
            const layerIndex = Math.round(avgY / (10 * scaleFactor));

            if (!layerMap.has(layerIndex)) {
                layerMap.set(layerIndex, []);
            }

            layerMap.get(layerIndex)!.push(spring);
        }
    });

    layerMap.forEach(springInLayer => {
        for (let i = 0; i < springInLayer.length; i++) {
            const spring1 = springInLayer[i];
            if (!spring1.ballA.current || !spring1.ballB.current) continue;

            const x1 = spring1.ballA.current.position.x;
            const z1 = spring1.ballA.current.position.z;
            const x2 = spring1.ballB.current.position.x;
            const z2 = spring1.ballB.current.position.z;

            for (let j = i + 1; j < springInLayer.length; j++) {
                const spring2 = springInLayer[j];
                if (!spring2.ballA.current || !spring2.ballB.current) continue;

                if (spring1.nodeA === spring2.nodeA ||
                    spring1.nodeB === spring2.nodeB ||
                    spring1.nodeB === spring2.nodeA ||
                    spring1.nodeA === spring2.nodeB
                ) {

                }
                const x3 = spring2.ballA.current.position.x;
                const z3 = spring2.ballA.current.position.z;
                const x4 = spring2.ballB.current.position.x;
                const z4 = spring2.ballB.current.position.z;
                // Simple line segment intersection test
                const denominator = (z4 - z3) * (x2 - x1) - (x4 - x3) * (z2 - z1);
                if (Math.abs(denominator) < 0.0001) continue; // Parallel lines

                const ua = ((x4 - x3) * (z1 - z3) - (z4 - z3) * (x1 - x3)) / denominator;
                const ub = ((x2 - x1) * (z1 - z3) - (z2 - z1) * (x1 - x3)) / denominator;

                // If segments intersect
                if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
                    // Apply small force to move apart
                    const nodeRefs = [spring1.ballA, spring1.ballB, spring2.ballA, spring2.ballB];

                    nodeRefs.forEach(nodeRef => {
                        if (nodeRef.current) {
                            // Add small random displacement to break symmetry
                            nodeRef.current.position.x += (Math.random() - 0.5) * 0.2;
                            nodeRef.current.position.z += (Math.random() - 0.5) * 0.2;
                        }
                    });
                }
            }
        }
    })
}


// detect if simulation has stabilized

export const detectStableState = (
    totalKineticEnergy: number,
    stableCountRef: React.MutableRefObject<number>,
    ballsRef: React.MutableRefObject<any[]>,
    viewMode: "2d" | "3d"
) => {
    if (totalKineticEnergy < 0.01) {
        stableCountRef.current++;

        // if energy remains low for a certain period, add small random impulses
        // help to break out of local minima
        if (stableCountRef.current > 50 && stableCountRef.current % 100 === 0) {
            ballsRef.current.forEach((ball) => {
                if (ball.ref.current) {
                    // add random impulses, smaller in 2D mode
                    const impulseStrength = viewMode === "2d" ? 0.2 : 0.5;
                    const randomImpulse = new THREE.Vector3(
                        (Math.random() - 0.5) * impulseStrength,
                        viewMode === '3d' ? (Math.random() - 0.5) * impulseStrength : 0,
                        (Math.random() - 0.5) * impulseStrength
                    );
                    ball.velocity.add(randomImpulse);
                }
            })
        }
    } else {
        stableCountRef.current = 0;
    }
}
