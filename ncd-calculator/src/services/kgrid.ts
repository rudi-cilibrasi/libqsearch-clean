import {deflate} from "pako";

export interface GridObject {
    id: string;
    content: string;
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
    ncdMatrix: Record<string, Record<string, number>>;
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

export const precomputeNCDMatrix = (
    objects: GridObject[]
): Record<string, Record<string, number>> => {
    const matrix: Record<string, Record<string, number>> = {};

    for (const obj of objects) {
        matrix[obj.id] = {};
    }

    for (let i = 0; i < objects.length; i++) {
        const obj1 = objects[i];

        matrix[obj1.id][obj1.id] = 0;

        for (let j = i + 1; j < objects.length; j++) {
            const obj2 = objects[j];

            const ncd = calculateNCD(obj1.content, obj2.content);

            matrix[obj1.id][obj2.id] = ncd;
            matrix[obj2.id][obj1.id] = ncd;
        }
    }

    return matrix;
}


export const createGradualFactorMatrix = (width: number, height: number): number[][] => {
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

export const calculateObjective = (grid: GridState): number => {
    let total = 0;

    for (let i = 0; i < grid.height; i++) {
        for (let j = 0; j < grid.width; j++) {
            const currentId = grid.grid[i][j];
            let positionNCD = 0;

            const rightJ = (j + 1) % grid.width;
            const rightNeighborId = grid.grid[i][rightJ];

            positionNCD += grid.ncdMatrix[currentId][rightNeighborId];

            const downI = (i + 1) % grid.height;
            const downNeighborId = grid.grid[downI][j];
            positionNCD += grid.ncdMatrix[currentId][downNeighborId];

            const factor = gradualFactor({i, j}, grid.width, grid.height);
            total += positionNCD * factor;

        }
    }
    return total;
}

export const deepCopy = (gridState: GridState): GridState => {
    const newGrid: number[][] = [];

    for (let i = 0; i < gridState.height; i++) {
        newGrid[i] = [];
        for (let j = 0; j < gridState.width; j++) {
            newGrid[i][j] = gridState.grid[i][j];
        }
    }
    return {
        width: gridState.width,
        height: gridState.height,
        ncdMatrix: gridState.ncdMatrix,
        grid: newGrid,
        objectiveValue: gridState.objectiveValue
    }
}

export const extractBlock = (grid: GridState, block: Block): number[][] => {
    // Normalize the block to ensure proper coordinates
    const normalizedBlock = normalizeBlock(block, grid.height, grid.width);
    const {topLeft, bottomRight} = normalizedBlock;

    // Calculate exact dimensions
    const blockHeight = bottomRight.i - topLeft.i + 1;
    const blockWidth = bottomRight.j - topLeft.j + 1;

    console.log(`Extracting block with dimensions ${blockWidth}×${blockHeight}`);

    // Create a properly sized array
    const blockContent: number[][] = Array(blockHeight).fill(null)
        .map(() => Array(blockWidth).fill(-1));

    // Fill the array with grid content
    for (let i = 0; i < blockHeight; i++) {
        for (let j = 0; j < blockWidth; j++) {
            // Apply toroidal wraparound properly
            const gridI = (topLeft.i + i) % grid.height;
            const gridJ = (topLeft.j + j) % grid.width;

            blockContent[i][j] = grid.grid[gridI][gridJ];
        }
    }

    console.log(`Extracted block content ${blockHeight}×${blockWidth}:`,
        JSON.stringify(blockContent));
    return blockContent;
}
export const reflectHorizontally = (block: string[][]): void => {
    if (!block || block.length === 0) return;

    for (let i = 0; i < block.length; i++) {
        if (Array.isArray(block[i])) {
            block[i].reverse();
        }
    }
}

export const reflectVertically = (block: string[][]): void => {
    if (!block || block.length === 0) return;
    block.reverse();
}

export const placeBlock = (grid: GridState, block: Block, blockContent: number[][]): void => {
    // Normalize the block to ensure proper coordinates
    const normalizedBlock = normalizeBlock(block, grid.height, grid.width);
    const {topLeft, bottomRight} = normalizedBlock;

    // Calculate expected dimensions
    const expectedHeight = bottomRight.i - topLeft.i + 1;
    const expectedWidth = bottomRight.j - topLeft.j + 1;

    // Get actual dimensions from content
    const actualHeight = blockContent.length;
    const actualWidth = actualHeight > 0 ? blockContent[0].length : 0;

    console.log(`Placing block: expected ${expectedWidth}×${expectedHeight}, actual ${actualWidth}×${actualHeight}`);

    // Critical check: if dimensions don't match, we need to handle it properly
    if (expectedHeight !== actualHeight || expectedWidth !== actualWidth) {
        console.warn(`Block dimension mismatch: expected ${expectedWidth}×${expectedHeight}, got ${actualWidth}×${actualHeight}`);

        // Approach 1: Resize the block to match content (preferable)
        const adjustedBlock = {
            topLeft: normalizedBlock.topLeft,
            bottomRight: {
                i: normalizedBlock.topLeft.i + actualHeight - 1,
                j: normalizedBlock.topLeft.j + actualWidth - 1
            }
        };

        // Update our working block to the adjusted one
        Object.assign(normalizedBlock, adjustedBlock);
    }

    // Now place the content, using the actual dimensions from blockContent
    for (let i = 0; i < blockContent.length; i++) {
        for (let j = 0; j < blockContent[i].length; j++) {
            // Apply toroidal wraparound
            const gridI = (topLeft.i + i) % grid.height;
            const gridJ = (topLeft.j + j) % grid.width;

            // Ensure we're within grid bounds (defensive programming)
            if (gridI >= 0 && gridI < grid.height && gridJ >= 0 && gridJ < grid.width) {
                grid.grid[gridI][gridJ] = blockContent[i][j];
            } else {
                console.error(`Invalid grid position (${gridI},${gridJ}) when placing block`);
            }
        }
    }
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


export const createSafeInitialGrid = (width: number, height: number, objects: GridObject[]) => {

    const processedObjects = objects.map(object => ({
        ...object,
        id: object.id
    }))

    const uniqueIdsMap = new Map();
    processedObjects.forEach(object => {
        if (!uniqueIdsMap.has(object.id)) {
            uniqueIdsMap.set(object.id, object);
        }
    })

    const uniqueObjects = Array.from(uniqueIdsMap.values());
    if (uniqueObjects.length < width * height) {
        throw new Error(`Not enough unique objects (${uniqueObjects.length}) for a ${width}×${height} grid`);
    }

    const shuffledObjects = [...uniqueObjects];
    for (let i = shuffledObjects.length - 1; i >= 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledObjects[i], shuffledObjects[j]] = [shuffledObjects[j], shuffledObjects[i]];
    }

    const selected = shuffledObjects.slice(0, width * height);
    const grid: number[][] = [];

    let index = 0;
    for (let i = 0; i < height; i++) {
        grid[i] = [];
        for (let j = 0; j < width; j++) {
            grid[i][j] = index;
            index++;
        }
    }
    const rows = grid.map((row, i) => {
        return `Row ${i}:` + row.join(", ");
    });
    console.log("Created initial grid with IDs: " + rows);


    const ncdMatrix = precomputeNCDMatrix(objects);
    const factorMatrix = createGradualFactorMatrix(width, height);

    const gridState = {
        width, height, grid, ncdMatrix, objectiveValue: 0
    }

    gridState.objectiveValue = calculateObjectiveWithSymmetryBreaking(gridState, factorMatrix);
    return gridState;
}

export const selectRandomCell = (grid: GridState): Position => {
    const i = Math.floor(Math.random() * grid.height);
    const j = Math.floor(Math.random() * grid.width);

    console.log(`Selected random cell at position (${i},${j})`);
    return {i, j};
}


export const swapCells = (grid: GridState, pos1: Position, pos2: Position): GridState => {
    console.log(`Swapping cells: (${pos1.i},${pos1.j}) with (${pos2.i},${pos2.j})`);

    const newGrid = deepCopy(grid);
    const value1 = grid.grid[pos1.i][pos1.j];
    const value2 = grid.grid[pos2.i][pos2.j];

    newGrid.grid[pos1.i][pos1.j] = value2;
    newGrid.grid[pos2.i][pos2.j] = value1;

    console.log(`Swapped ${value1} at (${pos1.i},${pos1.j}) with ${value2} at (${pos2.i},${pos2.j})`);
    newGrid.objectiveValue = calculateObjective(newGrid);
    return newGrid;
}


const OPTIMIZE_STEP_OPTIONS = {
    initialTemperature: 10.0,  // Starting temperature (higher = more exploration)
    finalTemperature: 0.00,    // Final temperature
    coolingRate: 0.9999,       // Cooling rate per iteration (slower = better results)
    swapsPerStep: 1,           // Number of swaps to try per step
}

export const optimizeStep = (grid: GridState, iterationCount: number, bestGrid: GridState | null, factorMatrix: number[][]): GridState => {
    const {
        initialTemperature,
        finalTemperature,
        coolingRate,
        swapsPerStep
    } = OPTIMIZE_STEP_OPTIONS;

    const newGrid = deepCopy(grid);
    const temperature = initialTemperature * Math.pow(coolingRate, iterationCount);
    const inExploitationMode = temperature <= finalTemperature;

    const actualSwaps = inExploitationMode ? 1 : swapsPerStep;
    let bestSwapGrid = newGrid;

    for (let i = 0; i < actualSwaps; i++) {
        const cell1 = selectRandomCell(bestSwapGrid);
        const cell2 = selectRandomCell(bestSwapGrid);

        if (cell1.i === cell2.i && cell1.j === cell2.j) {
            continue;
        }

        const swapped = swapCells(bestSwapGrid, cell1, cell2);
        const delta = swapped.objectiveValue - newGrid.objectiveValue;

        const acceptanceProbability = delta <= 0 ? 1 : Math.exp(-delta / temperature);

        if (Math.random() < acceptanceProbability) {
            if (swapped.objectiveValue < bestSwapGrid.objectiveValue) {
                bestSwapGrid = swapped;
            }
        }
    }

    if (iterationCount % 1000 === 0) {
        console.log(`[Iteration ${iterationCount}] Temperature: ${temperature.toFixed(6)}, Objective: ${bestSwapGrid.objectiveValue.toFixed(6)}`);
    }

    return bestSwapGrid;
}

export const calculateObjectiveWithSymmetryBreaking = (grid: GridState, factorMatrix: number[][]): number => {
    let total = 0;
    for(let i = 0; i < grid.height; i++) {
        for(let j = 0; j < grid.width; j++) {
            let positionNCD = 0;
            const currentId = grid.grid[i][j];
            const rightJ = (j + 1) % grid.width;
            const rightNeighborId = grid.grid[i][rightJ];
            if (grid.grid[i][j] !== -1 && grid.grid[i][rightJ] !== -1) {
                positionNCD += grid.ncdMatrix[currentId][rightNeighborId];
            }

            const downI = (i + 1) % grid.height;
            const downNeighborId = grid.grid[downI][j];
            if (grid.grid[i][j] !== -1 && grid.grid[downI][j] !== -1) {
                positionNCD += grid.ncdMatrix[currentId][downNeighborId];
            }
            total += positionNCD * factorMatrix[i][j];
        }
    }
    return total;
}
