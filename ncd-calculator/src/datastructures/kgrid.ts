import {deflate} from "pako";
import {NCDMatrixResponse} from "@/types/ncd.ts";
import {UnionFind} from "@/datastructures/unionFind.ts";

export interface GridObject {
    id: string;
    content: number[];
    label: string;
}

export interface Position {
    i: number;
    j: number;
}

export interface GridState {
    width: number;
    height: number;
    grid: number[]; // grid index position, just using 1D grid instead of 2 for better performance
    numericNcdMatrix: number[][];
    idToIndexMap: Map<string, number>;
    indexToIdMap: Map<number, string>;
    factorMatrix: number[];
    objectiveValue: number;
    emptyIndex: number;
    optimizationHistory: OptimizationHistory;
}

/**
 * Calculate the Normalized Compression Distance between two strings using gzip compression.
 * NCD measures similarity based on information content rather than superficial features.
 *
 * The mathematical definition of NCD is:
 * NCD(x,y) = (C(xy) - min(C(x), C(y))) / max(C(x), C(y))
 *
 * Where C(x) is the compressed length of x, and C(xy) is the compressed length of
 * the concatenation of x and y.
 *
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} - NCD value between 0 (identical) and ~1 (completely different)
 */
export const calculateNCD = (str1: string, str2: string): number => {
    if (!str1 && !str2) return 0;
    if (!str1 || !str2) return 0;


    const data1 = new TextEncoder().encode(str1);
    const data2 = new TextEncoder().encode(str2);

    const combinedLength = data1.length + data2.length;
    const combinedData = new Uint8Array(combinedLength);
    combinedData.set(data1, 0);
    combinedData.set(data2, data1.length);

    const compressed1 = deflate(data1);
    const compressed2 = deflate(data2);
    const compressedCombined = deflate(combinedData);

    const C_x = compressed1.length;
    const C_y = compressed2.length;
    const C_xy = compressedCombined.length;

    const minCompression = Math.min(C_x, C_y);
    const maxCompression = Math.max(C_x, C_y);

    if (maxCompression === 0) return 0;

    const ncd = (C_xy - minCompression) / maxCompression;
    return Math.max(0, Math.min(1, ncd));
};

export const getFlatGradualFactorMatrix = (width: number, height: number): number[] => {
    const factorMatrix: number[] = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            factorMatrix[i * width + j] = gradualFactor({i, j}, width, height);
        }
    }
    return factorMatrix;
}


export const gradualFactor = (pos: Position, width: number, height: number): number => {
    // For true wraparound, we want a more circular/toroidal pattern
    // Calculate distance from center (normalized)
    const centerI = height / 2;
    const centerJ = width / 2;

    // Calculate normalized circular distance from center
    const distI = Math.min(Math.abs(pos.i - centerI), Math.abs(pos.i - centerI - height), Math.abs(pos.i - centerI + height)) / (height / 2);
    const distJ = Math.min(Math.abs(pos.j - centerJ), Math.abs(pos.j - centerJ - width), Math.abs(pos.j - centerJ + width)) / (width / 2);

    // Combined distance (circular)
    const dist = Math.sqrt(distI * distI + distJ * distJ);

    // Stronger center bias - increase weight of center positions
    const base = 1.3;

    // Stronger radial gradient to encourage grouping near center
    const radialFactor = 0.35 * (1 - dist);

    // Add more pronounced asymmetry to break symmetrical arrangements
    const asymFactor = 0.08 * Math.sin(pos.i * Math.PI / height) * Math.sin(pos.j * Math.PI / width);

    // Add adjacency bias - encourages adjacent positions to have similar factors
    const adjacencyBias = 0.1 * Math.sin((pos.i + pos.j) * Math.PI / (width + height));

    // Combine factors and apply power scaling
    return Math.pow(base + radialFactor + asymFactor + adjacencyBias, 0.5);
};

export const flattenGrid = (grid2d: number[][]): number[] => {
    const height = grid2d.length;
    const width = grid2d[0].length;
    const flatGrid = new Array(height * width);
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            flatGrid[width * i + j] = grid2d[i][j];
        }
    }
    return flatGrid;
}

export const unflattenGrid = (grid: number[], width: number, height: number): number[][] => {
    const unflattenGrid = new Array(height).fill(null).map(() => new Array(width));
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            unflattenGrid[i][j] = grid[i * width + j];
        }
    }
    return unflattenGrid;
}


export const getNCDValue = (index1: number, index2: number, ncdMatrix: number[][]): number => {
    return ncdMatrix[index1][index2];
}


export const getAdjacentEmptyCells = (grid: number[][], visited: Set<string>, emptyIndex: number = -1): [number, number][] => {
    if (!grid || grid.length === 0) return [];

    const adjacent: [number, number][] = [];
    const height = grid.length;
    const width = grid[0].length;

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (grid[i][j] !== emptyIndex && !visited.has(`${i}-${j}`)) {
                visited.add(`${i}-${j}`);

                const neighbors = [
                    [i - 1, j], // up
                    [i, j + 1], // right,
                    [i + 1, j], // down
                    [i, j - 1], // left
                ];

                for (const [ni_raw, nj_raw] of neighbors) {
                    const ni = (ni_raw + height) % height;
                    const nj = (nj_raw + width) % width;

                    if (grid[ni][nj] === emptyIndex) {
                        adjacent.push([ni, nj]);
                    }
                }
            }
        }
    }
    return adjacent;
};


export const createSafeInitialGrid = (width: number, height: number, gridObjects: GridObject[], ncdMatrixResponse: NCDMatrixResponse): GridState => {
    const len = gridObjects.length;
    const baseWidth = Math.ceil(Math.sqrt(len));
    const baseHeight = Math.ceil(len / baseWidth);

    const gridWidth = (width || baseWidth) + 1;
    const gridHeight = (height || baseHeight) + 1;

    console.log(`Initialize safe grid with dimension: ${gridWidth}x${gridHeight}`);
    const idToIndexMap: Map<string, number> = new Map();
    const indexToIdMap: Map<number, string> = new Map();
    gridObjects.forEach((obj: GridObject, index: number) => {
        idToIndexMap.set(obj.id, index);
        indexToIdMap.set(index, obj.id);
    })
    const EMPTY_CELL_INDEX = -1;
    const grid = new Array(gridWidth * gridHeight).fill(EMPTY_CELL_INDEX);

    const centerI = gridWidth / 2;
    const centerJ = gridHeight / 2;
    const firstObjectIdx = idToIndexMap.get(gridObjects[0].id);
    grid[Math.floor(centerI) * gridWidth + Math.floor(centerJ)] = firstObjectIdx !== undefined ? firstObjectIdx : EMPTY_CELL_INDEX;
    console.log(`Placed first object (index ${firstObjectIdx}) at center (${centerI},${centerJ})`);
    let placeCount = 1;
    let attempts = 0;
    const maxAttempts = 10 * len;
    const grid2D = unflattenGrid(grid, gridWidth, gridHeight);
    while (attempts <= maxAttempts && placeCount < len) {
        attempts++;
        const visited: Set<string> = new Set();
        const adjacentEmptyCells = getAdjacentEmptyCells(grid2D, visited, EMPTY_CELL_INDEX);
        if (adjacentEmptyCells.length === 0) {
            console.log("The grid doesn't have any empty cell");
            break;
        }
        const randIdx = Math.floor((Math.random() * adjacentEmptyCells.length));
        const [i, j] = adjacentEmptyCells[randIdx];
        const nextObjectIdx = idToIndexMap.get(gridObjects[placeCount].id);
        if (nextObjectIdx !== undefined) {
            grid2D[i][j] = nextObjectIdx;
            grid[i * width + j] = nextObjectIdx;
            placeCount++;
        }
    }
    if (placeCount < len) {
        console.log(`Only able to place ${placeCount} out of ${len} objects`);
    } else {
        console.log(`Place all ${placeCount} objects successfully`);
    }

    const numericNcdMatrix = ncdMatrixResponse.ncdMatrix;
    const factorMatrix = getFlatGradualFactorMatrix(gridWidth, gridHeight);
    const flatGrid = flattenGrid(grid2D);
    const gridState: GridState = {
        width: gridWidth,
        height: gridHeight,
        numericNcdMatrix,
        factorMatrix: factorMatrix,
        grid: flatGrid,
        emptyIndex: EMPTY_CELL_INDEX,
        idToIndexMap,
        indexToIdMap,
        objectiveValue: 0,
        optimizationHistory: new OptimizationHistory(ADAPTIVE_OPTIMIZE_OPTIONS.historyWindowSize)
    }
    gridState.objectiveValue = calculateObjectiveWithSlackSpace(gridState);
    console.log("Created initial grid: " + JSON.stringify(gridState));
    return gridState;
}


export const wouldBreakConnectivity = (gridState: GridState, pos1: Position, pos2: Position): boolean => {
    const {width, height, grid, emptyIndex = -1,} = gridState;

    const value1 = getGridValue(gridState, pos1);
    const value2 = getGridValue(gridState, pos2);
    // if both are not empty index then the connectivity remain the same
    if (value1 !== emptyIndex && value2 !== emptyIndex) {
        return false;
    }

    if (value1 === emptyIndex && value2 === emptyIndex) {
        return false;
    }
    const nonEmptyPos = value1 === emptyIndex ? pos2 : pos1;
    const tempGrid = efficientCopy(gridState);
    setGridValue(tempGrid, nonEmptyPos, emptyIndex);

    let totalNonEmptyCells = 0;
    let nonEmptyCellIndicies: number[] = [];
    let firstNonEmptyPosition: Position | null = null;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const index = i * width + j;
            const cellValue = grid[index];

            if (cellValue !== emptyIndex && !(i === nonEmptyPos.i && j === nonEmptyPos.j)) {
                if (firstNonEmptyPosition === null) {
                    firstNonEmptyPosition = {i, j};
                }
                nonEmptyCellIndicies.push(index);
                totalNonEmptyCells++;
            }
        }
    }
    // if there is just only non-empty cell or none, then the connectivity cannot be broken
    if (totalNonEmptyCells <= 1) return false;
    const uf = new UnionFind(width * height);
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const index = i * width + j;
            const position = {i, j};
            // skip the cell that would be moved
            if (i === nonEmptyPos.i && j === nonEmptyPos.j) continue;
            if (getGridValue(gridState, position) !== emptyIndex) {
                for (const [di, dj] of directions) {
                    const ni = (i + di + height) % height;
                    const nj = (j + dj + width) % width;
                    const neighborPos = {i: ni, j: nj};
                    const neighborIndex = ni * width + nj;
                    // skip the cell that would be moved
                    if (ni === nonEmptyPos.i && nj === nonEmptyPos.j) continue;
                    if (getGridValue(gridState, neighborPos) !== emptyIndex) {
                        uf.union(index, neighborIndex);
                    }
                }
            }
        }
    }

    // If all non-empty cells are connected, we should have only one set
    // (the number of sets equals the initial count minus the number of unions performed)
    // Check if we have more than one set among the non-empty cells
    const roots = new Set<number>();
    for (const index of nonEmptyCellIndicies) {
        roots.add(uf.find(index));
    }
    return roots.size > 1;
}


export const selectRandomNonEmptyCell = (grid: GridState): Position => {
    const {width, height, grid: gridArray, emptyIndex = -1} = grid;
    const nonEmptyCells: Position[] = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (gridArray[i * width + j] !== emptyIndex) {
                nonEmptyCells.push({i, j});
            }
        }
    }
    if (nonEmptyCells.length === 0) {
        nonEmptyCells.push({i: 0, j: 0});
    }
    const len = nonEmptyCells.length;
    const randIndex = Math.floor(Math.random() * len);
    return nonEmptyCells[randIndex];
}


export const calculateObjectiveWithSlackSpace = (gridState: GridState): number => {
    let total = 0;
    const {width, height, grid} = gridState;

    if (!grid || grid.length === 0) {
        console.error("Invalid grid data in calculateObjectiveWithSlackSpace");
        return 0;
    }

    const contributionCache = new Map<number, number>();

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const position = {i: i, j: j};
            const cellContribution = getCellContribution(gridState, position, contributionCache);
            total += cellContribution;
        }
    }

    // Ensure the objective value is non-negative
    // We use Math.max with a small positive value to avoid zero which can cause issues
    return Math.max(0.0001, total / 2);
};

export const getCellContribution = (gridState: GridState, position: Position, contributionCache: Map<number, number>): number => {
    const {width, height, emptyIndex = -1, factorMatrix, numericNcdMatrix, grid} = gridState;
    const cellIndex = position.i * width + position.j;
    const currentIndex = grid[cellIndex];
    // if the cell is empty, it has no contribution
    if (currentIndex === emptyIndex) {
        return 0;
    }
    if (contributionCache && contributionCache.has(cellIndex)) {
        return contributionCache.get(cellIndex)!;
    }

    let contribution = 0;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    for (const [di, dj] of directions) {
        const ni = (position.i + di + height) % height; // wrap-around
        const nj = (position.j + dj + width) % width;
        const neighborCellIndex = ni * width + nj;
        const neighborIndex = grid[neighborCellIndex];
        if (neighborIndex !== emptyIndex) {
            contribution += numericNcdMatrix[currentIndex][neighborIndex] * factorMatrix[cellIndex];
        }
    }

    if (contributionCache) {
        contributionCache.set(cellIndex, contribution);
    }

    return contribution;
}


export const calculateCellContribution = (gridState: GridState, pos: Position): number => {
    const {width, height, emptyIndex = -1, factorMatrix, grid, numericNcdMatrix} = gridState;
    const cellIndex = pos.i * width + pos.j;
    const currentIndex = grid[cellIndex];
    if (currentIndex === emptyIndex) {
        return 0;
    }
    let contribution = 0;
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const [di, dj] of directions) {
        const ni = (pos.i + di + height) % height;
        const nj = (pos.j + dj + width) % width;
        const neighborCellIndex = ni * width + nj;
        const neighborIndex = grid[neighborCellIndex];
        if (neighborIndex !== emptyIndex) {
            contribution += numericNcdMatrix[currentIndex][neighborIndex] * factorMatrix[cellIndex];
        }
    }
    return contribution;
}


export const calculateNeighborContribution = (gridState: GridState, position: Position): number => {
    const {width, height, emptyIndex = -1, grid, factorMatrix, numericNcdMatrix} = gridState;
    const cellIndex = (position.i * width) + position.j;
    const currentIndex = grid[cellIndex];
    if (currentIndex === emptyIndex) {
        return 0;
    }
    let contribution = 0;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (const [di, dj] of directions) {
        const ni = (position.i + di + height) % height;
        const nj = (position.j + dj + width) % width;
        const neighborPosition = {i: ni, j: nj};
        const neighborCellValue = getGridValue(gridState, neighborPosition);
        if (neighborCellValue !== emptyIndex) {
            contribution += numericNcdMatrix[neighborCellValue][currentIndex] * factorMatrix[neighborCellValue];
        }
    }
    return contribution;
}


export const getFactorValue = (gridState: GridState, pos: Position): number => {
    const {factorMatrix} = gridState;
    return factorMatrix[gridState.width * pos.i + pos.j];
}

// helper method to treat the grid as 1D great as 2D
export const getGridValue = (grid: GridState, pos: Position): number => {
    return grid.grid[grid.width * pos.i + pos.j];
}

export const setGridValue = (grid: GridState, position: Position, val: number): void => {
    grid.grid[grid.width * position.i + position.j] = val;
}


export const efficientCopy = (gridState: GridState): GridState => {
    try {
        const result = structuredClone(gridState);
        if (gridState.optimizationHistory) {
            result.optimizationHistory = new OptimizationHistory(ADAPTIVE_OPTIMIZE_OPTIONS.historyWindowSize);
            if (gridState.optimizationHistory['objectiveValues']) {
                result.optimizationHistory['objectiveValues'] = [...gridState.optimizationHistory['objectiveValues']];
            }
        }
        return result;
    } catch (error: any) {
        const {
            width,
            height,
            emptyIndex = -1,
            objectiveValue,
            grid,
            numericNcdMatrix,
            factorMatrix,
            optimizationHistory
        } = gridState;

        const newIdToIndexMap = new Map(gridState.idToIndexMap);
        const newIndexToIdMap = new Map(gridState.indexToIdMap);

        let newOptimizationHistory: OptimizationHistory;
        if (optimizationHistory) {
            newOptimizationHistory = new OptimizationHistory(ADAPTIVE_OPTIMIZE_OPTIONS.historyWindowSize);
            if (optimizationHistory['objectiveValues']) {
                newOptimizationHistory['objectiveValues'] = [...optimizationHistory['objectiveValues']];
            }
        } else {
            newOptimizationHistory = new OptimizationHistory(ADAPTIVE_OPTIMIZE_OPTIONS.historyWindowSize);
        }

        return {
            width,
            height,
            emptyIndex,
            objectiveValue,
            grid: [...grid],
            idToIndexMap: newIdToIndexMap,
            indexToIdMap: newIndexToIdMap,
            factorMatrix: factorMatrix,
            numericNcdMatrix: numericNcdMatrix,
            optimizationHistory: newOptimizationHistory
        };
    }
}

export const calculateGridSimilarity = (grid1: GridState, grid2: GridState): number => {
    if (grid1.width !== grid2.width || grid1.height !== grid2.height) {
        throw new Error("Grids must have the same dimensions to calculate similarity");
    }

    let matches = 0;
    const totalCells = grid1.height * grid1.width;
    for (let i = 0; i < grid1.height; i++) {
        for (let j = 0; j < grid1.width; j++) {
            const flattenIndex = i * grid1.width + j;
            if (grid1.grid[flattenIndex] === grid2.grid[flattenIndex]) {
                matches++;
            }
        }
    }
    return matches / totalCells;
}


export const ADAPTIVE_OPTIMIZE_OPTIONS = {
    initialTemperature: 12, // starting temperature (higher temperature = more exploration)
    finalTemperature: 0.001, // final temperature
    coolingRate: 0.9997, // base cooling rate per iteration
    adaptiveCoolingEnabled: true, // enable adaptive cooling

    // swap strategy configuration
    swapsPerStep: 1, // base number of swaps to try per step
    explorationRate: 0.3, // probability of random exploration (vs. optimization)

    // cell selection parameters
    sampleSizeMin: 5,// minimum number of cells when exploring
    sampleSizeMax: 15, // maximum number of cells when exploring
    adaptiveSampleSize: true, // enable adaptive sample sizing

    // when to switch to more aggressive exploitation
    exploitationThreshold: 0.1, // temperature threshold for switching to exploitation

    // special moves configuration
    allowSpecialMoves: true, // allow special moves like cluster reposition
    specialMoveFrequency: 0.05, // frequency of attempting special moves

    historyWindowSize: 1000, // window size for tracking improvement history
}

class OptimizationHistory {
    // check if we're stuck in a plateau
    private objectiveValues: number[] = [];
    private windowSize: number;

    constructor(windowSize: number) {
        this.windowSize = windowSize;
    }

    addValue(value: number) {
        this.objectiveValues.push(value);
        if (this.objectiveValues.length > this.windowSize) {
            this.objectiveValues.shift(); // remove the oldest value
        }
    }

    // get improvement rate over the history window
    getImprovementRate(): number {
        if (this.objectiveValues.length < 2) return 0;
        const oldest = this.objectiveValues[0];
        const newest = this.objectiveValues[this.objectiveValues.length - 1];
        if (oldest === 0) return 0;
        return Math.abs((oldest - newest) / oldest);
    }

    // get change rate based on recent iterations
    getRecentChangeRate(recentWindow: number = 100): number {
        if (this.objectiveValues.length < recentWindow + 1) return 0;

        const before = this.objectiveValues[this.objectiveValues.length - recentWindow - 1];
        const current = this.objectiveValues[this.objectiveValues.length - 1];
        if (before === 0) return 0;
        return Math.abs((before - current) / before) / recentWindow;
    }

    // check if we're stuck in the plateau
    isStuckInPlateau(threshold: number = 0.0001, minLength: number = 200): boolean {
        if (this.objectiveValues.length < minLength) return false;
        const recentValues = this.objectiveValues.slice(-minLength);
        const mean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;

        // calculate standard variation
        const variance = recentValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recentValues.length;
        const stdDev = Math.sqrt(variance);
        // If standard deviation is very small relative to mean, we're in a plateau
        return (stdDev / mean) < threshold;
    }

}


// These changes should be applied to the kgrid.ts file to fix the negative objective value issues

// 1. Update the calculateSwapDelta function to prevent invalid calculations

export const calculateSwapDelta = (gridState: GridState, pos1: Position, pos2: Position): number => {
    const value1 = getGridValue(gridState, pos1);
    const value2 = getGridValue(gridState, pos2);

    // If both cell contain the same value or empty, no change
    if (value1 === value2) {
        return 0;
    }

    // Calculate the current contribution of each cell and its neighbors
    const oldCellContribution1 = calculateCellContribution(gridState, pos1);
    const oldCellContribution2 = calculateCellContribution(gridState, pos2);
    const oldNeighborContribution1 = calculateNeighborContribution(gridState, pos1);
    const oldNeighborContribution2 = calculateNeighborContribution(gridState, pos2);

    // Create a new grid with the swap applied
    const newGrid = efficientCopy(gridState);
    setGridValue(newGrid, pos1, value2);
    setGridValue(newGrid, pos2, value1);

    // Calculate the new contribution after the swap
    const newCellContribution1 = calculateCellContribution(newGrid, pos1);
    const newCellContribution2 = calculateCellContribution(newGrid, pos2);
    const newNeighborContribution1 = calculateNeighborContribution(newGrid, pos1);
    const newNeighborContribution2 = calculateNeighborContribution(newGrid, pos2);

    // Calculate the total difference
    const totalNew = (newCellContribution1 + newCellContribution2 + newNeighborContribution1 + newNeighborContribution2);
    const totalOld = (oldCellContribution1 + oldCellContribution2 + oldNeighborContribution1 + oldNeighborContribution2);
    let delta = totalNew - totalOld;

    // Sanity checks to prevent invalid deltas
    if (isNaN(delta) || !isFinite(delta)) {
        console.error("Invalid delta detected:", {
            pos1, pos2,
            old: [oldCellContribution1, oldCellContribution2, oldNeighborContribution1, oldNeighborContribution2],
            new: [newCellContribution1, newCellContribution2, newNeighborContribution1, newNeighborContribution2]
        });
        return 0; // Reject this swap
    }

    // Limit extreme delta values
    const MAX_DELTA_MAGNITUDE = 10.0;
    if (Math.abs(delta) > MAX_DELTA_MAGNITUDE) {
        console.warn(`Unusually large delta detected: ${delta}. Clamping to range.`);
        delta = Math.sign(delta) * MAX_DELTA_MAGNITUDE;
    }

    return delta;
};

// 2. Add objective value validation in adaptiveOptimizeStep

export const adaptiveOptimizeStep = (gridState: GridState, iterationCount: number): GridState => {
    const options = ADAPTIVE_OPTIMIZE_OPTIONS;

    // Initialize optimization history if it doesn't exist
    if (!gridState.optimizationHistory) {
        gridState.optimizationHistory = new OptimizationHistory(options.historyWindowSize);
        gridState.optimizationHistory.addValue(gridState.objectiveValue);
    }

    // Periodically recalculate the objective value to prevent drift
    if (iterationCount % 1000 === 0) {
        const recalculatedObjective = calculateObjectiveWithSlackSpace(gridState);

        if (Math.abs(recalculatedObjective - gridState.objectiveValue) > 0.1) {
            console.warn(`Objective value drift detected. Recalculated: ${recalculatedObjective}, Current: ${gridState.objectiveValue}`);
            gridState.objectiveValue = recalculatedObjective;
        }
    }

    // Calculate temperature based on iteration count
    let temperature = options.initialTemperature * Math.pow(options.coolingRate, iterationCount);

    // Adaptive cooling adjustments based on progress
    if (options.adaptiveCoolingEnabled && iterationCount > 0 && iterationCount % 100 === 0) {
        const history = gridState?.optimizationHistory as OptimizationHistory;

        // Slow down cooling if making good progress
        if (history.getRecentChangeRate(100) > 0.001) {
            temperature *= 1.05;
        }

        // Boost temperature to escape plateaus
        if (history.isStuckInPlateau() && Math.random() < 0.3) {
            temperature *= 2.0;
            console.log(`[Iteration ${iterationCount}] Boosting temperature to escape plateau`);
        }
    }

    // Determine if we're in exploitation mode
    const inExploitationMode = temperature <= options.exploitationThreshold;
    const actualSwaps = inExploitationMode ? 1 : options.swapsPerStep;
    let currentGrid = efficientCopy(gridState);

    // Try multiple swaps
    for (let i = 0; i < actualSwaps; i++) {
        // Sample size calculation
        const sampleSize = options.adaptiveSampleSize
            ? Math.max(
                options.sampleSizeMin,
                Math.min(
                    options.sampleSizeMax,
                    Math.floor(Math.sqrt(gridState.width * gridState.height) * (temperature / options.initialTemperature))
                )
            )
            : options.sampleSizeMin;

        // Try special moves occasionally
        if (options.allowSpecialMoves && Math.random() < options.specialMoveFrequency) {
            currentGrid = attemptSpecialMove(currentGrid, temperature);
        }

        // Select cells to swap
        const cell1 = selectCellAdaptive(currentGrid, sampleSize, inExploitationMode);

        // Different strategies for selecting the second cell
        let cell2;
        if (Math.random() < 0.6) {
            // 60% try to find related cell
            cell2 = findRelatedCellAdaptive(currentGrid, cell1, sampleSize);
        } else if (Math.random() < 0.5) {
            // 20% empty cell
            cell2 = selectRandomEmptyCell(currentGrid);
            if (!cell2) {
                cell2 = selectRandomNonEmptyCell(currentGrid);
            }
        } else {
            // 20% non-empty cell
            cell2 = selectRandomNonEmptyCell(currentGrid);
        }

        // Skip if same cell or would break connectivity
        if (cell1.i === cell2.i && cell1.j === cell2.j) {
            continue;
        }
        if (wouldBreakConnectivity(currentGrid, cell1, cell2)) {
            continue;
        }

        // Calculate delta and decide whether to accept the swap
        const delta = calculateSwapDelta(currentGrid, cell1, cell2);
        const acceptanceProbability = getAcceptanceProbability(delta, temperature);

        if (Math.random() < acceptanceProbability) {
            // Apply the swap
            const value1 = getGridValue(currentGrid, cell1);
            const value2 = getGridValue(currentGrid, cell2);

            setGridValue(currentGrid, cell1, value2);
            setGridValue(currentGrid, cell2, value1);

            // Update the objective value
            currentGrid.objectiveValue += delta;

            // Validate objective value after update - force positive values
            if (currentGrid.objectiveValue < 0) {
                console.warn(`Negative objective value detected: ${currentGrid.objectiveValue}. Recalculating.`);
                currentGrid.objectiveValue = calculateObjectiveWithSlackSpace(currentGrid);
            }

            // Log significant improvements
            if (delta < -0.1) {
                console.log(`[Iteration ${iterationCount}] Significant improvement: swap at (${cell1.i},${cell1.j})⟷(${cell2.i},${cell2.j}), new objective: ${currentGrid.objectiveValue.toFixed(6)}`);
            }
        }
    }

    // Update history
    currentGrid.optimizationHistory.addValue(currentGrid.objectiveValue);

    // Final validation of objective value
    if (currentGrid.objectiveValue < 0 || isNaN(currentGrid.objectiveValue) || !isFinite(currentGrid.objectiveValue)) {
        console.error(`Invalid objective value: ${currentGrid.objectiveValue}. Performing full recalculation.`);
        currentGrid.objectiveValue = calculateObjectiveWithSlackSpace(currentGrid);
    }

    return currentGrid;
};

export const getRecentProgress = (gridState: GridState, windowSize: number) => {
    if (!gridState?.optimizationHistory) return 0;
    return gridState.optimizationHistory.getRecentChangeRate(windowSize);
}

// adaptive cell selection that considers both poor fit and cluster boundaries
export const selectCellAdaptive = (gridState: GridState, sampleSize: number, inExploitationMode: boolean): Position => {
    const {width, height, emptyIndex = -1, numericNcdMatrix} = gridState;

    // in exploitation mode, focus more on poor-fitting cells
    const explorationRate = inExploitationMode ? 0.1 : 0.3;

    // random exploration
    if (Math.random() < explorationRate) {
        return selectRandomNonEmptyCell(gridState);
    }

    // strategic selection
    const candidates: [Position, number][] = [];

    // sample cells to evaluate
    for (let i = 0; i < sampleSize; i++) {
        const pos = selectRandomNonEmptyCell(gridState);
        const value = getGridValue(gridState, pos);
        if (value === emptyIndex) continue;

        // calculate fit score (higher score = worse fit)
        let fitScore = 0;
        let neighborCount = 0;

        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        for (const [di, dj] of directions) {
            const ni = (pos.i + di + height) % height;
            const nj = (pos.j + dj + width) % width;
            const neighborPos = {i: ni, j: nj};
            const neighborValue = getGridValue(gridState, neighborPos);
            if (neighborValue !== emptyIndex) {
                fitScore += numericNcdMatrix[value][neighborValue];
                neighborCount++;
            }
        }

        // calculate average fit score
        const avgFitScore = neighborCount > 0 ? fitScore / neighborCount : 0;

        // add boundary detection: cells at cluster boundary are good swapping candidates
        let isBoundary = false;
        for (const [di, dj] of directions) {
            const ni = (pos.i + di + height) % height;
            const nj = (pos.j + dj + width) % width;
            const neighborPos = {i: ni, j: nj};
            const neighborValue = getGridValue(gridState, neighborPos);
            if (neighborValue !== emptyIndex && neighborValue !== value) {
                // check if this neighbor is significantly different
                if (numericNcdMatrix[value][neighborValue] > 0.5) {
                    isBoundary = true;
                    break;
                }
            }
        }

        // boundary cell gets a bonus
        const finalScore = isBoundary ? avgFitScore * 1.5 : avgFitScore;
        candidates.push([pos, finalScore]);
    }

    // sort by worst fit first
    candidates.sort((a, b) => b[1] - a[1]);
    // Return one of the worst-fitting cells (with some randomness)
    const randomIndex = Math.floor(Math.random() * Math.min(3, candidates.length));
    return candidates.length > 0 ? candidates[randomIndex][0] : selectRandomNonEmptyCell(gridState);
}


// find related cell consider both similarity and layout quality
export const findRelatedCellAdaptive = (gridState: GridState, pos: Position, sampleSize: number): Position => {
    const {width, emptyIndex = -1, numericNcdMatrix, factorMatrix} = gridState;
    const value = getGridValue(gridState, pos);

    if (value === emptyIndex) {
        return selectRandomNonEmptyCell(gridState);
    }


    const candidates: [Position, number][] = [];

    // sample cells to find related one
    for (let i = 0; i < sampleSize; i++) {
        const candidatePos = selectRandomNonEmptyCell(gridState);
        if (candidatePos.i === pos.i && candidatePos.j === pos.j) continue;
        const candidateValue = getGridValue(gridState, candidatePos);
        if (candidateValue === emptyIndex) continue;
        // get NCD value - lower is better
        const ncdValue = numericNcdMatrix[value][candidateValue];
        // consider the factor matrix value (higher is better) for central position
        const factorValue = factorMatrix[candidatePos.i * width + candidatePos.j];
        // combined score - lower is better, balance between similarity and position quality
        const combinedValue = ncdValue - (factorValue * 0.1);
        candidates.push([candidatePos, combinedValue]);
    }

    // sort in increasing order of the combined values, lower score = better match
    candidates.sort((a, b) => a[1] - b[1]);
    // pick one of the best matches
    const index = Math.floor(Math.random() * Math.min(3, candidates.length));
    return candidates.length > 0 ? candidates[index][0] : selectRandomNonEmptyCell(gridState);
}

export const attemptSpecialMove = (gridState: GridState, temperature: number): GridState => {
    const {width, height, emptyIndex = -1, numericNcdMatrix} = gridState;
    const newGrid = efficientCopy(gridState);
    const moveType = Math.random();

    // 1. cluster movement - move a group of related items together
    if (moveType < 0.4) {
        const seedPos = selectRandomNonEmptyCell(newGrid);
        const seedValue = getGridValue(newGrid, seedPos);
        if (seedValue === emptyIndex) return newGrid;

        // find cells that are similar to seed
        const similarCells: Position[] = [];
        const threshold = 0.3; // similar threshold

        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const pos = {i, j};
                const value = getGridValue(newGrid, pos);
                if (value !== emptyIndex && value !== seedValue) {
                    if (numericNcdMatrix[seedValue][value] < threshold) {
                        similarCells.push(pos);
                    }
                }
            }
        }

        // if we found similar cells, try to move one closer to the seed
        if (similarCells.length > 0) {
            const targetCell = similarCells[Math.floor(Math.random() * similarCells.length)];

            // find an adjacent position to move to
            const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
            const shuffleDirs = directions.sort(() => Math.random() - 0.5);

            for (const [di, dj] of shuffleDirs) {
                const ni = (seedPos.i + di + height) % height;
                const nj = (seedPos.j + dj + width) % width;
                const moveToPos = {i: ni, j: nj};
                const moveToValue = getGridValue(newGrid, moveToPos);
                if (moveToValue === emptyIndex || !wouldBreakConnectivity(newGrid, targetCell, moveToPos)) {
                    // calculate the delta for this move
                    const delta = calculateSwapDelta(newGrid, targetCell, moveToPos);
                    // even if it's not an improvement, we might accept it to escape local optima
                    const acceptanceProbability = getAcceptanceProbability(delta, temperature);
                    if (Math.random() < acceptanceProbability) {
                        const cellValue = getGridValue(newGrid, targetCell);
                        setGridValue(newGrid, targetCell, moveToValue);
                        setGridValue(newGrid, moveToPos, cellValue);
                        newGrid.objectiveValue += delta;

                        console.log(`Special move: Cluster item moved near similar item. Delta: ${delta.toFixed(6)}`);
                        return newGrid;
                    }
                }
            }
        }
    }
    // row or column shift - works well for grid arrangements
    else if (moveType < 0.7) {
        const shiftRow = Math.random() < 0.5;
        if (shiftRow) {
            const rowToShift = Math.floor(Math.random() * height);
            const shiftDirection = Math.random() < 0.5 ? 1 : -1;

            // calculating the effect of shifting this row
            let shiftDelta = 0;
            const tempGrid = efficientCopy(newGrid);

            // perform the shift
            const rowBuffer = [];
            for (let j = 0; j < width; j++) {
                rowBuffer[j] = getGridValue(tempGrid, {i: rowToShift, j});
            }

            for (let j = 0; j < width; j++) {
                const newJ = (j + shiftDirection + width) % width;
                setGridValue(tempGrid, {i: rowToShift, j: newJ}, rowBuffer[j]);
            }

            // calculate new objective after shifting rows
            tempGrid.objectiveValue = calculateObjectiveWithSlackSpace(tempGrid);
            shiftDelta = tempGrid.objectiveValue - newGrid.objectiveValue;
            const acceptanceProbability = getAcceptanceProbability(shiftDelta, temperature);
            if (Math.random() < acceptanceProbability) {
                console.log(`Special move: Row ${rowToShift} shifted by ${shiftDirection}. Delta: ${shiftDelta.toFixed(6)}`);
                return tempGrid;
            }
        } else {
            // shift a column
            const colToShift = Math.floor(Math.random() * width);
            const shiftDirection = Math.random() < 0.5 ? 1 : -1;

            // calculate the effect of shifting this column
            let shiftDelta = 0;
            const tempGrid = efficientCopy(newGrid);

            // perform the shift
            const colBuffer = [];
            for (let i = 0; i < height; i++) {
                colBuffer[i] = getGridValue(tempGrid, {i, j: colToShift});
            }
            for (let i = 0; i < height; i++) {
                const newI = (i + shiftDirection + height) % height;
                setGridValue(tempGrid, {i: newI, j: colToShift}, colBuffer[i]);
            }

            // calculate the objective value after shifting the column
            tempGrid.objectiveValue = calculateObjectiveWithSlackSpace(tempGrid);
            shiftDelta = tempGrid.objectiveValue - newGrid.objectiveValue;
            const acceptanceProbability = getAcceptanceProbability(shiftDelta, temperature);
            if (Math.random() < acceptanceProbability) {
                console.log(`Special move: Column ${colToShift} shifted by ${shiftDirection}. Delta: ${shiftDelta.toFixed(6)}`);
                return tempGrid;
            }
        }
    }
    // 3. empty cell redistribution - help break symmetry and create space for meaningful arrangements
    else {
        // find all empty cells
        const emptyCells: Position[] = [];
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                if (getGridValue(newGrid, {i, j}) === emptyIndex) {
                    emptyCells.push({i, j});
                }
            }
        }
        // if we have multiple empty cells, try to arrange them
        if (emptyCells.length > 1) {
            // strategy: move an empty cell to a poorly connected item
            // find a cell with poor fits (high NCD) with its neighbor

            const candidates: [Position, number][] = [];
            const sampleSize = Math.min(10, width * height);

            for (let i = 0; i < sampleSize; i++) {
                const pos = selectRandomNonEmptyCell(newGrid);
                const value = getGridValue(newGrid, pos);
                if (value === emptyIndex) continue;

                // evaluate fit with neighbors
                let totalNCD = 0;
                let neighborCount = 0;
                const directions = [[0, 1], [1, 0], [-1, 0], [0, -1]];
                for (const [di, dj] of directions) {
                    const ni = (pos.i + di + height) % height;
                    const nj = (pos.j + dj + width) % width;
                    const neighborPos = {i: ni, j: nj};
                    const neighborValue = getGridValue(newGrid, neighborPos);
                    if (neighborValue !== emptyIndex) {
                        totalNCD += newGrid.numericNcdMatrix[value][neighborValue];
                        neighborCount++;
                    }
                }

                // higher score means worse fit with neighbors
                const averageNCD = neighborCount > 0 ? totalNCD / neighborCount : 0;
                candidates.push([pos, averageNCD]);
            }

            candidates.sort((a, b) => b[1] - a[1]);

            if (candidates.length > 0) {
                const poorFitPos = candidates[0][0];
                const directions = [[0, 1], [1, 0], [-1, 0], [1, 0]];
                for (const [di, dj] of directions) {
                    const ni = (poorFitPos.i + di + height) % height;
                    const nj = (poorFitPos.j + dj + width) % width;
                    const adjacentPos = {i: ni, j: nj};
                    const adjacentValue = getGridValue(newGrid, adjacentPos);
                    if (adjacentValue !== emptyIndex) {
                        // try to move an empty cell here to replace the poor fit neighbor
                        const randomEmptyIndex = Math.floor(Math.random() * emptyCells.length);
                        const emptyCell = emptyCells[randomEmptyIndex];
                        if (!wouldBreakConnectivity(newGrid, adjacentPos, emptyCell)) {
                            // perform swap
                            const delta = calculateSwapDelta(newGrid, adjacentPos, emptyCell);
                            const acceptanceProbability = getAcceptanceProbability(delta, temperature);

                            if (Math.random() < acceptanceProbability) {
                                setGridValue(newGrid, adjacentPos, emptyIndex);
                                setGridValue(newGrid, emptyCell, adjacentValue);

                                newGrid.objectiveValue += delta;
                                console.log(`Special move: Empty cell relocation. Delta: ${delta.toFixed(6)}`);
                                return newGrid;
                            }
                        }
                    }
                }
            }
        }
    }
    // If no special move was performed, return the original grid
    return newGrid;
}


export const getAcceptanceProbability = (delta: number, temperature: number): number => {
    // always accept improvements
    if (delta <= 0) {
        return 1.0;
    }
    // for worsening moves, use Boltzmann distribution
    return Math.exp(-delta / Math.max(0.001, temperature));
}


export const selectRandomEmptyCell = (gridState: GridState): Position | null => {
    const {width, height, grid: gridArray, emptyIndex = -1} = gridState;
    const emptyCells: Position[] = [];

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (gridArray[i * width + j] === emptyIndex) {
                emptyCells.push({i, j});
            }
        }
    }

    if (emptyCells.length === 0) {
        return null;
    }

    const randIndex = Math.floor(Math.random() * emptyCells.length);
    return emptyCells[randIndex];
}



