// KGridDualOptimization.tsx

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

export const KGridDualOptimization = ({
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
                                          ncdMatrixResponse,
                                         onMatchPercentageUpdate,
                                      }) => {
    // Main grid states
    const [gridState1, setGridState1] = useState(null);
    const [gridState2, setGridState2] = useState(null);

    // Display objective values - separate from internal grid state objectives
    const [displayObjective1, setDisplayObjective1] = useState(null);
    const [displayObjective2, setDisplayObjective2] = useState(null);

    // Tracking and control states
    const [iterations, setIterations] = useState(0);
    const [converged, setConverged] = useState(false);
    const [convergenceType, setConvergenceType] = useState("");
    const [matchPercentage, setMatchPercentage] = useState(0);
    const bestMatchPercentageRef = useRef(0);

    // Best state tracking
    const [bestObjective1, setBestObjective1] = useState(Number.MAX_VALUE);
    const [bestObjective2, setBestObjective2] = useState(Number.MAX_VALUE);
    const [bestGrid1, setBestGrid1] = useState(null);
    const [bestGrid2, setBestGrid2] = useState(null);

    // Performance tracking
    const [lastAcceptedSwap1, setLastAcceptedSwap1] = useState(null);
    const [lastAcceptedSwap2, setLastAcceptedSwap2] = useState(null);

    // Use refs for interval timers to avoid closure issues
    const animationFrameRef = useRef(null);
    const lastUpdateTimeRef = useRef(Date.now());
    const autoStartRef = useRef(autoStart);
    const hasStartedRef = useRef(false);
    const isRunningRef = useRef(isRunning);

    // Ref to track if initialization has occurred
    const initializedRef = useRef(false);

    // Create a stable objects by ID mapping
    const objectsById = useMemo(() => {
        const mapping = {};
        objects.forEach((obj) => {
            const stringId = String(obj.id);
            mapping[stringId] = {
                label: obj.label || "Unknown",
                content: obj.content || "",
            };
        });
        return mapping;
    }, [objects]);

    // Initialize a new grid - only called once per component lifecycle
    const initializeGrid = useCallback((factorMatrix) => {
        console.log("Initializing grid with objects:", objects.length);
        const processedObjects = objects.map(obj => ({
            ...obj,
            id: obj.id
        }));
        const grid = createSafeInitialGrid(width, height, processedObjects, ncdMatrixResponse);
        grid.objectiveValue = calculateObjectiveWithSymmetryBreaking(grid, factorMatrix, ncdMatrixResponse.ncdMatrix);
        return grid;
    }, [width, height, objects, ncdMatrixResponse]);

    // Check for convergence between the two grids
    const checkConvergence = useCallback(() => {
        if (!gridState1 || !gridState2) return false;

        // Update best states if needed
        if (gridState1.objectiveValue < bestObjective1) {
            setBestObjective1(gridState1.objectiveValue);
            setBestGrid1(deepCopy(gridState1));
            setLastAcceptedSwap1(iterations);
            // Only update display objective when a better value is found
            setDisplayObjective1(gridState1.objectiveValue);
            console.log(`New best for Grid 1: ${gridState1.objectiveValue.toFixed(4)}`);
        }

        if (gridState2.objectiveValue < bestObjective2) {
            setBestObjective2(gridState2.objectiveValue);
            setBestGrid2(deepCopy(gridState2));
            setLastAcceptedSwap2(iterations);
            // Only update display objective when a better value is found
            setDisplayObjective2(gridState2.objectiveValue);
            console.log(`New best for Grid 2: ${gridState2.objectiveValue.toFixed(4)}`);
        }

        // Calculate similarity between grids - properly handle empty grids
        if (gridState1?.grid && gridState2?.grid) {
            const currentSimilarity = calculateGridSimilarity(gridState1, gridState2);
            // Convert to percentage (0-100)
            const percentage = currentSimilarity * 100;

            // Only update if the match percentage improves
            if (percentage > matchPercentage) {
                setMatchPercentage(percentage);

                // Pass match percentage up to parent component
                if (onMatchPercentageUpdate) {
                    onMatchPercentageUpdate(percentage);
                }

                // Track best match percentage
                bestMatchPercentageRef.current = percentage;
            }
        }

        // Check for termination conditions
        if (matchPercentage === 100) {
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
        onOptimizationEnd,
        matchPercentage
    ]);

    // Perform one optimization step for a grid
    const performOptimizationStep = useCallback((gridState, iteration) => {
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

    // Synchronize running state with ref
    useEffect(() => {
        isRunningRef.current = isRunning;
    }, [isRunning]);

    // Main optimization loop using requestAnimationFrame for smoother updates
    useEffect(() => {
        if (!isRunning || !gridState1 || !gridState2) return;

        // Only allow the optimization to run when explicitly set to running
        if (!isRunningRef.current) return;

        const runOptimizationStep = () => {
            // Check again inside the function to ensure we have the latest value
            if (!isRunningRef.current) return;

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

            // Schedule the next frame only if still running
            if (isRunningRef.current) {
                animationFrameRef.current = requestAnimationFrame(runOptimizationStep);
            }
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

    // Handle auto-start - make sure it only happens once
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
    const handleCellSelect1 = useCallback((objectId, i, j) => {
        if (onCellSelect) {
            onCellSelect(1, objectId, [i, j]);
        }
    }, [onCellSelect]);

    const handleCellSelect2 = useCallback((objectId, i, j) => {
        if (onCellSelect) {
            onCellSelect(2, objectId, [i, j]);
        }
    }, [onCellSelect]);

    // Initialize grids when component mounts - ONLY ONCE
    useEffect(() => {
        // Only initialize once, using the initializedRef to prevent duplicate initializations
        if (!initializedRef.current && objects.length > 0 && ncdMatrixResponse) {
            try {
                const precomputedGradualFactor = getGradualFactorMatrix(width, height);
                const initialGrid1 = initializeGrid(precomputedGradualFactor);
                const initialGrid2 = initializeGrid(precomputedGradualFactor);

                setGridState1(initialGrid1);
                setGridState2(initialGrid2);

                // Set initial display objectives - only when animation is stopped
                if (!isRunning) {
                    setDisplayObjective1(initialGrid1.objectiveValue);
                    setDisplayObjective2(initialGrid2.objectiveValue);
                }

                // Set initial best objectives
                setBestObjective1(initialGrid1.objectiveValue);
                setBestObjective2(initialGrid2.objectiveValue);

                console.log("Initial grids created");

                // Mark as initialized to prevent re-initialization
                initializedRef.current = true;
            } catch (error) {
                console.error("Error creating initial grids:", error);
            }
        }
    }, [width, height, initializeGrid, objects, ncdMatrixResponse, isRunning]);

    // Update display objectives and show best grids when the animation is stopped
    useEffect(() => {
        if (!isRunning) {
            // When animation stops, show the grids with the lowest objective values
            if (bestGrid1 && bestGrid2) {
                console.log(`Showing best objective grids with values: ${bestGrid1.objectiveValue.toFixed(4)} and ${bestGrid2.objectiveValue.toFixed(4)}`);

                // Update the display with the best objective grids
                setGridState1(bestGrid1);
                setGridState2(bestGrid2);

                // Set the objective values from best grids
                setDisplayObjective1(bestGrid1.objectiveValue);
                setDisplayObjective2(bestGrid2.objectiveValue);
            } else if (gridState1 && gridState2) {
                // If no best grids, just show current objective values
                setDisplayObjective1(gridState1.objectiveValue);
                setDisplayObjective2(gridState2.objectiveValue);
            }
        }
    }, [isRunning, gridState1, gridState2, bestGrid1, bestGrid2]);

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            // Reset initializedRef if component is unmounting
            initializedRef.current = false;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, []);

    // Calculate the grid cell size based on the available dimensions to prevent flickering
    const calculateCellDimensions = () => {
        const cellWidth = `${100 / width}%`;
        const cellHeight = `${100 / height}%`;
        return { width: cellWidth, height: cellHeight };
    };

    const cellDimensions = useMemo(calculateCellDimensions, [width, height]);

    return (
        <div className="w-full h-full">
            {/* Grid Display Area */}
            <div className={`flex ${showSingleGrid ? 'gap-0' : 'gap-4'} mb-4`}>
                <div className={`${showSingleGrid ? 'w-full' : 'w-1/2'} bg-gray-800 rounded-lg shadow-md overflow-hidden`}>
                    <h3 className="text-center font-bold p-2 bg-gray-700 border-b border-gray-600 text-white text-lg">
                        Grid 1
                        {!isRunning && displayObjective1 !== null && (
                            <span className="ml-2 text-sm text-green-300">
                                ({displayObjective1?.toFixed(4) || "N/A"})
                            </span>
                        )}
                    </h3>
                    <div className="h-96 border-b border-gray-600 overflow-hidden">
                        {gridState1 ? (
                            <GridDisplay
                                key="grid1-display" // Fixed key to prevent recreation
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
                            {!isRunning && displayObjective2 !== null && (
                                <span className="ml-2 text-sm text-green-300">
                                    ({displayObjective2?.toFixed(4) || "N/A"})
                                </span>
                            )}
                        </h3>
                        <div className="h-96 border-b border-gray-600 overflow-hidden">
                            {gridState2 ? (
                                <GridDisplay
                                    key="grid2-display" // Fixed key to prevent recreation
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
