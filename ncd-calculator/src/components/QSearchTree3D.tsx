import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Canvas, useThree} from "@react-three/fiber";
import {Html, OrbitControls} from "@react-three/drei";
import type {OrbitControls as OrbitControlsImpl} from "three-stdlib";
import * as THREE from "three";
import {saveAs} from "file-saver";
import createGraph from "../functions/graphExport";
import {DotGraphVisualizer} from "./DotGraphVisualizer";
import {calculateCameraFitDistance} from "./tree/cameraFit";

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

type TreeView = "planar" | "spatial";
type CameraAction = "fit" | "reset" | "zoom-in" | "zoom-out";

interface CameraCommand {
    action: CameraAction;
    requestId: number;
}

interface TreeBounds {
    center: THREE.Vector3;
    size: THREE.Vector3;
}

interface TreeEdge {
    source: number;
    target: number;
}

const EMPTY_CAMERA_COMMAND: CameraCommand = {action: "fit", requestId: 0};
const DEFAULT_CAMERA_DIRECTION = new THREE.Vector3(1, 0.72, 1).normalize();

const getTreeRoot = (nodes: QTreeNode[]): QTreeNode | undefined => (
    [...nodes].sort((left, right) => right.connections.length - left.connections.length)[0]
);

const countLeaves = (
    nodeIndex: number,
    parentIndex: number | null,
    nodesByIndex: Map<number, QTreeNode>,
    path: Set<number>
): number => {
    if (path.has(nodeIndex)) return 1;
    const node = nodesByIndex.get(nodeIndex);
    if (!node) return 1;

    const nextPath = new Set(path).add(nodeIndex);
    const children = node.connections.filter(connection => connection !== parentIndex && !nextPath.has(connection));
    if (children.length === 0) return 1;

    return children.reduce(
        (total, childIndex) => total + countLeaves(childIndex, nodeIndex, nodesByIndex, nextPath),
        0
    );
};

/** Create a deterministic radial layout for the optional spatial explorer. */
const calculateSpatialPositions = (nodes: QTreeNode[], scaleFactor: number): Map<number, THREE.Vector3> => {
    const positions = new Map<number, THREE.Vector3>();
    const root = getTreeRoot(nodes);
    if (!root) return positions;

    const nodesByIndex = new Map(nodes.map(node => [node.index, node]));
    const visited = new Set<number>();
    const levelDistance = 32 * scaleFactor;

    const placeNode = (
        nodeIndex: number,
        parentIndex: number | null,
        depth: number,
        angleStart: number,
        angleEnd: number
    ): void => {
        if (visited.has(nodeIndex)) return;
        const node = nodesByIndex.get(nodeIndex);
        if (!node) return;
        visited.add(nodeIndex);

        const angle = (angleStart + angleEnd) / 2;
        const radius = depth * levelDistance;
        const z = depth === 0 ? 0 : Math.sin(angle * 2) * depth * 3.5 * scaleFactor;
        positions.set(nodeIndex, new THREE.Vector3(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            z
        ));

        const children = node.connections
            .filter(connection => connection !== parentIndex && !visited.has(connection))
            .sort((left, right) => left - right);
        if (children.length === 0) return;

        const weights = children.map(child => countLeaves(child, nodeIndex, nodesByIndex, new Set([nodeIndex])));
        const totalWeight = weights.reduce((total, weight) => total + weight, 0);
        let cursor = angleStart;

        children.forEach((child, index) => {
            const share = (angleEnd - angleStart) * weights[index] / totalWeight;
            placeNode(child, nodeIndex, depth + 1, cursor, cursor + share);
            cursor += share;
        });
    };

    placeNode(root.index, null, 0, -Math.PI, Math.PI);

    const disconnected = nodes.filter(node => !visited.has(node.index));
    disconnected.forEach((node, index) => {
        const angle = 2 * Math.PI * index / Math.max(disconnected.length, 1);
        const radius = levelDistance * 1.5;
        positions.set(node.index, new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    });

    return positions;
};

const collectEdges = (nodes: QTreeNode[]): TreeEdge[] => {
    const seen = new Set<string>();
    const edges: TreeEdge[] = [];

    for (const node of nodes) {
        for (const connection of node.connections) {
            const source = Math.min(node.index, connection);
            const target = Math.max(node.index, connection);
            const key = `${source}-${target}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({source, target});
        }
    }

    return edges;
};

const getTreeBounds = (positions: Map<number, THREE.Vector3>, padding: number): TreeBounds | null => {
    const points = Array.from(positions.values());
    if (points.length === 0) return null;

    const box = new THREE.Box3().setFromPoints(points).expandByScalar(padding);
    return {
        center: box.getCenter(new THREE.Vector3()),
        size: box.getSize(new THREE.Vector3()),
    };
};

interface CameraRigProps {
    bounds: TreeBounds | null;
    command: CameraCommand;
    scaleFactor: number;
}

const CameraRig: React.FC<CameraRigProps> = ({bounds, command, scaleFactor}) => {
    const controlsRef = useRef<OrbitControlsImpl>(null);
    const {camera, size} = useThree();

    const fitCamera = useCallback((resetOrientation: boolean): void => {
        if (!bounds || !(camera instanceof THREE.PerspectiveCamera)) return;

        const target = bounds.center;
        const controls = controlsRef.current;
        const currentDirection = controls
            ? camera.position.clone().sub(controls.target).normalize()
            : DEFAULT_CAMERA_DIRECTION.clone();
        const direction = resetOrientation || currentDirection.lengthSq() === 0
            ? DEFAULT_CAMERA_DIRECTION.clone()
            : currentDirection;
        const distance = calculateCameraFitDistance(
            bounds.size,
            camera.fov,
            size.width / Math.max(size.height, 1)
        );

        camera.position.copy(target).add(direction.multiplyScalar(distance));
        camera.near = Math.max(distance / 200, 0.1);
        camera.far = Math.max(distance * 20, 1000);
        camera.updateProjectionMatrix();
        controls?.target.copy(target);
        controls?.update();
    }, [bounds, camera, size.height, size.width]);

    useEffect(() => {
        fitCamera(true);
    }, [fitCamera]);

    useEffect(() => {
        if (command.requestId === 0) return;
        const controls = controlsRef.current;

        if (command.action === "fit") {
            fitCamera(false);
            return;
        }
        if (command.action === "reset") {
            fitCamera(true);
            return;
        }
        if (!controls) return;

        const direction = camera.position.clone().sub(controls.target);
        const factor = command.action === "zoom-in" ? 0.78 : 1.28;
        const nextDistance = Math.max(scaleFactor * 8, direction.length() * factor);
        camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(nextDistance));
        controls.update();
    }, [camera, command, fitCamera, scaleFactor]);

    return (
        <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
            enablePan
            enableRotate
            enableZoom
            autoRotate={false}
            minDistance={scaleFactor * 8}
            maxDistance={scaleFactor * 500}
        />
    );
};

interface SpatialEdgeProps {
    start: THREE.Vector3;
    end: THREE.Vector3;
    color: number;
    scaleFactor: number;
}

const SpatialEdge: React.FC<SpatialEdgeProps> = ({start, end, color, scaleFactor}) => {
    const geometry = useMemo(() => {
        const direction = end.clone().sub(start);
        const midpoint = start.clone().add(end).multiplyScalar(0.5);
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.clone().normalize()
        );
        return {length: direction.length(), midpoint, quaternion};
    }, [end, start]);

    return (
        <mesh position={geometry.midpoint} quaternion={geometry.quaternion}>
            <cylinderGeometry args={[0.7 * scaleFactor, 0.7 * scaleFactor, geometry.length, 10]}/>
            <meshBasicMaterial color={color}/>
        </mesh>
    );
};

interface SpatialTreeProps {
    data: QTreeResponse;
    positions: Map<number, THREE.Vector3>;
    edges: TreeEdge[];
    scaleFactor: number;
    theme: "light" | "dark";
    selectedNode: number | null;
    onSelectNode: (index: number | null) => void;
}

const SpatialTree: React.FC<SpatialTreeProps> = ({
    data,
    positions,
    edges,
    scaleFactor,
    theme,
    selectedNode,
    onSelectNode,
}) => {
    const edgeColor = theme === "dark" ? 0xb8c9bf : 0x315b4b;
    const leafColor = theme === "dark" ? 0x5d9cec : 0x245c91;
    const internalColor = theme === "dark" ? 0xd66f55 : 0xa6402c;
    return (
        <group>
            {edges.map(edge => {
                const start = positions.get(edge.source);
                const end = positions.get(edge.target);
                if (!start || !end) return null;
                return (
                    <SpatialEdge
                        key={`${edge.source}-${edge.target}`}
                        start={start}
                        end={end}
                        color={edgeColor}
                        scaleFactor={scaleFactor}
                    />
                );
            })}

            {data.nodes.map(node => {
                const position = positions.get(node.index);
                if (!position) return null;
                const isLeaf = node.connections.length <= 1;
                const isSelected = selectedNode === node.index;
                const displayLabel = node.label?.trim();

                return (
                    <group key={node.index} position={position}>
                        <mesh
                            scale={isSelected ? 1.28 : 1}
                            onClick={event => {
                                event.stopPropagation();
                                onSelectNode(isSelected ? null : node.index);
                            }}
                        >
                            <sphereGeometry args={[(isLeaf ? 4.2 : 2.6) * scaleFactor, 24, 24]}/>
                            <meshStandardMaterial
                                color={isSelected ? 0xf0b44d : (isLeaf ? leafColor : internalColor)}
                                roughness={0.72}
                                metalness={0.04}
                            />
                        </mesh>

                        {isLeaf && displayLabel && (
                            <Html position={[0, 7 * scaleFactor, 0]} center zIndexRange={[10, 0]}>
                                <span className="quartet-tree__node-label">{displayLabel}</span>
                            </Html>
                        )}
                    </group>
                );
            })}
        </group>
    );
};

export const QSearchTree3D: React.FC<QSearchTree3DProps> = ({data}) => {
    const [view, setView] = useState<TreeView>("planar");
    const [theme, setTheme] = useState<"light" | "dark">("dark");
    const [selectedNode, setSelectedNode] = useState<number | null>(null);
    const [cameraCommand, setCameraCommand] = useState<CameraCommand>(EMPTY_CAMERA_COMMAND);
    const scaleFactor = Math.max(1, Math.sqrt(data.nodes.length) / 4);
    const positions = useMemo(() => calculateSpatialPositions(data.nodes, scaleFactor), [data.nodes, scaleFactor]);
    const edges = useMemo(() => collectEdges(data.nodes), [data.nodes]);
    const bounds = useMemo(() => getTreeBounds(positions, 10 * scaleFactor), [positions, scaleFactor]);
    const selected = data.nodes.find(node => node.index === selectedNode);

    useEffect(() => {
        setSelectedNode(null);
    }, [data]);

    const requestCameraAction = (action: CameraAction): void => {
        setCameraCommand(current => ({action, requestId: current.requestId + 1}));
    };

    const handleExport = (): void => {
        const dotFormat = createGraph(data, false);
        const blob = new Blob([dotFormat], {type: "text/plain;charset=utf-8"});
        saveAs(blob, "quartet-tree.dot");
    };

    return (
        <section className={`quartet-tree quartet-tree--${view}`} aria-label="Quartet tree explorer">
            <header className="quartet-tree__toolbar">
                <div className="quartet-tree__view-switch" role="group" aria-label="Tree presentation">
                    <button type="button" onClick={() => setView("planar")} aria-pressed={view === "planar"}>
                        Planar 2D
                    </button>
                    <button type="button" onClick={() => setView("spatial")} aria-pressed={view === "spatial"}>
                        Interactive 3D
                    </button>
                </div>

                <div className="quartet-tree__actions">
                    {view === "spatial" && (
                        <>
                            <button type="button" onClick={() => requestCameraAction("zoom-out")} aria-label="Zoom out">−</button>
                            <button type="button" onClick={() => requestCameraAction("zoom-in")} aria-label="Zoom in">+</button>
                            <button type="button" onClick={() => requestCameraAction("fit")}>Fit tree</button>
                            <button type="button" onClick={() => requestCameraAction("reset")}>Reset view</button>
                            <button type="button" onClick={() => setTheme(current => current === "dark" ? "light" : "dark")}>
                                {theme === "dark" ? "Light canvas" : "Dark canvas"}
                            </button>
                        </>
                    )}
                    <button type="button" onClick={handleExport}>Export DOT</button>
                </div>
            </header>

            <div className="quartet-tree__stage" data-theme={theme}>
                {view === "planar" ? (
                    <DotGraphVisualizer data={data}/>
                ) : (
                    <Canvas
                        dpr={[1, 1.75]}
                        shadows
                        camera={{position: [100, 75, 100], fov: 50, near: 0.1, far: 2000}}
                        onPointerMissed={() => setSelectedNode(null)}
                    >
                        <color attach="background" args={[theme === "dark" ? "#101b17" : "#f7f3e8"]}/>
                        <ambientLight intensity={theme === "dark" ? 1.1 : 1.35}/>
                        <directionalLight position={[50, 80, 70]} intensity={1.3}/>
                        <directionalLight position={[-40, -20, -60]} intensity={0.55}/>
                        <SpatialTree
                            data={data}
                            positions={positions}
                            edges={edges}
                            scaleFactor={scaleFactor}
                            theme={theme}
                            selectedNode={selectedNode}
                            onSelectNode={setSelectedNode}
                        />
                        <CameraRig bounds={bounds} command={cameraCommand} scaleFactor={scaleFactor}/>
                    </Canvas>
                )}
            </div>

            {view === "spatial" && (
                <footer className="quartet-tree__footer">
                    <div className="quartet-tree__selection" aria-live="polite">
                        {selected ? (
                            <>
                                <strong>{selected.label?.trim() || `Internal node ${selected.index}`}</strong>
                                <span>{selected.connections.length <= 1 ? "Leaf" : "Internal node"} · {selected.connections.length} connection{selected.connections.length === 1 ? "" : "s"}</span>
                            </>
                        ) : (
                            <span>Select a node to inspect it.</span>
                        )}
                    </div>
                    <p className="quartet-tree__hint">Drag to rotate · Right-drag to pan · Scroll or pinch to zoom</p>
                </footer>
            )}
        </section>
    );
};

export default QSearchTree3D;
