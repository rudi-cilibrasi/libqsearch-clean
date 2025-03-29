import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createSafeInitialGrid, GridObject, GridState,} from "@/services/kgrid";
import {GridDisplay} from "./GridDisplay";
// @ts-ignore
import OptimizationWorker from '../workers/kgridWorker.js?worker';
import {NCDMatrixResponse} from "@/types/ncd.ts";


interface OptimizationImprovements {
    grid1Improved: boolean;
    similarityImproved: boolean;
}

interface IterationStatus {
    currentIteration: number;
    bestObjective1: number;
    bestSimilarity: number;
    noImprovementCount: number;
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
    onMatchPercentageUpdate?: (number: number) => void;
    showEmptyCells?: boolean; // New prop to control empty cell visibility
    fitToContainer?: boolean; // New prop to control fitting behavior
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
                                                                                onMatchPercentageUpdate,
                                                                                showEmptyCells = true, // Show empty cells by default
                                                                                fitToContainer = false, // Don't fit to container by default
                                                                            }) => {
    // Main grid states
    const [gridState1, setGridState1] = useState<GridState | null>(null);
    const [gridState2, setGridState2] = useState<GridState | null>(null);

    // Display objective values - separate from internal grid state objectives
    const [displayObjective1, setDisplayObjective1] = useState<number | null>(null);
    const [displayObjective2, setDisplayObjective2] = useState<number | null>(null);

    // Tracking and control states
    const [iterations, setIterations] = useState<number>(0);
    //@ts-ignore
    const [converged, setConverged] = useState<boolean>(false);
    //@ts-ignore
    const [convergenceType, setConvergenceType] = useState<string>("");
    const [matchPercentage, setMatchPercentage] = useState<number>(0);
    const bestMatchPercentageRef = useRef<number>(0);

    // Best state tracking
    //@ts-ignore
    const [bestObjective1, setBestObjective1] = useState<number>(Number.MAX_VALUE);
    //@ts-ignore
    const [bestGrid1, setBestGrid1] = useState<GridState | null>(null);

    // Reference to the web worker
    const workerRef = useRef<Worker | null>(null);

    // State tracking refs
    const isRunningRef = useRef(isRunning);
    const optimizationActive = useRef(false);
    const autoStartRef = useRef(autoStart);
    const hasStartedRef = useRef(false);
    const initializedRef = useRef(false);

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
        };
    }, []);

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
                        processImprovement(grid1, similarity, improvement);
                    }
                    break;

                case 'status_update':
                    if (status) {
                        checkTerminationConditions(status);
                    }
                    break;

                case 'optimization_complete':
                    console.log("Optimization complete - reached maximum iterations");
                    setConverged(true);
                    setConvergenceType("max iterations reached");
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
                    break;

                default:
                    console.warn(`Unknown message type: ${type}`);
            }
        };

    }, [onIterationUpdate]);

    // Process improvement received from worker
    const processImprovement = useCallback((
        newGrid1: GridState,
        similarity: number,
        improvement: OptimizationImprovements
    ) => {
        if (!isRunningRef.current) return;

        // Apply updates based on improvements
        if (improvement.grid1Improved) {
            setGridState1(newGrid1);
            setBestObjective1(newGrid1.objectiveValue);
            setBestGrid1(structuredClone(newGrid1));
            setDisplayObjective1(newGrid1.objectiveValue);
            console.log(`New best for Grid 1: ${newGrid1.objectiveValue.toFixed(4)}`);
        }

        if (improvement.similarityImproved) {
            setMatchPercentage(similarity);
            if (onMatchPercentageUpdate) {
                onMatchPercentageUpdate(similarity);
            }
            bestMatchPercentageRef.current = similarity;
        }

        if (similarity >= 100) {
            console.log("Grids have converged to identical arrangements");
            setConverged(true);
            setConvergenceType("exact match");
            stopOptimization();
        }
    }, [onMatchPercentageUpdate]);

    // Check for termination conditions
    const checkTerminationConditions = useCallback((status: IterationStatus) => {
        const {currentIteration, noImprovementCount} = status;

        if (currentIteration >= maxIterations) {
            console.log("Maximum iterations reached");
            setConverged(true);
            setConvergenceType("max iterations reached");
            stopOptimization();
            return true;
        }

        if (noImprovementCount > 10000) {
            console.log("Optimization stalled - no improvement in 10,000 iterations");
            setConverged(true);
            setConvergenceType("optimization stalled");
            stopOptimization();
            return true;
        }

        return false;
    }, [maxIterations]);

    const startOptimization = useCallback(() => {
        if (!gridState1 || !gridState2 || !workerRef.current) {
            console.error("Cannot start optimization: missing required data");
            return;
        }

        console.log("Starting optimization with new grids");

        workerRef.current.postMessage({command: 'reset'});

        isRunningRef.current = true;
        optimizationActive.current = true;

        setConverged(false);
        setConvergenceType("");
        setIterations(0);

        setTimeout(() => {
            if (!workerRef.current || !gridState1 || !gridState2) return;

            const message = {
                command: 'start_optimization',
                data: {
                    gridState1: gridState1,
                    gridState2: gridState2,
                    ncdMatrix: ncdMatrixResponse?.ncdMatrix,
                    maxIterations: maxIterations
                }
            };

            workerRef.current.postMessage(message);

            if (onOptimizationStart) {
                onOptimizationStart();
            }
        }, 100);
    }, [gridState1, gridState2, ncdMatrixResponse, maxIterations, onOptimizationStart]);

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

                if (!isRunning) {
                    setDisplayObjective1(initialGrid1.objectiveValue);
                    setDisplayObjective2(initialGrid2.objectiveValue);
                }

                setBestObjective1(initialGrid1.objectiveValue);

                console.log("Initial grids created");

                initializedRef.current = true;
            } catch (error) {
                console.error("Error creating initial grids:", error);
            }
        }
    }, [width, height, initializeGrid, objects, ncdMatrixResponse]);

    // Update display objectives and show best grids when the animation is stopped
    useEffect(() => {
        if (!isRunning) {
            if (bestGrid1) {
                console.log(`Showing best objective grids with values: ${bestGrid1.objectiveValue.toFixed(4)}`);

                setGridState1(bestGrid1);

                setDisplayObjective1(bestGrid1.objectiveValue);
            } else if (gridState1 && gridState2) {
                setDisplayObjective1(gridState1.objectiveValue);
                setDisplayObjective2(gridState2.objectiveValue);
            }
        }
    }, [isRunning, gridState1, gridState2, bestGrid1]);

    return (
        <div className="w-full h-full">
            {/* Grid Display Area */}
            <div className={`flex ${showSingleGrid ? 'gap-0' : 'gap-4'} mb-4`}>
                <div
                    className={`${showSingleGrid ? 'w-full' : 'w-1/2'} bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col`}>
                    <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                        Grid 1
                        {!isRunning && displayObjective1 !== null && (
                            <span className="ml-2 text-sm text-green-300">
                                ({displayObjective1?.toFixed(4) || "N/A"})
                            </span>
                        )}
                    </h3>
                    <div className="h-96 border-b border-gray-600 overflow-hidden flex-grow">
                        {gridState1 ? (
                            <GridDisplay
                                key="grid1-display"
                                grid={gridState1}
                                objectsById={objectsById}
                                iterations={iterations}
                                colorTheme={colorTheme}
                                showEmptyCells={showEmptyCells}
                                fitToContainer={fitToContainer}
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
                    </div>

                    {/* Grid details */}
                    <div className="p-2 bg-gray-700 text-xs text-gray-300 flex justify-between">
                        <span>Dimensions: {gridState1?.width}×{gridState1?.height}</span>
                        <span>Empty cells: {gridState1 ? countEmptyCells(gridState1) : 0}</span>
                    </div>
                </div>

                {!showSingleGrid && (
                    <div className="w-1/2 bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col">
                        <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                            Grid 2
                            {!isRunning && displayObjective2 !== null && (
                                <span className="ml-2 text-sm text-green-300">
                                    ({displayObjective2?.toFixed(4) || "N/A"})
                                </span>
                            )}
                        </h3>
                        <div className="h-96 border-b border-gray-600 overflow-hidden flex-grow">
                            {gridState2 ? (
                                <GridDisplay
                                    key="grid2-display"
                                    grid={gridState2}
                                    objectsById={objectsById}
                                    iterations={iterations}
                                    colorTheme={colorTheme}
                                    showEmptyCells={showEmptyCells}
                                    fitToContainer={fitToContainer}
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
                        </div>

                        {/* Grid details */}
                        <div className="p-2 bg-gray-700 text-xs text-gray-300 flex justify-between">
                            <span>Dimensions: {gridState2?.width}×{gridState2?.height}</span>
                            <span>Empty cells: {gridState2 ? countEmptyCells(gridState2) : 0}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Status and controls */}
            <div className="bg-gray-800 rounded-lg p-2 text-center">
                {isRunning ? (
                    <div className="text-xs text-gray-400 p-2">
                        Optimization in progress. Updates occur when better arrangements are found.
                        Current iteration: {iterations.toLocaleString()}
                    </div>
                ) : (
                    <div className="text-xs text-gray-400 p-2">
                        Match percentage: {matchPercentage.toFixed(2)}% |
                        Empty cells are {showEmptyCells ? 'visible' : 'hidden'} |
                        Grid type: {gridState1?.width}×{gridState1?.height} with slack space
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper function to count empty cells in a grid
const countEmptyCells = (grid: GridState): number => {
    const EMPTY_CELL_INDEX = grid.emptyIndex || -1;
    let count = 0;

    for (let i = 0; i < grid.height; i++) {
        for (let j = 0; j < grid.width; j++) {
            const index = i * grid.width + j;
            if (grid.grid[index] === EMPTY_CELL_INDEX) {
                count++;
            }
        }
    }

    return count;
};
