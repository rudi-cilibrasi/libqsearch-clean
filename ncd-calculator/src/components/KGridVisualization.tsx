import { useState, useEffect, useRef } from 'react';
import { KGridDualOptimization } from './KGridDualOptimization';
import { QSearchTree3D } from './QSearchTree3D';
import {
    Download,
    Upload,
} from 'lucide-react';
import {MatrixTable} from "@/components/MatrixTable.tsx";

// Visualization types enum for better type safety
const VisualizationType = {
    QUARTET: "quartet",
    KGRID: "kgrid",
    MATRIX: "matrix"
};

const KGridVisualization = ({
                                ncdMatrixResponse,
                                objects = [],
                                width = 3,
                                height = 3,
                                maxIterations = 50000,
                                onOptimizationStart,
                                onOptimizationEnd,
                                onIterationUpdate,
                                autoStart = false,
                                optimizationStartTime,
                                optimizationEndTime,
                                totalExecutionTime,
                                iterationsPerSecond,
                                qSearchTreeResult,
                                labelManager,
                                errorMsg
                            }) => {
    // Default to QUARTET view, fallback to others if available
    const getDefaultView = () => {
        if (qSearchTreeResult && Object.keys(qSearchTreeResult).length > 0) {
            return VisualizationType.QUARTET;
        }
        return VisualizationType.KGRID;
    };

    // State management
    const [activeViz, setActiveViz] = useState(getDefaultView());
    const [selectedTheme, setSelectedTheme] = useState("scientific");
    const [isRunning, setIsRunning] = useState(false);
    const [iterations, setIterations] = useState(0);
    const [matchPercentage, setMatchPercentage] = useState(0);
    const [runningTime, setRunningTime] = useState(0);
    const [localIterationsPerSecond, setLocalIterationsPerSecond] = useState(0);
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [showHelp, setShowHelp] = useState(false);

    // Update default view when tree data becomes available
    useEffect(() => {
        if (qSearchTreeResult && Object.keys(qSearchTreeResult).length > 0) {
            setActiveViz(VisualizationType.QUARTET);
        }
    }, [qSearchTreeResult]);

    // Refs for timers and animation frames
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const speedCalcRef = useRef({ lastTime: 0, lastIteration: 0 });

    // Use a ref to track running state to avoid closure issues
    const isRunningRef = useRef(false);

    // Handle optimization start
    const handleOptimizationStart = () => {
        // Set running state
        setIsRunning(true);
        isRunningRef.current = true;

        // Reset iteration counter
        setIterations(0);
        setMatchPercentage(0);

        // Start timing
        startTimeRef.current = Date.now();

        // Set up timer to update running time
        timerRef.current = setInterval(() => {
            if (startTimeRef.current && isRunningRef.current) {
                setRunningTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }
        }, 1000);

        // Notify parent
        if (onOptimizationStart) {
            onOptimizationStart();
        }
    };

    // Handle optimization end - ensure all animations are stopped
    const handleOptimizationEnd = () => {
        // Update running state first
        setIsRunning(false);
        isRunningRef.current = false;

        // Clear the interval timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        // Notify parent about optimization end
        if (onOptimizationEnd) {
            onOptimizationEnd();
        }
    };

    // Handle iteration update
    const handleIterationUpdate = (iteration) => {
        // Only update if still running
        if (!isRunningRef.current) return;

        setIterations(iteration);

        // Calculate iterations per second
        const now = Date.now();
        if (now - speedCalcRef.current.lastTime >= 1000) {
            const elapsed = (now - speedCalcRef.current.lastTime) / 1000;
            const iterationsInPeriod = iteration - speedCalcRef.current.lastIteration;
            setLocalIterationsPerSecond(Math.round(iterationsInPeriod / elapsed));

            speedCalcRef.current = {
                lastTime: now,
                lastIteration: iteration
            };
        }

        if (onIterationUpdate) {
            onIterationUpdate(iteration);
        }
    };

    // Format time display (mm:ss)
    const formatTime = (seconds) => {
        if (seconds === undefined || seconds === null) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // Calculate optimal grid dimensions
    const getOptimalDimensions = () => {
        const itemCount = objects.length || ncdMatrixResponse?.labels.length;
        const optimalWidth = Math.ceil(Math.sqrt(itemCount));
        const optimalHeight = Math.ceil(itemCount / optimalWidth);

        return {
            width: width !== 3 ? width : optimalWidth,
            height: height !== 3 ? height : optimalHeight
        };
    };

    const { width: gridWidth, height: gridHeight } = getOptimalDimensions();

    // Update running metrics from props
    useEffect(() => {
        if (optimizationStartTime && optimizationEndTime && totalExecutionTime) {
            setRunningTime(Math.floor(totalExecutionTime / 1000));
        } else if (optimizationStartTime) {
            setRunningTime(Math.floor((Date.now() - optimizationStartTime) / 1000));
        }

        if (iterationsPerSecond !== undefined && iterationsPerSecond !== null) {
            setLocalIterationsPerSecond(Math.round(iterationsPerSecond));
        }
    }, [optimizationStartTime, optimizationEndTime, totalExecutionTime, iterationsPerSecond]);

    // Handle cell selection for cluster information
    const handleCellSelect = (gridNumber, objectId, position) => {
        setSelectedCluster({
            gridNumber,
            objectId,
            position,
            label: objects.find(obj => obj.id === objectId)?.label || ncdMatrixResponse?.labels[Number(objectId)] || 'Unknown'
        });
    };

    // Check if tree data is available and has nodes
    const hasTreeData = () => {
        return !!(
            qSearchTreeResult &&
            qSearchTreeResult.nodes &&
            qSearchTreeResult.nodes.length > 0
        );
    };


    const getDisplayLabels = (ids: string[]): string[] => {
        return ids.map(id => labelManager.getDisplayLabel(id) || 'Unknown');
    }

    // Render K-Grid visualization content
    const renderKGridContent = () => {
        return (
            <div className="flex flex-col">
                {/* K-Grid Dual Optimization Component */}
                <KGridDualOptimization
                    width={gridWidth}
                    height={gridHeight}
                    objects={objects}
                    maxIterations={maxIterations}
                    onOptimizationStart={handleOptimizationStart}
                    onOptimizationEnd={handleOptimizationEnd}
                    onIterationUpdate={handleIterationUpdate}
                    onCellSelect={handleCellSelect}
                    colorTheme={selectedTheme}
                    autoStart={autoStart}
                    optimizationStartTime={optimizationStartTime}
                    optimizationEndTime={optimizationEndTime}
                    totalExecutionTime={totalExecutionTime}
                    iterationsPerSecond={iterationsPerSecond}
                    showSingleGrid={true}
                    isRunning={isRunning}
                    ncdMatrixResponse={ncdMatrixResponse}
                />
            </div>
        );
    };

    // Render the matrix content
    const renderMatrixContent = () => {
        return (
            <div>
                <MatrixTable ncdMatrix={ncdMatrixResponse.ncdMatrix} labels={getDisplayLabels(ncdMatrixResponse.labels)} />
            </div>
        );
    };

    // Render Quartet Tree content
    const renderQuartetContent = () => {
        return (
            <div>
                {hasTreeData() ? (
                    <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                        <QSearchTree3D data={qSearchTreeResult} darkThemeOnly={true} />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-96 bg-gray-800 rounded-lg shadow">
                        <div className="text-center">
                            <div className="text-blue-400 mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p className="text-white text-lg mb-2">Quartet Tree data is being processed...</p>
                            <p className="text-blue-300 text-base">Please wait for the quartet tree algorithm to complete.</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Get content for current visualization type
    const renderVisualizationContent = () => {
        switch (activeViz) {
            case VisualizationType.KGRID:
                return renderKGridContent();
            case VisualizationType.MATRIX:
                return renderMatrixContent();
            case VisualizationType.QUARTET:
                return renderQuartetContent();
            default:
                return <div>Select a visualization</div>;
        }
    };

    return (
        <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden" style={{ minHeight: '600px' }}>
            {/* Error message display */}
            {errorMsg && (
                <div className="bg-red-900 border-l-4 border-red-400 text-white p-4 mb-4">
                    <p className="text-lg font-medium">{errorMsg}</p>
                </div>
            )}

            {/* Visualization Type Selector */}
            <div className="bg-gray-900 border-b border-gray-700">
                <div className="flex p-2">
                    <button
                        onClick={() => setActiveViz(VisualizationType.QUARTET)}
                        className={`px-4 py-3 text-base font-bold rounded-t mr-1 ${
                            activeViz === VisualizationType.QUARTET
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        Quartet Tree Visualization
                    </button>
                    <button
                        onClick={() => setActiveViz(VisualizationType.KGRID)}
                        className={`px-4 py-3 text-base font-bold rounded-t mr-1 ${
                            activeViz === VisualizationType.KGRID
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        K-Grid Visualization
                    </button>
                    <button
                        onClick={() => setActiveViz(VisualizationType.MATRIX)}
                        className={`px-4 py-3 text-base font-bold rounded-t ${
                            activeViz === VisualizationType.MATRIX
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        Matrix View
                    </button>
                </div>
            </div>

            {/* Status Panel - Only for K-Grid visualization */}
            {activeViz === VisualizationType.KGRID && (
                <div className="bg-blue-800 text-white p-3 border-b border-blue-900 flex justify-between items-center">
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center">
                            <span className="font-bold mr-2">Status:</span>
                            <span className={`font-medium ${isRunning ? 'text-green-300' : 'text-yellow-300'}`}>
                                {isRunning ? 'Running' : 'Ready'}
                            </span>
                        </div>
                        <div className="flex items-center">
                            <span className="font-bold mr-2">Running Time:</span>
                            <span className="font-medium text-green-300">{formatTime(runningTime)}</span>
                        </div>
                    </div>
                    <div className="flex items-center space-x-6">
                        <div className="flex items-center">
                            <span className="font-bold mr-2">Iterations:</span>
                            <span className="font-medium text-green-300">{iterations.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center">
                            <span className="font-bold mr-2">Match:</span>
                            <span className="font-medium text-green-300">{matchPercentage.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="p-4 flex">
                {/* Left Controls Panel - Only show for K-Grid visualization */}
                {activeViz === VisualizationType.KGRID && (
                    <div className="w-64 bg-gray-800 rounded-lg shadow-lg mr-4 text-white h-fit flex-shrink-0 overflow-hidden">
                        <div className="bg-blue-800 text-white p-3 rounded-t-lg">
                            <h3 className="font-bold text-lg">Controls</h3>
                        </div>

                        {/* Display Options */}
                        <div className="p-4 border-b border-gray-700">
                            <h4 className="font-bold mb-3 text-blue-300 text-base">Display Info</h4>

                            <div className="mb-3">
                                <p className="text-sm text-white mb-2 font-medium">Grid Size:</p>
                                <div className="flex items-center">
                                    <span className="text-base text-blue-300 mr-3 font-bold">{gridWidth}×{gridHeight}</span>
                                    <div className="flex-1 bg-gray-600 h-2 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full" style={{ width: '50%' }}></div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3">
                                <p className="text-sm text-white mb-2 font-medium">Items:</p>
                                <span className="text-base font-medium">{objects.length || ncdMatrixResponse?.labels.length}</span>
                            </div>
                        </div>

                        {/* Color Theme */}
                        <div className="p-4 border-b border-gray-700">
                            <h4 className="font-bold mb-3 text-blue-300 text-base">Color Theme</h4>

                            <div className="space-y-3">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="theme"
                                        checked={selectedTheme === "scientific"}
                                        onChange={() => setSelectedTheme("scientific")}
                                        className="mr-3 h-4 w-4"
                                    />
                                    <span className="text-base text-white">Scientific</span>
                                </label>

                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="theme"
                                        checked={selectedTheme === "colorblind"}
                                        onChange={() => setSelectedTheme("colorblind")}
                                        className="mr-3 h-4 w-4"
                                    />
                                    <span className="text-base text-white">Colorblind Friendly</span>
                                </label>
                            </div>
                        </div>

                        {/* Optimization Controls */}
                        <div className="p-4 border-b border-gray-700">
                            <h4 className="font-bold mb-3 text-blue-300 text-base">Optimization</h4>

                            <div className="flex gap-3 mb-4">
                                <button
                                    onClick={handleOptimizationStart}
                                    disabled={isRunning}
                                    className={`flex-1 py-2 px-3 rounded-md text-base font-bold ${
                                        isRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'
                                    }`}
                                >
                                    Start
                                </button>

                                <button
                                    onClick={handleOptimizationEnd}
                                    disabled={!isRunning}
                                    className={`flex-1 py-2 px-3 rounded-md text-base font-bold ${
                                        !isRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'
                                    }`}
                                >
                                    Stop
                                </button>
                            </div>

                            <div className="mb-3">
                                <label className="block text-sm text-white mb-2 font-medium">Max Iterations:</label>
                                <input
                                    type="number"
                                    value={maxIterations}
                                    disabled
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                />
                            </div>
                        </div>

                        {/* Data Options */}
                        <div className="p-4 border-b border-gray-700">
                            <h4 className="font-bold mb-3 text-blue-300 text-base">Data</h4>

                            <div className="flex gap-3">
                                <button className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-base font-bold flex justify-center items-center">
                                    <Upload size={16} className="mr-2" />
                                    Import
                                </button>

                                <button className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-base font-bold flex justify-center items-center">
                                    <Download size={16} className="mr-2" />
                                    Export
                                </button>
                            </div>
                        </div>

                        {/* Help Button */}
                        <div className="p-4">
                            <button
                                onClick={() => setShowHelp(!showHelp)}
                                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-base font-bold"
                            >
                                Help
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Visualization Area */}
                <div className="flex-1 overflow-auto">
                    {showHelp && (
                        <div className="bg-gray-800 p-4 border-l-4 border-yellow-500 mb-4 text-white text-left">
                            <h3 className="font-bold text-lg mb-2 text-yellow-300 text-center">About Genome Similarity Visualization</h3>
                            <p className="mb-2 text-base">
                                This tool visualizes genome similarity using different methods:
                            </p>
                            <ul className="text-left">
                                <li className="mb-1"><strong className="text-yellow-300">Quartet Tree:</strong> Displays relationships as a hierarchical tree structure showing evolutionary relationships.</li>
                                <li className="mb-1"><strong className="text-yellow-300">K-Grid:</strong> Arranges items in a grid where similar items are placed close together. The optimization process compares different arrangements to find the optimal organization.</li>
                                <li className="mb-1"><strong className="text-yellow-300">Matrix View:</strong> Shows the raw similarity scores between all pairs of items as a color-coded matrix.</li>
                            </ul>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="mt-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-500 font-medium"
                            >
                                Close
                            </button>
                        </div>
                    )}
                    {renderVisualizationContent()}
                </div>
            </div>

            {/* Status Bar */}
            <div className="bg-gray-900 text-gray-300 p-2 text-xs">
                <div className="flex justify-between items-center">
                    <div>
                        Status: {isRunning ? "Optimization running" : "Ready"} • Items: {ncdMatrixResponse?.labels.length || objects.length}
                    </div>
                    <div>
                        Visualization: {activeViz.charAt(0).toUpperCase() + activeViz.slice(1)}
                    </div>
                </div>
            </div>
        </div>
    );
};


export default KGridVisualization;
