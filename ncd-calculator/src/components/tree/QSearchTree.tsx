import React, {useEffect, useRef, useState} from "react";
import * as THREE from "three";
import {useFrame} from "@react-three/fiber";
import {BallObject, QSearchTreeProps, QTreeNode, SimulationPhase, SpringObject} from "./types";
import {
    calculate2DPositions,
    calculate3DPositions,
    calculateNodeDepths,
    findPathBetweenNodes,
    findRootNode,
    positionDisconnectedNodes
} from "./treeLayout";
import {
    applyBalancingForces,
    applyRepulsiveForces,
    applySpringForces,
    getPhysicsParams,
    handleNodeHighlighting
} from "./physics";
import {detectStableState, minimizeEdgeCrossings} from "./edgeCrossing";
import {loadGraph as loadGraphData} from "./GraphLoader";
import NodeObject from "./NodeObject";
import SpringObjectComponent from "./SpringObject";

const QSearchTree: React.FC<QSearchTreeProps> = ({
                                                     data,
                                                     scaleFactor,
                                                     theme,
                                                     viewMode,
                                                     hoveredNode,
                                                     setHoveredNode,
                                                     selectedNode,
                                                     setSelectedNode,
                                                     highlightPath,
                                                     updateNodePositions
                                                 }) => {
    const sceneRef = useRef<THREE.Scene>(null);
    const ballsRef = useRef<BallObject[]>([]);
    const springsRef = useRef<SpringObject[]>([]);
    const [graph, setGraph] = useState<string | null>(null);
    const simulationPhaseRef = useRef<SimulationPhase>("initial");
    const frameCountRef = useRef<number>(0);
    const stableCountRef = useRef<number>(0);

    const calculateInitialPositions = (nodes: QTreeNode[]): Map<number, THREE.Vector3> => {
        const positions = new Map<number, THREE.Vector3>();
        const visited = new Set<number>();

        // Find root node and calculate depths
        const rootNode = findRootNode(nodes);
        const nodeDepths = calculateNodeDepths(nodes, rootNode.index);

        // Calculate positions based on view mode
        if (viewMode === "2d") {
            const pos2D = calculate2DPositions(nodes, nodeDepths, scaleFactor);
            pos2D.forEach((pos, idx) => {
                positions.set(idx, pos);
                visited.add(idx);
            });
        } else {
            const pos3D = calculate3DPositions(nodes, rootNode, scaleFactor);
            pos3D.forEach((pos, idx) => {
                positions.set(idx, pos);
                visited.add(idx);
            });
        }

        // Handle any disconnected nodes
        positionDisconnectedNodes(nodes, positions, visited, viewMode, scaleFactor);

        return positions;
    };

    // Update when data, theme, or view mode changes
    useEffect(() => {
        if (JSON.stringify(data) !== graph || theme || viewMode) {
            const initialPositions = calculateInitialPositions(data.nodes);
            loadGraphData(
                data,
                ballsRef,
                springsRef,
                initialPositions,
                theme,
                scaleFactor,
                setSelectedNode,
                setHoveredNode,
                selectedNode
            );
            setGraph(JSON.stringify(data));
            simulationPhaseRef.current = "initial";
            frameCountRef.current = 0;
            stableCountRef.current = 0;
        }
    }, [data, theme, viewMode, scaleFactor, setSelectedNode, setHoveredNode, selectedNode]);

    useFrame(({camera}): void => {
        frameCountRef.current++;
        const phase = simulationPhaseRef.current;

        // Get physics parameters based on phase and view mode
        const {
            dampingFactor,
            timeStep,
            repulsionStrength,
            minDistance,
            springStrength,
            squishForce
        } = getPhysicsParams(phase, viewMode, scaleFactor);

        // Phase transitions
        if (phase === "initial" && frameCountRef.current > 120) {
            simulationPhaseRef.current = "stabilizing";
            frameCountRef.current = 0; // Reset for the next phase
        } else if (phase === "stabilizing" && frameCountRef.current > 180) {
            simulationPhaseRef.current = "stable";
            frameCountRef.current = 0; // Reset for the next phase
        }

        const cameraDistance = camera.position.length();
        const labelScaleFactor = Math.max(0.5, cameraDistance / (100 * scaleFactor));

        // Calculate total kinetic energy to monitor stability
        let totalKineticEnergy = 0;

        // Apply 2D constraints if needed
        if (viewMode === "2d") {
            ballsRef.current.forEach((ball) => {
                if (ball.ref.current && ball.depth !== undefined) {
                    // Lock Y position based on depth
                    const idealY = (ball.depth * 20) * scaleFactor;
                    const currentY = ball.ref.current.position.y;
                    const yDiff = idealY - currentY;

                    ball.ref.current.position.y += yDiff * 0.1;
                    ball.velocity.y = 0; // Zero out vertical velocity
                }
            });
        }

        // Apply forces to all nodes
        ballsRef.current.forEach((ball) => {
            if (!ball.ref.current) return;

            // Handle node highlighting
            handleNodeHighlighting(ball, hoveredNode, selectedNode, data.nodes, highlightPath, theme);

            // Calculate all forces
            const force = new THREE.Vector3();

            // Repulsive forces between nodes
            const repulsiveForce = applyRepulsiveForces(
                ball,
                ballsRef.current,
                repulsionStrength,
                minDistance,
                phase === "initial" ? Math.min(1, frameCountRef.current / 60) : 1
            );
            force.add(repulsiveForce);

            // Spring forces between connected nodes
            const springForce = applySpringForces(
                ball,
                springsRef.current,
                springStrength,
                scaleFactor,
                viewMode,
                highlightPath
            );
            force.add(springForce);

            // Balancing forces (squish, center repulsion, tree balancing)
            const balancingForce = applyBalancingForces(
                ball,
                ballsRef.current,
                viewMode,
                squishForce,
                scaleFactor
            );
            force.add(balancingForce);

            // Apply damping
            force.add(ball.velocity.clone().multiplyScalar(-dampingFactor));

            // Update velocity and position
            ball.velocity.add(force.multiplyScalar(timeStep));

            // For 2D mode, limit horizontal velocity to prevent excessive oscillation
            if (viewMode === "2d") {
                const maxHorizontalVelocity = 0.5;
                const horizontalSpeed = new THREE.Vector2(ball.velocity.x, ball.velocity.z).length();
                if (horizontalSpeed > maxHorizontalVelocity) {
                    const factor = maxHorizontalVelocity / horizontalSpeed;
                    ball.velocity.x *= factor;
                    ball.velocity.z *= factor;
                }
            }

            ball.ref.current.position.add(ball.velocity.clone().multiplyScalar(timeStep));
            totalKineticEnergy += ball.velocity.lengthSq();

            // Update label position and orientation
            if (ball.labelRef.current) {
                const labelOffset = (ball.isLeaf ? 6 : 4) * scaleFactor;
                ball.labelRef.current.position.copy(ball.ref.current.position);
                ball.labelRef.current.position.y += labelOffset;
                ball.labelRef.current.quaternion.copy(camera.quaternion);

                // Make selected/hovered node labels bigger
                const isHighlighted = ball.index === selectedNode || ball.index === hoveredNode;
                const highlightScale = isHighlighted ? 1.2 : 1.0;
                ball.labelRef.current.scale.setScalar(labelScaleFactor * highlightScale);
            }
        });

        // Update all springs
        springsRef.current.forEach(updateSpring);

        // Apply edge crossing minimization in 2D mode
        if (viewMode === "2d" && phase === "stable") {
            minimizeEdgeCrossings(springsRef.current, scaleFactor);
        }

        // Detect if system has stabilized
        if (phase === "stable") {
            detectStableState(totalKineticEnergy, stableCountRef, ballsRef, viewMode);
        }

        // Update minimap node positions
        if (typeof updateNodePositions === 'function') {
            const miniMapNodes = ballsRef.current.map(ball => ({
                index: ball.index,
                position: ball.ref.current?.position.clone() || new THREE.Vector3(),
                isLeaf: ball.isLeaf,
                isSelected: ball.index === selectedNode,
                isHovered: ball.index === hoveredNode
            }));

            updateNodePositions(miniMapNodes);
        }
    });

    const updateSpring = (spring: SpringObject): void => {
        const {ballA, ballB, springRef, nodeA, nodeB} = spring;
        if (!ballA.current || !ballB.current || !springRef.current) return;

        const positionA = ballA.current.position;
        const positionB = ballB.current.position;
        const midPoint = new THREE.Vector3()
            .addVectors(positionA, positionB)
            .multiplyScalar(0.5);
        springRef.current.position.copy(midPoint);

        const currentLength = positionA.distanceTo(positionB);
        springRef.current.scale.set(1, currentLength, 1);

        const direction = new THREE.Vector3().subVectors(positionB, positionA);
        if (direction.length() === 0) return;

        // Fix rotation issue that could cause springs to disappear
        const normalizedDirection = direction.clone().normalize();
        const axis = new THREE.Vector3(0, 1, 0).cross(normalizedDirection);
        const axisLength = axis.length();

        if (axisLength < 0.001) {
            // Special case: direction is parallel to Y axis
            springRef.current.rotation.set(direction.y > 0 ? 0 : Math.PI, 0, 0);
        } else {
            axis.normalize();
            const angle = Math.acos(
                Math.min(1, Math.max(-1, new THREE.Vector3(0, 1, 0).dot(normalizedDirection)))
            );
            springRef.current.setRotationFromAxisAngle(axis, angle);
        }

        // Handle highlighting of connections
        if (highlightPath && (hoveredNode !== null || selectedNode !== null)) {
            const activeNode = hoveredNode !== null ? hoveredNode : selectedNode;
            if (activeNode !== null) {
                const path = findPathBetweenNodes(data.nodes, activeNode, nodeA) ||
                    findPathBetweenNodes(data.nodes, activeNode, nodeB);

                const isHighlighted = path !== null &&
                    path.includes(nodeA) &&
                    path.includes(nodeB) &&
                    (path.indexOf(nodeA) === path.indexOf(nodeB) + 1 ||
                        path.indexOf(nodeB) === path.indexOf(nodeA) + 1);

                // Update spring appearance based on highlight state
                if (springRef.current.material instanceof THREE.MeshStandardMaterial) {
                    const material = springRef.current.material;

                    if (isHighlighted) {
                        material.color.set(theme === "dark" ? 0xff9900 : 0xff6600);
                        material.emissive.set(theme === "dark" ? 0x332200 : 0x331100);
                        material.emissiveIntensity = 0.5;
                    } else {
                        material.color.set(theme === "dark" ? 0x555555 : 0xAAAAAA);
                        material.emissive.set(0x000000);
                        material.emissiveIntensity = 0;
                    }
                }
            }
        }
    };

    return (
        <scene ref={sceneRef}>
            <ambientLight intensity={0.6}/>
            <directionalLight
                color={0xffffff}
                intensity={0.8}
                position={[10, 10, 10]}
                castShadow
                key="direction1"
            />
            <directionalLight
                color={0xffffff}
                intensity={0.5}
                position={[-10, -10, -10]}
                key="direction2"
            />

            {/* Add a subtle grid for better spatial awareness in 2D mode */}
            {viewMode === "2d" && (
                <gridHelper
                    args={[300 * scaleFactor, 30, theme === "dark" ? 0x333333 : 0xcccccc, theme === "dark" ? 0x222222 : 0xdddddd]}
                    position={[0, -5, 0]}
                />
            )}

            {/* Render springs first so nodes appear on top */}
            {springsRef.current.map((springObj) => (
                <SpringObjectComponent
                    key={`spring-${springObj.nodeA}-${springObj.nodeB}`}
                    springObj={springObj}
                    hoveredNode={hoveredNode}
                    selectedNode={selectedNode}
                    highlightPath={highlightPath}
                    theme={theme}
                    nodes={data.nodes}
                />
            ))}

            {/* Render nodes and labels */}
            {ballsRef.current.map((ballObj) => (
                <NodeObject
                    key={`node-${ballObj.index}`}
                    ballObj={ballObj}
                    hoveredNode={hoveredNode}
                    selectedNode={selectedNode}
                    scaleFactor={scaleFactor}
                    theme={theme}
                />
            ))}

            {/* Add a visual indicator for selected nodes */}
            {selectedNode !== null && ballsRef.current.find(ball => ball.index === selectedNode)?.ref.current && (
                <mesh
                    position={ballsRef.current.find(ball => ball.index === selectedNode)?.ref.current?.position || [0, 0, 0]}
                    scale={1.2}
                >
                    <sphereGeometry
                        args={[
                            (ballsRef.current.find(ball => ball.index === selectedNode)?.isLeaf ? 4 : 2) * 1.2 * scaleFactor,
                            32,
                            32
                        ]}
                    />
                    <meshStandardMaterial color={0xffcc00} transparent={true} opacity={0.3}/>
                </mesh>
            )}
        </scene>
    );
};

export default QSearchTree;
