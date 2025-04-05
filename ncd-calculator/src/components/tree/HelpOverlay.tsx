import React from 'react';
import {HelpOverlayProps} from './types';

/**
 * Help overlay with information about using the visualization
 */
const HelpOverlay: React.FC<HelpOverlayProps> = ({onClose}) => {
    return (
        <div className="absolute inset-0 bg-black bg-opacity-90 text-white p-8 overflow-auto z-20">
            <h2 className="text-2xl font-bold mb-4">Interactive Tree Visualization Help</h2>

            <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Navigation Controls</h3>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Left-click + drag:</strong> Rotate the view (3D mode only)</li>
                    <li><strong>Right-click + drag:</strong> Pan the view</li>
                    <li><strong>Scroll wheel:</strong> Zoom in/out</li>
                    <li><strong>Click on nodes:</strong> Select a node to view its details</li>
                </ul>
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">View Options</h3>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>3D/2D View:</strong> Toggle between 3D interactive view and simplified 2D top-down view
                    </li>
                    <li><strong>Theme:</strong> Switch between dark and light themes</li>
                    <li><strong>Auto-Rotate:</strong> Enable/disable automatic rotation in 3D mode</li>
                    <li><strong>Path Highlight:</strong> When enabled, highlights connection paths on hover</li>
                    <li><strong>Minimap:</strong> Toggle the minimap display in the corner of the screen</li>
                </ul>
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Understanding the Visualization</h3>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Blue nodes:</strong> Leaf nodes (only one connection)</li>
                    <li><strong>Purple nodes:</strong> Internal nodes (multiple connections)</li>
                    <li><strong>Connections:</strong> Represent relationships between nodes</li>
                    <li><strong>Node size:</strong> Bigger nodes have more importance in the structure</li>
                </ul>
            </div>

            <div className="mb-6">
                <h3 className="text-xl font-bold mb-2">Actions</h3>
                <ul className="list-disc pl-6 space-y-1">
                    <li><strong>Export Graph:</strong> Save the current graph structure as a DOT file</li>
                    <li><strong>Reset View:</strong> Return to the default view settings</li>
                </ul>
            </div>

            <button
                onClick={onClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow-md"
            >
                Close Help
            </button>
        </div>
    );
};

export default HelpOverlay;
