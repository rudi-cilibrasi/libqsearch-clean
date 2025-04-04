import React, {useEffect} from 'react';
import * as THREE from "three";
import {QTreeNode, SpringObject} from './types';
import {findPathBetweenNodes} from "@/components/tree/treeLayout.ts";

interface SpringObjectProps {
    springObj: SpringObject;
    hoveredNode: number | null;
    selectedNode: number | null;
    highlightPath: boolean;
    theme: "light" | "dark";
    nodes: QTreeNode[];
}

/**
 * Component for rendering a single spring/connection
 */
const SpringObjectComponent: React.FC<SpringObjectProps> = ({
                                                                springObj,
                                                                hoveredNode,
                                                                selectedNode,
                                                                highlightPath,
                                                                theme,
                                                                nodes
                                                            }) => {
    // Update spring positioning and highlighting
    useEffect(() => {
        const updateSpring = () => {
            const {ballA, ballB, springRef} = springObj;
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
        };

        // Handle highlighting based on path
        const updateHighlighting = () => {
            const {springRef, nodeA, nodeB} = springObj;
            if (!springRef.current) return;

            if (highlightPath && (hoveredNode !== null || selectedNode !== null)) {
                const activeNode = hoveredNode !== null ? hoveredNode : selectedNode;
                if (activeNode !== null) {
                    const path = findPathBetweenNodes(nodes, activeNode, nodeA) ||
                        findPathBetweenNodes(nodes, activeNode, nodeB);

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

        // Run updates
        updateSpring();
        updateHighlighting();
    }, [springObj, hoveredNode, selectedNode, highlightPath, theme, nodes]);

    return springObj.mesh;
};

export default SpringObjectComponent;
