import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createSafeInitialGrid, GridObject, GridState,} from "@/datastructures/kgrid.ts";
import {GridDisplay} from "./GridDisplay";
// @ts-ignore
import OptimizationWorker from '../workers/kgridWorker.js?worker';
import {NCDMatrixResponse} from "@/types/ncd.d.ts";

interface OptimizationImprovements {
    grid1Improved: boolean;
    similarityImproved: boolean;
}

interface IterationStatus {
    currentIteration: number;
    bestObjective1: number;
    bestSimilarity: number;
    noImprovementCount: number;
    // Adding for performance metrics
    iterationsPerSecond?: number;
    estimatedTimeRemaining?: number;
}

// Update the worker response types
interface WorkerResponse {
    type: 'optimization_improved' | 'status_update' | 'initialized' | 'reset_confirmed' |
        'optimization_started' | 'optimization_stopped' | 'optimization_complete' | 'error';
    grid1?: GridState;
    similarity?: number;
    iteration?: number;
    improvement?: OptimizationImprovements;
    status?: IterationStatus;
    error?: string;
}

interface KGridDualOptimizationProps {
    width?: number;
    height?: number;
    objects?: GridObject[];
    maxIterations?: number;
    onOptimizationStart?: () => void;
    onOptimizationEnd?: () => void;
    onIterationUpdate?: (iteration: number) => void;
    colorTheme?: string;
    autoStart?: boolean;
    showSingleGrid?: boolean;
    isRunning?: boolean;
    ncdMatrixResponse?: NCDMatrixResponse;
    showEmptyCells?: boolean; // Control empty cell visibility
    fitToContainer?: boolean; // Control fitting behavior
    onError?: (error: string) => void; // New error callback
}

export const KGridDualOptimization: React.FC<KGridDualOptimizationProps> = ({
                                                                                width = 3,
                                                                                height = 3,
                                                                                objects,
                                                                                maxIterations = 50000,
                                                                                onOptimizationStart,
                                                                                onOptimizationEnd,
                                                                                onIterationUpdate,
                                                                                colorTheme = "scientific",
                                                                                autoStart = false,
                                                                                showSingleGrid = false,
                                                                                isRunning = false,
                                                                                ncdMatrixResponse,
                                                                                showEmptyCells = true,
                                                                                fitToContainer = true,
                                                                                onError
                                                                            }) => {
    // Add global styles for custom text size
    React.useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .text-xxs {
                font-size: 0.65rem;
                line-height: 0.85rem;
            }
        `;
        style.textContent += `
    .shadow-glow {
        box-shadow: 0 0 3px 1px rgba(59, 130, 246, 0.6);
    }
`;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Main grid states
    const [gridState1, setGridState1] = useState<GridState | null>(null);
    const [gridState2, setGridState2] = useState<GridState | null>(null);

    // Tracking and control states
    const [iterations, setIterations] = useState<number>(0);
    const [converged, setConverged] = useState<boolean>(false);
    const bestMatchPercentageRef = useRef<number>(0);

    const [hasError, setHasError] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>("");

    // Best state tracking
    const [, setBestObjective1] = useState<number>(Number.MAX_VALUE);
    const [bestGrid1, setBestGrid1] = useState<GridState | null>(null);

    // Reference to the web worker
    const workerRef = useRef<Worker | null>(null);

    // State tracking refs
    const isRunningRef = useRef(isRunning);
    const optimizationActive = useRef(false);
    const autoStartRef = useRef(autoStart);
    const hasStartedRef = useRef(false);
    const initializedRef = useRef(false);

    // Refs for grid containers
    const grid1ContainerRef = useRef<HTMLDivElement>(null);
    const grid2ContainerRef = useRef<HTMLDivElement>(null);

    // Keep track of highlights for recent improvements
    const [highlightCells1, setHighlightCells1] = useState<{ i: number, j: number }[]>([]);
    const [highlightCells2, setHighlightCells2] = useState<{ i: number, j: number }[]>([]);
    const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Create a stable objects by ID mapping
    const objectsById = useMemo(() => {
        const mapping: Record<string, { label: string, content: number[] }> = {};
        objects?.forEach((obj: GridObject) => {
            const stringId = String(obj.id);
            mapping[stringId] = {
                label: obj.label || "Unknown",
                content: obj.content
            };
        });
        return mapping;
    }, [objects]);

    // Initialize a new grid - only called once per component lifecycle
    const initializeGrid = useCallback((objects: GridObject[], ncdMatrixResponse: NCDMatrixResponse) => {
        console.log("Initializing grid with objects:", objects?.length);
        const processedObjects = objects?.map(obj => ({
            ...obj,
            id: obj.id
        }));
        return createSafeInitialGrid(width, height, processedObjects, ncdMatrixResponse);
    }, [width, height, objects, ncdMatrixResponse]);

    // Helper to convert Map to serializable object
    const mapToObject = useCallback((map: Map<any, any>) => {
        const obj: Record<string, any> = {};
        map.forEach((value, key) => {
            obj[String(key)] = value;
        });
        return obj;
    }, []);

    // Helper to convert object back to Map
    const objectToMap = useCallback((obj: Record<string, any>, isNumberKey = false) => {
        const map = new Map();
        Object.entries(obj).forEach(([key, value]) => {
            map.set(isNumberKey ? Number(key) : key, value);
        });
        return map;
    }, []);

    // Create and initialize worker
    useEffect(() => {
        if (!workerRef.current) {
            console.log("Creating worker instance (one-time)");
            workerRef.current = new OptimizationWorker();

            const initMessage = {
                command: 'initialize'
            };
            if (workerRef.current) {
                workerRef.current.postMessage(initMessage);
            }
        }

        // Clean up the worker when component unmounts
        return () => {
            if (workerRef.current) {
                console.log("Terminating worker");
                workerRef.current.terminate();
                workerRef.current = null;
            }

            // Clear any highlight timers
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    // Helper to update highlights
    const updateCellHighlights = useCallback((grid: GridState, type: 'grid1' | 'grid2') => {
        // Find cells that have changed significantly based on the type of optimization
        const changes: { i: number, j: number }[] = [];

        // Choose a subset of cells to highlight (for visual effect)
        for (let i = 0; i < Math.min(3, grid.height); i++) {
            for (let j = 0; j < Math.min(3, grid.width); j++) {
                if (Math.random() > 0.7) { // Randomly select cells to highlight
                    changes.push({i, j});
                }
            }
        }

        if (type === 'grid1') {
            setHighlightCells1(changes);
        } else {
            setHighlightCells2(changes);
        }

        // Clear highlights after a delay
        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }

        highlightTimerRef.current = setTimeout(() => {
            setHighlightCells1([]);
            setHighlightCells2([]);
        }, 1500);
    }, []);

    // Process improvement received from worker
    const processImprovement = useCallback((
        newGrid1: GridState,
        similarity: number,
        improvement: OptimizationImprovements
    ) => {
        if (!isRunningRef.current) return;

        // Check for negative objective values and fix them
        if (newGrid1.objectiveValue < 0) {
            console.warn("Received negative objective value - recalculating");
            // Send reset command to worker
            if (workerRef.current) {
                workerRef.current.postMessage({command: 'reset'});
            }
            setHasError(true);
            setErrorMessage("Negative objective value detected. Optimization will restart.");
            if (onError) {
                onError("Negative objective value detected. Optimization will restart.");
            }
            return;
        }

        // Apply updates based on improvements
        if (improvement.grid1Improved) {
            setGridState1(newGrid1);
            setBestObjective1(newGrid1.objectiveValue);
            setBestGrid1(structuredClone(newGrid1));
            console.log(`New best for Grid 1: ${newGrid1.objectiveValue.toFixed(4)}`);
        }

        if (improvement.similarityImproved) {
            bestMatchPercentageRef.current = similarity;
        }

        if (similarity >= 100) {
            console.log("Grids have converged to identical arrangements");
            setConverged(true);
            stopOptimization();
        }
    }, [onError]);

    // Check for termination conditions
    const checkTerminationConditions = useCallback((status: IterationStatus) => {
        const {currentIteration, noImprovementCount} = status;

        // Check for negative objective values
        if (status.bestObjective1 < 0) {
            console.warn("Negative objective value detected - resetting worker");
            stopOptimization();

            // Reset and restart
            setTimeout(() => {
                if (workerRef.current) {
                    workerRef.current.postMessage({command: 'reset'});
                }
            }, 100);

            setHasError(true);
            setErrorMessage("Negative objective value detected. Optimization will restart.");
            if (onError) {
                onError("Negative objective value detected. Optimization will restart.");
            }

            return true;
        }

        if (currentIteration >= maxIterations) {
            console.log("Maximum iterations reached");
            setConverged(true);
            stopOptimization();
            return true;
        }

        if (noImprovementCount > 10000) {
            console.log("Optimization stalled - no improvement in 10,000 iterations");
            setConverged(true);
            stopOptimization();
            return true;
        }

        return false;
    }, [maxIterations, onError]);

    // Set up the message handler for worker responses
    useEffect(() => {
        if (!workerRef.current) return;

        // Set the message handler
        workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
            const {type, grid1, similarity, iteration, improvement, status, error} = e.data;

            if (iteration !== undefined) {
                setIterations(iteration);
                if (onIterationUpdate) {
                    onIterationUpdate(iteration);
                }
            }

            console.log(`Received worker message: ${type}, iteration: ${iteration || 'N/A'}`);
            switch (type) {
                case 'optimization_improved':
                    if (grid1 && similarity !== undefined && improvement) {
                        // Fix Map serialization before processing
                        if (grid1.idToIndexMap && !(grid1.idToIndexMap instanceof Map)) {
                            grid1.idToIndexMap = objectToMap(grid1.idToIndexMap as any);
                        }
                        if (grid1.indexToIdMap && !(grid1.indexToIdMap instanceof Map)) {
                            grid1.indexToIdMap = objectToMap(grid1.indexToIdMap as any, true);
                        }

                        processImprovement(grid1, similarity, improvement);

                        // Update highlights to show improvement
                        if (improvement.grid1Improved) {
                            updateCellHighlights(grid1, 'grid1');
                        }
                    }
                    break;

                case 'status_update':
                    if (status) checkTerminationConditions(status);
                    break;

                case 'optimization_complete':
                    console.log("Optimization complete - reached maximum iterations");
                    setConverged(true);
                    stopOptimization();
                    break;

                case 'optimization_stopped':
                    console.log("Optimization stopped by worker");
                    break;

                case 'optimization_started':
                    console.log("Optimization started in worker");
                    break;

                case 'initialized':
                    console.log('Worker initialized');
                    break;

                case 'reset_confirmed':
                    console.log('Worker state reset');
                    break;

                case 'error':
                    console.error('Worker error:', error);
                    setHasError(true);
                    setErrorMessage(error || "Unknown error occurred");
                    if (onError) {
                        onError(error || "Unknown error occurred");
                    }
                    break;

                default:
                    console.warn(`Unknown message type: ${type}`);
            }
        };

    }, [onIterationUpdate, objectToMap, processImprovement, checkTerminationConditions, updateCellHighlights, onError]);

    const stopOptimization = useCallback(() => {
        isRunningRef.current = false;
        optimizationActive.current = false;

        if (workerRef.current) {
            workerRef.current.postMessage({command: 'stop_optimization'});
        }

        if (onOptimizationEnd) {
            onOptimizationEnd();
        }

        console.log(`Optimization ended with best match: ${bestMatchPercentageRef.current.toFixed(2)}%`);
    }, [onOptimizationEnd]);

    const startOptimization = useCallback(() => {
        if (!gridState1 || !gridState2 || !workerRef.current) {
            console.error("Cannot start optimization: missing required data");
            return;
        }

        console.log("Starting optimization with new grids");

        workerRef.current.postMessage({command: 'reset'});

        // Clear any previous errors
        setHasError(false);
        setErrorMessage("");

        isRunningRef.current = true;
        optimizationActive.current = true;

        setConverged(false);
        setIterations(0);

        setTimeout(() => {
            if (!workerRef.current || !gridState1 || !gridState2) return;

            const gridState1Clone = structuredClone(gridState1);
            const gridState2Clone = structuredClone(gridState2);


            const message = {
                command: 'start_optimization',
                data: {
                    gridState1: gridState1Clone,
                    gridState2: gridState2Clone,
                    ncdMatrix: ncdMatrixResponse?.ncdMatrix,
                    maxIterations: Number.MAX_SAFE_INTEGER
                }
            };

            workerRef.current.postMessage(message);

            if (onOptimizationStart) {
                onOptimizationStart();
            }
        }, 100);
    }, [gridState1, gridState2, ncdMatrixResponse, maxIterations, onOptimizationStart, mapToObject]);

    // Sync with external isRunning prop
    useEffect(() => {
        isRunningRef.current = isRunning;

        if (isRunning && !optimizationActive.current && gridState1 && gridState2) {
            startOptimization();
        } else if (!isRunning && optimizationActive.current) {
            stopOptimization();
        }
    }, [isRunning, gridState1, gridState2, startOptimization, stopOptimization]);

    // Auto-start effect
    useEffect(() => {
        if (autoStartRef.current && !hasStartedRef.current && gridState1 && gridState2) {
            console.log("Auto-starting optimization");
            hasStartedRef.current = true;
            startOptimization();
        }
    }, [gridState1, gridState2, startOptimization]);

    // Initialize grids when component mounts - ONLY ONCE
    useEffect(() => {
        if (!initializedRef.current && objects && objects.length > 0 && ncdMatrixResponse) {
            try {
                const initialGrid1 = initializeGrid(objects, ncdMatrixResponse);
                const initialGrid2 = initializeGrid(objects, ncdMatrixResponse);

                setGridState1(initialGrid1);
                setGridState2(initialGrid2);

                setBestObjective1(initialGrid1.objectiveValue);

                console.log("Initial grids created");

                initializedRef.current = true;
            } catch (error) {
                console.error("Error creating initial grids:", error);
                setHasError(true);
                setErrorMessage("Failed to initialize grids. Please try again.");
                if (onError) {
                    onError("Failed to initialize grids. Please try again.");
                }
            }
        }
    }, [width, height, initializeGrid, objects, ncdMatrixResponse, isRunning, onError]);

    // Show the best arrangement when the animation is stopped.
    useEffect(() => {
        if (!isRunning) {
            if (bestGrid1) {
                console.log(`Showing best objective grids with values: ${bestGrid1.objectiveValue.toFixed(4)}`);

                setGridState1(bestGrid1);
            }
        }
    }, [isRunning, gridState1, gridState2, bestGrid1]);

    return (
        <div className="w-full h-full">
            {/* Error message if any */}
            {hasError && (
                <div className="mb-4 bg-red-800 text-white p-3 rounded-lg shadow flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 flex-shrink-0" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                    </svg>
                    <span>{errorMessage}</span>
                    <button
                        className="ml-auto bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs"
                        onClick={() => {
                            setHasError(false);
                            setErrorMessage("");
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Keep progress user-facing; detailed worker metrics stay internal. */}
            {isRunning && (
                <div className="mb-4 bg-gray-800 text-white p-2 rounded-lg shadow flex items-center">
                    <div className="flex items-center">
                        <div className="animate-pulse mr-2 h-2 w-2 bg-green-400 rounded-full"></div>
                        <span className="text-xs">Arranging similar objects…</span>
                    </div>
                </div>
            )}

            {/* Grid Display Area */}
            <div className={`flex ${showSingleGrid ? 'gap-0' : 'gap-0'} mb-4`}>
                <div
                    ref={grid1ContainerRef}
                    className={`${showSingleGrid ? 'w-full' : 'w-1/2'} bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col`}>
                    <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                        Arrangement
                    </h3>
                    <div className="h-96 border-b border-gray-600 overflow-hidden flex-grow relative p-0">
                        {gridState1 ? (
                            <GridDisplay
                                key="grid1-display"
                                grid={gridState1}
                                objectsById={objectsById}
                                iterations={iterations}
                                colorTheme={colorTheme}
                                showEmptyCells={showEmptyCells}
                                fitToContainer={fitToContainer}
                                clusterThreshold={0.25} // Lower threshold for better clustering
                                highlightCells={highlightCells1}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full bg-gray-900 text-gray-300">
                                <div className="text-center">
                                    <div
                                        className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                    <p>Initializing grid...</p>
                                </div>
                            </div>
                        )}

                        {/* Optimization indicator overlay */}
                        {isRunning && highlightCells1.length > 0 && (
                            <div
                                className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded opacity-80 animate-pulse">
                                Improving...
                            </div>
                        )}
                    </div>

                </div>

                {!showSingleGrid && (
                    <div
                        ref={grid2ContainerRef}
                        className="w-1/2 bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col">
                        <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                            Alternative arrangement
                        </h3>
                        <div className="h-96 border-b border-gray-600 overflow-hidden flex-grow relative">
                            {gridState2 ? (
                                <GridDisplay
                                    key="grid2-display"
                                    grid={gridState2}
                                    objectsById={objectsById}
                                    iterations={iterations}
                                    colorTheme={colorTheme}
                                    showEmptyCells={showEmptyCells}
                                    fitToContainer={fitToContainer}
                                    clusterThreshold={0.25} // Lower threshold for better clustering
                                    highlightCells={highlightCells2}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full bg-gray-900 text-gray-300">
                                    <div className="text-center">
                                        <div
                                            className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                        <p>Initializing grid...</p>
                                    </div>
                                </div>
                            )}

                            {/* Optimization indicator overlay */}
                            {isRunning && highlightCells2.length > 0 && (
                                <div
                                    className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded opacity-80 animate-pulse">
                                    Improving...
                                </div>
                            )}
                        </div>

                    </div>
                )}
            </div>

            {converged && !isRunning && (
                <div className="mt-2 bg-green-800 rounded-lg p-3 text-white">
                    <p className="text-xs">Arrangement complete.</p>
                </div>
            )}
        </div>
    );
};
