import {deflate} from "pako";
import {NCDMatrixResponse} from "@/types/ncd.ts";
import {LabelManager} from "@/functions/labelUtils.ts";

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
    for(let i = 0; i < height; i++) {
        factorMatrix[i] = [];
        for(let j = 0; j < width; j++) {
            factorMatrix[i][j] = gradualFactor({i, j}, width, height);
        }
    }
    return factorMatrix;
}

export const gradualFactor = (pos: Position, width: number, height: number): number => {
    // Normalize position coordinates to [0,1] range
    const normalizedI = pos.i / (height - 1);
    const normalizedJ = pos.j / (width - 1);

    // Create a two-component symmetry breaker:
    // 1. Primary gradient: exponential increase toward bottom-right with different coefficients
    // 2. Secondary pattern: subtle sinusoidal variation to break additional symmetries

    // Base component with carefully calibrated parameters
    const baseGradient = 1.15 + 0.25 * normalizedI + 0.35 * normalizedJ;

    // Subtle secondary pattern to break remaining symmetries
    const secondaryPattern = 0.03 * Math.sin(normalizedI * 3.14) * Math.sin(normalizedJ * 2.71);

    // Combine components with carefully chosen exponent (0.4)
    // - Higher than 0.2 (your original) for more differentiation
    // - Lower than 0.6 to avoid overwhelming the NCD relationships
    return Math.pow(baseGradient + secondaryPattern, 0.4);
};


export const deepCopy = (gridState: GridState): GridState => {
    const newGrid: number[][] = [];
    for(let i = 0; i < gridState.height; i++) {
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
        idToIndexMap: newIdToIndexMap
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


export const createGridObjectsFromMatrixResponse = (ncdMatrixResponse: NCDMatrixResponse, labelManager: LabelManager) : GridObject[] => {
    const {labels, ncdMatrix} = ncdMatrixResponse;
    const displayLabel = (label: string) => {
        const fullLabel = labelManager.getDisplayLabel(label) || 'Unknown';
        return fullLabel.length > 15 ? fullLabel.substring(0, Math.min(15, fullLabel.length)) + '...' : fullLabel;
    }
    return labels.map((label, index) => ({
        id: label,
        label: displayLabel(label),
        content: ncdMatrix[index]
    }));

}


export const createSafeInitialGrid = (width: number, height: number, objects: GridObject[], ncdMatrixResponse: NCDMatrixResponse) => {
    // Process objects to ensure unique IDs as strings
    const processedObjects = objects.map(obj => ({
        ...obj,
        id: String(obj.id)
    }));

    // Filter to unique objects
    const uniqueIdsMap = new Map();
    processedObjects.forEach(object => {
        if (!uniqueIdsMap.has(object.id)) {
            uniqueIdsMap.set(object.id, object);
        }
    });
    const uniqueObjects = Array.from(uniqueIdsMap.values());

    // Calculate optimal grid dimensions based on actual number of objects
    const itemCount = uniqueObjects.length;

    // Adjust width and height based on available objects
    const optimalWidth = Math.ceil(Math.sqrt(itemCount));
    const optimalHeight = Math.ceil(itemCount / optimalWidth);

    // Use provided dimensions or calculate optimal ones
    const gridWidth = width || optimalWidth;
    const gridHeight = height || optimalHeight;

    // Ensure minimum viable grid size
    if (itemCount < 4) {
        throw new Error(`Need at least 4 unique objects, found only ${itemCount}`);
    }

    // Create mappings between string IDs and numeric indices
    const idToIndexMap = new Map<string, number>();
    const indexToIdMap = new Map<number, string>();
    uniqueObjects.forEach((obj, index) => {
        idToIndexMap.set(obj.id, index);
        indexToIdMap.set(index, obj.id);
    });

    // Shuffle objects for random initial placement
    const shuffledObjects = [...uniqueObjects];
    for (let i = shuffledObjects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledObjects[i], shuffledObjects[j]] = [shuffledObjects[j], shuffledObjects[i]];
    }

    // Select objects needed for the grid, up to grid capacity
    const cellCount = gridWidth * gridHeight;
    const selected = shuffledObjects.slice(0, Math.min(itemCount, cellCount));

    // Fill grid with selected objects, repeating if necessary
    const grid: number[][] = [];
    let index = 0;

    for (let i = 0; i < gridHeight; i++) {
        grid[i] = [];
        for (let j = 0; j < gridWidth; j++) {
            // If we have more cells than objects, cycle through objects
            const objIndex = index % selected.length;
            const obj = selected[objIndex];
            grid[i][j] = idToIndexMap.get(obj.id)!;
            index++;
        }
    }

    // Create and return grid state
    const numericNcdMatrix = ncdMatrixResponse.ncdMatrix;
    const factorMatrix = precomputeGradualFactorMatrix(gridWidth, gridHeight);

    const gridState = {
        width: gridWidth,
        height: gridHeight,
        grid,
        numericNcdMatrix,
        idToIndexMap,
        indexToIdMap,
        factorMatrix,
        objectiveValue: 0
    };

    gridState.objectiveValue = calculateObjectiveWithNumericMatrix(gridState);
    console.log(`Created initial grid ${gridWidth}×${gridHeight} with ${itemCount} unique objects`);

    return gridState;
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
    const { grid, numericNcdMatrix, factorMatrix, width, height } = gridState;

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


export const optimizeStep = (grid: GridState, iterationCount: number): GridState => {
    const {
        initialTemperature,
        finalTemperature,
        coolingRate,
        swapsPerStep
    } = OPTIMIZE_STEP_OPTIONS;

    // Create a completely new grid state to ensure immutability
    let currentGrid = deepCopy(grid);

    // Calculate current temperature based on iteration count
    const temperature = initialTemperature * Math.pow(coolingRate, iterationCount);
    const inExploitationMode = temperature <= finalTemperature;

    // Determine how many swaps to attempt this step
    const actualSwaps = inExploitationMode ? 1 : swapsPerStep;

    // Attempt swaps
    for (let i = 0; i < actualSwaps; i++) {
        const cell1 = selectRandomCell(currentGrid);
        const cell2 = selectRandomCell(currentGrid);

        // Skip if trying to swap a cell with itself
        if (cell1.i === cell2.i && cell1.j === cell2.j) {
            continue;
        }

        // Create a completely new grid with the proposed swap
        const proposedGrid = swapCells(currentGrid, cell1, cell2);

        // Calculate the change in objective function
        const delta = proposedGrid.objectiveValue - currentGrid.objectiveValue;

        // Accept or reject the swap based on simulated annealing rules
        const acceptanceProbability = delta <= 0 ? 1 : Math.exp(-delta / temperature);

        if (Math.random() < acceptanceProbability) {
            // Accept the swap - replace the current grid with the swapped version
            currentGrid = proposedGrid;
            console.log(`[Iteration ${iterationCount}] Accepted swap at (${cell1.i},${cell1.j})⟷(${cell2.i},${cell2.j}), new objective: ${currentGrid.objectiveValue.toFixed(6)}`);
        }
    }

    // Log progress periodically
    if (iterationCount % 100 === 0) {
        console.log(`[Iteration ${iterationCount}] Temperature: ${temperature.toFixed(6)}, Objective: ${currentGrid.objectiveValue.toFixed(6)}`);
    }

    // Return the new grid state (always a different object from the input)
    return currentGrid;
};

// Updated swapCells function to ensure it returns a completely new object
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
    newGrid.objectiveValue = calculateObjectiveWithNumericMatrix(newGrid);

    console.log(`Swapped ${value1} at (${pos1.i},${pos1.j}) with ${value2} at (${pos2.i},${pos2.j})`);
    console.log(`New objective value: ${newGrid.objectiveValue.toFixed(6)}`);

    return newGrid;
}

const SYMMETRY_BREAKER_OPTIONS = {
    alpha : 0.25,        // Primary gradient i-coefficient
    beta : 0.35,         // Primary gradient j-coefficient
    baseValue : 1.15,    // Base value to ensure positive factors
    varAmplitude1 : 0.03, // Primary variation amplitude
    varAmplitude2 : 0.02, // Secondary variation amplitude
    varFreq1 : Math.PI,  // Primary variation frequency
    varFreq2 : 2.71,     // Secondary variation frequency (using e for irrationality)
    powerFactor : 0.4    // Power to control overall effect magnitude
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
    const { grid, width, height } = gridState;
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
    for(let i = 0; i < grid1.height; i++) {
        for(let j = 0; j < grid1.width; j++) {
            if (grid1.grid[i][j] === grid2.grid[i][j]) {
                matches++;
            }
        }
    }
    console.log('matches now: ' + matches);
    console.log('matches/total cells: ' + (matches/totalCells));
    return matches / totalCells;
}
