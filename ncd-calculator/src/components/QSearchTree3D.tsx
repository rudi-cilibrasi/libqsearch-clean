import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Text, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { saveAs } from "file-saver";
import createGraph from "../functions/graphExport";

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

export const QSearchTree3D: React.FC<QSearchTree3DProps> = ({ data }) => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const scaleFactor = Math.max(1, Math.sqrt(data.nodes.length) / 4);

  const containerStyle: ContainerStyle = {
    width: "100%",
    height: "600px", // Fixed height
    position: "relative",
    overflow: "hidden",
    background: theme === "dark" ? "#1a1a2e" : "#f0f2f5" // Dark navy or light gray
  };

  const handleExport = (): void => {
    const dotFormat = createGraph(data, false);
    const blob = new Blob([dotFormat], { type: "text/plain;charset=utf-8" });
    saveAs(blob, "graph.dot");
  };

  const toggleTheme = (): void => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  return (
      <div style={containerStyle}>
        <div className="grid grid-cols-2 gap-2 p-4 absolute top-0 right-0 z-10">
          <button
              onClick={toggleTheme}
              className="bg-blue-600 text-white hover:bg-blue-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
          >
            {theme === "dark" ? "Light Theme" : "Dark Theme"}
          </button>
          <button
              onClick={handleExport}
              className="bg-green-600 text-white hover:bg-green-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
          >
            Export Graph
          </button>
        </div>

        <Canvas
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
          <color attach="background" args={[theme === "dark" ? "#1a1a2e" : "#f0f2f5"]} />
          <fog attach="fog" args={[theme === "dark" ? "#1a1a2e" : "#f0f2f5", 300, 500]} />
          <QSearchTree
              data={data}
              scaleFactor={scaleFactor}
              theme={theme}
          />
        </Canvas>

        {/* Help overlay */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded text-xs">
          <p>Mouse controls: Left-click rotate, Right-click pan, Scroll to zoom</p>
        </div>
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

const QSearchTree: React.FC<QSearchTreeProps> = ({ data, scaleFactor, theme }) => {
  const sceneRef = useRef<THREE.Scene>(null);
  const ballsRef = useRef<BallObject[]>([]);
  const springsRef = useRef<SpringObject[]>([]);
  const [graph, setGraph] = useState<string | null>(null);
  const simulationPhaseRef = useRef<SimulationPhase>("initial");
  const frameCountRef = useRef<number>(0);

  // Update when data or theme changes
  useEffect(() => {
    if (JSON.stringify(data) !== graph || theme) {
      loadGraph(data);
      setGraph(JSON.stringify(data));
      simulationPhaseRef.current = "initial";
      frameCountRef.current = 0;
    }
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
      const x = Math.cos(angle) * radius * Math.cos(level);
      const y = Math.sin(level) * radius;
      const z = Math.sin(angle) * radius * Math.cos(level);

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
    const { ballA, ballB, springRef } = spring;
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

  useFrame(({ camera }): void => {
    frameCountRef.current++;
    const phase = simulationPhaseRef.current;

    // Dynamic parameters based on simulation phase
    const dampingFactor = phase === "initial" ? 0.3 : 0.5;
    const timeStep = phase === "initial" ? 0.1 : 0.2;
    const repulsionStrength = (phase === "initial" ? 15 : 30) * scaleFactor;
    const minDistance = 1 * scaleFactor;
    const springStrength = phase === "initial" ? 0.01 : 0.02;
    const squishForce = phase === "initial" ? 0.05 : 0.1;

    // Transition between phases
    if (phase === "initial" && frameCountRef.current > 100) {
      simulationPhaseRef.current = "stabilizing";
    } else if (phase === "stabilizing" && frameCountRef.current > 200) {
      simulationPhaseRef.current = "stable";
    }

    const cameraDistance = camera.position.length();
    const labelScaleFactor = Math.max(
        0.5,
        cameraDistance / (100 * scaleFactor)
    );

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

          const phaseFactor =
              phase === "initial" ? Math.min(1, frameCountRef.current / 50) : 1;

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

        ball.velocity.add(force.multiplyScalar(timeStep));
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
            <sphereGeometry args={[ballSize, 32, 32]} />
            <meshStandardMaterial color={color} roughness={0.5} metalness={0.5} />
          </mesh>
      );

      // Create label with background for better visibility
      const label = (
          <Text
              ref={labelRef}
              position={[
                position.x,
                position.y + (isLeaf ? 6 : 4) * scaleFactor,
                position.z,
              ]}
              fontSize={1.5 * scaleFactor}
              color={textColor}
              anchorX="center"
              anchorY="middle"
              key={`label-${node.index}`}
              renderOrder={1}
              material-depthTest={false}
              outlineColor={theme === "dark" ? "#000000" : "#ffffff"}
              outlineWidth={0.05}
          >
            {node.label}
          </Text>
      );

      const velocity = new THREE.Vector3(0, 0, 0);
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

    // Create springs
    graph.nodes.forEach((node) => {
      node.connections.forEach((connectionIndex) => {
        const ballA = nodeMap.get(node.index);
        const ballB = nodeMap.get(connectionIndex);

        const hasSpring = springsRef.current.find(
            (spring) =>
                (spring.ballA === ballA?.ref && spring.ballB === ballB?.ref) ||
                (spring.ballA === ballB?.ref && spring.ballB === ballA?.ref)
        );

        if (ballA && ballB && !hasSpring) {
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
        <ambientLight intensity={0.5} />
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
