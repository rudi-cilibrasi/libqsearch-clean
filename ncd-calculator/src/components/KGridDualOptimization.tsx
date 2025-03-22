import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
    GridObject,
    GridState,
    createSafeInitialGrid,
    optimizeStep,
    calculateObjectiveWithSymmetryBreaking,
    getGradualFactorMatrix,
    deepCopy,
    calculateGridSimilarity,
} from "@/services/kgrid.ts";
import { GridDisplay } from "./GridDisplay";
import {NCDMatrixResponse} from "@/types/ncd.ts";

interface KGridDualOptimizationProps {
    width: number;
    height: number;
    objects: GridObject[];
    maxIterations: number;
    onOptimizationStart?: () => void;
    onOptimizationEnd?: () => void;
    onIterationUpdate?: (iteration: number) => void;
    onCellSelect?: (gridNumber: 1 | 2, objectId: string, position: [number, number]) => void;
    colorTheme?: string;
    autoStart?: boolean;
    optimizationEndTime?: number;
    optimizationStartTime?: number;
    totalExecutionTime?: number;
    iterationsPerSecond?: number;
    showSingleGrid?: boolean;
    isRunning?: boolean;
    ncdMatrixResponse: NCDMatrixResponse;
}

export const KGridDualOptimization: React.FC<KGridDualOptimizationProps> = ({
                                                                                width = 3,
                                                                                height = 3,
                                                                                objects,
                                                                                maxIterations = 50000,
                                                                                onOptimizationStart,
                                                                                onOptimizationEnd,
                                                                                onIterationUpdate,
                                                                                onCellSelect,
                                                                                colorTheme = "scientific",
                                                                                autoStart = false,
                                                                                optimizationEndTime,
                                                                                totalExecutionTime,
                                                                                iterationsPerSecond,
                                                                                optimizationStartTime,
                                                                                showSingleGrid = false,
                                                                                isRunning,
                                                                                ncdMatrixResponse
                                                                            }) => {
    // Main grid states
    const [gridState1, setGridState1] = useState<GridState | null>(null);
    const [gridState2, setGridState2] = useState<GridState | null>(null);

    // Tracking and control states
    const [iterations, setIterations] = useState(0);
    const [converged, setConverged] = useState(false);
    const [convergenceType, setConvergenceType] = useState("");
    const [matchPercentage, setMatchPercentage] = useState(0);

    // Best state tracking
    const [bestObjective1, setBestObjective1] = useState(Number.MAX_VALUE);
    const [bestObjective2, setBestObjective2] = useState(Number.MAX_VALUE);
    const [bestGrid1, setBestGrid1] = useState<GridState | null>(null);
    const [bestGrid2, setBestGrid2] = useState<GridState | null>(null);

    // UI state
    const [grid1Version, setGrid1Version] = useState(0);
    const [grid2Version, setGrid2Version] = useState(0);

    // Performance tracking
    const [lastAcceptedSwap1, setLastAcceptedSwap1] = useState<number | null>(null);
    const [lastAcceptedSwap2, setLastAcceptedSwap2] = useState<number | null>(null);

    // Use refs for interval timers to avoid closure issues
    const animationFrameRef = useRef<number | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());
    const autoStartRef = useRef(autoStart);
    const hasStartedRef = useRef(false);

    // Track last grid states to detect meaningful changes
    const lastGrid1Ref = useRef<number[][] | null>(null);
    const lastGrid2Ref = useRef<number[][] | null>(null);

    // Create a stable objects by ID mapping
    const objectsById = useMemo(() => {
        const mapping: Record<string, { label: string; content: number[] }> = {};
        objects.forEach((obj) => {
            const stringId = String(obj.id);
            mapping[stringId] = {
                label: obj.label || "Unknown",
                content: obj.content || "",
            };
        });
        return mapping;
    }, [objects]);

    // Initialize a new grid
    const initializeGrid = useCallback((factorMatrix: number[][]) => {
        console.log("Initializing grid with objects:", objects.length);
        const processedObjects = objects.map(obj => ({
            ...obj,
            id: obj.id
        }));
        const grid = createSafeInitialGrid(width, height, processedObjects, ncdMatrixResponse);
        grid.objectiveValue = calculateObjectiveWithSymmetryBreaking(grid, factorMatrix, ncdMatrixResponse.ncdMatrix);
        return grid;
    }, [width, height, objects]);

    // Check for convergence between the two grids
    const checkConvergence = useCallback(() => {
        if (!gridState1 || !gridState2) return false;

        // Update best states if needed
        if (gridState1.objectiveValue < bestObjective1) {
            setBestObjective1(gridState1.objectiveValue);
            setBestGrid1(deepCopy(gridState1));
            setLastAcceptedSwap1(iterations);
            console.log(`New best for Grid 1: ${gridState1.objectiveValue.toFixed(4)}`);
        }

        if (gridState2.objectiveValue < bestObjective2) {
            setBestObjective2(gridState2.objectiveValue);
            setBestGrid2(deepCopy(gridState2));
            setLastAcceptedSwap2(iterations);
            console.log(`New best for Grid 2: ${gridState2.objectiveValue.toFixed(4)}`);
        }

        // Calculate similarity between grids
        const currentSimilarity = calculateGridSimilarity(gridState1, gridState2);
        setMatchPercentage(currentSimilarity);

        // Check for termination conditions
        if (currentSimilarity === 1) {
            console.log("Grids have converged to identical arrangements");
            setConverged(true);
            setConvergenceType("exact match");
            if (onOptimizationEnd) {
                onOptimizationEnd();
            }
            return true;
        }

        if (iterations >= maxIterations) {
            console.log("Maximum iterations reached");
            setConverged(true);
            setConvergenceType("max iterations reached");
            if (onOptimizationEnd) {
                onOptimizationEnd();
            }
            return true;
        }

        // Check if we've gone too long without improvement
        const iterationsSinceLastImprovement1 = lastAcceptedSwap1 !== null ? iterations - lastAcceptedSwap1 : 0;
        const iterationsSinceLastImprovement2 = lastAcceptedSwap2 !== null ? iterations - lastAcceptedSwap2 : 0;

        // If both grids haven't improved in 10,000 iterations, consider convergence
        if (iterationsSinceLastImprovement1 > 10000 && iterationsSinceLastImprovement2 > 10000) {
            console.log("Optimization stalled - no improvement in 10,000 iterations");
            setConverged(true);
            setConvergenceType("optimization stalled");
            if (onOptimizationEnd) {
                onOptimizationEnd();
            }
            return true;
        }

        return false;
    }, [
        gridState1,
        gridState2,
        iterations,
        maxIterations,
        bestObjective1,
        bestObjective2,
        lastAcceptedSwap1,
        lastAcceptedSwap2,
        onOptimizationEnd
    ]);

    // Perform one optimization step for a grid
    const performOptimizationStep = useCallback((gridState: GridState, iteration: number) => {
        if (!gridState) return null;

        // Perform the optimization step (which returns a new grid state)
        const updatedGrid = optimizeStep(gridState, iteration);

        // Always return a new object to ensure React detects the change
        return {
            ...updatedGrid,
            grid: [...updatedGrid.grid.map(row => [...row])],
            // Use new map objects to ensure reference change
            idToIndexMap: new Map(updatedGrid.idToIndexMap),
            indexToIdMap: new Map(updatedGrid.indexToIdMap)
        };
    }, []);

    // Main optimization loop using requestAnimationFrame for smoother updates
    useEffect(() => {
        if (!isRunning || !gridState1 || !gridState2) return;

        const runOptimizationStep = () => {
            // Update grid states with new optimized versions
            const newGrid1 = performOptimizationStep(gridState1, iterations);
            const newGrid2 = performOptimizationStep(gridState2, iterations);

            // Check if grids have actually changed
            setGridState1(newGrid1);
            setGridState2(newGrid2);

            // Update iteration counter and notify parent
            setIterations(prev => {
                const newIteration = prev + 1;
                if (onIterationUpdate) {
                    onIterationUpdate(newIteration);
                }
                return newIteration;
            });

            // Update the last update time
            lastUpdateTimeRef.current = Date.now();

            // Check for convergence
            if (checkConvergence()) {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                    animationFrameRef.current = null;
                }
                return;
            }

            // Schedule the next frame
            animationFrameRef.current = requestAnimationFrame(runOptimizationStep);
        };

        // Start the animation loop
        animationFrameRef.current = requestAnimationFrame(runOptimizationStep);

        // Cleanup on unmount or when optimization stops
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [isRunning, gridState1, gridState2, iterations, performOptimizationStep, checkConvergence, onIterationUpdate]);

    // Handle auto-start
    useEffect(() => {
        if (autoStartRef.current && !hasStartedRef.current && gridState1 && gridState2) {
            console.log("Auto-starting optimization");
            hasStartedRef.current = true;
            if (onOptimizationStart) {
                onOptimizationStart();
            }
        }
    }, [gridState1, gridState2, onOptimizationStart]);

    // Cell selection handlers
    const handleCellSelect1 = useCallback((objectId: string, i: number, j: number) => {
        if (onCellSelect) {
            onCellSelect(1, objectId, [i, j]);
        }
    }, [onCellSelect]);

    const handleCellSelect2 = useCallback((objectId: string, i: number, j: number) => {
        if (onCellSelect) {
            onCellSelect(2, objectId, [i, j]);
        }
    }, [onCellSelect]);

    // Initialize grids when component mounts
    useEffect(() => {
        try {
            const precomputedGradualFactor = getGradualFactorMatrix(width, height);
            const initialGrid1 = initializeGrid(precomputedGradualFactor);
            const initialGrid2 = initializeGrid(precomputedGradualFactor);

            setGridState1(initialGrid1);
            setGridState2(initialGrid2);

            lastGrid1Ref.current = initialGrid1.grid.map(row => [...row]);
            lastGrid2Ref.current = initialGrid2.grid.map(row => [...row]);

            console.log("Initial grids created");
        } catch (error) {
            console.error("Error creating initial grids:", error);
        }
    }, [width, height, initializeGrid]);

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, []);

    return (
        <div className="w-full h-full">
            {/* Grid Display Area */}
            <div className={`flex ${showSingleGrid ? 'gap-0' : 'gap-4'} mb-4`}>
                <div className={`${showSingleGrid ? 'w-full' : 'w-1/2'} bg-gray-800 rounded-lg shadow-md overflow-hidden`}>
                    <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                        Grid 1
                        <span className="ml-2 text-sm text-green-300">
              ({gridState1?.objectiveValue.toFixed(4) || "N/A"})
            </span>
                    </h3>
                    <div className="h-96 border-b border-gray-600">
                        {gridState1 ? (
                            <GridDisplay
                                key={`grid1-${grid1Version}-${iterations}`}
                                grid={gridState1}
                                objectsById={objectsById}
                                iterations={iterations}
                                colorTheme={colorTheme}
                                onCellSelect={handleCellSelect1}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full bg-gray-900 text-gray-300">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                    <p>Initializing grid...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {!showSingleGrid && (
                    <div className="w-1/2 bg-gray-800 rounded-lg shadow-md overflow-hidden">
                        <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                            Grid 2
                            <span className="ml-2 text-sm text-green-300">
                ({gridState2?.objectiveValue.toFixed(4) || "N/A"})
              </span>
                        </h3>
                        <div className="h-96 border-b border-gray-600">
                            {gridState2 ? (
                                <GridDisplay
                                    key={`grid2-${grid2Version}-${iterations}`}
                                    grid={gridState2}
                                    objectsById={objectsById}
                                    iterations={iterations}
                                    colorTheme={colorTheme}
                                    onCellSelect={handleCellSelect2}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full bg-gray-900 text-gray-300">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                        <p>Initializing grid...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
