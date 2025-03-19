import React, {useEffect, useState, useCallback, useMemo} from "react";
import {
    GridObject,
    GridState,
    calculateMatchPercentage,
    ensureStringIds,
    createSafeInitialGrid,
    optimizeStep,
    calculateObjectiveWithSymmetryBreaking,
} from "@/services/kgrid.ts";
import {GridDisplay} from "./GridDisplay";

interface KGridDualOptimizationProps {
    width: number;
    height: number;
    objects: GridObject[];
    maxIterations: number;
}

export const KGridDualOptimization: React.FC<KGridDualOptimizationProps> = ({
                                                                                width = 3,
                                                                                height = 3,
                                                                                objects,
                                                                                maxIterations = 50000,
                                                                            }) => {
    const [gridState1, setGridState1] = useState<GridState | null>(null);
    const [gridState2, setGridState2] = useState<GridState | null>(null);
    const [iterations, setIterations] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [converged, setConverged] = useState(false);
    const [convergenceType, setConvergenceType] = useState("");
    const [matchPercentage, setMatchPercentage] = useState(0);
    const [bestObjective1, setBestObjective1] = useState(Number.MAX_VALUE);
    const [bestObjective2, setBestObjective2] = useState(Number.MAX_VALUE);
    const [bestGrid1, setBestGrid1] = useState<GridState | null>(null);
    const [bestGrid2, setBestGrid2] = useState<GridState | null>(null);
    const [renderKey, setRenderKey] = useState(0);


    const updateGrids = (grid1: GridState, grid2: GridState) => {
        const copiedGrid1 = JSON.parse(JSON.stringify(grid1));
        const copiedGrid2 = JSON.parse(JSON.stringify(grid2));
        setGridState1(ensureStringIds(copiedGrid1));
        setGridState2(ensureStringIds(copiedGrid2));

        setRenderKey(prev => prev + 1);
    };

    // Create a stable objects by ID mapping to prevent re-renders with new object references
    const objectsById = useMemo(() => {
        const mapping: Record<string, { label: string; content: string }> = {};

        // Process all objects and ensure IDs are strings
        objects.forEach((obj) => {
            const stringId = String(obj.id);
            mapping[stringId] = {
                label: obj.label || "Unknown",
                content: obj.content || "",
            };
        });

        console.log("Created objectsById mapping with keys:", Object.keys(mapping));
        return mapping;
    }, [objects]);

    // Initialize grid states
    const initializeGrid = useCallback(() => {
        console.log("Initializing grid with objects:", objects.length);
        const processedObjects = objects.map(obj => ({
            ...obj,
            id: String(obj.id)
        }));
        const grid = createSafeInitialGrid(width, height, processedObjects);
        grid.objectiveValue = calculateObjectiveWithSymmetryBreaking(grid);
        return ensureStringIds(grid);
    }, [width, height, objects]);

    const updateMatchPercentage = useCallback(() => {
        if (!gridState1 || !gridState2) return 0;

        const currentMatchPercentage = calculateMatchPercentage(gridState1, gridState2);
        setMatchPercentage(currentMatchPercentage);
        return currentMatchPercentage;
    }, [gridState1, gridState2]);

    const checkConvergence = useCallback(() => {
        if (!gridState1 || !gridState2) return false;

        const currentMatchPercentage = updateMatchPercentage();

        if (gridState1.objectiveValue < bestObjective1) {
            setBestObjective1(gridState1.objectiveValue);
            setBestGrid1(ensureStringIds(gridState1));
            console.log(`New best for Grid 1: ${gridState1.objectiveValue.toFixed(4)}`);
        }

        if (gridState2.objectiveValue < bestObjective2) {
            setBestObjective2(gridState2.objectiveValue);
            setBestGrid2(ensureStringIds(gridState2));
            console.log(`New best for Grid 2: ${gridState2.objectiveValue.toFixed(4)}`);
        }

        // Check for exact match (100% convergence)
        if (currentMatchPercentage === 1) {
            console.error("grid 1 content: " + JSON.stringify(gridState1.grid) + ", object mapped by id: " + JSON.stringify(objectsById) + "grid 2 content: " + JSON.stringify(gridState2.grid) + ", object mapped by id: " + JSON.stringify(objectsById) + "");
            setConverged(true);
            setConvergenceType("exact match");
            setIsRunning(false);
            updateGrids(gridState1, gridState2);
            return true;
        }

        // Check if we've reached max iterations
        if (iterations >= maxIterations) {
            setConverged(true);
            setConvergenceType("max iterations reached");
            setIsRunning(false);
            return true;
        }

        // After 80% of max iterations, accept high objective similarity as convergence
        if (iterations > maxIterations * 0.8 &&
            Math.abs(gridState1.objectiveValue - gridState2.objectiveValue) < 0.0001 &&
            iterations % 1000 === 0) {

            console.log("Accepting convergence based on objective value equality");
            setConverged(true);
            setConvergenceType("objective value convergence");
            setIsRunning(false);
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
        bestGrid1,
        bestGrid2,
        updateMatchPercentage
    ]);

    useEffect(() => {
        if (!isRunning || !gridState1 || !gridState2) return;
        const optimizationTimer = setInterval(() => {
            setGridState1((prevGrid) => {
                if (!prevGrid) return prevGrid;

                return optimizeStep(prevGrid, iterations, bestGrid1);
            });

            setGridState2((prevGrid) =>
                prevGrid ? optimizeStep(prevGrid, iterations, bestGrid2) : prevGrid
            );

            setRenderKey(prev => prev + 1);
            setIterations((prev) => prev + 1);

            if (checkConvergence()) {
                clearInterval(optimizationTimer);
            }
        }, 1);

        return () => clearInterval(optimizationTimer);
    }, [isRunning, iterations, gridState1, gridState2, checkConvergence, bestGrid1, bestGrid2]);


    useEffect(() => {
        if (!isRunning || !gridState1 || !gridState2) return;
        const optimizationTimer = setInterval(() => {
            setGridState1((prevGrid) =>
                prevGrid ? optimizeStep(prevGrid, iterations, bestGrid1) : prevGrid
            );

            setGridState2((prevGrid) =>
                prevGrid ? optimizeStep(prevGrid, iterations, bestGrid2) : prevGrid
            );

            setRenderKey(prev => prev + 1);

            setIterations((prev) => prev + 1);

            if (checkConvergence()) {
                clearInterval(optimizationTimer);
            }
        }, 1);

        return () => clearInterval(optimizationTimer);
    }, [isRunning, iterations, gridState1, gridState2, optimizeStep, checkConvergence, bestGrid1, bestGrid2]);

    const startOptimization = () => {
        try {
            const initialGrid1 = initializeGrid();
            const initialGrid2 = initializeGrid();

            setGridState1(initialGrid1);
            setGridState2(initialGrid2);
            setIsRunning(true);

            console.log(
                "Grid 1 content:",
                initialGrid1.grid
                    .flat()
                    .map((id) => `${id}:${objectsById[id]?.label || "unknown"}`)
            );
            console.log(
                "Grid 2 content:",
                initialGrid2.grid
                    .flat()
                    .map((id) => `${id}:${objectsById[id]?.label || "unknown"}`)
            );
        } catch (error) {
            console.error("Error initializing grids:", error);
            setConvergenceType(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }


    useEffect(() => {
        if (!isRunning || !gridState1 || !gridState2) return;

        const optimizationTimer = setInterval(() => {
            setGridState1((prevGrid) => {
                if (!prevGrid) return prevGrid;

                return optimizeStep(prevGrid, iterations, bestGrid1);
            });

            setGridState2((prevGrid) => {
                if (!prevGrid) return prevGrid;

                return optimizeStep(prevGrid, iterations, bestGrid2);
            });

            setRenderKey(prev => prev + 1);
            setIterations((prev) => prev + 1);

            if (checkConvergence()) {
                clearInterval(optimizationTimer);
            }
        }, 1);

        return () => clearInterval(optimizationTimer);
    }, [isRunning, iterations, gridState1, gridState2, checkConvergence, bestGrid1, bestGrid2]);

    const stopOptimization = () => {
        setIsRunning(false);
    };

    return (
        <div style={{fontFamily: 'system-ui, sans-serif', width: '100%', height: '100%'}}>
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
                        {converged && (
                            <div style={{fontSize: '0.875rem'}}>
                                Convergence type: {convergenceType}
                            </div>
                        )}
                    </div>

                    <div>
                        <div style={{fontWeight: 'bold'}}>Iterations: {iterations}</div>
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
                    <h4 style={{textAlign: 'center', margin: '0 0 8px 0'}}>Grid 1</h4>
                    <div style={{flex: '1', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden'}}>
                        {gridState1 ? (
                            <GridDisplay
                                key={`grid1-${renderKey}`}
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
                    <h4 style={{textAlign: 'center', margin: '0 0 8px 0'}}>Grid 2</h4>
                    <div style={{flex: '1', border: '1px solid #eee', borderRadius: '4px', overflow: 'hidden'}}>
                        {gridState2 ? (
                            <GridDisplay
                                key={`grid2-${renderKey}`}
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

            <div style={{
                backgroundColor: '#f8f9fa',
                padding: '16px',
                borderRadius: '4px',
                marginTop: '16px'
            }}>
                <h4 style={{marginTop: 0}}>Dual-Grid Optimization Explained</h4>
                <p style={{fontSize: '0.875rem', lineHeight: '1.5'}}>
                    This implementation runs two independent optimizations starting from
                    different random arrangements. The algorithm requires that both grids
                    converge to exactly the same arrangement, providing strong evidence
                    that we've found the global optimum.
                </p>
                <p style={{fontSize: '0.875rem', lineHeight: '1.5'}}>For proper convergence, the input data should
                    contain files that:</p>
                <ul style={{fontSize: '0.875rem', lineHeight: '1.5'}}>
                    <li>Are larger than 1KB when possible</li>
                    <li>
                        Contain meaningful information (don't compress too efficiently)
                    </li>
                    <li>
                        Have unique characteristics that differentiate them from other files
                    </li>
                </ul>
                <p style={{fontSize: '0.875rem', lineHeight: '1.5'}}>The algorithm will stop when either:</p>
                <ul style={{fontSize: '0.875rem', lineHeight: '1.5'}}>
                    <li>Both grids match exactly (100% identical arrangement)</li>
                    <li>Maximum iterations ({maxIterations}) are reached</li>
                </ul>
                <p style={{fontSize: '0.875rem', lineHeight: '1.5'}}>
                    If the algorithm fails to converge, it indicates that your input data
                    might have symmetries that create multiple equally optimal
                    arrangements. Consider using more information-rich files if you
                    encounter this issue.
                </p>
            </div>
        </div>
    );
};

export default KGridDualOptimization;
