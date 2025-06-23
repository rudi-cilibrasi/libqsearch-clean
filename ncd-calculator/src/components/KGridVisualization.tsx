import React, {useEffect, useRef, useState} from 'react';
import {KGridDualOptimization} from './KGridDualOptimization';
import {QSearchTree3D, QTreeResponse} from './QSearchTree3D';
import {Download, Upload} from 'lucide-react';
import {MatrixTable} from "@/components/MatrixTable.tsx";
import {GridObject} from "@/datastructures/kgrid.ts";
import {LabelManager} from "@/functions/labelUtils.ts";
import type {NCDMatrixResponse} from "@/types/ncd";

// Visualization types enum for better type safety
export const VisualizationType = {
    QUARTET: "quartet",
    KGRID: "kgrid",
    MATRIX: "matrix"
} as const;

type VisualizationTypeValue = typeof VisualizationType[keyof typeof VisualizationType];

interface KGridVisualizationProps {
    ncdMatrixResponse: NCDMatrixResponse;
    objects: GridObject[];
    width?: number;
    height?: number;
    maxIterations?: number;
    onOptimizationStart?: () => void;
    onOptimizationEnd?: () => void;
    onIterationUpdate?: (iteration: number) => void;
    autoStart?: boolean;
    optimizationStartTime?: number;
    optimizationEndTime?: number;
    totalExecutionTime?: number;
    iterationsPerSecond?: number;
    qSearchTreeResult?: QTreeResponse;
    labelManager: LabelManager;
    errorMsg?: string;
}

const KGridVisualization: React.FC<KGridVisualizationProps> = ({
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
    const getDefaultView = (): VisualizationTypeValue => {
        if (qSearchTreeResult && Object.keys(qSearchTreeResult).length > 0) {
            return VisualizationType.QUARTET;
        }
        return VisualizationType.KGRID;
    };

    // State management
    const [activeViz, setActiveViz] = useState<VisualizationTypeValue>(getDefaultView());
    const [selectedTheme, setSelectedTheme] = useState("scientific");
    const [isRunning, setIsRunning] = useState(false);
    const [iterations, setIterations] = useState(0);
    const [matchPercentage, setMatchPercentage] = useState(0);
    const [runningTime, setRunningTime] = useState(0);
    // @ts-ignore
    const [localIterationsPerSecond, setLocalIterationsPerSecond] = useState(0);
    // @ts-ignore
    const [selectedCluster, setSelectedCluster] = useState(null);
    const [showHelp, setShowHelp] = useState(false);

    // Track if optimization has been started manually
    const manuallyStartedRef = useRef(false);

    // Update default view when tree data becomes available
    useEffect(() => {
        if (qSearchTreeResult && Object.keys(qSearchTreeResult).length > 0) {
            setActiveViz(VisualizationType.QUARTET);
        }
    }, [qSearchTreeResult]);

    // Refs for timers and animation frames
    const timerRef = useRef<any>(null);
    const startTimeRef = useRef<number | null>(null);
    const speedCalcRef = useRef<any>({lastTime: 0, lastIteration: 0});

    // Use a ref to track running state to avoid closure issues
    const isRunningRef = useRef<boolean>(false);

    // Handle optimization start - should only happen when start button is clicked
    const handleOptimizationStart = () => {
        // Set running state
        setIsRunning(true);
        isRunningRef.current = true;
        manuallyStartedRef.current = true;

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

    // Handle iteration update - also updates match percentage
    const handleIterationUpdate = (iteration: number) => {
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

    // Update matchPercentage from KGridDualOptimization
    const handleMatchPercentageUpdate = (percentage: number) => {
        setMatchPercentage(percentage);
    };

    // Format time display (mm:ss)
    const formatTime = (seconds: number) => {
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

    const {width: gridWidth, height: gridHeight} = getOptimalDimensions();

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

    // Check if tree data is available and has nodes
    const hasTreeData = () => {
        return (
            qSearchTreeResult &&
            qSearchTreeResult.nodes &&
            qSearchTreeResult.nodes.length > 0
        );
    };

    const getDisplayLabels = (ids: string[]) => {
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
                    currentIterations={iterations}
                    onOptimizationStart={handleOptimizationStart}
                    onOptimizationEnd={handleOptimizationEnd}
                    onIterationUpdate={handleIterationUpdate}
                    colorTheme={selectedTheme}
                    autoStart={autoStart && !manuallyStartedRef.current}
                    showSingleGrid={true}
                    isRunning={isRunning}
                    ncdMatrixResponse={ncdMatrixResponse}
                    onMatchPercentageUpdate={handleMatchPercentageUpdate}
                />
            </div>
        );
    };

    // Render the matrix content
    const renderMatrixContent = () => {
        return (
            <div>
                <MatrixTable ncdMatrix={ncdMatrixResponse.ncdMatrix}
                             labels={getDisplayLabels(ncdMatrixResponse.labels)}/>
            </div>
        );
    };

    // Render Quartet Tree content
    const renderQuartetContent = () => {
        return (
            <div>
                {hasTreeData() ? (
                    <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
                        {qSearchTreeResult &&
                            <QSearchTree3D data={qSearchTreeResult} darkThemeOnly={true} labelManager={labelManager}/>
                        }
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-96 bg-gray-800 rounded-lg shadow">
                        <div className="text-center">
                            <div className="text-blue-400 mb-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none"
                                     viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
                                </svg>
                            </div>
                            <p className="text-white text-lg mb-2">Quartet Tree data is being processed...</p>
                            <p className="text-blue-300 text-base">Please wait for the quartet tree algorithm to
                                complete.</p>
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
        <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden" style={{minHeight: '600px'}}>
            {/* Error message display */}
            {errorMsg && (
                <div className="bg-red-900 border-l-4 border-red-400 text-white p-4 mb-4">
                    <p className="text-lg font-medium">{errorMsg}</p>
                </div>
            )}

            {/* Visualization Type Selector - scrollable on mobile */}
            <div className="bg-gray-900 border-b border-gray-700">
                <div className="flex p-2 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={() => setActiveViz(VisualizationType.QUARTET)}
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-bold rounded-t mr-1 whitespace-nowrap ${
                            activeViz === VisualizationType.QUARTET
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        <span className="hidden sm:inline">Tree Visualization</span>
                        <span className="sm:hidden">Tree</span>
                    </button>
                    <button
                        onClick={() => setActiveViz(VisualizationType.KGRID)}
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-bold rounded-t mr-1 whitespace-nowrap ${
                            activeViz === VisualizationType.KGRID
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        <span className="hidden sm:inline">Grid Visualization</span>
                        <span className="sm:hidden">Grid</span>
                    </button>
                    <button
                        onClick={() => setActiveViz(VisualizationType.MATRIX)}
                        className={`px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base font-bold rounded-t whitespace-nowrap ${
                            activeViz === VisualizationType.MATRIX
                                ? 'bg-blue-700 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        Matrix
                    </button>
                </div>
            </div>


            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row">
                {/* Left Controls Panel - Only show for K-Grid visualization and on desktop */}
                {activeViz === VisualizationType.KGRID && (
                    <div className="w-full lg:w-64 bg-gray-800 text-white flex-shrink-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-gray-700">
                        <div className="bg-blue-800 text-white p-3">
                            <h3 className="font-bold text-base lg:text-lg">Controls</h3>
                        </div>

                        {/* Mobile: Collapsible controls */}
                        <div className="lg:block">
                            {/* Display Options */}
                            <div className="p-4 border-b border-gray-700">
                                <h4 className="font-bold mb-3 text-blue-300 text-sm lg:text-base">Display Info</h4>

                                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                                    <div>
                                        <p className="text-xs lg:text-sm text-white mb-2 font-medium">Grid Size:</p>
                                        <div className="flex items-center">
                                            <span className="text-sm lg:text-base text-blue-300 mr-3 font-bold">
                                                {gridWidth}×{gridHeight}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs lg:text-sm text-white mb-2 font-medium">Items:</p>
                                        <span className="text-sm lg:text-base font-medium">
                                            {objects.length || ncdMatrixResponse?.labels.length}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Color Theme */}
                            <div className="p-4 border-b border-gray-700">
                                <h4 className="font-bold mb-3 text-blue-300 text-sm lg:text-base">Color Theme</h4>

                                <div className="flex lg:flex-col gap-3">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="theme"
                                            checked={selectedTheme === "scientific"}
                                            onChange={() => setSelectedTheme("scientific")}
                                            className="mr-2 lg:mr-3 h-3 w-3 lg:h-4 lg:w-4"
                                        />
                                        <span className="text-sm lg:text-base text-white">Scientific</span>
                                    </label>

                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="radio"
                                            name="theme"
                                            checked={selectedTheme === "colorblind"}
                                            onChange={() => setSelectedTheme("colorblind")}
                                            className="mr-2 lg:mr-3 h-3 w-3 lg:h-4 lg:w-4"
                                        />
                                        <span className="text-sm lg:text-base text-white">Colorblind Friendly</span>
                                    </label>
                                </div>
                            </div>

                            {/* Optimization Controls */}
                            <div className="p-4 border-b border-gray-700">
                                <h4 className="font-bold mb-3 text-blue-300 text-sm lg:text-base">Optimization</h4>

                                <div className="flex gap-2 lg:gap-3 mb-4">
                                    <button
                                        onClick={handleOptimizationStart}
                                        disabled={isRunning}
                                        className={`flex-1 py-2 px-2 lg:px-3 rounded-md text-sm lg:text-base font-bold ${
                                            isRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'
                                        }`}
                                    >
                                        Start
                                    </button>

                                    <button
                                        onClick={handleOptimizationEnd}
                                        disabled={!isRunning}
                                        className={`flex-1 py-2 px-2 lg:px-3 rounded-md text-sm lg:text-base font-bold ${
                                            !isRunning ? 'bg-gray-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500'
                                        }`}
                                    >
                                        Stop
                                    </button>
                                </div>
                            </div>

                            {/* Data Options */}
                            <div className="p-4 border-b border-gray-700">
                                <h4 className="font-bold mb-3 text-blue-300 text-sm lg:text-base">Data</h4>

                                <div className="grid grid-cols-2 gap-2">
                                    <button className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs lg:text-sm font-bold flex justify-center items-center">
                                        <Upload size={12} className="mr-1 lg:w-[14px] lg:h-[14px]"/>
                                        Import
                                    </button>

                                    <button className="py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs lg:text-sm font-bold flex justify-center items-center">
                                        <Download size={12} className="mr-1 lg:w-[14px] lg:h-[14px]"/>
                                        Export
                                    </button>
                                </div>
                            </div>

                            {/* Help Button */}
                            <div className="p-4">
                                <button
                                    onClick={() => setShowHelp(!showHelp)}
                                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-sm lg:text-base font-bold"
                                >
                                    Help
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Visualization Area */}
                <div className="flex-1 overflow-auto p-4">
                    {showHelp && (
                        <div className="bg-gray-800 p-4 border-l-4 border-yellow-500 mb-4 text-white text-left">
                            <h3 className="font-bold text-base lg:text-lg mb-2 text-yellow-300 text-center">
                                About Genome Similarity Visualization
                            </h3>
                            <p className="mb-2 text-sm lg:text-base">
                                This tool visualizes genome similarity using different methods:
                            </p>
                            <ul className="text-left text-sm lg:text-base space-y-1">
                                <li><strong className="text-yellow-300">Quartet Tree:</strong> Displays
                                    relationships as a hierarchical tree structure showing evolutionary relationships.
                                </li>
                                <li><strong className="text-yellow-300">K-Grid:</strong> Arranges items
                                    in a grid where similar items are placed close together. The optimization process
                                    compares different arrangements to find the optimal organization.
                                </li>
                                <li><strong className="text-yellow-300">Matrix View:</strong> Shows the
                                    raw similarity scores between all pairs of items as a color-coded matrix.
                                </li>
                            </ul>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="mt-2 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-500 font-medium text-sm"
                            >
                                Close
                            </button>
                        </div>
                    )}
                    {renderVisualizationContent()}
                </div>
            </div>

            {/* Status Bar */}
            <div className="bg-gray-900 text-gray-300 p-2 text-xs border-t border-gray-700">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="text-xs lg:text-sm">
                        Status: {isRunning ? "Optimization running" : "Ready"} •
                        Items: {ncdMatrixResponse?.labels.length || objects.length}
                    </div>
                    <div className="text-xs lg:text-sm">
                        Visualization: {activeViz.charAt(0).toUpperCase() + activeViz.slice(1)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KGridVisualization;
