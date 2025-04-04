import React from 'react';
import {ControlPanelProps} from './types';

const ControlPanel: React.FC<ControlPanelProps> = ({
                                                       theme,
                                                       viewMode,
                                                       autoRotate,
                                                       highlightPath,
                                                       showMinimap,
                                                       showHelp,
                                                       onThemeToggle,
                                                       onViewModeToggle,
                                                       onAutoRotateToggle,
                                                       onHighlightPathToggle,
                                                       onMinimapToggle,
                                                       onHelpToggle,
                                                       onExport,
                                                       onReset
                                                   }) => {
    return (
        <div className="p-4 absolute top-0 right-0 z-10 flex flex-col space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <button
                    onClick={onThemeToggle}
                    className="bg-blue-600 text-white hover:bg-blue-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
                >
                    {theme === "dark" ? "Light Theme" : "Dark Theme"}
                </button>
                <button
                    onClick={onViewModeToggle}
                    className="bg-purple-600 text-white hover:bg-purple-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
                >
                    {viewMode === "3d" ? "2D View" : "3D View"}
                </button>
                <button
                    onClick={onAutoRotateToggle}
                    className={`${autoRotate ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white shadow-md px-4 py-2 rounded-md text-sm flex items-center`}
                >
                    {autoRotate ? "Auto-Rotate: On" : "Auto-Rotate: Off"}
                </button>
                <button
                    onClick={onHighlightPathToggle}
                    className={`${highlightPath ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'} text-white shadow-md px-4 py-2 rounded-md text-sm flex items-center`}
                >
                    {highlightPath ? "Path Highlight: On" : "Path Highlight: Off"}
                </button>
                <button
                    onClick={onExport}
                    className="bg-green-600 text-white hover:bg-green-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
                >
                    Export Graph
                </button>
                <button
                    onClick={onReset}
                    className="bg-yellow-600 text-white hover:bg-yellow-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center"
                >
                    Reset View
                </button>
                <button
                    onClick={onMinimapToggle}
                    className={`bg-indigo-600 text-white hover:bg-indigo-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center`}
                >
                    {showMinimap ? "Hide Minimap" : "Show Minimap"}
                </button>
                <button
                    onClick={onHelpToggle}
                    className="bg-gray-600 text-white hover:bg-gray-700 shadow-md px-4 py-2 rounded-md text-sm flex items-center justify-center"
                >
                    {showHelp ? "Hide Help" : "Show Help"}
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;
