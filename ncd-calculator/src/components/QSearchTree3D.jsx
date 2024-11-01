import React, {useEffect, useRef, useState} from 'react';
import {Canvas, useFrame} from "@react-three/fiber";
import * as THREE from "three";
import {Text, OrbitControls} from "@react-three/drei";

export const QSearchTree3D = ({data}) => {
    const scaleFactor = Math.max(1, Math.sqrt(data.nodes.length) / 4);
    const containerStyle = {
        width: '100%',
        height: '80vh',
        position: 'relative',
        overflow: 'hidden'
    };

    return (
        <div style={containerStyle}>
            <Canvas
                camera={{
                    position: [scaleFactor * 100, scaleFactor * 100, scaleFactor * 100],
                    fov: 60,
                    near: 1,
                    far: 1000
                }}
            >
                <OrbitControls
                    enablePan={true}
                    enableZoom={true}
                    enableRotate={true}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                />
                <QSearchTree data={data} scaleFactor={scaleFactor} />
            </Canvas>
        </div>
    );
};

const QSearchTree = ({data, scaleFactor}) => {
    const sceneRef = useRef();
    const ballsRef = useRef([]);
    const springsRef = useRef([]);
    const [graph, setGraph] = useState(null);
    const simulationPhaseRef = useRef('initial'); // 'initial', 'stabilizing', 'stable'
    const frameCountRef = useRef(0);

    useEffect(() => {
        if (JSON.stringify(data) !== graph) {
            loadGraph(data);
            setGraph(JSON.stringify(data));
            simulationPhaseRef.current = 'initial';
            frameCountRef.current = 0;
        }
    }, [data]);

    const calculateInitialPositions = (nodes) => {
        const positions = new Map();
        const visited = new Set();
        const spread = 25 * scaleFactor;

        // Find root nodes (nodes with most connections)
        const sortedNodes = [...nodes].sort((a, b) => b.connections.length - a.connections.length);
        const rootNode = sortedNodes[0];

        // Recursive function to position nodes in a tree-like structure
        const positionNode = (node, angle, radius, level) => {
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
                    const connectedNode = nodes.find(n => n.index === connectedIndex);
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
        nodes.forEach(node => {
            if (!visited.has(node.index)) {
                const angle = Math.random() * Math.PI * 2;
                const radius = spread * (0.5 + Math.random() * 0.5);
                const level = Math.random() * Math.PI - Math.PI / 2;
                positionNode(node, angle, radius, level);
            }
        });

        return positions;
    };

    const updateSpring = (spring) => {
        const {ballA, ballB, springRef} = spring;
        if (!ballA.current || !ballB.current || !springRef.current) return;

        const positionA = ballA.current.position;
        const positionB = ballB.current.position;
        const midPoint = new THREE.Vector3().addVectors(positionA, positionB).multiplyScalar(0.5);
        springRef.current.position.copy(midPoint);

        const currentLength = positionA.distanceTo(positionB);
        springRef.current.scale.set(1, currentLength, 1);

        const direction = new THREE.Vector3().subVectors(positionB, positionA);
        const axis = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
        const angle = Math.acos(new THREE.Vector3(0, 1, 0).dot(direction.normalize()));
        springRef.current.setRotationFromAxisAngle(axis, angle);
    };

    useFrame(({camera}) => {
        frameCountRef.current++;
        const phase = simulationPhaseRef.current;

        // Dynamic parameters based on simulation phase
        const dampingFactor = phase === 'initial' ? 0.3 : 0.5;
        const timeStep = phase === 'initial' ? 0.1 : 0.2;
        const repulsionStrength = (phase === 'initial' ? 15 : 30) * scaleFactor;
        const minDistance = 1 * scaleFactor;
        const springStrength = phase === 'initial' ? 0.01 : 0.02;
        const squishForce = phase === 'initial' ? 0.05 : 0.1;

        // Transition between phases
        if (phase === 'initial' && frameCountRef.current > 100) {
            simulationPhaseRef.current = 'stabilizing';
        } else if (phase === 'stabilizing' && frameCountRef.current > 200) {
            simulationPhaseRef.current = 'stable';
        }

        const cameraDistance = camera.position.length();
        const labelScaleFactor = Math.max(0.5, cameraDistance / (100 * scaleFactor));

        // Calculate total kinetic energy to monitor stability
        let totalKineticEnergy = 0;

        ballsRef.current.forEach((ball) => {
            const force = new THREE.Vector3();

            ballsRef.current.forEach((otherBall) => {
                if (ball !== otherBall && ball.ref.current && otherBall.ref.current) {
                    const direction = ball.ref.current.position.clone().sub(otherBall.ref.current.position);
                    let distance = direction.length();
                    if (distance < minDistance) distance = minDistance;
                    direction.normalize();

                    // Gradual force application during initial phase
                    const phaseFactor = phase === 'initial' ?
                        Math.min(1, frameCountRef.current / 50) : 1;

                    force.add(direction.multiplyScalar(repulsionStrength * phaseFactor / (distance * distance)));
                }
            });

            springsRef.current.forEach((spring) => {
                if ((spring.ballA.current === ball.ref.current || spring.ballB.current === ball.ref.current) &&
                    spring.ballA.current && spring.ballB.current) {
                    const otherBall = spring.ballA.current === ball.ref.current ? spring.ballB : spring.ballA;
                    const direction = new THREE.Vector3().subVectors(otherBall.current.position, ball.ref.current.position);
                    const currentLength = direction.length();
                    direction.normalize();
                    force.add(direction.multiplyScalar(springStrength * currentLength));
                }
            });

            if (ball && ball.ref.current) {
                const ballRef = ball.ref.current;
                const distanceToXY = Math.abs(ballRef.position.z);
                force.add(new THREE.Vector3(
                    0,
                    0,
                    -Math.sign(ballRef.position.z) * squishForce * distanceToXY
                ));
                force.add(ball.velocity.clone().multiplyScalar(-dampingFactor));

                ball.velocity.add(force.multiplyScalar(timeStep));
                ballRef.position.add(ball.velocity.clone().multiplyScalar(timeStep));

                // Calculate kinetic energy
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

    const loadGraph = (graph) => {
        ballsRef.current = [];
        springsRef.current = [];

        const nodeMap = new Map();
        const initialPositions = calculateInitialPositions(graph.nodes);

        // Create balls and labels
        graph.nodes.forEach(node => {
            const position = initialPositions.get(node.index);
            const isLeaf = node.connections.length === 1;
            const color = isLeaf ? 0x0000ff : 0xff00ff;

            const ballRef = React.createRef();
            const labelRef = React.createRef();

            const ballSize = (isLeaf ? 4 : 2) * scaleFactor;
            const ball = (
                <mesh ref={ballRef} position={[position.x, position.y, position.z]} key={`ball-${node.index}`}>
                    <sphereGeometry args={[ballSize, 32, 32]}/>
                    <meshPhongMaterial color={color} shininess={50}/>
                </mesh>
            );

            const label = (
                <Text
                    ref={labelRef}
                    position={[position.x, position.y + (isLeaf ? 6 : 4) * scaleFactor, position.z]}
                    fontSize={1.5 * scaleFactor}
                    color="yellow"
                    anchorX="center"
                    anchorY="middle"
                    key={`label-${node.index}`}
                    renderOrder={1}
                    depthTest={false}
                >
                    {node.label}
                </Text>
            );

            const velocity = new THREE.Vector3(0, 0, 0);
            const ballObj = {ball, label, ref: ballRef, labelRef, velocity, index: node.index, isLeaf};

            ballsRef.current.push(ballObj);
            nodeMap.set(node.index, ballObj);
        });

        // Create springs
        graph.nodes.forEach(node => {
            node.connections.forEach(connectionIndex => {
                const ballA = nodeMap.get(node.index);
                const ballB = nodeMap.get(connectionIndex);

                const hasSpring = springsRef.current.find(spring =>
                    (spring.ballA === ballA && spring.ballB === ballB) ||
                    (spring.ballA === ballB && spring.ballB === ballA)
                );

                if (ballA && ballB && !hasSpring) {
                    const springRef = React.createRef();
                    const spring = (
                        <mesh ref={springRef} key={`${ballA.index}-${ballB.index}`}>
                            <cylinderGeometry args={[0.5 * scaleFactor, 0.5 * scaleFactor, 1, 8]}/>
                            <meshPhongMaterial color={0x808080} shininess={30}/>
                        </mesh>
                    );

                    springsRef.current.push({
                        ballA: ballA.ref,
                        ballB: ballB.ref,
                        mesh: spring,
                        springRef
                    });
                }
            });
        });
    };

    return (
        <scene ref={sceneRef}>
            <ambientLight intensity={0.5} color={0x404040}/>
            <directionalLight color={0xffffff} intensity={0.8} position={[10, 10, 10]} key={"direction1"}/>
            <directionalLight color={0xffffff} intensity={0.8} position={[-10, -10, -10]} key={"direction2"}/>
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