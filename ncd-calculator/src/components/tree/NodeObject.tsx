import React from 'react';
import {Html} from "@react-three/drei";
import {BallObject} from './types';

interface NodeObjectProps {
    ballObj: BallObject;
    hoveredNode: number | null;
    selectedNode: number | null;
    scaleFactor: number;
    theme: "light" | "dark";
}

/**
 * Component for rendering a single node (ball) with its label and tooltip
 */
const NodeObject: React.FC<NodeObjectProps> = ({
                                                   ballObj,
                                                   hoveredNode,
                                                   selectedNode,
                                                   scaleFactor,
                                                   theme
                                               }) => {
    return (
        <group key={`group-${ballObj.index}`}>
            {ballObj.ball}
            {ballObj.label}

            {/* Tooltip for hovered node (only shows when node is hovered but not selected) */}
            {hoveredNode === ballObj.index && selectedNode !== ballObj.index && (
                <Html
                    position={[
                        ballObj.ref.current?.position.x || 0,
                        (ballObj.ref.current?.position.y || 0) + 10 * scaleFactor,
                        ballObj.ref.current?.position.z || 0
                    ]}
                    center
                    distanceFactor={10}
                >
                    <div
                        className={`px-2 py-1 rounded text-xs ${theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-gray-800"} shadow-lg opacity-80`}>
                        {ballObj.label.props.children}
                    </div>
                </Html>
            )}
        </group>
    );
};

export default NodeObject;
