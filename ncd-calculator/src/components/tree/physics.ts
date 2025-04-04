import {BallObject, QTreeNode, SimulationPhase, SpringObject} from "@/components/tree/types.ts";
import * as THREE from "three";
import {Mesh} from "three";
import {RefObject} from "react";
import {findPathBetweenNodes} from "@/components/tree/treeLayout.ts";

// applies repulsive force between nodes
export const applyRepulsiveForces = (
    ball: BallObject,
    allBalls: BallObject[],
    repulsionStrength: number,
    minDistance: number,
    phaseFactor: number
): THREE.Vector3 => {
    const force = new THREE.Vector3();
    if (!ball.ref.current) return force;
    allBalls.forEach((otherBall) => {
        if (ball !== otherBall && ball.ref.current !== otherBall.ref.current) {
            const direction = ball.ref.current!.position.clone()
                .sub(otherBall.ref.current!.position);
            let distance = direction.length();
            if (distance < minDistance) distance = minDistance;
            direction.normalize();

            force.add(
                direction.multiplyScalar(
                    (repulsionStrength * phaseFactor) / (distance * distance)
                )
            )
        }
    });
    return force;
}

// applies spring force between connected nodes
export const applySpringForces = (
    ball: BallObject,
    springs: SpringObject[],
    springStrength: number,
    scaleFactor: number,
    viewMode: "2d" | "3d",
    highlightPath: boolean
): THREE.Vector3 => {
    const force = new THREE.Vector3();

    if (!ball.ref.current) return force;

    springs.forEach((spring) => {
        if (
            (spring.ballA.current === ball.ref.current || spring.ballB.current === ball.ref.current)
            && spring.ballA.current && spring.ballB.current && ball.ref.current) {
            const otherBall: RefObject<Mesh> = ball.ref.current === spring.ballA.current ? spring.ballB : spring.ballA;
            if (otherBall.current) return;
            const direction = new THREE.Vector3().subVectors(
                otherBall.current!.position,
                ball.ref.current.position
            );

            const currentLength = direction.length();
            // shorter target length for springs
            const targetLength = 12 * scaleFactor; // make this smaller if we want to make the spring looks shorter
            const lengthDiff = currentLength - targetLength;

            direction.normalize();
            force.add(direction.multiplyScalar(springStrength * lengthDiff));

            // anti-crossing force for spring in 2D mode
            if (viewMode === '2d' && highlightPath) {
                force.add(applyAntiCrossingForces(ball, spring, otherBall, springs, scaleFactor));
            }
        }
    });
    return force;
}

// apply forces to minimize edge crossing
export const applyAntiCrossingForces = (ball: BallObject, spring: SpringObject, otherBall: RefObject<THREE.Mesh>, allSprings: SpringObject[], scaleFactor: number) => {
    const force = new THREE.Vector3();

    if (!ball.ref.current || otherBall.current) return force;
    allSprings.forEach((otherSpring) => {
        if (spring !== otherSpring &&
            spring.nodeA !== otherSpring.nodeA &&
            spring.nodeB !== otherSpring.nodeB &&
            spring.nodeB !== otherSpring.nodeA &&
            spring.nodeA !== otherSpring.nodeB
        ) {
            // simple heuristic to detect potential crossings and apply subtle forces
            const thisCenter = new THREE.Vector3().addVectors(
                ball.ref.current!.position,
                otherBall.current!.position
            ).multiplyScalar(0.5);
            if (otherSpring.springRef.current) {
                const otherCenter = otherSpring.springRef.current.position;
                const repelDir = new THREE.Vector3().subVectors(thisCenter, otherCenter);
                const dist = repelDir.length();

                if (dist < 10 * scaleFactor) {
                    repelDir.normalize();
                    force.add(repelDir.multiplyScalar(0.05 * (10 * scaleFactor - dist)));
                }
            }
        }
    })
    return force;
}

// applies balancing force to maintain desired layout
export const applyBalancingForces = (
    ball: BallObject,
    allBalls: BallObject[],
    viewMode: "2d" | "3d",
    squishForce: number,
    scaleFactor: number
): THREE.Vector3 => {
    const force = new THREE.Vector3();
    if (!ball.ref.current) force;

    // apply different forces based on view-mode
    if (viewMode === "3d") {
        const distanceToXY = Math.abs(ball.ref.current?.position.z!);
        force.add(
            new THREE.Vector3(
                0,
                0,
                -Math.sign(ball.ref.current?.position.z!) * squishForce * distanceToXY
            )
        );
    }

    // apply gentle force to prevent nodes at crowding at the center
    const distanceToCenter = new THREE.Vector2(
        ball.ref.current?.position.x,
        ball.ref.current?.position.z
    ).length();

    if (distanceToCenter < 15 * scaleFactor) {
        const dirFromCenter = new THREE.Vector3(
            ball.ref.current?.position.x,
            0,
            ball.ref.current?.position.z
        ).normalize();
        force.add(dirFromCenter.multiplyScalar(0.1 * (15 * scaleFactor - distanceToCenter)));
    }

    // tree balancing: nodes should prefer to be arranged hierarchically
    if (viewMode === "2d" && ball.depth !== undefined) {
        // make the connected nodes at the same depth spread out more
        allBalls.forEach((otherBall) => {
            if (ball !== otherBall &&
                ball.depth === otherBall.depth &&
                ball.ref.current &&
                otherBall.ref.current
            ) {
                const sameLayerDistance = new THREE.Vector2(
                    ball.ref.current.position.x - otherBall.ref.current.position.x,
                    ball.ref.current.position.z - otherBall.ref.current.position.z
                ).length();

                if (sameLayerDistance < 20 * scaleFactor) {
                    const horizontalDir = new THREE.Vector3(
                        ball.ref.current.position.x - otherBall.ref.current.position.x,
                        0,
                        ball.ref.current.position.z - otherBall.ref.current.position.z
                    ).normalize();

                    force.add(horizontalDir.multiplyScalar(0.2 * (20 * scaleFactor - sameLayerDistance)));
                }
            }
        })
    }
    return force;
}


// handle node highlighting based on node selection, hover, and path
export const handleNodeHighlighting = (
    ball: BallObject,
    hoveredNode: number | null,
    selectedNode: number | null,
    allNodes: QTreeNode[],
    highlightPath: boolean,
    theme: "dark" | "light"
) => {
    if (!ball.ref.current || !(ball.ref.current.material instanceof THREE.MeshStandardMaterial)) return;

    const material = ball.ref.current.material;
    const isActive = ball.index === hoveredNode || ball.index === selectedNode;
    const isFocus = selectedNode !== null && selectedNode === ball.index;

    // set node appearance based on state
    if (isFocus) {
        // selected node - bright highlight
        material.emissive.set(theme === 'dark' ? 0x442200 : 0x331100);
        material.emissiveIntensity = 0.8;
    } else if (isActive) {
        // hovered node - medium highlight
        material.emissive.set(theme === 'dark' ? 0x331100 : 0x220000);
        material.emissiveIntensity = 0.5;
    } else if (highlightPath && (hoveredNode !== null || selectedNode !== null)) {
        const activeNode = hoveredNode !== null ? hoveredNode : selectedNode;
        if (activeNode !== null) {
            const path = findPathBetweenNodes(allNodes, activeNode, ball.index);
            if (path !== null) {
                // node is in path - subtle highlight
                material.emissive.set(theme === "dark" ? 0x221100 : 0x110000);
                material.emissiveIntensity = 0.3;
            } else {
                // node not in the path - no highlight
                material.emissive.set(0x000000);
                material.emissiveIntensity = 0;
            }
        }
    } else {
        // default state - no highlight
        material.emissive.set(0x000000);
        material.emissiveIntensity = 0;
    }
}


export const getPhysicsParams = (phase: SimulationPhase, viewMode: "2d" | "3d", scaleFactor: number) => {
    return {
        dampingFactor: viewMode === "2d" ? 0.6 : (phase === "initial" ? 0.2 : phase === "stabilizing" ? 0.4 : 0.6),
        timeStep: viewMode === "2d" ? 0.1 : (phase === "initial" ? 0.2 : 0.15),
        repulsionStrength: (viewMode === "2d" ? 15 : (phase === "initial" ? 30 : phase === "stabilizing" ? 25 : 20)) * scaleFactor,
        minDistance: (viewMode === "2d" ? 2 : 5) * scaleFactor,
        springStrength: viewMode === "2d" ? 0.03 : (phase === "initial" ? 0.02 : 0.015),
        squishForce: viewMode === "2d" ? 0.1 : (phase === "initial" ? 0.03 : 0.05)
    }
}
