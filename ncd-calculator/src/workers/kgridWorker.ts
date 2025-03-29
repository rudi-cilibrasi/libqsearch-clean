import {adaptiveOptimizeStep, calculateGridSimilarity, efficientCopy, GridState,} from "@/datastructures/kgrid.ts";


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

const CONFIG = {
    // Status update frequencies
    updateInterval: 50,              // Regular update interval without improvements
    initialStatusUpdates: 10,        // Always send updates for first N iterations
    maxNoImprovement: 1000,           // Force update after many iterations without improvement
    loggingInterval: 100,            // Console logging frequency

    // Performance parameters
    batchSize: 30,                   // Iterations per batch
    minUpdateInterval: 100,          // Minimum ms between updates to main thread

    // Early termination conditions
    minImprovementRate: 0.0001,      // Minimum improvement rate to continue
    stagnationCheckWindow: 2000,     // Window for checking stagnation

    // Optimization parameters
    adaptiveOptimizationEnabled: true, // Use adaptive optimization

    // Default constraints
    maxIterations: 50000,            // Default max iterations

    // Performance tracking
    performanceWindowSize: 100       // Window size for performance metrics
};

// Worker internal state with enhanced tracking
let state = {
    // Optimization tracking
    bestObjective1: Number.MAX_VALUE,
    bestObjective2: Number.MAX_VALUE,
    bestSimilarity: 0,
    noImprovementCount: 0,
    currentIteration: 0,

    // Performance tracking
    lastUpdateTime: 0,
    startTime: 0,
    iterationTimestamps: [] as number[],
    objectiveHistory: [] as number[],
    similarityHistory: [] as number[],

    // Best grid tracking
    bestGrid1Overall: null as GridState | null,
    bestGrid2Overall: null as GridState | null,

    // State flags
    isRunning: false,

    // Current grid states
    currentGridState1: null as GridState | null,
    currentGridState2: null as GridState | null,

    // Scheduler
    optimizationTimer: null as any,

    // Configuration
    userMaxIterations: CONFIG.maxIterations
};

// Reset the worker state
const resetState = () => {
    console.log("[Worker] Resetting state");
    // clear all state variables
    state = {
        bestObjective1: Number.MAX_VALUE,
        bestObjective2: Number.MAX_VALUE,
        bestSimilarity: 0,
        noImprovementCount: 0,
        currentIteration: 0,

        lastUpdateTime: 0,
        startTime: 0,
        iterationTimestamps: [],
        objectiveHistory: [],
        similarityHistory: [],

        bestGrid1Overall: null,
        bestGrid2Overall: null,

        isRunning: false,

        currentGridState1: null,
        currentGridState2: null,

        optimizationTimer: null,

        userMaxIterations: CONFIG.maxIterations
    }

    // clear any existing timer
    if (state.optimizationTimer !== null) {
        clearTimeout(state.optimizationTimer);
        state.optimizationTimer = null;
    }
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

    // initialize performance tracking
    state.startTime = performance.now();
    state.lastUpdateTime = state.startTime;
    state.iterationTimestamps = [];
    state.objectiveHistory = [];
    state.similarityHistory = [];

    // initialize best grid tracking
    state.bestGrid1Overall = structuredClone(gridState1);
    state.bestGrid2Overall = structuredClone(gridState2);

    state.bestObjective1 = gridState1.objectiveValue;
    state.bestObjective2 = gridState2.objectiveValue;

    console.log(`[Worker] Starting optimization with max ${state.userMaxIterations} iterations`);
    runOptimizationStep();
    return true;
}

// The main optimization step function - completely rewritten
const runOptimizationStep = () => {
    if (!state.isRunning || !state.currentGridState1 || !state.currentGridState2) {
        return;
    }

    try {
        // process batch of iterations
        let grid1Improved = false;
        let grid2Improved = false;
        let similarityImproved = false;

        const batchEndIterations = Math.min(state.currentIteration + CONFIG.batchSize, state.userMaxIterations);
        for (let i = state.currentIteration; i < batchEndIterations; i++) {
            if (i >= state.userMaxIterations) {
                // Reached max iterations
                console.log(`[Worker] Reached maximum iterations (${state.userMaxIterations})`);
                state.isRunning = false;

                // Send final best grid
                ctx.postMessage({
                    type: 'optimization_complete',
                    grid1: state.bestGrid1Overall,
                    grid2: state.bestGrid2Overall,
                    similarity: state.bestSimilarity,
                    status: {
                        currentIteration: i,
                        bestObjective1: state.bestObjective1,
                        bestObjective2: state.bestObjective2,
                        bestSimilarity: state.bestSimilarity,
                        noImprovementCount: state.noImprovementCount,
                        ...calculatePerformanceMetrics()
                    },
                    iteration: i
                });
                return;
            }


            // record timestamp for performance tracking
            state.iterationTimestamps.push(performance.now());

            // use the adaptive optimization if enabled
            const updateGrid1: GridState = CONFIG.adaptiveOptimizationEnabled
                ? adaptiveOptimizeStep(state.currentGridState1, i)
                : adaptiveOptimizeStep(state.currentGridState1, i);

            const updateGrid2: GridState = CONFIG.adaptiveOptimizationEnabled
                ? adaptiveOptimizeStep(state.currentGridState2, i)
                : adaptiveOptimizeStep(state.currentGridState2, i);

            state.currentGridState1 = updateGrid1;
            state.currentGridState2 = updateGrid2;

            const currentSimilarity = calculateGridSimilarity(updateGrid1, updateGrid2);
            const similarityPercentage = currentSimilarity * 100;

            // track history for performance analysis
            state.objectiveHistory.push(updateGrid1.objectiveValue);
            state.similarityHistory.push(similarityPercentage);

            if (i % CONFIG.loggingInterval === 0) {
                const perfMetrics = calculatePerformanceMetrics();
                console.log(
                    `[Worker] Iteration ${i}, Similarity: ${similarityPercentage.toFixed(2)}%, ` +
                    `Objective1: ${updateGrid1.objectiveValue.toFixed(4)}, ` +
                    `Speed: ${perfMetrics.iterationsPerSecond.toFixed(1)} it/s, ` +
                    `Est. remaining: ${Math.round(perfMetrics.estimatedTimeRemaining)}s`
                );
            }

            if (updateGrid1.objectiveValue < state.bestObjective1) {
                state.bestObjective1 = updateGrid1.objectiveValue;
                state.bestGrid1Overall = efficientCopy(updateGrid1);
                grid1Improved = true;
            }

            if (updateGrid2.objectiveValue < state.bestObjective2) {
                state.bestObjective2 = updateGrid2.objectiveValue;
                state.bestGrid2Overall = efficientCopy(updateGrid2);
                grid2Improved = true;
            }

            if (similarityPercentage > state.bestSimilarity) {
                state.bestSimilarity = similarityPercentage;
                similarityImproved = true;
            }

            if (grid1Improved || grid2Improved || similarityImproved) {
                state.noImprovementCount = 0;
            } else {
                state.noImprovementCount++;
            }
            state.currentIteration++;
        }

        // Check if we should send an update
        const now = performance.now();
        const timeSinceLastUpdate = now - state.lastUpdateTime;

        const shouldSendUpdate =
            grid1Improved ||
            grid2Improved ||
            similarityImproved ||
            state.currentIteration < CONFIG.initialStatusUpdates ||
            state.currentIteration % CONFIG.updateInterval === 0 ||
            state.noImprovementCount >= CONFIG.maxNoImprovement ||
            timeSinceLastUpdate >= CONFIG.minUpdateInterval;

        if (shouldSendUpdate) {
            state.lastUpdateTime = now;

            ctx.postMessage({
                type: grid1Improved || grid2Improved || similarityImproved
                    ? 'optimization_improved'
                    : 'status_update',
                grid1: state.bestGrid1Overall,
                grid2: state.bestGrid2Overall,
                similarity: state.bestSimilarity,
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
                    ...calculatePerformanceMetrics()
                },
                iteration: state.currentIteration
            });

            if (state.noImprovementCount >= CONFIG.maxNoImprovement) {
                state.noImprovementCount = 0;
            }
        }

        // schedule next batch with more adaptive timing based on performance
        const batchTime = performance.now() - now;
        const minDelay = Math.max(0, CONFIG.minUpdateInterval - batchTime);
        state.optimizationTimer = setTimeout(runOptimizationStep, minDelay);
    } catch (error: any) {
        console.error("[Worker] Error during optimization:", error);

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
        });

        // Try to continue despite error
        state.currentIteration++;
        state.optimizationTimer = setTimeout(runOptimizationStep, 100);
    }
};


// Stop the optimization loop
const stopOptimization = () => {
    console.log("[Worker] Stopping optimization");
    state.isRunning = false;

    // Clear any existing timer
    if (state.optimizationTimer !== null) {
        clearTimeout(state.optimizationTimer);
        state.optimizationTimer = null;
    }

    // Send final status with best grid
    ctx.postMessage({
        type: 'optimization_stopped',
        grid1: state.bestGrid1Overall,
        grid2: state.bestGrid2Overall,
        similarity: state.bestSimilarity,
        status: {
            currentIteration: state.currentIteration,
            bestObjective1: state.bestObjective1,
            bestObjective2: state.bestObjective2,
            bestSimilarity: state.bestSimilarity,
            noImprovementCount: state.noImprovementCount,
            ...calculatePerformanceMetrics()
        },
        iteration: state.currentIteration
    });
};


const calculatePerformanceMetrics = () => {
    const now = performance.now();
    const recentTimestamps = state.iterationTimestamps.slice(-CONFIG.performanceWindowSize);
    let iterationsPerSecond = 0;
    if (recentTimestamps.length > 5) { // Ensure we have enough data points
        const timeWindow = recentTimestamps[recentTimestamps.length - 1] - recentTimestamps[0];
        iterationsPerSecond = (recentTimestamps.length - 1) / (timeWindow / 1000);
        iterationsPerSecond = Math.round(iterationsPerSecond * 10) / 10;
    }
    let estimatedTimeRemaining = 0;
    if (iterationsPerSecond > 0) {
        const remainingIterations = state.userMaxIterations - state.currentIteration;
        estimatedTimeRemaining = remainingIterations / iterationsPerSecond;
        estimatedTimeRemaining *= 1.1;
    }

    let recentImprovementRate = 0;
    const recentObjectives = state.objectiveHistory.slice(-CONFIG.stagnationCheckWindow);

    if (recentObjectives.length > 1) {
        const oldestObjective = recentObjectives[0];
        const newestObjective = recentObjectives[recentObjectives.length - 1];
        recentImprovementRate = Math.abs((oldestObjective - newestObjective) / oldestObjective);
    }

    return {
        iterationsPerSecond,
        estimatedTimeRemaining,
        recentImprovementRate,
        totalElapsedTime: (now - state.startTime) / 1000
    };
};
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
