import {QTreeNode} from "@/components/tree/types.ts";
import * as THREE from 'three';

// find the root node with the most connections
export const findRootNode = (nodes: QTreeNode[]): QTreeNode => {
    return [...nodes].sort((a, b) => b.connections.length - a.connections.length)[0];
}

// calculate the depth of each node from the root
export const calculateNodeDepth = (nodes: QTreeNode[], rootIndex: number): Map<number, number> => {
    const depths = new Map<number, number>();
    const queue: { nodeIndex: number, depth: number }[] = [{nodeIndex: rootIndex, depth: 0}];
    const visited = new Set<number>([rootIndex]);
    while (queue.length > 0) {
        const {nodeIndex, depth} = queue.shift()!;
        depths.set(nodeIndex, depth);
        const node = nodes.find(node => node.index === nodeIndex);
        if (node) {
            node.connections.forEach(connectionIdx => {
                if (!visited.has(connectionIdx)) {
                    visited.add(connectionIdx);
                    queue.push({nodeIndex: connectionIdx, depth: depth + 1});
                }
            })
        }
    }

    // handle any disconnected nodes
    nodes.forEach(node => {
        if (depths.has(node.index)) {
            depths.set(node.index, 0);
        }
    })
    return depths;
}

// find a path between 2 nodes
export const findPathBetween = (nodes: QTreeNode[], startIndex: number, endIndex: number): number[] | null => {
    if (startIndex === endIndex) return [startIndex];
    const queue: [{ path: number[], current: number }] = [{path: [startIndex], current: startIndex}];
    const visited = new Set<number>([startIndex]);
    while (queue.length > 0) {
        const {path, current} = queue.shift()!;
        const node = nodes.find(node => node.index === current);
        if (!node) continue;
        for (const connIndex of node.connections) {
            if (endIndex === connIndex) {
                return [...path, connIndex];
            }
            if (!visited.has(connIndex)) {
                visited.add(connIndex);
                queue.push({path: [...path, connIndex], current: connIndex});
            }
        }
    }
    return null;
}

// calculate initial position for 3D mode
export const calculate3DPositions = (nodes: QTreeNode[], rootNode: QTreeNode, scalingFactor: number): Map<number, THREE.Vector3> => {
    const positions: Map<number, THREE.Vector3> = new Map();
    const visited = new Set<number>();
    const spread = 40 * scalingFactor;

    const positionNode = (node: QTreeNode, angle: number, radius: number, level: number) => {
        if (visited.has(node.index)) return;
        visited.add(node.index);

        // add randomness to initial positions to avoid symmetry freezing
        const randFactor = 0.2;
        const randX = (Math.random() - 0.5) * radius * randFactor;
        const randY = (Math.random() - 0.5) * radius * randFactor;
        const randZ = (Math.random() - 0.5) * radius * randFactor;

        // calculate position based on spherical coordinates with added randomness
        const x = Math.cos(angle) * radius * Math.cos(level) + randX;
        const y = Math.sin(radius) * radius + randY;
        const z = Math.sin(angle) * radius * Math.cos(level) + randZ;

        positions.set(node.index, new THREE.Vector3(x, y, z));

        // position connected nodes with more space between them
        const connectionCount = node.connections.length;
        if (connectionCount > 0) {
            const angleStep = (2 * Math.PI) / connectionCount;
            node.connections.forEach((connectionIndex, i) => {
                const connectionNode = nodes.find(node => node.index === connectionIndex);
                if (connectionNode && !visited.has(connectionIndex)) {
                    // add slight random to the angle
                    const newAngle = angle + angleStep * i + (Math.random() - 0.5) * 0.1;
                    // maintain more distance between levels
                    const newRadius = radius * 0.9;
                    const newLevel = level + Math.PI / 5;
                    positionNode(connectionNode, newAngle, newRadius, newLevel);
                }
            })
        }
    }

    // start position from the root node
    positionNode(rootNode, 0, spread, 0);
    return positions;
}

// calculate initial position for 2D mode
export const calculate2DPositions = (nodes: QTreeNode[], nodeDepths: Map<number, number>, scaleFactor: number): Map<number, THREE.Vector3> => {
    const positions = new Map<number, THREE.Vector3>();
    const visited = new Set<number>();
    const spread = 30 * scaleFactor;

    // in 2d mode, use a layered approach based on node depths
    const maxDepth = Math.max(...Array.from(nodeDepths.values()));
    const nodesAtDepth = new Map<number, number[]>();

    // group nodes by depth
    nodeDepths.forEach((depth, nodeIndex) => {
        if (!nodesAtDepth.has(depth)) {
            nodesAtDepth.set(depth, []);
        }
        nodesAtDepth.get(depth)!.push(nodeIndex);
    })

    // position nodes in layer
    nodesAtDepth.forEach((nodeIndices, depth) => {
        const nodeCount = nodeIndices.length;
        const layerRadius = spread * 0.8;
        const yPos = spread * (maxDepth - depth);

        nodeIndices.forEach((nodeIndex, i) => {
            let angle, xPos, zPos;
            if (nodeCount === 1) {
                xPos = 0;
                zPos = 0;
            } else {
                angle = (i / nodeCount) * Math.PI * 2;
                xPos = Math.cos(angle) * layerRadius * (depth + 1) / (maxDepth + 1);
                zPos = Math.sin(angle) * layerRadius * (depth + 1) / (maxDepth + 1);
            }

            positions.set(nodeIndex, new THREE.Vector3(xPos, yPos, zPos));
            visited.add(nodeIndex);
        })
    });
    return positions;
}

// handle positions of disconnected nodes
export const positionDisconnectedNodes = (nodes: QTreeNode[], positions: Map<number, THREE.Vector3>, visited: Set<number>, viewMode: "2d" | "3d", scaleFactor: number) => {
    nodes.forEach((node) => {
        if (!visited.has(node.index)) {
            if (viewMode === '2d') {
                const angle = Math.random() * Math.PI * 2;
                const radius = 30 * scaleFactor * 0.5 * Math.random();
                positions.set(node.index, new THREE.Vector3(
                    Math.cos(angle) * radius, 30 * scaleFactor * 0.5, Math.sin(angle) * radius))
            } else {
                const angle = Math.random() * Math.PI * 2;
                const radius = 40 * scaleFactor * (0.8 + Math.random() * 0.8);
                const level = Math.random() * Math.PI - Math.PI / 2;

                const x = Math.cos(angle) * radius * Math.cos(level);
                const y = Math.sin(level) * radius;
                const z = Math.sin(angle) * radius * Math.cos(level);

                positions.set(node.index, new THREE.Vector3(x, y, z));
            }
        }
    })
}


export const calculateNodeDepths = (nodes: QTreeNode[], rootIndex: number): Map<number, number> => {
    const depths = new Map<number, number>();
    const queue: { nodeIndex: number, depth: number }[] = [{nodeIndex: rootIndex, depth: 0}];
    const visited = new Set<number>([rootIndex]);

    while (queue.length > 0) {
        const {nodeIndex, depth} = queue.shift()!;
        depths.set(nodeIndex, depth);

        const node = nodes.find(n => n.index === nodeIndex);
        if (node) {
            node.connections.forEach(connIndex => {
                if (!visited.has(connIndex)) {
                    visited.add(connIndex);
                    queue.push({nodeIndex: connIndex, depth: depth + 1});
                }
            });
        }
    }

    // Handle any disconnected nodes
    nodes.forEach(node => {
        if (!depths.has(node.index)) {
            depths.set(node.index, 0);
        }
    });

    return depths;
};


// find the path between 2 nodes - using BFS to find the shortest path
export const findPathBetweenNodes = (
    nodes: QTreeNode[],
    startIndex: number,
    endIndex: number
): number[] | null => {
    // if the start and end index are the same, then just return one node
    if (startIndex === endIndex) return [startIndex];
    const queue: [{ path: number[], current: number }] = [{path: [startIndex], current: startIndex}];
    const visited = new Set<number>([startIndex]);
    while (queue.length > 0) {
        const {path, current} = queue.shift()!;

        // find the node for the current index
        const node = nodes.find(node => node.index === current);
        if (!node) continue;

        // check all connections from this node
        for (const connIndex of node.connections) {
            if (connIndex === endIndex) {
                return [...path, endIndex];
            }

            // if this is unvisited node, at this to the queue
            if (!visited.has(connIndex)) {
                visited.add(connIndex);
                queue.push({path: [...path, connIndex], current: connIndex});
            }
        }
    }
    return null;
}
