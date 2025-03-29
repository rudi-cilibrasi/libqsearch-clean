import {deflate} from "pako";
import {NCDMatrixResponse} from "@/types/ncd.ts";

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

    // Base value
    const base = 1.15;

    // Radial pattern with slight variation
    const radialFactor = 0.2 * (1 - dist);

    // Add some asymmetry with a small sinusoidal component
    const asymFactor = 0.05 * Math.sin(pos.i * Math.PI / height) * Math.sin(pos.j * Math.PI / width);

    // Combine and apply power scaling
    return Math.pow(base + radialFactor + asymFactor, 0.4);
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
        objectiveValue: 0
    }
    gridState.objectiveValue = calculateObjectiveWithSlackSpace(gridState);
    return gridState;
}

export const optimizeStep = (grid: GridState, iterationCount: number): GridState => {
    const {
        initialTemperature,
        finalTemperature,
        coolingRate,
        swapsPerStep
    } = OPTIMIZE_STEP_OPTIONS;

    let currentGrid = structuredClone(grid);
    const temperature = initialTemperature * Math.pow(coolingRate, iterationCount);
    const inExploitationMode = temperature <= finalTemperature;

    const actualSwaps = inExploitationMode ? 1 : swapsPerStep;
    for (let i = 0; i < actualSwaps; i++) {
        const cell1 = selectRandomNonEmptyCell(grid);
        let cell2;
        if (Math.random() < 0.8) {
            cell2 = selectRandomNonEmptyCell(grid);
        } else {
            cell2 = selectRandomEmptyCell(grid);
            if (!cell2) {
                cell2 = selectRandomNonEmptyCell(grid);
            }
        }
        if (cell1.i === cell2.i && cell1.j === cell2.j) {
            continue;
        }
        if (wouldBreakConnectivity(currentGrid, cell1, cell2)) {
            continue;
        }
        const proposedGrid = swapCells(currentGrid, cell1, cell2);

        const delta = proposedGrid.objectiveValue - grid.objectiveValue;
        const acceptanceProbability = delta <= 0 ? 1 : Math.exp(-delta / temperature);
        if (Math.random() < acceptanceProbability) {
            currentGrid = proposedGrid;
            console.log(`[Iteration ${iterationCount}] Accepted swap at (${cell1.i},${cell1.j})⟷(${cell2.i},${cell2.j}), new objective: ${currentGrid.objectiveValue.toFixed(6)}`);
        }
    }
    return currentGrid;
}


export const wouldBreakConnectivity = (grid: GridState, cell1: Position, cell2: Position): boolean => {
    const {width, height, emptyIndex} = grid;

    const value1 = getGridValue(grid, cell1);
    const value2 = getGridValue(grid, cell2);

    if (value1 !== emptyIndex && value2 !== emptyIndex) {
        return false;
    }

    if (value1 === emptyIndex && value2 === emptyIndex) {
        return false;
    }

    const nonEmptyPos = value1 === emptyIndex ? cell2 : cell1;
    const emptyPos = value1 !== emptyIndex ? cell2 : cell1;

    let nonEmptyNeighborCount = 0;
    let nonEmptyNeighbors: Position[] = [];
    const directions = [[0, 1], [1, 0], [-1, 0], [0, -1]];

    for (const [di, dj] of directions) {
        const ni = (nonEmptyPos.i + di + height) % height;
        const nj = (nonEmptyPos.j + dj + width) % width;
        const neighborPos = {i: ni, j: nj};
        if (ni === emptyPos.i && nj === emptyPos.j) {
            continue;
        }
        const neighborValue = getGridValue(grid, neighborPos);
        if (neighborValue !== emptyIndex) {
            nonEmptyNeighborCount++;
            nonEmptyNeighbors.push({i: ni, j: nj});
        }
    }
    if (nonEmptyNeighborCount > 1) {
        if (nonEmptyNeighborCount === 2) {
            const tempGrid = efficientCopy(grid);
            setGridValue(tempGrid, nonEmptyPos, emptyIndex);

            // Check if two neighbors can reach each other!
            return !canReach(tempGrid, nonEmptyNeighbors[0], nonEmptyNeighbors[1]);
        }
        return false;
    }

    let totalNonEmptyCells = 0;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (getGridValue(grid, {i: i, j: j}) !== emptyIndex) {
                totalNonEmptyCells++;
            }
        }
    }
    if (totalNonEmptyCells <= 1) {
        return false;
    }

    const tempGrid = efficientCopy(grid);
    // perform swap
    const v1 = getGridValue(grid, cell1);
    const v2 = getGridValue(grid, cell2);
    setGridValue(tempGrid, cell1, v2);
    setGridValue(tempGrid, cell2, v1);

    let startPos: Position | null = null;
    for (let i = 0; i < height && !startPos; i++) {
        for (let j = 0; j < width && !startPos; j++) {
            if (getGridValue(tempGrid, {i: i, j: j}) !== emptyIndex) {
                startPos = {i, j};
            }
        }
    }
    if (!startPos) {
        return false;
    }

    const visited = new Set<string>();
    let visitedCount = bfsCountReachable(tempGrid, startPos, visited);
    return visitedCount !== totalNonEmptyCells - 1;
}

export const bfsCountReachable = (grid: GridState, start: Position, visited: Set<string>): number => {
    const {width, height, emptyIndex = -1} = grid;
    const queue: Position[] = [start];
    visited.add(`${start.i},${start.j}`);
    let count = 1;
    while (queue.length > 0) {
        const current = queue.shift()!;

        const directions = [[0, 1], [1, 0], [-1, 0], [0, -1]];
        for (const [di, dj] of directions) {
            const ni = (current.i + di + height) % height;
            const nj = (current.j + dj + width) % width;
            const neighborPos = {i: ni, j: nj};
            const key = `${ni},${nj}`;
            if (!visited.has(key) && getGridValue(grid, neighborPos) !== emptyIndex) {
                visited.add(key);
                queue.push({i: ni, j: nj});
                count++;
            }
        }
    }
    return count;
}

export const canReach = (grid: GridState, start: Position, end: Position): boolean => {
    const {width, height, emptyIndex} = grid;
    const queue: Position[] = [start];
    const visited = new Set<string>([`${start.i},${start.j}`]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.i === end.i && current.j === end.j) {
            return true;
        }

        const directions = [[0, 1], [1, 0], [-1, 0], [0, -1]];
        for (const [di, dj] of directions) {
            const ni = (current.i + di + height) % height; // wrap-around;
            const nj = (current.j + dj + width) % width;
            const neighborPos = {i: ni, j: nj};
            const key = `${ni},${nj}`;
            if (!visited.has(key) && getGridValue(grid, neighborPos) !== emptyIndex) {
                visited.add(key);
                queue.push(neighborPos);
            }
        }
    }
    return false;
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


export const selectRandomEmptyCell = (grid: GridState): Position => {
    const {width, height, grid: gridArray, emptyIndex = -1} = grid;
    const emptyCells: Position[] = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const index = i * width + j;
            if (gridArray[index] === emptyIndex) {
                emptyCells.push({i, j});
            }
        }
    }
    if (emptyCells.length === 0) {
        emptyCells.push({i: 0, j: 0});
    }
    const len = emptyCells.length;
    const randIdx = Math.floor(Math.random() * len);
    return emptyCells[randIdx];
}

export const calculateObjectiveWithSlackSpace = (gridState: GridState): number => {
    let total = 0;
    const {width, height, grid, emptyIndex = -1, factorMatrix, numericNcdMatrix} = gridState;
    if (!grid || grid.length === 0) {
        console.error("Invalid grid data in calculateObjectiveWithSlackSpace");
        return 0;
    }

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const cellIndex = i * width + j;
            const currentIdx = grid[cellIndex];
            if (currentIdx === emptyIndex) {
                continue;
            }
            const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
            for (const [di, dj] of directions) {
                const ni = (di + i + height) % height;
                const nj = (dj + j + width) % width;
                const neighborCellIndex = ni * width + nj;
                const neighborIdx = grid[neighborCellIndex];
                if (neighborIdx !== emptyIndex) {
                    total += numericNcdMatrix[currentIdx][neighborIdx] * factorMatrix[cellIndex];
                }
            }
        }
    }
    return total;
};


export const calculateCellContribution = (grid: GridState, position: Position): number => {
    const {width, height, numericNcdMatrix, emptyIndex} = grid;
    const cellIndex = getGridValue(grid, position);
    if (cellIndex === emptyIndex) return 0;
    const i = position.i;
    const j = position.j;
    const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const factorValue = getFactorValue(grid, position);
    let contribution = 0;
    for (const [di, dj] of directions) {
        const ni = (i + di + height) % height;
        const nj = (j + dj + width) % width;
        const neighborPosition = {i: ni, j: nj};
        const neighborIdx = getGridValue(grid, neighborPosition);
        if (neighborIdx !== emptyIndex) {
            contribution += numericNcdMatrix[cellIndex][neighborIdx] * factorValue;
        }
    }
    return contribution;
}


export const calculateNeighborContribution = (grid: GridState, position: Position): number => {
    const {width, height, emptyIndex, numericNcdMatrix} = grid;
    const cellIndex = getGridValue(grid, position);
    if (cellIndex === emptyIndex) {
        return 0; // if the cell is an empty cell, then don't calculate neighbor contributions
    }
    let contribution = 0;
    const i = position.i, j = position.j;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    for (const [di, dj] of directions) {
        const ni = (i + di + height) % height; // wrap-around
        const nj = (j + dj + width) % width;
        const neighborPosition = {i: ni, j: nj};
        const neighborIndex = getGridValue(grid, neighborPosition);
        if (neighborIndex !== emptyIndex) {
            const neighborFactor = getFactorValue(grid, neighborPosition);
            contribution += numericNcdMatrix[neighborIndex][cellIndex] * neighborFactor;
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
        return structuredClone(gridState);
    } catch (error: any) {
        const {width, height, emptyIndex = -1, objectiveValue, grid, numericNcdMatrix, factorMatrix} = gridState;
        const newIdToIndexMap = new Map(gridState.idToIndexMap);
        const newIndexToIdMap = new Map(gridState.indexToIdMap);
        return {
            width,
            height,
            emptyIndex,
            objectiveValue,
            grid: [...grid],
            idToIndexMap: newIdToIndexMap,
            indexToIdMap: newIndexToIdMap,
            factorMatrix: factorMatrix,
            numericNcdMatrix: numericNcdMatrix
        }
    }
}


export const selectRandomCell = (grid: GridState): Position => {
    const i = Math.floor(Math.random() * grid.height);
    const j = Math.floor(Math.random() * grid.width);

    console.log(`Selected random cell at position (${i},${j})`);
    return {i, j};
}


const OPTIMIZE_STEP_OPTIONS = {
    initialTemperature: 10.0,  // Starting temperature (higher = more exploration)
    finalTemperature: 0.00,    // Final temperature
    coolingRate: 0.9999,       // Cooling rate per iteration (slower = better results)
    swapsPerStep: 1,           // Number of swaps to try per step
}

export const swapCells = (gridState: GridState, pos1: Position, pos2: Position): GridState => {
    const newGrid = efficientCopy(gridState);

    const value1 = getGridValue(newGrid, pos1);
    const value2 = getGridValue(newGrid, pos2);
    const oldCellContribution1 = calculateCellContribution(newGrid, pos1);
    const oldCellContribution2 = calculateCellContribution(newGrid, pos2);
    const oldNeighborContribution1 = calculateNeighborContribution(newGrid, pos1);
    const oldNeighborContribution2 = calculateNeighborContribution(newGrid, pos2);

    setGridValue(newGrid, pos1, value2);
    setGridValue(newGrid, pos2, value1);

    const newCellContribution1 = calculateCellContribution(newGrid, pos1);
    const newCellContribution2 = calculateCellContribution(newGrid, pos2);
    const newNeighborContribution1 = calculateNeighborContribution(newGrid, pos1);
    const newNeighborContribution2 = calculateNeighborContribution(newGrid, pos2);

    const delta = (newCellContribution1 + newCellContribution2 + newNeighborContribution1 + newNeighborContribution2)
        - (oldCellContribution1 + oldCellContribution2 + oldNeighborContribution1 + oldNeighborContribution2);
    newGrid.objectiveValue = gridState.objectiveValue + delta;
    console.log(`Swapped ${value1} at (${pos1.i},${pos1.j}) with ${value2} at (${pos2.i},${pos2.j})`);
    console.log(`New objective value: ${newGrid.objectiveValue.toFixed(6)}`);
    return newGrid;
}

const SYMMETRY_BREAKER_OPTIONS = {
    alpha: 0.25,        // Primary gradient i-coefficient
    beta: 0.35,         // Primary gradient j-coefficient
    baseValue: 1.15,    // Base value to ensure positive factors
    varAmplitude1: 0.03, // Primary variation amplitude
    varAmplitude2: 0.02, // Secondary variation amplitude
    varFreq1: Math.PI,  // Primary variation frequency
    varFreq2: 2.71,     // Secondary variation frequency (using e for irrationality)
    powerFactor: 0.4    // Power to control overall effect magnitude
}

export const symmetryBreaker = (pos: Position, width: number, height: number) => {
    const {
        alpha,
        beta,
        baseValue,
        varAmplitude1,
        varAmplitude2,
        varFreq1,
        varFreq2,
        powerFactor
    } = SYMMETRY_BREAKER_OPTIONS;

    const normalizedI = pos.i / (height - 1 || 1);
    const normalizedJ = pos.j / (width - 1 || 1);

    const baseGradient = baseValue + (alpha * normalizedI) + (beta * normalizedJ);

    const primaryVariation = varAmplitude1 * Math.sin(normalizedI * varFreq1) * Math.sin(normalizedJ * varFreq2);
    const phi = 1.618033988749895;
    const secondaryVariation = varAmplitude2 * Math.sin(normalizedI * varFreq1 * phi) * Math.cos(normalizedJ * varFreq2 * phi);

    return Math.pow(baseGradient + primaryVariation + secondaryVariation, powerFactor);
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
