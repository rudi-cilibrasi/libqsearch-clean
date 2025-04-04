import React, {RefObject} from "react";
import * as THREE from "three";

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

export interface ContainerStyle {
    width: string;
    height: string;
    position: "relative";
    overflow: "hidden";
    background: string;
}

export interface QSearchTreeProps {
    data: QTreeResponse;
    scaleFactor: number;
    theme: "light" | "dark";
    viewMode: "2d" | "3d";
    hoveredNode?: number | null;
    setHoveredNode?: (index: number | null) => void;
    selectedNode?: number | null;
    setSelectedNode?: (index: number | null) => void;
    highlightPath?: boolean;
    updateNodePositions?: (positions: any[]) => void; // Add this line
}


export interface BallObject {
    ball: JSX.Element;
    label: JSX.Element;
    ref: RefObject<THREE.Mesh>;
    labelRef: RefObject<any>;
    velocity: THREE.Vector3;
    index: number;
    isLeaf: boolean;
    depth?: number;
}

export interface SpringObject {
    ballA: RefObject<THREE.Mesh>;
    ballB: RefObject<THREE.Mesh>;
    nodeA: number;
    nodeB: number;
    mesh: JSX.Element;
    springRef: RefObject<THREE.Mesh>;
    isHighlighted?: boolean;
}

export type SimulationPhase = "initial" | "stabilizing" | "stable";

export interface MiniMapProps {
    nodes: {
        index: number;
        position: THREE.Vector3;
        isLeaf: boolean;
        isSelected: boolean;
        isHovered: boolean;
    }[];
    cameraPosition: THREE.Vector3;
    size: number;
    theme: "light" | "dark";
}

export interface ControlPanelProps {
    theme: "light" | "dark";
    viewMode: "2d" | "3d";
    showHelp: boolean;
    showMinimap: boolean;
    autoRotate: boolean;
    highlightPath: boolean;
    onThemeToggle: () => void;
    onViewModeToggle: () => void;
    onHelpToggle: () => void;
    onAutoRotateToggle: () => void;
    onHighlightPathToggle: () => void;
    onMinimapToggle: () => void;
    onExport: () => void;
    onReset: () => void;
}

export interface HelpOverlayProps {
    onClose: () => void;
}

export interface HelpInfoPanelProps {
    node: QTreeNode | undefined;
    onClose: () => void;
}

export interface NodeInfoPanelProps {
    node: QTreeNode | undefined;
    onClose: () => void;
}

export interface CameraTrackerProps {
    children: (position: THREE.Vector3) => React.ReactNode;
}
