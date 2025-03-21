import React, {useEffect, useState, useCallback, useMemo, useRef} from "react";
import {
    GridObject,
    GridState,
    createSafeInitialGrid,
    optimizeStep,
    calculateObjectiveWithSymmetryBreaking, createGradualFactorMatrix, deepCopy, calculateGridSimilarity,
} from "@/services/kgrid.ts";
import {GridDisplay} from "./GridDisplay";

interface KGridDualOptimizationProps {
    width: number;
    height: number;
    objects: GridObject[];
    maxIterations: number;
    onOptimizationStart?: () => void;
    onOptimizationEnd?: () => void;
    onIterationUpdate?: (iteration: number) => void;
    autoStart?: boolean;
    optimizationEndTime?: number;
    optimizationStartTime?: number;
    totalExecutionTime?: number;
    iterationsPerSecond?: number
}

export const KGridDualOptimization: React.FC<KGridDualOptimizationProps> = ({
                                                                                width = 3,
                                                                                height = 3,
                                                                                objects,
                                                                                maxIterations = 50000,
                                                                                onOptimizationStart,
                                                                                onOptimizationEnd,
                                                                                onIterationUpdate,
                                                                                autoStart = false,
                                                                                optimizationEndTime,
                                                                                totalExecutionTime,
                                                                                iterationsPerSecond,
                                                                                optimizationStartTime
                                                                            }) => {
    // Main grid states
    const [gridState1, setGridState1] = useState<GridState | null>(null);
    const [gridState2, setGridState2] = useState<GridState | null>(null);

    // Tracking and control states
    const [iterations, setIterations] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
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
        const mapping: Record<string, { label: string; content: string }> = {};
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
        const grid = createSafeInitialGrid(width, height, processedObjects);
        grid.objectiveValue = calculateObjectiveWithSymmetryBreaking(grid, factorMatrix);
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
            setIsRunning(false);
            if (onOptimizationEnd) {
                onOptimizationEnd();
            }
            return true;
        }

        if (iterations >= maxIterations) {
            console.log("Maximum iterations reached");
            setConverged(true);
            setConvergenceType("max iterations reached");
            setIsRunning(false);
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
            setIsRunning(false);
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
            // Ensure minimum time between updates for UI responsiveness
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

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
                lastUpdateTimeRef.current = now;

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
            setIsRunning(true);
            if (onOptimizationStart) {
                onOptimizationStart();
            }
        }
    }, [gridState1, gridState2, onOptimizationStart]);

    // Start a new optimization run
    const startOptimization = () => {
        try {
            // Clear any existing animation frame
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }

            // Reset all state variables
            setIterations(0);
            setConverged(false);
            setConvergenceType("");
            setBestObjective1(Number.MAX_VALUE);
            setBestObjective2(Number.MAX_VALUE);
            setBestGrid1(null);
            setBestGrid2(null);
            setGrid1Version(0);
            setGrid2Version(0);
            setLastAcceptedSwap1(null);
            setLastAcceptedSwap2(null);
            lastGrid1Ref.current = null;
            lastGrid2Ref.current = null;

            // Create new initial grids
            const precomputedGradualFactor = createGradualFactorMatrix(width, height);
            const initialGrid1 = initializeGrid(precomputedGradualFactor);
            const initialGrid2 = initializeGrid(precomputedGradualFactor);

            // Update grid states
            setGridState1(initialGrid1);
            setGridState2(initialGrid2);

            // Store initial grid layouts
            lastGrid1Ref.current = initialGrid1.grid.map(row => [...row]);
            lastGrid2Ref.current = initialGrid2.grid.map(row => [...row]);

            // Start optimization
            lastUpdateTimeRef.current = Date.now();
            setIsRunning(true);

            // Notify parent about optimization start
            if (onOptimizationStart) {
                onOptimizationStart();
            }

            console.log("Started new optimization with initial grids:");
            console.log("Grid 1:", JSON.stringify(initialGrid1.grid));
            console.log("Grid 2:", JSON.stringify(initialGrid2.grid));
        } catch (error) {
            console.error("Error initializing grids:", error);
            setConvergenceType(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);

            // Notify parent about optimization end
            if (onOptimizationEnd) {
                onOptimizationEnd();
            }
        }
    }

    // Stop the current optimization run
    const stopOptimization = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
        setIsRunning(false);

        // Notify parent about optimization end
        if (onOptimizationEnd) {
            onOptimizationEnd();
        }
    };

    // Initialize grids when component mounts
    useEffect(() => {
        try {
            const precomputedGradualFactor = createGradualFactorMatrix(width, height);
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


    // Format time display - converts ms to a readable format
    const formatTime = (ms: number | undefined): string => {
        if (ms === null) return "0:00";

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="k-grid-content"
             style={{fontFamily: 'system-ui, sans-serif', width: '100%', height: '100%', minHeight: '500px'}}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <h3 style={{margin: 0}}>K-Grid Dual Optimization</h3>

                <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                    <div>
                        <div style={{fontWeight: 'bold'}}>
                            Status: {isRunning ? "Running" : converged ? "Converged" : "Ready"}
                        </div>
                        {optimizationStartTime && (
                            <>
                                <div style={{
                                    marginRight: "15px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center"
                                }}>
                                    <span style={{fontWeight: "bold"}}>Running Time</span>
                                    <span>{optimizationEndTime ? formatTime(totalExecutionTime) : formatTime(Date.now() - optimizationStartTime)}</span>
                                </div>

                                {iterationsPerSecond !== null && (
                                    <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                                        <span style={{fontWeight: "bold"}}>Iterations/sec</span>
                                        <span>{Math.round(iterationsPerSecond || 0).toLocaleString()}</span>
                                    </div>
                                )}
                            </>
                        )}
                        {converged && (
                            <div style={{fontSize: '0.875rem'}}>
                                Convergence type: {convergenceType}
                            </div>
                        )}
                    </div>

                    <div>
                        <div style={{fontWeight: 'bold'}}>Iterations: {iterations.toLocaleString()}</div>
                        <div style={{fontSize: '0.875rem'}}>
                            Match percentage: {(matchPercentage * 100).toFixed(2)}%
                        </div>
                    </div>

                    <div>
                        <div style={{fontWeight: 'bold'}}>Objective Values</div>
                        <div style={{fontSize: '0.875rem'}}>
                            Grid 1: {gridState1?.objectiveValue.toFixed(4) || "N/A"}
                        </div>
                        <div style={{fontSize: '0.875rem'}}>
                            Grid 2: {gridState2?.objectiveValue.toFixed(4) || "N/A"}
                        </div>
                        {isRunning && (
                            <>
                                <div style={{fontSize: '0.875rem'}}>
                                    Best 1: {bestObjective1 !== Number.MAX_VALUE ? bestObjective1.toFixed(4) : "N/A"}
                                </div>
                                <div style={{fontSize: '0.875rem'}}>
                                    Best 2: {bestObjective2 !== Number.MAX_VALUE ? bestObjective2.toFixed(4) : "N/A"}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div style={{display: 'flex', gap: '16px', marginBottom: '16px'}}>
                <button
                    onClick={startOptimization}
                    disabled={isRunning}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: isRunning ? '#cccccc' : '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        flex: '1'
                    }}
                >
                    Start New Optimization
                </button>

                <button
                    onClick={stopOptimization}
                    disabled={!isRunning}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: !isRunning ? '#cccccc' : '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: !isRunning ? 'not-allowed' : 'pointer',
                        flex: '1'
                    }}
                >
                    Stop Optimization
                </button>
            </div>

            <div style={{
                display: 'flex',
                gap: '24px',
                marginBottom: '24px',
                height: 'calc(100% - 200px)',
                minHeight: '300px'
            }}>
                <div style={{flex: '1', display: 'flex', flexDirection: 'column'}}>
                    <h4 style={{textAlign: 'center', margin: '0 0 8px 0'}}>
                        Grid 1 {grid1Version > 0 &&
                        <span style={{fontSize: '0.75rem', color: '#666'}}>v{grid1Version}</span>}
                    </h4>
                    <div style={{flex: '1', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden'}}>
                        {gridState1 ? (
                            <GridDisplay
                                key={`grid1-${grid1Version}-${iterations}`}
                                grid={gridState1}
                                objectsById={objectsById}
                                iterations={iterations}
                            />
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                backgroundColor: '#f9f9f9',
                                color: '#666'
                            }}>
                                Initializing grid...
                            </div>
                        )}
                    </div>
                </div>

                <div style={{flex: '1', display: 'flex', flexDirection: 'column'}}>
                    <h4 style={{textAlign: 'center', margin: '0 0 8px 0'}}>
                        Grid 2 {grid2Version > 0 &&
                        <span style={{fontSize: '0.75rem', color: '#666'}}>v{grid2Version}</span>}
                    </h4>
                    <div style={{flex: '1', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden'}}>
                        {gridState2 ? (
                            <GridDisplay
                                key={`grid2-${grid2Version}-${iterations}`}
                                grid={gridState2}
                                objectsById={objectsById}
                                iterations={iterations}
                            />
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '100%',
                                backgroundColor: '#f9f9f9',
                                color: '#666'
                            }}>
                                Initializing grid...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
