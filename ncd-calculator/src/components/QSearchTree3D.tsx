import React, {useEffect, useRef, useState} from "react";
import {Canvas, useFrame} from "@react-three/fiber";
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
}

interface ContainerStyle {
    width: string;
    height: string;
    position: "relative";
    overflow: "hidden";
    background: string;
}

export const QSearchTree3D: React.FC<QSearchTree3DProps> = ({data}) => {
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
                position={[scaleFactor * 100, scaleFactor * 100, scaleFactor * 100]}
                fov={60}
                near={1}
                far={1000}
              />
              <OrbitControls
                enablePan={true}
                enableZoom={true}
                enableRotate={true}
                autoRotate={true}
                autoRotateSpeed={0.5}
                maxDistance={scaleFactor * 300} // Limit zoom out
                minDistance={scaleFactor * 10}  // Limit zoom in
              />
              <color attach="background" args={[theme === "dark" ? "#1a1a2e" : "#f0f2f5"]}/>
              <fog attach="fog" args={[theme === "dark" ? "#1a1a2e" : "#f0f2f5", 300, 500]}/>
              <QSearchTree
                key={treeKey.current} // Force QSearchTree remount when data changes
                data={data}
                scaleFactor={scaleFactor}
                theme={theme}
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
              <button
                onClick={toggleDotGraph}
                className="bg-purple-600 text-white hover:bg-purple-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
              >
                  {showDotGraph ? "Show 3D Tree" : "Show DOT Graph"}
              </button>
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
}

interface BallObject {
    ball: JSX.Element;
    label: JSX.Element;
    ref: React.RefObject<THREE.Mesh>;
    labelRef: React.RefObject<any>; // Text component from @react-three/drei
    velocity: THREE.Vector3;
    index: number;
    isLeaf: boolean;
}

interface SpringObject {
    ballA: React.RefObject<THREE.Mesh>;
    ballB: React.RefObject<THREE.Mesh>;
    mesh: JSX.Element;
    springRef: React.RefObject<THREE.Mesh>;
}

type SimulationPhase = "initial" | "stabilizing" | "stable";

const QSearchTree: React.FC<QSearchTreeProps> = ({data, scaleFactor, theme}) => {
    const sceneRef = useRef<THREE.Scene>(null);
    const ballsRef = useRef<BallObject[]>([]);
    const springsRef = useRef<SpringObject[]>([]);
    const [graph, setGraph] = useState<string | null>(null);
    const simulationPhaseRef = useRef<SimulationPhase>("initial");
    const frameCountRef = useRef<number>(0);
    const processedConnectionsRef = useRef<Set<string>>(new Set());
    const hasInitializedRef = useRef<boolean>(false);
    
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
    
    const calculateInitialPositions = (
      nodes: QTreeNode[]
    ): Map<number, THREE.Vector3> => {
        const positions = new Map<number, THREE.Vector3>();
        const visited = new Set<number>();
        const spread = 25 * scaleFactor;
        
        // Find root nodes (nodes with most connections)
        const sortedNodes = [...nodes].sort(
          (a, b) => b.connections.length - a.connections.length
        );
        const rootNode = sortedNodes[0];
        
        // Recursive function to position nodes in a tree-like structure
        const positionNode = (
          node: QTreeNode,
          angle: number,
          radius: number,
          level: number
        ): void => {
            if (visited.has(node.index)) return;
            visited.add(node.index);
            
            // Calculate position using spherical coordinates
            // Add small random offset to prevent perfect symmetry
            const randOffset = 0.1;
            const x = Math.cos(angle) * radius * Math.cos(level) + (Math.random() - 0.5) * randOffset * radius;
            const y = Math.sin(level) * radius + (Math.random() - 0.5) * randOffset * radius;
            const z = Math.sin(angle) * radius * Math.cos(level) + (Math.random() - 0.5) * randOffset * radius;
            
            positions.set(node.index, new THREE.Vector3(x, y, z));
            
            // Position connected nodes
            const connectionCount = node.connections.length;
            if (connectionCount > 0) {
                const angleStep = (2 * Math.PI) / connectionCount;
                node.connections.forEach((connectedIndex, i) => {
                    const connectedNode = nodes.find((n) => n.index === connectedIndex);
                    if (connectedNode && !visited.has(connectedIndex)) {
                        const newAngle = angle + angleStep * i;
                        const newRadius = radius * 0.8;
                        const newLevel = level + Math.PI / 6;
                        positionNode(connectedNode, newAngle, newRadius, newLevel);
                    }
                });
            }
        };
        
        // Start positioning from root node
        positionNode(rootNode, 0, spread, 0);
        
        // Handle any disconnected nodes
        nodes.forEach((node) => {
            if (!visited.has(node.index)) {
                const angle = Math.random() * Math.PI * 2;
                const radius = spread * (0.5 + Math.random() * 0.5);
                const level = Math.random() * Math.PI - Math.PI / 2;
                positionNode(node, angle, radius, level);
            }
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
    
    useFrame(({camera}): void => {
        // Only run simulation if initialized
        if (!hasInitializedRef.current) return;
        
        frameCountRef.current++;
        const phase = simulationPhaseRef.current;
        
        // Shorter phase transitions
        if (phase === "initial" && frameCountRef.current > 50) {
            simulationPhaseRef.current = "stabilizing";
        } else if (phase === "stabilizing" && frameCountRef.current > 100) {
            simulationPhaseRef.current = "stable";
        }
        
        // Dynamic parameters optimized for faster expansion
        const dampingFactor = phase === "initial" ? 0.25 : 0.5; // Reduced damping initially
        
        // Calculate system energy for adaptive time step
        const systemEnergy = ballsRef.current.reduce((sum, ball) =>
          sum + (ball.velocity ? ball.velocity.lengthSq() : 0), 0);
        const energyFactor = Math.min(1, 0.5 / Math.max(0.1, systemEnergy));
        
        // Adaptive time step based on system energy
        const timeStep = phase === "initial"
          ? Math.min(0.3, 0.2 * (1 + energyFactor))
          : 0.2;
        
        // Stronger initial repulsion with faster ramp-up
        const repulsionStrength = (phase === "initial" ? 60 : 30) * scaleFactor;
        const minDistance = scaleFactor;
        const springStrength = phase === "initial" ? 0.01 : 0.02;
        const squishForce = phase === "initial" ? 0.05 : 0.1;
        
        const cameraDistance = camera.position.length();
        const labelScaleFactor = Math.max(
          1.0,
          cameraDistance / (100 * scaleFactor)
        );
        
        // For all calculations below, speed up the initial phase using a faster ramp-up
        const phaseFactor = phase === "initial" ? Math.min(1, frameCountRef.current / 30) : 1;
        
        // Calculate total kinetic energy to monitor stability
        let totalKineticEnergy = 0;
        
        ballsRef.current.forEach((ball) => {
            const force = new THREE.Vector3();
            
            ballsRef.current.forEach((otherBall) => {
                if (ball !== otherBall && ball.ref.current && otherBall.ref.current) {
                    if (!ball.ref.current || !otherBall.ref.current) return;
                    const direction = ball.ref.current.position
                      .clone()
                      .sub(otherBall.ref.current.position);
                    let distance = direction.length();
                    if (distance < minDistance) distance = minDistance;
                    direction.normalize();
                    
                    force.add(
                      direction.multiplyScalar(
                        (repulsionStrength * phaseFactor) / (distance * distance)
                      )
                    );
                }
            });
            
            // Continue with spring forces...
            springsRef.current.forEach((spring) => {
                if (
                  (spring.ballA.current === ball.ref.current ||
                    spring.ballB.current === ball.ref.current) &&
                  spring.ballA.current &&
                  spring.ballB.current &&
                  ball.ref.current
                ) {
                    const otherBall =
                      spring.ballA.current === ball.ref.current
                        ? spring.ballB
                        : spring.ballA;
                    if (!otherBall.current) return;
                    const direction = new THREE.Vector3().subVectors(
                      otherBall.current.position,
                      ball.ref.current.position
                    );
                    const currentLength = direction.length();
                    direction.normalize();
                    force.add(direction.multiplyScalar(springStrength * currentLength));
                }
            });
            
            // Apply exponentially-decaying outward force for faster initial expansion
            if (phase === "initial" && frameCountRef.current < 40) {
                const dirFromCenter = ball.ref.current?.position.clone().normalize() || new THREE.Vector3();
                const expansionForce = 3.0 * Math.exp(-frameCountRef.current / 20);
                force.add(dirFromCenter.multiplyScalar(expansionForce));
            }
            
            if (ball && ball.ref.current) {
                const ballRef = ball.ref.current;
                const distanceToXY = Math.abs(ballRef.position.z);
                force.add(
                  new THREE.Vector3(
                    0,
                    0,
                    -Math.sign(ballRef.position.z) * squishForce * distanceToXY
                  )
                );
                force.add(ball.velocity.clone().multiplyScalar(-dampingFactor));
                
                // Apply force limiting to prevent instability
                const maxForce = 8; // Increased max force for faster expansion
                if (force.length() > maxForce) {
                    force.normalize().multiplyScalar(maxForce);
                }
                
                ball.velocity.add(force.multiplyScalar(timeStep));
                
                // Apply velocity limiting with higher initial limit
                const maxVelocity = phase === "initial" ? 5 : 2;
                if (ball.velocity.length() > maxVelocity) {
                    ball.velocity.normalize().multiplyScalar(maxVelocity);
                }
                
                ballRef.position.add(ball.velocity.clone().multiplyScalar(timeStep));
                
                totalKineticEnergy += ball.velocity.lengthSq();
                
                if (ball.labelRef.current) {
                    const labelOffset = (ball.isLeaf ? 6 : 4) * scaleFactor;
                    ball.labelRef.current.position.copy(ballRef.position);
                    ball.labelRef.current.position.y += labelOffset;
                    ball.labelRef.current.quaternion.copy(camera.quaternion);
                    ball.labelRef.current.scale.setScalar(labelScaleFactor);
                }
            }
        });
        
        springsRef.current.forEach(updateSpring);
    });
    
    const loadGraph = (graph: QTreeResponse): void => {
        ballsRef.current = [];
        springsRef.current = [];
        processedConnectionsRef.current.clear();
        
        const nodeMap = new Map<number, BallObject>();
        const initialPositions = calculateInitialPositions(graph.nodes);
        
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
            
            const ballSize = (isLeaf ? 4 : 2) * scaleFactor;
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
            
            // Create label with background for better visibility
            const label = (
              <Text
                ref={labelRef}
                position={[
                    position.x,
                    position.y + (isLeaf ? 8 : 6) * scaleFactor, // Increased offset
                    position.z,
                ]}
                fontSize={2.2 * scaleFactor} // Increased font size
                color={textColor}
                anchorX="center"
                anchorY="middle"
                key={`label-${node.index}`}
                renderOrder={1}
                material-depthTest={false}
                outlineColor={theme === "dark" ? "#000000" : "#ffffff"}
                outlineWidth={0.1} // Thicker outline
                backgroundColor={theme === "dark" ? "#00000080" : "#ffffff80"} // Semi-transparent background
                padding={0.5 * scaleFactor} // Add padding
                maxWidth={20 * scaleFactor} // Limit width for long labels
                overflowWrap="break-word" // Break long words if needed
              >
                  {node.label}
              </Text>
            );
            
            // Add some initial outward velocity to help with expansion
            const dirFromCenter = new THREE.Vector3(position.x, position.y, position.z);
            dirFromCenter.normalize();
            
            const velocity = new THREE.Vector3(
              dirFromCenter.x * 0.5 + (Math.random() - 0.5) * 0.1,
              dirFromCenter.y * 0.5 + (Math.random() - 0.5) * 0.1,
              dirFromCenter.z * 0.5 + (Math.random() - 0.5) * 0.1
            );
            
            const ballObj: BallObject = {
                ball,
                label,
                ref: ballRef,
                labelRef,
                velocity,
                index: node.index,
                isLeaf,
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
                            args={[0.5 * scaleFactor, 0.5 * scaleFactor, 1, 8]}
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
          {ballsRef.current.map((ballObj) => (
            <group key={`group-${ballObj.index}`}>
                {ballObj.ball}
                {ballObj.label}
            </group>
          ))}
          {springsRef.current.map((springObj) => springObj.mesh)}
      </scene>
    );
};

export default QSearchTree3D;
