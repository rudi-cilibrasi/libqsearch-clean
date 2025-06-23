import React, {useEffect, useRef, useState} from "react";
import {Canvas, useFrame, useThree} from "@react-three/fiber";
import * as THREE from "three";
import {OrbitControls, PerspectiveCamera, Text} from "@react-three/drei";
import {saveAs} from "file-saver";
import createGraph from "../functions/graphExport";
import { DotGraphVisualizer } from "./DotGraphVisualizer";

// Types for the graph data
export interface QTreeNode {
    index: number;
    label: string;
    connections: number[];
}

export interface QTreeResponse {
    nodes: QTreeNode[];
}

export interface QSearchTree3DProps {
    data: QTreeResponse;
    darkThemeOnly?: boolean;
    labelManager?: any; // Add labelManager prop
}

interface ContainerStyle {
    width: string;
    height: string;
    position: "relative";
    overflow: "hidden";
    background: string;
}

export const QSearchTree3D: React.FC<QSearchTree3DProps> = ({data, labelManager}) => {
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [showDotGraph, setShowDotGraph] = useState<boolean>(false);
    const scaleFactor = Math.max(1, Math.sqrt(data.nodes.length) / 4);
    // Create a key that changes whenever data changes to force component remounting
    const treeKey = useRef(Math.random().toString(36));
    
    // Update the key when data changes to force a complete remount
    useEffect(() => {
        treeKey.current = Math.random().toString(36);
    }, [data]);
    
    const containerStyle: ContainerStyle = {
        width: "100%",
        height: "600px", // Fixed height
        position: "relative",
        overflow: "hidden",
        background: theme === "dark" ? "#1a1a2e" : "#f0f2f5" // Dark navy or light gray
    };
    
    const handleExport = (): void => {
        const dotFormat = createGraph(data, false);
        const blob = new Blob([dotFormat], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "graph.dot");
    };
    
    const toggleTheme = (): void => {
        setTheme(prev => prev === "dark" ? "light" : "dark");
    };
    
    const toggleDotGraph = (): void => {
        setShowDotGraph(prev => !prev);
    };
    
    // Render either the 3D Tree or the DOT Graph based on state
    const renderVisualization = () => {
        if (showDotGraph) {
            return (
              <div className="w-full h-full" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  <DotGraphVisualizer data={data} />
              </div>
            );
        }
        
        return (
          <Canvas
            key={treeKey.current} // Force Canvas remount when data changes
            shadows
            dpr={[1, 2]} // Better render quality on high DPI screens
          >
              <PerspectiveCamera
                makeDefault
                position={[0, 0, scaleFactor * 100]} // Moved closer for bigger appearance
                fov={75} // Increased FOV for wider view
                near={1}
                far={1500}
              />
              <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                autoRotate={false} // Disabled auto-rotate to allow manual positioning
                autoRotateSpeed={0.5}
                maxDistance={scaleFactor * 250} // Adjusted max zoom out
                minDistance={scaleFactor * 18}  // Adjusted minimum distance
                target={[0, 0, 0]} // Center target since tree is now properly centered
              />
              <color attach="background" args={[theme === "dark" ? "#1a1a2e" : "#f0f2f5"]}/>
              <fog attach="fog" args={[theme === "dark" ? "#1a1a2e" : "#f0f2f5", 300, 500]}/>
              <QSearchTree
                key={treeKey.current} // Force QSearchTree remount when data changes
                data={data}
                scaleFactor={scaleFactor}
                theme={theme}
                labelManager={labelManager}
              />
          </Canvas>
        );
    };
    
    return (
      <div style={containerStyle}>
          {/* Fixed horizontal button layout for both views */}
          <div className="flex absolute top-4 right-4 space-x-2 z-10">
              {!showDotGraph && (
                <button
                  onClick={toggleTheme}
                  className="bg-blue-600 text-white hover:bg-blue-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
                >
                    {theme === "dark" ? "Light Theme" : "Dark Theme"}
                </button>
              )}
              {/*<button*/}
              {/*  onClick={toggleDotGraph}*/}
              {/*  className="bg-purple-600 text-white hover:bg-purple-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"*/}
              {/*>*/}
              {/*    {showDotGraph ? "Show 3D Tree" : "Show DOT Graph"}*/}
              {/*</button>*/}
              <button
                onClick={handleExport}
                className="bg-green-600 text-white hover:bg-green-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
              >
                  Export Graph
              </button>
          </div>
          
          {/* Render either the 3D Tree or DOT Graph based on state */}
          {renderVisualization()}
          
          {/* Help overlay - only shown when 3D Tree is active */}
          {!showDotGraph && (
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded text-xs">
                <p>Mouse controls: Left-click rotate, Right-click pan, Scroll to zoom</p>
                <p>The tree can be repositioned by dragging with right-click</p>
            </div>
          )}
      </div>
    );
};

// Types for the QSearchTree component
interface QSearchTreeProps {
    data: QTreeResponse;
    scaleFactor: number;
    theme: "light" | "dark";
    labelManager?: any;
}

interface BallObject {
    ball: JSX.Element;
    label: JSX.Element;
    ref: React.RefObject<THREE.Mesh>;
    labelRef: React.RefObject<any>; // Text component from @react-three/drei
    velocity: THREE.Vector3;
    index: number;
    isLeaf: boolean;
    originalPosition?: THREE.Vector3;
    labelOffset?: number;
}

interface SpringObject {
    ballA: React.RefObject<THREE.Mesh>;
    ballB: React.RefObject<THREE.Mesh>;
    mesh: JSX.Element;
    springRef: React.RefObject<THREE.Mesh>;
}

type SimulationPhase = "initial" | "stabilizing" | "stable";

const QSearchTree: React.FC<QSearchTreeProps> = ({data, scaleFactor, theme, labelManager}) => {
    const sceneRef = useRef<THREE.Scene>(null);
    const ballsRef = useRef<BallObject[]>([]);
    const springsRef = useRef<SpringObject[]>([]);
    const [graph, setGraph] = useState<string | null>(null);
    const simulationPhaseRef = useRef<SimulationPhase>("initial");
    const frameCountRef = useRef<number>(0);
    const processedConnectionsRef = useRef<Set<string>>(new Set());
    const hasInitializedRef = useRef<boolean>(false);
    const groupRef = useRef<THREE.Group>(null);
    const [groupPosition, setGroupPosition] = useState<THREE.Vector3>(new THREE.Vector3(0, -scaleFactor * 10, 0)); // Start lower
    
    // Update when data or theme changes with complete reset
    useEffect(() => {
        // Clear all internal state
        ballsRef.current = [];
        springsRef.current = [];
        processedConnectionsRef.current.clear();
        simulationPhaseRef.current = "initial";
        frameCountRef.current = 0;
        hasInitializedRef.current = false;
        
        // Force null graph state to ensure useEffect triggers
        setGraph(null);
        
        // Small delay to ensure clean state before loading
        setTimeout(() => {
            if (data && data.nodes) {
                loadGraph(data);
                setGraph(JSON.stringify(data));
                hasInitializedRef.current = true;
            }
        }, 50);
    }, [data, theme]);
    
    /**
     * Calculate beautiful tree layout using Reingold-Tilford hierarchical algorithm
     * This creates an aesthetically pleasing tree with proper spacing.
     * 
     * Reference: Reingold, E. M., & Tilford, J. S. (1981).
     * "Tidier drawings of trees" IEEE Transactions on Software Engineering, 7(2), 223-228.
     * 
     * Algorithm principles:
     * 1. Hierarchical positioning with proper levels
     * 2. Aesthetic spacing between siblings and subtrees
     * 3. Balanced layout preventing overlaps
     * 4. Beautiful visual tree structure
     */
    const calculateOptimalPositions = (
      nodes: QTreeNode[]
    ): Map<number, THREE.Vector3> => {
        const positions = new Map<number, THREE.Vector3>();
        
        if (nodes.length === 0) return positions;
        
        // Build adjacency list for tree traversal
        const adjacency = new Map<number, number[]>();
        nodes.forEach(node => {
            adjacency.set(node.index, node.connections);
        });
        
        // Find root node (node with most connections, or center of tree)
        const rootNode = nodes.reduce((max, node) => 
            node.connections.length > max.connections.length ? node : max
        );
        
        // Calculate tree structure with levels
        const visited = new Set<number>();
        const levels = new Map<number, number>(); // node -> level
        const children = new Map<number, number[]>(); // parent -> children
        const parent = new Map<number, number>(); // child -> parent
        
        // BFS to establish tree hierarchy
        const queue = [{node: rootNode.index, level: 0, parentIndex: -1}];
        visited.add(rootNode.index);
        levels.set(rootNode.index, 0);
        
        while (queue.length > 0) {
            const {node: nodeIndex, level, parentIndex} = queue.shift()!;
            
            if (parentIndex !== -1) {
                parent.set(nodeIndex, parentIndex);
                if (!children.has(parentIndex)) {
                    children.set(parentIndex, []);
                }
                children.get(parentIndex)!.push(nodeIndex);
            }
            
            const nodeConnections = adjacency.get(nodeIndex) || [];
            nodeConnections.forEach(connectedIndex => {
                if (!visited.has(connectedIndex)) {
                    visited.add(connectedIndex);
                    levels.set(connectedIndex, level + 1);
                    queue.push({node: connectedIndex, level: level + 1, parentIndex: nodeIndex});
                }
            });
        }
        
        // Calculate positions using hierarchical layout with proper spacing
        const levelSpacing = 50 * scaleFactor; // Increased vertical distance between levels
        const minSiblingSpacing = 60 * scaleFactor; // Increased horizontal spacing to prevent overlap
        
        // Position calculation with proper spacing
        const subtreeWidths = new Map<number, number>();
        const nodeXPositions = new Map<number, number>();
        
        // Post-order traversal to calculate subtree widths
        const calculateSubtreeWidth = (nodeIndex: number): number => {
            const nodeChildren = children.get(nodeIndex) || [];
            
            if (nodeChildren.length === 0) {
                subtreeWidths.set(nodeIndex, minSiblingSpacing);
                return minSiblingSpacing;
            }
            
            let totalWidth = 0;
            nodeChildren.forEach(childIndex => {
                totalWidth += calculateSubtreeWidth(childIndex);
            });
            
                         // Add extra spacing for larger subtrees and ensure minimum separation
             totalWidth = Math.max(totalWidth, nodeChildren.length * minSiblingSpacing * 1.5);
             subtreeWidths.set(nodeIndex, totalWidth);
             return totalWidth;
        };
        
        // Calculate X positions with proper centering
        const calculateXPositions = (nodeIndex: number, leftBound: number): number => {
            const nodeChildren = children.get(nodeIndex) || [];
            const subtreeWidth = subtreeWidths.get(nodeIndex) || minSiblingSpacing;
            
            if (nodeChildren.length === 0) {
                // Leaf node
                nodeXPositions.set(nodeIndex, leftBound + subtreeWidth / 2);
                return leftBound + subtreeWidth;
            }
            
            // Internal node - position children first
            let currentX = leftBound;
            const childXPositions: number[] = [];
            
            nodeChildren.forEach(childIndex => {
                const childWidth = subtreeWidths.get(childIndex) || minSiblingSpacing;
                const childCenterX = currentX + childWidth / 2;
                childXPositions.push(childCenterX);
                currentX = calculateXPositions(childIndex, currentX);
            });
            
            // Position this node at the center of its children
            const leftmostChild = Math.min(...childXPositions);
            const rightmostChild = Math.max(...childXPositions);
            const nodeX = (leftmostChild + rightmostChild) / 2;
            nodeXPositions.set(nodeIndex, nodeX);
            
            return leftBound + subtreeWidth;
        };
        
        // Execute layout calculation
        calculateSubtreeWidth(rootNode.index);
        calculateXPositions(rootNode.index, 0);
        
        // Convert to 3D positions with better centering and collision prevention
        const maxLevel = Math.max(...levels.values());
        const totalTreeHeight = maxLevel * levelSpacing;
        const totalWidth = subtreeWidths.get(rootNode.index) || minSiblingSpacing;
        
        // Don't scale down as much to maintain proper spacing
        const maxDimension = Math.max(totalTreeHeight, totalWidth);
        const targetMaxSize = 150 * scaleFactor; // Larger target size to prevent compression
        const scaleDown = maxDimension > targetMaxSize ? targetMaxSize / maxDimension : 1;
        
        // First pass: calculate initial positions
        const initialPositions = new Map<number, THREE.Vector3>();
        nodes.forEach(node => {
            const level = levels.get(node.index) || 0;
            const x = nodeXPositions.get(node.index) || 0;
            
            // Center both horizontally and vertically
            const centeredX = (x - totalWidth / 2) * scaleDown;
            const centeredY = (totalTreeHeight / 2 - level * levelSpacing) * scaleDown;
            
            // Minimal Z variation for cleaner look
            const z = (Math.sin(centeredX * 0.02) * 2 + Math.cos(centeredY * 0.02) * 2) * scaleFactor;
            
            initialPositions.set(node.index, new THREE.Vector3(centeredX, centeredY, z));
        });
        
        // Second pass: apply multiple iterations of collision detection and separation
        const minDistance = 18 * scaleFactor; // Increased minimum distance between any two nodes
        const finalPositions = new Map<number, THREE.Vector3>();
        
        // Copy initial positions to working positions
        nodes.forEach(node => {
            finalPositions.set(node.index, initialPositions.get(node.index)!.clone());
        });
        
        // Apply multiple iterations of collision resolution
        for (let iteration = 0; iteration < 5; iteration++) {
            let hasCollisions = false;
            
            // Check all pairs for collisions
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeA = nodes[i];
                    const nodeB = nodes[j];
                    const posA = finalPositions.get(nodeA.index)!;
                    const posB = finalPositions.get(nodeB.index)!;
                    
                    const distance = posA.distanceTo(posB);
                    if (distance < minDistance && distance > 0) {
                        hasCollisions = true;
                        
                        // Calculate separation vector
                        const separation = new THREE.Vector3().subVectors(posA, posB);
                        const separationNeeded = (minDistance - distance) / 2;
                        
                        if (separation.length() === 0) {
                            // If positions are identical, create random separation
                            separation.set(
                                (Math.random() - 0.5) * minDistance,
                                (Math.random() - 0.5) * minDistance,
                                (Math.random() - 0.5) * minDistance * 0.2
                            );
                        }
                        
                        separation.normalize().multiplyScalar(separationNeeded);
                        
                        // Move both nodes apart
                        posA.add(separation);
                        posB.sub(separation);
                    }
                }
            }
            
            // If no collisions found, we're done
            if (!hasCollisions) break;
        }
        
        // Copy final positions to return map
        finalPositions.forEach((pos, nodeIndex) => {
            positions.set(nodeIndex, pos);
        });
        
        return positions;
    };
    
    const updateSpring = (spring: SpringObject): void => {
        const {ballA, ballB, springRef} = spring;
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
        
        const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        if (axis.length() === 0) return;
        
        const angle = Math.acos(
          Math.min(1, Math.max(-1, new THREE.Vector3(0, 1, 0).dot(direction.normalize())))
        );
        springRef.current.setRotationFromAxisAngle(axis, angle);
    };
    
    /**
     * Simplified frame update - only handles label orientation and spring updates
     * No physics simulation needed since positions are pre-calculated optimally
     */
    useFrame(({camera}): void => {
        // Only run if initialized
        if (!hasInitializedRef.current) return;
        
        // Calculate label scale based on camera distance for better visibility
        const cameraDistance = camera.position.length();
        const labelScaleFactor = Math.max(
          1.0,
          cameraDistance / (100 * scaleFactor)
        );
        
        // Update label orientations to always face camera (billboard effect)
        // Only update labels for leaf nodes (internal nodes don't have labels)
        ballsRef.current.forEach((ball) => {
            if (ball.labelRef.current && ball.ref.current && ball.isLeaf) {
                const labelOffset = ball.labelOffset || 10 * scaleFactor;
                
                // Simple label positioning - no complex collision detection needed
                // since optimal positions minimize overlaps
                ball.labelRef.current.position.copy(ball.ref.current.position);
                ball.labelRef.current.position.y += labelOffset;
                ball.labelRef.current.quaternion.copy(camera.quaternion);
                ball.labelRef.current.scale.setScalar(labelScaleFactor);
            }
        });
        
        // Update spring geometries
        springsRef.current.forEach(updateSpring);
    });
    
    const loadGraph = (graph: QTreeResponse): void => {
        ballsRef.current = [];
        springsRef.current = [];
        processedConnectionsRef.current.clear();
        
        // Debug: Show current label manager state
        if (labelManager) {
            console.log("=== QSearchTree3D loadGraph - LabelManager State ===");
            labelManager.logMappings();
        }
        
        const nodeMap = new Map<number, BallObject>();
        const initialPositions = calculateOptimalPositions(graph.nodes);
        
        // Get theme-appropriate colors
        const leafNodeColor = theme === "dark" ? 0x4287f5 : 0x0047AB; // Blue
        const internalNodeColor = theme === "dark" ? 0xAA336A : 0x800080; // Purple
        const springColor = theme === "dark" ? 0x555555 : 0xAAAAAA; // Gray
        const textColor = theme === "dark" ? "white" : "black";
        
        // Create balls and labels
        graph.nodes.forEach((node) => {
            const position = initialPositions.get(node.index)!;
            const isLeaf = node.connections.length === 1;
            const color = isLeaf ? leafNodeColor : internalNodeColor;
            
            const ballRef = React.createRef<THREE.Mesh>();
            const labelRef = React.createRef<any>(); // Text component from @react-three/drei
            
            const ballSize = (isLeaf ? 4 : 3) * scaleFactor; // Reduced ball sizes for better fit
            const ball = (
              <mesh
                ref={ballRef}
                position={[position.x, position.y, position.z]}
                key={`ball-${node.index}`}
                castShadow
                receiveShadow
              >
                  <sphereGeometry args={[ballSize, 32, 32]}/>
                  <meshStandardMaterial color={color} roughness={0.5} metalness={0.5}/>
              </mesh>
            );
            
            // Create label only for leaf nodes (blue nodes with animal names)
            const labelOffsetDistance = ballSize * 1.8; // Proportional to ball size
            const fontSize = ballSize * 0.6; // Make text proportional to ball size (60% of ball diameter)
            
            // Get proper display label for leaf nodes
            let displayLabel = "";
            if (isLeaf) {
                // For leaf nodes, use the robust label resolution from labelManager
                const originalLabel = node.label;
                displayLabel = labelManager?.findDisplayLabel(originalLabel) || originalLabel;
                console.log(`Leaf node ${node.index}: original="${originalLabel}", display="${displayLabel}"`);
            }
            
            const label = isLeaf ? (
              <Text
                ref={labelRef}
                position={[
                    position.x,
                    position.y + labelOffsetDistance,
                    position.z,
                ]}
                fontSize={fontSize} // Proportional font size
                color={textColor}
                anchorX="center"
                anchorY="middle"
                key={`label-${node.index}`}
                renderOrder={1}
                material-depthTest={false}
                outlineColor={theme === "dark" ? "#000000" : "#ffffff"}
                outlineWidth={fontSize * 0.05} // Outline proportional to font size
                maxWidth={ballSize * 6} // Width proportional to ball size
              >
                  {displayLabel}
              </Text>
            ) : (
              // Empty element for internal nodes (no label)
              <group key={`empty-label-${node.index}`} />
            );
            
            // No velocity needed since positions are pre-calculated optimally
            const velocity = new THREE.Vector3(0, 0, 0); // Static positions
            
            const ballObj: BallObject = {
                ball,
                label,
                ref: ballRef,
                labelRef,
                velocity,
                index: node.index,
                isLeaf,
                originalPosition: position.clone(),
                labelOffset: labelOffsetDistance,
            };
            
            ballsRef.current.push(ballObj);
            nodeMap.set(node.index, ballObj);
        });
        
        // Create springs - handle duplicate connections
        const processedConnections = processedConnectionsRef.current;
        
        graph.nodes.forEach((node) => {
            node.connections.forEach((connectionIndex) => {
                // Create unique ID for this connection
                const connectionId = [Math.min(node.index, connectionIndex),
                    Math.max(node.index, connectionIndex)].join('-');
                
                // Skip if we've already processed this connection
                if (processedConnections.has(connectionId)) return;
                processedConnections.add(connectionId);
                
                const ballA = nodeMap.get(node.index);
                const ballB = nodeMap.get(connectionIndex);
                
                if (ballA && ballB) {
                    const springRef = React.createRef<THREE.Mesh>();
                    const spring = (
                      <mesh
                        ref={springRef}
                        key={`${ballA.index}-${ballB.index}`}
                        castShadow
                      >
                          <cylinderGeometry
                            args={[0.7 * scaleFactor, 0.7 * scaleFactor, 1, 8]} // Reduced spring thickness
                          />
                          <meshStandardMaterial
                            color={springColor}
                            roughness={0.7}
                            metalness={0.3}
                          />
                      </mesh>
                    );
                    
                    springsRef.current.push({
                        ballA: ballA.ref,
                        ballB: ballB.ref,
                        mesh: spring,
                        springRef,
                    });
                }
            });
        });
    };
    
    // Add drag functionality using mouse events
    const handlePointerDown = (event: any) => {
        if (event.button === 2) { // Right click
            event.stopPropagation();
        }
    };

    return (
      <scene ref={sceneRef}>
          <ambientLight intensity={0.5}/>
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
          <group 
            ref={groupRef} 
            position={groupPosition}
            onPointerDown={handlePointerDown}
          >
            {ballsRef.current.map((ballObj) => (
              <group key={`group-${ballObj.index}`}>
                  {ballObj.ball}
                  {ballObj.label}
              </group>
            ))}
            {springsRef.current.map((springObj) => springObj.mesh)}
          </group>
      </scene>
    );
};

export default QSearchTree3D;
