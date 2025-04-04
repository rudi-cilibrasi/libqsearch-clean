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

export interface Block {
    topLeft: Position;
    bottomRight: Position;
}

export interface GridState {
    width: number;
    height: number;
    grid: number[][]; // grid index position
    numericNcdMatrix: number[][];
    idToIndexMap: Map<string, number>;
    indexToIdMap: Map<number, string>;
    factorMatrix: number[][];
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

export const getGradualFactorMatrix = (width: number, height: number): number[][] => {
    const factorMatrix: number[][] = [];
    for (let i = 0; i < height; i++) {
        factorMatrix[i] = [];
        for (let j = 0; j < width; j++) {
            factorMatrix[i][j] = gradualFactor({i, j}, width, height);
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

export const deepCopy = (gridState: GridState): GridState => {
    const newGrid: number[][] = [];
    for (let i = 0; i < gridState.height; i++) {
        newGrid[i] = [...gridState.grid[i]];
    }

    const newIdToIndexMap = new Map(gridState.idToIndexMap);
    const newIndexToIdMap = new Map(gridState.indexToIdMap);

    return {
        width: gridState.width,
        height: gridState.height,
        grid: newGrid,
        objectiveValue: gridState.objectiveValue,
        numericNcdMatrix: gridState.numericNcdMatrix,
        factorMatrix: gridState.factorMatrix,
        indexToIdMap: newIndexToIdMap,
        idToIndexMap: newIdToIndexMap,
        emptyIndex: -1
    }
};

export const extractBlock = (grid: GridState, block: Block): number[][] => {
    const normalizedBlock = normalizeBlock(block, grid.height, grid.width);
    const {topLeft, bottomRight} = normalizedBlock;

    const blockHeight = bottomRight.i - topLeft.i + 1;
    const blockWidth = bottomRight.j - topLeft.j + 1;

    console.log(`Extracting block with dimensions ${blockWidth}×${blockHeight}`);

    const blockContent: number[][] = Array(blockHeight).fill(null)
        .map(() => Array(blockWidth).fill(-1));

    for (let i = 0; i < blockHeight; i++) {
        for (let j = 0; j < blockWidth; j++) {
            const gridI = (topLeft.i + i) % grid.height;
            const gridJ = (topLeft.j + j) % grid.width;

            blockContent[i][j] = grid.grid[gridI][gridJ];
        }
    }

    console.log(`Extracted block content ${blockHeight}×${blockWidth}:`,
        JSON.stringify(blockContent));
    return blockContent;
}

export const normalizeBlock = (block: Block, gridHeight: number, gridWidth: number): Block => {
    const topLeftI = Math.min(Math.max(0, Math.floor(block.topLeft.i)), gridHeight - 1);
    const topLeftJ = Math.min(Math.max(0, Math.floor(block.topLeft.j)), gridWidth - 1);
    const bottomRightI = Math.min(Math.max(0, Math.floor(block.bottomRight.i)), gridHeight - 1);
    const bottomRightJ = Math.min(Math.max(0, Math.floor(block.bottomRight.j)), gridWidth - 1);

    const normalizedBlock = {
        topLeft: {
            i: Math.min(topLeftI, bottomRightI),
            j: Math.min(topLeftJ, bottomRightJ)
        },
        bottomRight: {
            i: Math.max(topLeftI, bottomRightI),
            j: Math.max(topLeftJ, bottomRightJ)
        }
    };

    if (normalizedBlock.bottomRight.i < normalizedBlock.topLeft.i) {
        normalizedBlock.bottomRight.i = normalizedBlock.topLeft.i;
    }

    if (normalizedBlock.bottomRight.j < normalizedBlock.topLeft.j) {
        normalizedBlock.bottomRight.j = normalizedBlock.topLeft.j;
    }

    if (normalizedBlock.topLeft.i !== block.topLeft.i ||
        normalizedBlock.topLeft.j !== block.topLeft.j ||
        normalizedBlock.bottomRight.i !== block.bottomRight.i ||
        normalizedBlock.bottomRight.j !== block.bottomRight.j) {
        console.log(`Block normalized from (${block.topLeft.i},${block.topLeft.j})-(${block.bottomRight.i},${block.bottomRight.j}) to (${normalizedBlock.topLeft.i},${normalizedBlock.topLeft.j})-(${normalizedBlock.bottomRight.i},${normalizedBlock.bottomRight.j})`);
    }

    return normalizedBlock;
};


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

export const createSafeInitialGrid = (width: number, height: number, objects: GridObject[], ncdMatrixResponse: NCDMatrixResponse) => {
    // Process objects to ensure unique IDs as strings
    const processedObjects = objects.map(obj => ({
        ...obj,
        id: String(obj.id)
    }));

    const itemCount = processedObjects.length;
    if (itemCount < 4) {
        throw new Error("Needs at least 4 objects to create the initial grid");
    }

    console.log(`Creating grid for ${itemCount} objects`);

    // Calculate grid dimensions with slack space
    const baseWidth = Math.ceil(Math.sqrt(itemCount));
    const baseHeight = Math.ceil(itemCount / baseWidth);
    const gridWidth = (width || baseWidth);
    const gridHeight = (height || baseHeight) + 1;

    console.log(`Grid dimensions: ${gridWidth}x${gridHeight}`);

    // Create ID mappings
    const idToIndexMap: Map<string, number> = new Map();
    const indexToIdMap: Map<number, string> = new Map();
    const EMPTY_CELL_INDEX = -1;

    processedObjects.forEach((obj: GridObject, index: number) => {
        indexToIdMap.set(index, obj.id);
        idToIndexMap.set(obj.id, index);
    });

    // Initialize grid with empty cells
    const grid: number[][] = [];
    for (let i = 0; i < gridHeight; i++) {
        grid[i] = Array(gridWidth).fill(EMPTY_CELL_INDEX);
    }

    // Place first object in center
    const centerI = Math.floor(gridHeight / 2);
    const centerJ = Math.floor(gridWidth / 2);
    const firstObjectIdx = idToIndexMap.get(processedObjects[0].id);
    grid[centerI][centerJ] = firstObjectIdx !== undefined ? firstObjectIdx : EMPTY_CELL_INDEX;

    console.log(`Placed first object (index ${firstObjectIdx}) at center (${centerI},${centerJ})`);

    // Place remaining objects
    let placedCount = 1; // We've placed the first object
    let attempts = 0;
    const maxAttempts = itemCount * 10; // Avoid infinite loops

    while (placedCount < itemCount && attempts < maxAttempts) {
        attempts++;

        const visited = new Set<string>();
        const adjacentEmptyCells = getAdjacentEmptyCells(grid, visited, EMPTY_CELL_INDEX);

        if (adjacentEmptyCells.length === 0) {
            console.warn("No adjacent empty cells available. Grid connectivity constraint might prevent placing all objects.");
            break;
        }

        const randomIndex = Math.floor(Math.random() * adjacentEmptyCells.length);
        const [i, j] = adjacentEmptyCells[randomIndex];

        const nextObjectIdx = idToIndexMap.get(processedObjects[placedCount].id);
        if (nextObjectIdx !== undefined) {
            grid[i][j] = nextObjectIdx;
            placedCount++;
            console.log(`Placed object ${placedCount} (index ${nextObjectIdx}) at (${i},${j})`);
        }
    }

    if (placedCount < itemCount) {
        console.warn(`Could only place ${placedCount} out of ${itemCount} objects while maintaining connectivity`);
    } else {
        console.log(`Successfully placed all ${itemCount} objects`);
    }

    const numericNcdMatrix = ncdMatrixResponse.ncdMatrix;
    const factorMatrix = getGradualFactorMatrix(gridWidth, gridHeight);

    const gridState: GridState = {
        width: gridWidth,
        height: gridHeight,
        numericNcdMatrix,
        factorMatrix,
        emptyIndex: EMPTY_CELL_INDEX,
        grid: grid,
        idToIndexMap,
        indexToIdMap,
        objectiveValue: 0
    };

    gridState.objectiveValue = calculateObjectiveWithSlackSpace(gridState);

    return gridState;
};

export const optimizeStep = (grid: GridState, iterationCount: number): GridState => {
    const {
        initialTemperature,
        finalTemperature,
        coolingRate,
        swapsPerStep
    } = OPTIMIZE_STEP_OPTIONS;

    let currentGrid = deepCopy(grid);
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
    const {width, height, grid: gridArray, emptyIndex = -1} = grid;

    const tempGrid = gridArray.map(row => [...row]);
    [tempGrid[cell1.i][cell1.j], tempGrid[cell2.i][cell2.j]] = [tempGrid[cell2.i][cell2.j], tempGrid[cell1.i][cell1.j]];

    const needToCheck = tempGrid[cell1.i][cell1.j] === emptyIndex || tempGrid[cell2.i][cell2.j] === emptyIndex;
    if (!needToCheck) return false;

    // Find the first non-empty cell to start BFS
    let startI = -1, startJ = -1;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (tempGrid[i][j] !== emptyIndex) {
                startI = i;
                startJ = j;
                break;
            }
        }
        if (startI !== -1) break;
    }
    if (startI === -1) return false;
    let totalNonemptyCells = 0;
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (tempGrid[i][j] !== emptyIndex) {
                totalNonemptyCells++;
            }
        }
    }
    const visited = Array(height).fill(0).map(() => Array(width).fill(false));
    const queue = [[startI, startJ]];
    visited[startI][startJ] = true;
    let visitedCount = 1;
    while (queue.length > 0) {
        const [i, j] = queue.shift() as [number, number];

        const directions = [[-1, 0], [0, 1], [1, 0], [0, -1]];
        for (const [di, dj] of directions) {
            const ni = (i + di + height) % height;
            const nj = (j + dj + width) % width;

            if (ni >= 0 && ni < height && nj >= 0 && nj < width) {
                if (tempGrid[ni][nj] !== emptyIndex && !visited[ni][nj]) {
                    visited[ni][nj] = true;
                    queue.push([ni, nj]);
                    visitedCount++;
                }
            }
        }
    }
    return visitedCount !== totalNonemptyCells;
}

export const selectRandomNonEmptyCell = (grid: GridState): Position => {
    const {width, height, grid: gridArray, emptyIndex = -1} = grid;
    const nonEmptyCells: Position[] = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (gridArray[i][j] !== emptyIndex) {
                nonEmptyCells.push({i, j});
            }
        }
    }
    if (nonEmptyCells.length === 0) {
        nonEmptyCells.push({i: 0, j: 0});
    }
    const len = nonEmptyCells.length;
    const randIdx = Math.floor((Math.random() * len))
    return nonEmptyCells[randIdx];
}


export const selectRandomEmptyCell = (grid: GridState): Position => {
    const {width, height, grid: gridArray, emptyIndex = -1} = grid;
    const emptyCells: Position[] = [];
    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            if (gridArray[i][j] === emptyIndex) {
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
    const {grid, numericNcdMatrix, factorMatrix, width, height, emptyIndex} = gridState;

    if (!grid || grid.length === 0) {
        console.error("Invalid grid data in calculateObjectiveWithSlackSpace");
        return 0;
    }

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const currentIdx = grid[i][j];
            if (currentIdx === emptyIndex) continue;
            const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

            for (const [di, dj] of directions) {
                const ni = (i + di + height) % height; // wrap around
                const nj = (j + dj + width) % width;

                const neighborIdx = grid[ni][nj];
                if (neighborIdx !== emptyIndex) {
                    total += numericNcdMatrix[currentIdx][neighborIdx] * factorMatrix[i][j];
                }
            }
        }
    }
    return total;
};

export const precomputeGradualFactorMatrix = (width: number, height: number): number[][] => {
    const factorMatrix: number[][] = [];

    for (let i = 0; i < height; i++) {
        factorMatrix[i] = [];
        for (let j = 0; j < width; j++) {
            factorMatrix[i][j] = symmetryBreaker({i, j}, width, height);
        }
    }

    return factorMatrix;
}


export const calculateObjectiveWithNumericMatrix = (gridState: GridState): number => {
    let total = 0;
    const {grid, numericNcdMatrix, factorMatrix, width, height} = gridState;

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const currentIdx = grid[i][j];
            let positionNCD = 0;
            const rightJ = (j + 1) % width;
            const rightNeighborIdx = grid[i][rightJ];
            positionNCD += numericNcdMatrix[currentIdx][rightNeighborIdx];
            const downI = (i + 1) % height;
            const downNeighborIdx = grid[downI][j];
            positionNCD += numericNcdMatrix[currentIdx][downNeighborIdx];
            total += positionNCD * factorMatrix[i][j];
        }
    }
    return total;
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

export const swapCells = (grid: GridState, pos1: Position, pos2: Position): GridState => {
    console.log(`Swapping cells: (${pos1.i},${pos1.j}) with (${pos2.i},${pos2.j})`);

    // Create a completely new grid state
    const newGrid = deepCopy(grid);

    // Get the values at each position
    const value1 = grid.grid[pos1.i][pos1.j];
    const value2 = grid.grid[pos2.i][pos2.j];

    // Swap the values
    newGrid.grid[pos1.i][pos1.j] = value2;
    newGrid.grid[pos2.i][pos2.j] = value1;

    // Recalculate the objective value for the new grid
    newGrid.objectiveValue = calculateObjectiveWithSlackSpace(newGrid);

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


export const calculateObjectiveWithSymmetryBreaking = (
    gridState: GridState,
    factorMatrix: number[][],
    ncdMatrix: number[][]
): number => {
    const {grid, width, height} = gridState;
    let totalObjective = 0;

    for (let i = 0; i < height; i++) {
        for (let j = 0; j < width; j++) {
            const objIndex = grid[i][j];

            if (j < width - 1) {
                const rightIndex = grid[i][j + 1];
                const ncdValue = getNCDValue(objIndex, rightIndex, ncdMatrix);
                totalObjective += ncdValue * factorMatrix[i][j] * factorMatrix[i][j + 1];
            }

            if (i < height - 1) {
                const bottomIndex = grid[i + 1][j];
                const ncdValue = getNCDValue(objIndex, bottomIndex, ncdMatrix);
                totalObjective += ncdValue * factorMatrix[i][j] * factorMatrix[i + 1][j];
            }
        }
    }

    return totalObjective;
};


export const calculateGridSimilarity = (grid1: GridState, grid2: GridState): number => {
    if (grid1.width !== grid2.width || grid1.height !== grid2.height) {
        throw new Error("Grids must have the same dimensions to calculate similarity");
    }

    let matches = 0;
    const totalCells = grid1.height * grid1.width;
    for (let i = 0; i < grid1.height; i++) {
        for (let j = 0; j < grid1.width; j++) {
            if (grid1.grid[i][j] === grid2.grid[i][j]) {
                matches++;
            }
        }
    }
    return matches / totalCells;
}
