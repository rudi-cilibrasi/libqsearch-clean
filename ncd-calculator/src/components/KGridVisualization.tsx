import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ClusterReport} from "@/components/ClusterReport";
import {KGridDualOptimization} from './KGridDualOptimization';
import {QSearchTree3D} from './QSearchTree3D';
import type {QTreeResponse} from "@/types/qsearch";
import {MatrixTable} from "@/components/MatrixTable.tsx";
import {GridObject} from "@/datastructures/kgrid.ts";
import {getDisplayLabel} from "@/services/DisplayLabelProtocol.ts";
import type {NCDMatrixResponse} from "@/types/ncd";

// Visualization types enum for better type safety
export const VisualizationType = {
    REPORT: "report",
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
    qSearchTreeResult?: QTreeResponse;
    labelMap: ReadonlyMap<string, string>;
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
                                                                   qSearchTreeResult,
                                                                   labelMap,
                                                                   errorMsg
                                                               }) => {
    // State management
    const [activeViz, setActiveViz] = useState<VisualizationTypeValue>(VisualizationType.REPORT);
    const [selectedTheme, setSelectedTheme] = useState("scientific");
    const [isRunning, setIsRunning] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Track if optimization has been started manually
    const manuallyStartedRef = useRef(false);

    // Use a ref to track running state to avoid closure issues
    const isRunningRef = useRef<boolean>(false);

    // Handle optimization start - should only happen when start button is clicked
    const handleOptimizationStart = () => {
        // Set running state
        setIsRunning(true);
        isRunningRef.current = true;
        manuallyStartedRef.current = true;

        // Notify parent
        if (onOptimizationStart) {
            onOptimizationStart();
        }
    };

    // Handle optimization end - ensure all animations are stopped
    const handleOptimizationEnd = useCallback(() => {
        // Update running state first
        setIsRunning(false);
        isRunningRef.current = false;

        // Notify parent about optimization end
        if (onOptimizationEnd) {
            onOptimizationEnd();
        }
    }, [onOptimizationEnd]);

    // K-grid is an optional visualization. Stop its worker-side search and
    // timers as soon as the user switches to a different result view.
    useEffect(() => {
        if (activeViz !== VisualizationType.KGRID && isRunningRef.current) {
            handleOptimizationEnd();
        }
    }, [activeViz, handleOptimizationEnd]);

    // Handle iteration update - also updates match percentage
    const handleIterationUpdate = (iteration: number) => {
        // Only update if still running
        if (!isRunningRef.current) return;

        if (onIterationUpdate) {
            onIterationUpdate(iteration);
        }
    };

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

    // Check if tree data is available and has nodes
    const hasTreeData = () => {
        return (
            qSearchTreeResult &&
            qSearchTreeResult.nodes &&
            qSearchTreeResult.nodes.length > 0
        );
    };

    const getDisplayLabels = (ids: string[]) => {
        return ids.map(id => getDisplayLabel(labelMap, id));
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
                    colorTheme={selectedTheme}
                    autoStart={autoStart && !manuallyStartedRef.current}
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
                    <div className="ncd-visualization__canvas">
                        {qSearchTreeResult &&
                            <QSearchTree3D data={qSearchTreeResult} darkThemeOnly={true}/>
                        }
                    </div>
                ) : (
                    <div className="ncd-visualization__pending">
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
            case VisualizationType.REPORT:
                return (
                    <ClusterReport
                        ncdMatrixResponse={ncdMatrixResponse}
                        labelMap={labelMap}
                        qSearchTreeResult={qSearchTreeResult}
                    />
                );
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
            <section className="ncd-visualization" aria-label="NCD result visualization">
            {/* Error message display */}
            {errorMsg && (
                <div className="ncd-visualization__error" role="alert">
                    <p className="text-lg font-medium">{errorMsg}</p>
                </div>
            )}

            {/* Visualization Type Selector */}
            <nav className="ncd-visualization__tabs" aria-label="Result view">
                <button
                    type="button"
                    onClick={() => setActiveViz(VisualizationType.REPORT)}
                    aria-pressed={activeViz === VisualizationType.REPORT}
                >
                    Cluster report
                </button>
                <button
                    type="button"
                    onClick={() => setActiveViz(VisualizationType.QUARTET)}
                    aria-pressed={activeViz === VisualizationType.QUARTET}
                >
                    Quartet tree
                </button>
                <button
                    type="button"
                    onClick={() => setActiveViz(VisualizationType.KGRID)}
                    aria-pressed={activeViz === VisualizationType.KGRID}
                >
                    K-grid
                </button>
                <button
                    type="button"
                    onClick={() => setActiveViz(VisualizationType.MATRIX)}
                    aria-pressed={activeViz === VisualizationType.MATRIX}
                >
                    Distance matrix
                </button>
            </nav>


            {/* Main Content Area */}
            <div className="ncd-visualization__body">
                {/* Left Controls Panel - Only show for K-Grid visualization */}
                {activeViz === VisualizationType.KGRID && (
                    <aside className="ncd-visualization__controls">
                        <div className="bg-blue-800 text-white p-3 rounded-t-lg">
                            <h3 className="font-bold text-lg">K-grid controls</h3>
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
                    </aside>
                )}

                {/* Main Visualization Area */}
                <div className="ncd-visualization__output">
                    {showHelp && (
                        <div className="bg-gray-800 p-4 border-l-4 border-yellow-500 mb-4 text-white text-left">
                            <h3 className="font-bold text-lg mb-2 text-yellow-300 text-center">Reading NCD outputs</h3>
                            <p className="mb-2 text-base">
                                This tool presents relationships among the selected objects in four forms:
                            </p>
                            <ul className="text-left">
                                <li className="mb-1"><strong className="text-yellow-300">Cluster Report:</strong> Summarizes
                                    suggested groups, closest pairs, separation, and research limitations in text.
                                </li>
                                <li className="mb-1"><strong className="text-yellow-300">Quartet Tree:</strong> Displays
                                    global relationships as an unrooted topology without asserting evolutionary ancestry.
                                </li>
                                <li className="mb-1"><strong className="text-yellow-300">K-Grid:</strong> Arranges items
                                    in a grid where similar items are placed close together. The optimization process
                                    compares different arrangements to find the optimal organization.
                                </li>
                                <li className="mb-1"><strong className="text-yellow-300">Matrix View:</strong> Shows the
                                    raw similarity scores between all pairs of items as a color-coded matrix.
                                </li>
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

        </section>
    );
};

export default KGridVisualization;
