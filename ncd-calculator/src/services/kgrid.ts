import * as pako from 'pako';

export interface GridObject {
    id: string;
    content: string;
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
    objects: GridObject[][];
    ncdMatrix: number[][];
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


export const precomputeNCDMatrix = (objects: GridObject[]): number[][] => {
    const n = objects.length;
    const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

    // Calculate NCD for each unique pair
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const ncd = calculateNCD(objects[i], objects[j]);
            // NCD is symmetric, so store it in both positions
            matrix[i][j] = ncd;
            matrix[j][i] = ncd;
        }
        // Distance to self is 0
        matrix[i][i] = 0;
    }

    return matrix;
}

export const gradualFactor = (pos: Position): number => {
    return Math.pow((1.01 * pos.i + 1.02 * pos.j + 10), 0.1);
}

export const calculateObjective = (grid: GridState): number => {
    let total = 0;

    // horizontal neighbors
    for(let i = 0; i < grid.height; i++){
        for(let j = 0; j < grid.width; j++) {
            const right = (j + 1) % grid.width;

            const obj1 = grid.objects[i][j];
            const obj2 = grid.objects[i][right];

            const ncdValue = grid.ncdMatrix[obj1.id][obj2.id];
            const factor = gradualFactor({i, j});

            total += ncdValue * factor;
        }
    }

    // vertical neighbors
    for(let i = 0; i < grid.height; i++) {
        for(let j = 0; j < grid.width; j++) {
            const down = (i + 1) % grid.height;

            const obj1 = grid.objects[i][j];
            const obj2 = grid.objects[down][j];

            const ncdFactor = grid.ncdMatrix[obj1.id][obj2.id];
            const factor = gradualFactor({i, j});

            total += ncdFactor * factor;
        }
    }

    return total;
}

export const deepCopy = (grid: GridState): GridState => {
    const newGrid: GridState = {
        height: grid.height,
        width: grid.width,
        objectiveValue: grid.objectiveValue,
        ncdMatrix: [],
        objects: [],
    };

    newGrid.ncdMatrix = grid.ncdMatrix.map(row => [...row]);

    newGrid.objects = [];
    for(let i = 0; i < grid.height; i++) {
        newGrid.objects[i] = [];
        for(let j = 0; j < grid.width; j++) {
            newGrid.objects[i][j] = {
                id: grid.objects[i][j].id,
                content: grid.objects[i][j].content
            }
        }
    }

    return newGrid;
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

export const extractBlock = (grid: GridState, block: Block): GridObject[][] => {
    const {topLeft, bottomRight} = block;

    const blockHeight = bottomRight.i - topLeft.i + 1;
    const blockWidth = bottomRight.j - topLeft.j + 1;

    const blockContent: GridObject[][] = [];

    for(let i = 0; i < blockHeight; i++) {
        blockContent[i] = [];
        for(let j = 0; j < blockWidth; j++) {
            const gridI = topLeft.i + i;
            const gridJ = topLeft.j + j;

            if (gridI >= 0 && gridI < grid.height && gridJ >= 0 && gridJ < grid.width) {
                blockContent[i][j] = {
                    id: grid.objects[gridI][gridJ].id,
                    content: grid.objects[gridI][gridJ].content
                };
            } else {
                // Handle out-of-bounds gracefully
                console.warn(`Block coordinates out of bounds: (${gridI},${gridJ})`);
                blockContent[i][j] = {
                    id: "undefined",
                    content: "Out of bounds"
                };
            }
        }
    }

    return blockContent;
};

export const reflectHorizontally = (block: GridObject[][]): void => {
    for(let i = 0; i < block.length; i++) {
        block[i].reverse();
    }
}

export const reflectVertically = (block: GridObject[][]): void => {
    block.reverse();
}

export const placeBlock = (grid: GridState, block: Block, blockContent: GridObject[][]): void => {
    const {topLeft, bottomRight} = block;

    // copy the block content into the grid
    for(let i = 0; i < blockContent.length; i++) {
        for(let j = 0; j < blockContent[i].length; j++) {
            const gridI = topLeft.i + i;
            const gridJ = topLeft.j + j;

            // ensure the indicies are within grid bounds
            if (gridI >= 0 && gridI < grid.height && gridJ >= 0 && gridJ < grid.width) {
                grid.objects[i][j] = {
                    id: blockContent[i][j].id,
                    content: blockContent[i][j].content
                }
            }
        }
    }
}


export const isInSelectedBlock = (position: Position, selectedBlock1: Block | null, selectedBlock2: Block | null): boolean => {
    if (selectedBlock1) {
        const {topLeft,bottomRight} = selectedBlock1;
        if (position.i >= topLeft.i
        && position.i <= bottomRight.i
            && position.j >= topLeft.j
            && position.j <= bottomRight.j
        ) {
            return true;
        }
    }

    if (selectedBlock2) {
        const { topLeft, bottomRight } = selectedBlock2;
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
        topLeft: { i: startI, j: startJ },
        bottomRight: { i: startI + blockHeight - 1, j: startJ + blockWidth - 1 }
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
    const grid: GridObject[][] = [];
    let objectIndex = 0;

    for (let i = 0; i < height; i++) {
        grid[i] = [];
        for (let j = 0; j < width; j++) {
            grid[i][j] = shuffledObjects[objectIndex++];
        }
    }

    // Precompute the NCD matrix
    const ncdMatrix = precomputeNCDMatrix(objects);

    // Calculate the initial objective function value
    const initialState: GridState = {
        width,
        height,
        objects: grid,
        ncdMatrix,
        objectiveValue: 0
    };

    initialState.objectiveValue = calculateObjective(initialState);

    return initialState;
}

