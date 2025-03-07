import * as pako from 'pako';

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
    grid: string[][];
    ncdMatrix: Record<string, Record<string, number>>;
    objectiveValue: number;
}

export const calculateNCD = (obj1: GridObject, obj2: GridObject): number => {
    const str1 = obj1.content;

    const str2 = obj2.content;

    const data1 = new TextEncoder().encode(str1);
    const data2 = new TextEncoder().encode(str2);

    const combinedData = new Uint8Array(data1.length + data2.length);
    combinedData.set(data1, 0);
    combinedData.set(data2, data1.length);

    const compressed1 = pako.deflate(data1);
    const compressed2 = pako.deflate(data2);
    const compressedCombined = pako.deflate(combinedData);

    const C1 = compressed1.length;
    const C2 = compressed2.length;
    const C12 = compressedCombined.length;

    const ncd = (C12 - Math.min(C1, C2)) / Math.max(C1, C2);

    return ncd;
}


export const precomputeNCDMatrix = (objects: GridObject[]): Record<string, Record<string, number>> => {
    const matrix: Record<string, Record<string, number>> = {};

    for(const obj of objects) {
        matrix[obj.id] = {};
    }

    for(let i = 0; i < objects.length; i++) {
        const obj1 = objects[i];

        matrix[obj1.id][obj1.id] = 0;
        for(let j = i + 1; j < objects.length; j++) {
            const obj2 = objects[j];

            const ncd = calculateNCD(obj1, obj2);

            matrix[obj1.id][obj2.id] = ncd;
            matrix[obj2.id][obj1.id] = ncd;
        }
    }
    return matrix;
}

export const gradualFactor = (pos: Position): number => {
    return Math.pow((1.01 * pos.i + 1.02 * pos.j + 10), 0.1);
}

export const calculateObjective = (grid: GridState): number => {
    let total = 0;
    for (let i = 0; i < grid.height; i++) {
        for (let j = 0; j < grid.width; j++) {
            const currentId = grid.grid[i][j];
            let positionNCD = 0;

            // right neighbor
            const rightJ = (j + 1) % grid.width;
            const rightNeighborId = grid.grid[i][rightJ];
            positionNCD += grid.ncdMatrix[currentId][rightNeighborId]

            // down neighbor
            const downI = (i + 1) % grid.height;
            const downNeighborId = grid.grid[i][downI];
            positionNCD += grid.ncdMatrix[currentId][downNeighborId]

            const factor = gradualFactor({i, j});
            total += positionNCD * factor;
        }
    }
    return total;
}

export const deepCopy = (gridState: GridState): GridState => {
    const newGridState: GridState = {
        height: gridState.height,
        width: gridState.width,
        objectiveValue: gridState.objectiveValue,
        ncdMatrix: gridState.ncdMatrix,
        grid: [],
    };
    newGridState.grid = [];
    for(let i = 0; i < gridState.height; i++) {
        newGridState.grid[i] = [...gridState.grid[i]];
    }
    return newGridState;
}


export const swapBlocks = (
    grid: GridState,
    block1: Block,
    block2: Block,
    reflection: [boolean, boolean]
): GridState => {
    const newGrid = deepCopy(grid);

    const block1Content = extractBlock(grid, block1);
    const block2Content = extractBlock(grid, block2);


    if (reflection[0]) {
        reflectHorizontally(block1Content);
        reflectHorizontally(block2Content)
    }
    if (reflection[1]) {
        reflectVertically(block1Content);
        reflectVertically(block2Content);
    }

    placeBlock(newGrid, block2, block1Content);
    placeBlock(newGrid, block1, block2Content);

    newGrid.objectiveValue = calculateObjective(newGrid);
    return newGrid;
}

export const extractBlock = (grid: GridState, block: Block): string[][] => {
    const {topLeft, bottomRight} = block;

    const blockHeight = bottomRight.i - topLeft.i + 1;
    const blockWidth = bottomRight.j - topLeft.j + 1;

    const blockContent: string[][] = [];

    for (let i = 0; i < blockHeight; i++) {
        blockContent[i] = [];
        for (let j = 0; j < blockWidth; j++) {
            const gridI = topLeft.i + i;
            const gridJ = topLeft.j + j;

            blockContent[i][j] = grid.grid[gridI][gridJ];
        }
    }

    return blockContent;
};

export const reflectHorizontally = (block: string[][]): void => {
    for (let i = 0; i < block.length; i++) {
        block[i].reverse();
    }
}

export const reflectVertically = (block: string[][]): void => {
    block.reverse();
}

export const placeBlock = (grid: GridState, block: Block, blockContent: string[][]): void => {
    const {topLeft, bottomRight} = block;

    // copy the block content into the grid
    for (let i = 0; i < blockContent.length; i++) {
        for (let j = 0; j < blockContent[i].length; j++) {
            const gridI = topLeft.i + i;
            const gridJ = topLeft.j + j;

            // ensure the indicies are within grid bounds
            if (gridI >= 0 && gridI < grid.height && gridJ >= 0 && gridJ < grid.width) {
                grid.grid[gridI][gridJ] = blockContent[i][j];
            }
        }
    }
}


export const isInSelectedBlock = (position: Position, selectedBlock1: Block | null, selectedBlock2: Block | null): boolean => {
    if (selectedBlock1) {
        const {topLeft, bottomRight} = selectedBlock1;
        if (position.i >= topLeft.i
            && position.i <= bottomRight.i
            && position.j >= topLeft.j
            && position.j <= bottomRight.j
        ) {
            return true;
        }
    }

    if (selectedBlock2) {
        const {topLeft, bottomRight} = selectedBlock2;
        if (
            position.i >= topLeft.i &&
            position.i <= bottomRight.i &&
            position.j >= topLeft.j &&
            position.j <= bottomRight.j
        ) {
            return true;
        }
    }

    // Position is not in any selected block
    return false;
}


export const selectRandomBlock = (
    grid: GridState,
    minSize: number = 1,
    maxSize: number = 2
): Block => {
    // Determine random block dimensions (height and width)
    const blockHeight = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
    const blockWidth = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;

    // Ensure the block fits within the grid
    const maxStartI = grid.height - blockHeight;
    const maxStartJ = grid.width - blockWidth;

    // Select random starting position
    const startI = Math.floor(Math.random() * (maxStartI + 1));
    const startJ = Math.floor(Math.random() * (maxStartJ + 1));

    // Return the block definition
    return {
        topLeft: {i: startI, j: startJ},
        bottomRight: {i: startI + blockHeight - 1, j: startJ + blockWidth - 1}
    };
}

export const createInitialState = (
    width: number,
    height: number,
    objects: GridObject[]
): GridState => {
    // Make sure we have enough objects for the grid
    if (objects.length < width * height) {
        throw new Error(`Not enough objects (${objects.length}) for a ${width}×${height} grid`);
    }

    // Create a copy of objects to shuffle
    const shuffledObjects = [...objects];

    // Fisher-Yates shuffle algorithm to randomize the objects
    for (let i = shuffledObjects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledObjects[i], shuffledObjects[j]] = [shuffledObjects[j], shuffledObjects[i]];
    }

    // Create the initial grid arrangement
    const grid: string[][] = [];
    let objectIndex = 0;

    for (let i = 0; i < height; i++) {
        grid[i] = [];
        for (let j = 0; j < width; j++) {
            grid[i][j] = shuffledObjects[objectIndex++].id;
        }
    }

    // Precompute the NCD matrix
    const ncdMatrix = precomputeNCDMatrix(objects);

    // Calculate the initial objective function value
    const initialState: GridState = {
        width,
        height,
        grid,
        ncdMatrix,
        objectiveValue: 0
    };

    initialState.objectiveValue = calculateObjective(initialState);

    return initialState;
}

