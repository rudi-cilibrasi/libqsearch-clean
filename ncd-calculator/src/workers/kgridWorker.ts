import {calculateGridSimilarity, GridState, optimizeStep} from "@/datastructures/kgrid.ts";

interface WorkerMessage {
    command: 'initialize' | 'start_optimization' | 'stop_optimization' | 'reset' | 'pause_optimization' | 'resume_optimization';
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
        iterationsPerSecond?: number; // Added field for iterations per second
    };
    error?: string;
}

// Configuration options
const CONFIG = {
    updateInterval: 20,         // How many iterations between status updates with no improvements
    initialStatusUpdates: 10,   // Always send updates for first N iterations
    maxNoImprovement: 500,      // Force update after this many iterations without improvement
    maxIterations: 50000,       // Default max iterations (can be overridden)
    loggingInterval: 100,       // How often to log progress (iterations)
    performanceWindow: 100      // Window size for calculating iterations per second
};

// Unified worker state object
const state = {
    // Optimization tracking
    bestObjective1: Number.MAX_VALUE,
    bestObjective2: Number.MAX_VALUE,
    bestSimilarity: 0,
    noImprovementCount: 0,
    currentIteration: 0,

    // Performance tracking
    startTime: 0,
    lastUpdateTime: 0,
    iterationHistory: [] as number[],

    // Status flags
    isRunning: false,
    isPaused: false,
    wasRunningBeforePause: false,

    // Grid states
    currentGridState1: null as GridState | null,
    currentGridState2: null as GridState | null,

    // Scheduler
    optimizationTimer: null as any,

    // User configuration
    userMaxIterations: CONFIG.maxIterations
};

// Calculate iterations per second based on recent history
const calculateIterationsPerSecond = () => {
    const recentIterations = state.iterationHistory.slice(-CONFIG.performanceWindow);
    if (recentIterations.length < 2) return 0;

    const firstTimestamp = recentIterations[0];
    const lastTimestamp = recentIterations[recentIterations.length - 1];
    const timeSpan = (lastTimestamp - firstTimestamp) / 1000; // Convert to seconds

    if (timeSpan <= 0) return 0;
    return (recentIterations.length - 1) / timeSpan;
};

// Reset the worker state
const resetState = () => {
    console.log("[Worker] Resetting state");

    // Reset optimization tracking
    state.bestObjective1 = Number.MAX_VALUE;
    state.bestObjective2 = Number.MAX_VALUE;
    state.bestSimilarity = 0;
    state.noImprovementCount = 0;
    state.currentIteration = 0;

    // Reset performance tracking
    state.startTime = 0;
    state.lastUpdateTime = 0;
    state.iterationHistory = [];

    // Reset status flags
    state.isRunning = false;

    // Reset grid states
    state.currentGridState1 = null;
    state.currentGridState2 = null;

    // Clear any existing timer
    if (state.optimizationTimer !== null) {
        clearTimeout(state.optimizationTimer);
        state.optimizationTimer = null;
    }

    // Reset user configuration
    state.userMaxIterations = CONFIG.maxIterations;
}

// Start the optimization loop
const startOptimization = (gridState1: GridState, gridState2: GridState, matrix: number[][], maxIter: number) => {
    if (!gridState1 || !gridState2 || !matrix) {
        console.error("[Worker] Cannot start optimization: missing required data");
        return false;
    }

    state.currentGridState1 = gridState1;
    state.currentGridState2 = gridState2;
    state.userMaxIterations = maxIter || CONFIG.maxIterations;
    state.currentIteration = 0;
    state.isRunning = true;

    // Initialize performance tracking
    state.startTime = performance.now();
    state.lastUpdateTime = state.startTime;
    state.iterationHistory = [state.startTime];

    console.log(`[Worker] Starting optimization with max ${state.userMaxIterations} iterations`);

    runOptimizationStep();
    return true;
}

// Stop the optimization loop
const stopOptimization = () => {
    console.log("[Worker] Stopping optimization");
    state.isRunning = false;

    // Clear any existing timer
    if (state.optimizationTimer !== null) {
        clearTimeout(state.optimizationTimer);
        state.optimizationTimer = null;
    }

    // Calculate final iterations per second
    const iterationsPerSecond = calculateIterationsPerSecond();

    // Send final status
    ctx.postMessage({
        type: 'optimization_stopped',
        status: {
            currentIteration: state.currentIteration,
            bestObjective1: state.bestObjective1,
            bestObjective2: state.bestObjective2,
            bestSimilarity: state.bestSimilarity,
            noImprovementCount: state.noImprovementCount,
            iterationsPerSecond
        },
        iteration: state.currentIteration
    });
}

const runOptimizationStep = () => {
    if (!state.isRunning || !state.currentGridState1 || !state.currentGridState2) {
        return;
    }

    try {
        // Record timestamp for performance tracking
        const now = performance.now();
        state.iterationHistory.push(now);

        // Limit the history array size to prevent memory growth
        if (state.iterationHistory.length > CONFIG.performanceWindow * 2) {
            state.iterationHistory = state.iterationHistory.slice(-CONFIG.performanceWindow);
        }

        if (state.currentIteration >= state.userMaxIterations) {
            console.log(`[Worker] Reached maximum iterations (${state.userMaxIterations})`);
            state.isRunning = false;

            const iterationsPerSecond = calculateIterationsPerSecond();

            ctx.postMessage({
                type: 'optimization_complete',
                status: {
                    currentIteration: state.currentIteration,
                    bestObjective1: state.bestObjective1,
                    bestObjective2: state.bestObjective2,
                    bestSimilarity: state.bestSimilarity,
                    noImprovementCount: state.noImprovementCount,
                    iterationsPerSecond
                },
                iteration: state.currentIteration
            });

            return;
        }

        const updatedGrid1 = optimizeStep(state.currentGridState1, state.currentIteration);
        const updatedGrid2 = optimizeStep(state.currentGridState2, state.currentIteration);

        state.currentGridState1 = updatedGrid1;
        state.currentGridState2 = updatedGrid2;

        const currentSimilarity = calculateGridSimilarity(updatedGrid1, updatedGrid2);
        const similarityPercentage = currentSimilarity * 100;

        if (state.currentIteration % CONFIG.loggingInterval === 0) {
            const iterationsPerSecond = calculateIterationsPerSecond();
            console.log(
                `[Worker] Iteration ${state.currentIteration}, ` +
                `Similarity: ${similarityPercentage.toFixed(2)}%, ` +
                `Objective1: ${updatedGrid1.objectiveValue.toFixed(4)}, ` +
                `Speed: ${iterationsPerSecond.toFixed(1)} it/s`
            );
        }

        // Check for improvements
        let grid1Improved = false;
        let grid2Improved = false;
        let similarityImproved = false;

        if (similarityPercentage > state.bestSimilarity) {
            state.bestSimilarity = similarityPercentage;
            similarityImproved = true;
        }

        if (updatedGrid1.objectiveValue < state.bestObjective1) {
            state.bestObjective1 = updatedGrid1.objectiveValue;
            grid1Improved = true;
        }

        if (updatedGrid2.objectiveValue < state.bestObjective2) {
            state.bestObjective2 = updatedGrid2.objectiveValue;
            grid2Improved = true;
        }

        let shouldSendUpdate = false;

        if (grid1Improved || grid2Improved || similarityImproved) {
            shouldSendUpdate = true;
            state.noImprovementCount = 0;
        } else {
            state.noImprovementCount++;

            shouldSendUpdate =
                state.currentIteration < CONFIG.initialStatusUpdates || // Always send first few iterations
                state.currentIteration % CONFIG.updateInterval === 0 || // Regular interval updates
                state.noImprovementCount >= CONFIG.maxNoImprovement;    // Force update after many iterations with no improvement
            if (state.noImprovementCount >= CONFIG.maxNoImprovement) {
                state.noImprovementCount = 0;
            }
        }

        if (shouldSendUpdate) {
            // Calculate iterations per second
            const iterationsPerSecond = calculateIterationsPerSecond();

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
                    currentIteration: state.currentIteration,
                    bestObjective1: state.bestObjective1,
                    bestObjective2: state.bestObjective2,
                    bestSimilarity: state.bestSimilarity,
                    noImprovementCount: state.noImprovementCount,
                    iterationsPerSecond
                },
                iteration: state.currentIteration
            } as WorkerResponse);

            state.lastUpdateTime = now;
        }

        state.currentIteration++;
        state.optimizationTimer = setTimeout(runOptimizationStep, 0);

    } catch (error: any) {
        console.error("[Worker] Error during optimization:", error);

        const iterationsPerSecond = calculateIterationsPerSecond();

        ctx.postMessage({
            type: "error",
            error: error.message,
            status: {
                currentIteration: state.currentIteration,
                bestObjective1: state.bestObjective1,
                bestObjective2: state.bestObjective2,
                bestSimilarity: state.bestSimilarity,
                noImprovementCount: state.noImprovementCount,
                iterationsPerSecond
            },
            iteration: state.currentIteration
        } as WorkerResponse);
        state.currentIteration++;
        state.optimizationTimer = setTimeout(runOptimizationStep, 0);
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


            case "pause_optimization": {
                console.log("[Worker] Pausing optimization");
                state.wasRunningBeforePause = state.isRunning;
                state.isPaused = true;

                // Clear any existing timer
                if (state.optimizationTimer !== null) {
                    clearTimeout(state.optimizationTimer);
                    state.optimizationTimer = null;
                }
                break;
            }

            case "resume_optimization": {
                console.log("[Worker] Resuming optimization");
                state.isPaused = false;
                if (state.wasRunningBeforePause) {
                    // Only resume if it was running before
                    state.isRunning = true;
                    runOptimizationStep();
                }
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
                currentIteration: state.currentIteration,
                bestObjective1: state.bestObjective1,
                bestObjective2: state.bestObjective2,
                bestSimilarity: state.bestSimilarity,
                noImprovementCount: state.noImprovementCount
            },
            iteration: state.currentIteration
        } as WorkerResponse);
    }
});
