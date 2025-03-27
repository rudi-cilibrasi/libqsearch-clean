import {calculateGridSimilarity, GridState, optimizeStep} from "@/services/kgrid.ts";


interface WorkerMessage {
    command: 'initialize' | 'start_optimization' | 'stop_optimization' | 'reset';
    data?: {
        gridState1: GridState;
        gridState2: GridState;
        iteration: number;
        ncdMatrix: number[][];
        maxIterations: number;
    };
}

// Update the worker response types
interface WorkerResponse {
    type: 'optimization_improved' | 'status_update' | 'initialized' | 'reset_confirmed' |
        'optimization_started' | 'optimization_stopped' | 'optimization_complete' | 'error';
    grid1?: GridState;
    grid2?: GridState;
    similarity?: number;
    iteration?: number;
    improvement?: {
        grid1Improved: boolean;
        grid2Improved: boolean;
        similarityImproved: boolean;
    };
    status?: {
        currentIteration: number;
        bestObjective1: number;
        bestObjective2: number;
        bestSimilarity: number;
        noImprovementCount: number;
    };
    error?: string;
}

// Worker internal state
let bestObjective1 = Number.MAX_VALUE;
let bestObjective2 = Number.MAX_VALUE;
let bestSimilarity = 0;
let noImprovementCount = 0;
let currentIteration = 0;

// Configuration options
const CONFIG = {
    updateInterval: 20,         // How many iterations between status updates with no improvements
    initialStatusUpdates: 10,   // Always send updates for first N iterations
    maxNoImprovement: 500,      // Force update after this many iterations without improvement
    maxIterations: 50000,       // Default max iterations (can be overridden)
    loggingInterval: 100        // How often to log progress (iterations)
};

// Active optimization state
let isRunning = false;
let currentGridState1: GridState | null = null;
let currentGridState2: GridState | null = null;
let optimizationTimer: any = null;
let userMaxIterations = CONFIG.maxIterations;

// Reset the worker state
const resetState = () => {
    console.log("[Worker] Resetting state");
    bestObjective1 = Number.MAX_VALUE;
    bestObjective2 = Number.MAX_VALUE;
    bestSimilarity = 0;
    noImprovementCount = 0;
    currentIteration = 0;
    isRunning = false;

    // Clear any existing timer
    if (optimizationTimer !== null) {
        clearTimeout(optimizationTimer);
        optimizationTimer = null;
    }

    // Reset grid states
    currentGridState1 = null;
    currentGridState2 = null;
}

// Start the optimization loop
const startOptimization = (gridState1: GridState, gridState2: GridState, matrix: number[][], maxIter: number) => {
    if (!gridState1 || !gridState2 || !matrix) {
        console.error("[Worker] Cannot start optimization: missing required data");
        return false;
    }

    currentGridState1 = gridState1;
    currentGridState2 = gridState2;
    userMaxIterations = maxIter || CONFIG.maxIterations;
    currentIteration = 0;
    isRunning = true;

    console.log(`[Worker] Starting optimization with max ${userMaxIterations} iterations`);

    runOptimizationStep();
    return true;
}

// Stop the optimization loop
const stopOptimization = () => {
    console.log("[Worker] Stopping optimization");
    isRunning = false;

    // Clear any existing timer
    if (optimizationTimer !== null) {
        clearTimeout(optimizationTimer);
        optimizationTimer = null;
    }

    // Send final status
    ctx.postMessage({
        type: 'optimization_stopped',
        status: {
            currentIteration,
            bestObjective1,
            bestObjective2,
            bestSimilarity,
            noImprovementCount
        },
        iteration: currentIteration
    });
}

const runOptimizationStep = () => {
    if (!isRunning || !currentGridState1 || !currentGridState2) {
        return;
    }

    try {
        if (currentIteration >= userMaxIterations) {
            console.log(`[Worker] Reached maximum iterations (${userMaxIterations})`);
            isRunning = false;

            ctx.postMessage({
                type: 'optimization_complete',
                status: {
                    currentIteration,
                    bestObjective1,
                    bestObjective2,
                    bestSimilarity,
                    noImprovementCount
                },
                iteration: currentIteration
            });

            return;
        }

        const updatedGrid1 = optimizeStep(currentGridState1, currentIteration);
        const updatedGrid2 = optimizeStep(currentGridState2, currentIteration);

        currentGridState1 = updatedGrid1;
        currentGridState2 = updatedGrid2;

        const currentSimilarity = calculateGridSimilarity(updatedGrid1, updatedGrid2);
        const similarityPercentage = currentSimilarity * 100;

        if (currentIteration % CONFIG.loggingInterval === 0) {
            console.log(`[Worker] Iteration ${currentIteration}, Similarity: ${similarityPercentage.toFixed(2)}%, Objective1: ${updatedGrid1.objectiveValue.toFixed(4)}, Objective2: ${updatedGrid2.objectiveValue.toFixed(4)}`);
        }

        // Check for improvements
        let grid1Improved = false;
        let grid2Improved = false;
        let similarityImproved = false;

        if (similarityPercentage > bestSimilarity) {
            bestSimilarity = similarityPercentage;
            similarityImproved = true;
        }

        if (updatedGrid1.objectiveValue < bestObjective1) {
            bestObjective1 = updatedGrid1.objectiveValue;
            grid1Improved = true;
        }

        if (updatedGrid2.objectiveValue < bestObjective2) {
            bestObjective2 = updatedGrid2.objectiveValue;
            grid2Improved = true;
        }

        let shouldSendUpdate = false;

        if (grid1Improved || grid2Improved || similarityImproved) {
            shouldSendUpdate = true;
            noImprovementCount = 0;
        } else {
            noImprovementCount++;

            shouldSendUpdate =
                currentIteration < CONFIG.initialStatusUpdates || // Always send first few iterations
                currentIteration % CONFIG.updateInterval === 0 || // Regular interval updates
                noImprovementCount >= CONFIG.maxNoImprovement;    // Force update after many iterations with no improvement
            if (noImprovementCount >= CONFIG.maxNoImprovement) {
                noImprovementCount = 0;
            }
        }

        if (shouldSendUpdate) {
            ctx.postMessage({
                type: grid1Improved || grid2Improved || similarityImproved
                    ? 'optimization_improved'
                    : 'status_update',
                grid1: updatedGrid1,
                grid2: updatedGrid2,
                similarity: similarityPercentage,
                improvement: {
                    grid1Improved,
                    grid2Improved,
                    similarityImproved
                },
                status: {
                    currentIteration,
                    bestObjective1,
                    bestObjective2,
                    bestSimilarity,
                    noImprovementCount
                },
                iteration: currentIteration
            } as WorkerResponse);
        }

        currentIteration++;
        optimizationTimer = setTimeout(runOptimizationStep, 0);

    } catch (error: any) {
        console.error("[Worker] Error during optimization:", error);

        ctx.postMessage({
            type: "error",
            error: error.message,
            status: {
                currentIteration,
                bestObjective1,
                bestObjective2,
                bestSimilarity,
                noImprovementCount
            },
            iteration: currentIteration
        } as WorkerResponse);
        currentIteration++;
        optimizationTimer = setTimeout(runOptimizationStep, 0);
    }
}

const ctx: Worker = self as any;

ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    try {
        const {command, data} = event.data;

        switch (command) {
            case "initialize": {
                // Just reset and confirm initialization
                resetState();
                ctx.postMessage({
                    type: 'initialized',
                });
                console.log("[Worker] Initialized and ready");
                break;
            }

            case "start_optimization": {
                // Start a new optimization process
                resetState();
                if (data) {
                    const success = startOptimization(
                        data.gridState1,
                        data.gridState2,
                        data.ncdMatrix,
                        data.maxIterations
                    );
                    if (success) {
                        ctx.postMessage({
                            type: 'optimization_started',
                            iteration: 0
                        });
                    } else {
                        ctx.postMessage({
                            type: 'error',
                            error: "Failed to start optimization",
                            iteration: 0
                        });
                    }
                }
                break;
            }

            case "stop_optimization": {
                stopOptimization();
                break;
            }

            case "reset": {
                resetState();
                ctx.postMessage({
                    type: 'reset_confirmed'
                });
                console.log("[Worker] State reset completed");
                break;
            }

            default: {
                console.error(`[Worker] Unknown command: ${command}`);
            }
        }
    } catch (error: any) {
        console.error("[Worker] Unhandled error:", error);

        ctx.postMessage({
            type: "error",
            error: error.message,
            status: {
                currentIteration,
                bestObjective1,
                bestObjective2,
                bestSimilarity,
                noImprovementCount
            },
            iteration: currentIteration
        } as WorkerResponse);
    }
});
