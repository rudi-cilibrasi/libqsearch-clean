import React, {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {MiniMapProps} from './types';

/**
 * MiniMap component for navigating the tree visualization
 * Provides a top-down 2D view of the entire tree structure
 */
const MiniMap: React.FC<MiniMapProps> = ({
                                             nodes,
                                             cameraPosition,
                                             size = 150,
                                             theme
                                         }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameIdRef = useRef<number>(0);

    // Convert 3D positions to 2D for the minimap
    const project = (position: THREE.Vector3, scale: number = 1): [number, number] => {
        // Top-down view for minimap (ignoring Y)
        return [
            (position.x * scale) + size / 2,
            (position.z * scale) + size / 2
        ];
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Find appropriate scaling
        const positions = nodes.map(node => node.position);
        const xs = positions.map(p => p.x);
        const zs = positions.map(p => p.z);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minZ = Math.min(...zs);
        const maxZ = Math.max(...zs);

        const width = Math.max(maxX - minX, 1);
        const height = Math.max(maxZ - minZ, 1);
        const padding = 20;

        const scale = Math.min(
            (size - padding * 2) / width,
            (size - padding * 2) / height
        ) * 0.8; // 80% to leave margin

        // Center the view on the midpoint
        const centerX = (minX + maxX) / 2;
        const centerZ = (minZ + maxZ) / 2;

        const drawFrame = () => {
            ctx.clearRect(0, 0, size, size);

            // Draw background
            ctx.fillStyle = theme === "dark" ? "#111122" : "#f0f0f5";
            ctx.fillRect(0, 0, size, size);

            // Draw border
            ctx.strokeStyle = theme === "dark" ? "#333355" : "#ccccdd";
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, size, size);

            // Draw connections first (so nodes appear on top)
            ctx.strokeStyle = theme === "dark" ? "#444444" : "#aaaaaa";
            ctx.lineWidth = 1;

            // Create a set of unique connections to avoid drawing duplicates
            const drawnConnections = new Set<string>();

            nodes.forEach(node => {
                const [x1, y1] = project(node.position, scale);

                // Find connected nodes
                nodes.forEach(otherNode => {
                    // Skip self-connections
                    if (node.index === otherNode.index) return;

                    // Check if connected (we can infer this from the node data available)
                    const connection1 = `${node.index}-${otherNode.index}`;
                    const connection2 = `${otherNode.index}-${node.index}`;

                    if (!drawnConnections.has(connection1) && !drawnConnections.has(connection2)) {
                        // Find nodes near each other and draw connections
                        const [x2, y2] = project(otherNode.position, scale);
                        const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

                        // Only draw connections for nodes that are likely connected
                        // This is a heuristic since we don't have direct connection data
                        if (dist < size * 0.3) {
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();

                            // Mark as drawn
                            drawnConnections.add(connection1);
                        }
                    }
                });
            });

            // Draw nodes
            nodes.forEach(node => {
                const [x, y] = project(node.position, scale);

                // Skip nodes outside the visible area
                if (x < 0 || x > size || y < 0 || y > size) return;

                // Node appearance based on state
                ctx.beginPath();
                ctx.arc(x, y, node.isLeaf ? 3 : 2, 0, Math.PI * 2);

                if (node.isSelected) {
                    ctx.fillStyle = "#ffcc00";
                    ctx.strokeStyle = "#aa8800";
                } else if (node.isHovered) {
                    ctx.fillStyle = "#ff6600";
                    ctx.strokeStyle = "#aa4400";
                } else {
                    ctx.fillStyle = node.isLeaf ?
                        (theme === "dark" ? "#4287f5" : "#0047AB") :
                        (theme === "dark" ? "#AA336A" : "#800080");
                    ctx.strokeStyle = theme === "dark" ? "#222233" : "#ffffff";
                }

                ctx.fill();
                ctx.stroke();
            });

            // Draw camera position/view indicator
            const [camX, camZ] = project(cameraPosition, scale);

            // Only draw if camera is within map bounds
            if (camX >= 0 && camX <= size && camZ >= 0 && camZ <= size) {
                // Camera position
                ctx.beginPath();
                ctx.arc(camX, camZ, 5, 0, Math.PI * 2);
                ctx.fillStyle = theme === "dark" ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)";
                ctx.fill();

                // View direction indicator
                ctx.beginPath();
                ctx.moveTo(camX, camZ);
                // Approximating direction based on camera position
                const dirX = centerX - cameraPosition.x;
                const dirZ = centerZ - cameraPosition.z;
                const dirLen = Math.sqrt(dirX * dirX + dirZ * dirZ);
                const normalizedDirX = dirX / dirLen;
                const normalizedDirZ = dirZ / dirLen;

                ctx.lineTo(
                    camX + normalizedDirX * 10,
                    camZ + normalizedDirZ * 10
                );
                ctx.strokeStyle = theme === "dark" ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)";
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            frameIdRef.current = requestAnimationFrame(drawFrame);
        };

        drawFrame();

        return () => {
            cancelAnimationFrame(frameIdRef.current);
        };
    }, [nodes, cameraPosition, size, theme]);

    return (
        <div
            className={`absolute bottom-4 right-4 rounded shadow-lg overflow-hidden ${theme === "dark" ? "border border-gray-700" : "border border-gray-300"}`}>
            <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className="block"
            />
        </div>
    );
};

export default MiniMap;
