import React from 'react';
import {NodeInfoPanelProps} from "@/components/tree/types.ts";

const NodeInfoPanel: React.FC<NodeInfoPanelProps> = ({node, onClose}) => {
    if (!node) return null;

    return (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded shadow-lg max-w-xs">
            <h3 className="text-lg font-bold mb-2">{node.label}</h3>
            <p className="text-sm mb-2">Node ID: {node.index}</p>
            <p className="text-sm mb-2">
                Connections: {node.connections.length}
            </p>
            <button
                onClick={onClose}
                className="mt-2 bg-red-600 text-white px-2 py-1 rounded text-xs"
            >
                Close
            </button>
        </div>
    );
};

export default NodeInfoPanel;
