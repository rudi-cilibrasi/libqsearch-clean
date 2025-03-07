import React, {useCallback, useEffect, useState} from "react";
import {
    Block,
    createInitialState,
    GridObject,
    GridState,
    isInSelectedBlock,
    Position, selectRandomBlock, swapBlocks
} from "@/services/kgrid.ts";


const GridCell: React.FC<{
    id: string,
    content: string,
    label: string,
    position: Position,
    onSelect: (pos: Position) => void,
    isSelected: boolean
}> = ({ content, label, position, onSelect, isSelected }) => {
    return (
        <div
            className={`grid-cell ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(position)}
            title={content}
        >
            <div className="cell-content">
                {label}
            </div>
        </div>
    );
};

export const KGridNCD: React.FC<{
    width?: number,
    height?: number,
    objects?: GridObject[]
}> = ({
          width = 3,
          height = 3,
          objects = [
              // Default sample objects if none provided
              { id: "0", label: "Lion", content: "Lions are large cats that live in Africa." },
              { id: "1", label: "Tiger", content: "Tigers are striped cats from Asia." },
              { id: "2", label: "Dog", content: "Dogs are loyal pets with keen senses." },
              { id: "3", label: "Wolf", content: "Wolves are wild canines that live in packs." },
              { id: "4", label: "Dolphin", content: "Dolphins are intelligent marine mammals." },
              { id: "5", label: "Shark", content: "Sharks are predatory fish with cartilage skeletons." },
              { id: "6", label: "Eagle", content: "Eagles are birds of prey with sharp vision." },
              { id: "7", label: "Penguin", content: "Penguins are flightless birds that swim." },
              { id: "8", label: "Frog", content: "Frogs are amphibians that start life in water." }
          ]
      }) => {
    // State hooks
    const [gridState, setGridState] = useState<GridState>(() =>
        createInitialState(width, height, objects)
    );
    const [selectedBlock1, setSelectedBlock1] = useState<Block | null>(null);
    const [selectedBlock2, setSelectedBlock2] = useState<Block | null>(null);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
    const [optimizationSteps, setOptimizationSteps] = useState<number>(0);
    const [horizontalReflection, setHorizontalReflection] = useState<boolean>(false);
    const [verticalReflection, setVerticalReflection] = useState<boolean>(false);
    const [temperature, setTemperature] = useState<number>(1.0);

    // Handle cell selection for block definition
    const handleCellSelect = (pos: Position) => {
        if (!selectedBlock1) {
            // First click - start defining first block
            setSelectedBlock1({
                topLeft: pos,
                bottomRight: pos
            });
        } else if (!selectedBlock2) {
            // Second click - complete first block and start second block
            // If clicked inside first block, expand it
            if (isInSelectedBlock(pos, selectedBlock1, null)) {
                setSelectedBlock1({
                    topLeft: {
                        i: Math.min(selectedBlock1.topLeft.i, pos.i),
                        j: Math.min(selectedBlock1.topLeft.j, pos.j)
                    },
                    bottomRight: {
                        i: Math.max(selectedBlock1.bottomRight.i, pos.i),
                        j: Math.max(selectedBlock1.bottomRight.j, pos.j)
                    }
                });
            } else {
                // Start defining second block
                setSelectedBlock2({
                    topLeft: pos,
                    bottomRight: pos
                });
            }
        } else {
            // Third click - complete second block
            if (isInSelectedBlock(pos, null, selectedBlock2)) {
                setSelectedBlock2({
                    topLeft: {
                        i: Math.min(selectedBlock2.topLeft.i, pos.i),
                        j: Math.min(selectedBlock2.topLeft.j, pos.j)
                    },
                    bottomRight: {
                        i: Math.max(selectedBlock2.bottomRight.i, pos.i),
                        j: Math.max(selectedBlock2.bottomRight.j, pos.j)
                    }
                });
            } else {
                // Reset block selection and start over
                setSelectedBlock1({
                    topLeft: pos,
                    bottomRight: pos
                });
                setSelectedBlock2(null);
            }
        }
    };

    // Perform a manual block swap when both blocks are selected
    const performBlockSwap = () => {
        if (selectedBlock1 && selectedBlock2) {
            const reflection: [boolean, boolean] = [horizontalReflection, verticalReflection];
            const newGrid = swapBlocks(gridState, selectedBlock1, selectedBlock2, reflection);
            setGridState(newGrid);
            setSelectedBlock1(null);
            setSelectedBlock2(null);
        }
    };

    // Reset block selection
    const resetSelection = () => {
        setSelectedBlock1(null);
        setSelectedBlock2(null);
    };

    // Perform a single optimization step
    const optimizeStep = useCallback(() => {
        // Select random blocks
        const block1 = selectRandomBlock(gridState);
        const block2 = selectRandomBlock(gridState);

        // Random reflection
        const reflection: [boolean, boolean] = [
            Math.random() > 0.5,
            Math.random() > 0.5
        ];

        // Try swap
        const newGrid = swapBlocks(gridState, block1, block2, reflection);

        // Calculate acceptance probability using simulated annealing approach
        const delta = newGrid.objectiveValue - gridState.objectiveValue;
        const acceptanceProbability = delta <= 0 ? 1 : Math.exp(-delta / temperature);

        // Accept or reject based on probability
        if (Math.random() < acceptanceProbability) {
            setGridState(newGrid);
        }

        // Decrease temperature
        setTemperature(Math.max(0.01, temperature * 0.99));

        // Increment step counter
        setOptimizationSteps(prev => prev + 1);
    }, [gridState, temperature]);

    // Start/stop automatic optimization
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (isOptimizing) {
            timer = setInterval(() => {
                optimizeStep();
            }, 100);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isOptimizing, optimizeStep]);

    // Toggle optimization
    const toggleOptimization = () => {
        setIsOptimizing(!isOptimizing);
    };

    // Reset the grid to a new random arrangement
    const resetGrid = () => {
        setGridState(createInitialState(width, height, objects));
        setSelectedBlock1(null);
        setSelectedBlock2(null);
        setOptimizationSteps(0);
        setTemperature(1.0);
    };

    const gridObjects: Record<string, GridObject> = {}
    objects.forEach(object => {
        gridObjects[object.id] = object;
    })


    return (
        <div className="k-grid-container">
            <div className="control-panel">
                <h2>K-Grid NCD Optimization</h2>

                <div className="objective-display">
                    <h3>Objective Value: {gridState.objectiveValue.toFixed(4)}</h3>
                    <p>Lower values indicate better arrangement</p>
                </div>

                <div className="optimization-controls">
                    <h3>Optimization</h3>
                    <button
                        onClick={toggleOptimization}
                        className={isOptimizing ? 'active' : ''}
                    >
                        {isOptimizing ? 'Stop Optimization' : 'Start Optimization'}
                    </button>
                    <button onClick={optimizeStep} disabled={isOptimizing}>
                        Single Step
                    </button>
                    <button onClick={resetGrid}>
                        Reset Grid
                    </button>
                    <div>Steps: {optimizationSteps}</div>
                    <div>Temperature: {temperature.toFixed(3)}</div>
                </div>

                <div className="selection-controls">
                    <h3>Manual Block Swap</h3>
                    <p>
                        {!selectedBlock1
                            ? 'Click to select first block'
                            : !selectedBlock2
                                ? 'Click to select second block'
                                : 'Both blocks selected. Use controls to swap.'}
                    </p>

                    <div className="reflection-options">
                        <label>
                            <input
                                type="checkbox"
                                checked={horizontalReflection}
                                onChange={e => setHorizontalReflection(e.target.checked)}
                            />
                            Horizontal Reflection
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={verticalReflection}
                                onChange={e => setVerticalReflection(e.target.checked)}
                            />
                            Vertical Reflection
                        </label>
                    </div>

                    <div className="action-buttons">
                        <button
                            onClick={performBlockSwap}
                            disabled={!selectedBlock1 || !selectedBlock2}
                        >
                            Swap Blocks
                        </button>
                        <button onClick={resetSelection}>
                            Reset Selection
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="grid"
                style={{
                    gridTemplateColumns: `repeat(${gridState.width}, 1fr)`,
                    gridTemplateRows: `repeat(${gridState.height}, 1fr)`
                }}
            >
                {Array.from({ length: gridState.height }, (_, i) => (
                    Array.from({ length: gridState.width }, (_, j) => (
                        <GridCell
                            key={`${i}-${j}`}
                            content={gridObjects[gridState.grid[i][j]].content}
                            label={gridObjects[gridState.grid[i][j]].label}
                            position={{ i, j }}
                            onSelect={handleCellSelect}
                            isSelected={isInSelectedBlock({ i, j }, selectedBlock1, selectedBlock2)}
                         id={gridState.grid[i][j]}
                        />
                    ))
                ))}
            </div>

            <div className="explanation">
                <h3>How It Works</h3>
                <p>
                    This visualization arranges objects in a grid to minimize the Normalized Compression Distance (NCD)
                    between neighboring items. Similar items are placed close together.
                </p>
                <p>
                    The objective function calculates the sum of NCD values between all neighbors,
                    weighted by a gradual factor that breaks symmetry in the grid.
                </p>
                <p>
                    Block swapping with optional reflection allows exploration of different arrangements to find the optimal one.
                </p>
            </div>
        </div>
    );
};
