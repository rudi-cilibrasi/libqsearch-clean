import * as THREE from "three";
import React from "react";
import {Text} from "@react-three/drei";
import {BallObject, QTreeResponse, SpringObject} from "./types";
import {calculateNodeDepths, findRootNode} from "./treeLayout";

/**
 * Get theme-appropriate colors
 */
export const getThemeColors = (theme: "light" | "dark") => {
    return {
        leafNodeColor: theme === "dark" ? 0x4287f5 : 0x0047AB, // Blue
        internalNodeColor: theme === "dark" ? 0xAA336A : 0x800080, // Purple
        springColor: theme === "dark" ? 0x555555 : 0xAAAAAA, // Gray
        textColor: theme === "dark" ? "white" : "black"
    };
};

/**
 * Create ball objects for all nodes in the graph
 */
export const createBallObjects = (
    graph: QTreeResponse,
    initialPositions: Map<number, THREE.Vector3>,
    nodeDepths: Map<number, number>,
    theme: "light" | "dark",
    scaleFactor: number,
    setSelectedNode: (index: number | null) => void,
    setHoveredNode: (index: number | null) => void,
    selectedNode: number | null
): Map<number, BallObject> => {
    const nodeMap = new Map<number, BallObject>();
    const colors = getThemeColors(theme);

    graph.nodes.forEach((node) => {
        const position = initialPositions.get(node.index)!;
        const isLeaf = node.connections.length === 1;
        const color = isLeaf ? colors.leafNodeColor : colors.internalNodeColor;
        const depth = nodeDepths.get(node.index) || 0;

        const ballRef = React.createRef<THREE.Mesh>();
        const labelRef = React.createRef<any>(); // Text component from @react-three/drei

        // Size based on connections and depth
        const connectionFactor = Math.max(1, Math.min(2, node.connections.length / 3));
        const depthFactor = 1 - (depth * 0.1);
        const ballSize = (isLeaf ? 4 : 2 * connectionFactor) * scaleFactor * Math.max(0.6, depthFactor);

        // Create ball with interaction capabilities
        const ball = (
            <mesh
                ref={ballRef}
                position={[position.x, position.y, position.z]}
                key={`ball-${node.index}`}
                castShadow
                receiveShadow
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node.index === selectedNode ? null : node.index);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredNode(node.index);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHoveredNode(null);
                    document.body.style.cursor = 'auto';
                }}
            >
                <sphereGeometry args={[ballSize, 32, 32]}/>
                <meshStandardMaterial
                    color={color}
                    roughness={0.5}
                    metalness={0.5}
                />
            </mesh>
        );

        // Create enhanced label with background for better visibility
        const label = (
            <Text
                ref={labelRef}
                position={[
                    position.x,
                    position.y + (isLeaf ? 6 : 4) * scaleFactor,
                    position.z,
                ]}
                fontSize={1.5 * scaleFactor}
                color={colors.textColor}
                anchorX="center"
                anchorY="middle"
                key={`label-${node.index}`}
                renderOrder={1}
                material-depthTest={false}
                outlineColor={theme === "dark" ? "#000000" : "#ffffff"}
                outlineWidth={0.05}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNode(node.index === selectedNode ? null : node.index);
                }}
                onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredNode(node.index);
                    document.body.style.cursor = 'pointer';
                }}
                onPointerOut={(e) => {
                    e.stopPropagation();
                    setHoveredNode(null);
                    document.body.style.cursor = 'auto';
                }}
            >
                {node.label}
            </Text>
        );

        // Initial velocity with a bit of randomness to break symmetry
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );

        const ballObj: BallObject = {
            ball,
            label,
            ref: ballRef,
            labelRef,
            velocity,
            index: node.index,
            isLeaf,
            depth
        };

        nodeMap.set(node.index, ballObj);
    });

    return nodeMap;
};

/**
 * Create spring objects for all connections in the graph
 */
export const createSpringObjects = (
    graph: QTreeResponse,
    nodeMap: Map<number, BallObject>,
    theme: "light" | "dark",
    scaleFactor: number
): SpringObject[] => {
    const springs: SpringObject[] = [];
    const colors = getThemeColors(theme);

    graph.nodes.forEach((node) => {
        node.connections.forEach((connectionIndex) => {
            const ballA = nodeMap.get(node.index);
            const ballB = nodeMap.get(connectionIndex);

            const hasSpring = springs.find(
                (spring) =>
                    (spring.nodeA === node.index && spring.nodeB === connectionIndex) ||
                    (spring.nodeA === connectionIndex && spring.nodeB === node.index)
            );

            if (ballA && ballB && !hasSpring) {
                const springRef = React.createRef<THREE.Mesh>();

                // Determine spring thickness based on node importance
                const importance = Math.min(
                    node.connections.length + graph.nodes.find(n => n.index === connectionIndex)?.connections.length! || 1,
                    10
                ) / 10;

                const thickness = (0.3 + importance * 0.4) * scaleFactor;

                const spring = (
                    <mesh
                        ref={springRef}
                        key={`${ballA.index}-${ballB.index}`}
                        castShadow
                    >
                        <cylinderGeometry
                            args={[thickness, thickness, 1, 8]}
                        />
                        <meshStandardMaterial
                            color={colors.springColor}
                            roughness={0.7}
                            metalness={0.3}
                            transparent={true}
                            opacity={0.8}
                        />
                    </mesh>
                );

                springs.push({
                    ballA: ballA.ref,
                    ballB: ballB.ref,
                    nodeA: node.index,
                    nodeB: connectionIndex,
                    mesh: spring,
                    springRef,
                });
            }
        });
    });

    return springs;
};

/**
 * Load graph data and create visual objects
 */
export const loadGraph = (
    graph: QTreeResponse,
    ballsRef: React.MutableRefObject<BallObject[]>,
    springsRef: React.MutableRefObject<SpringObject[]>,
    initialPositions: Map<number, THREE.Vector3>,
    theme: "light" | "dark",
    scaleFactor: number,
    setSelectedNode: (index: number | null) => void,
    setHoveredNode: (index: number | null) => void,
    selectedNode: number | null
): void => {
    ballsRef.current = [];
    springsRef.current = [];

    // Find root node and calculate node depths
    const rootNode = findRootNode(graph.nodes);
    const nodeDepths = calculateNodeDepths(graph.nodes, rootNode.index);

    // Create balls and get node map
    const nodeMap = createBallObjects(
        graph,
        initialPositions,
        nodeDepths,
        theme,
        scaleFactor,
        setSelectedNode,
        setHoveredNode,
        selectedNode
    );

    // Add all balls to the ref
    nodeMap.forEach(ball => {
        ballsRef.current.push(ball);
    });

    // Create springs
    springsRef.current = createSpringObjects(graph, nodeMap, theme, scaleFactor);
};
