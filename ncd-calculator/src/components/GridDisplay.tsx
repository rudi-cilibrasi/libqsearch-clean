import React, {useEffect, useMemo, useRef, useState} from "react";
import {GridState} from "@/datastructures/kgrid.ts";

interface GridDisplayProps {
    grid: GridState;
    objectsById: Record<string, { label: string; content: number[] }>;
    iterations: number;
    iterationsPerSecond?: number;
    colorTheme?: string;
    onCellSelect?: (objectId: string, i: number, j: number) => void;
    cellDimensions?: { width: string; height: string };
    showEmptyCells?: boolean;
    fitToContainer?: boolean;
    clusterThreshold?: number;
    highlightCells?: { i: number, j: number }[];
}

interface ClusterInfo {
    clusterId: number;
    memberCount: number;
    color: string;
}

// Get colorblind-friendly colors
const getColorblindFriendlyColor = (index: number) => {
    const colorblindPalette = [
        '#cce6ff', '#dae8c3', '#f2dfeb', '#f4e1d2', '#e0e0e0',
        '#f9e8c9', '#deebf7', '#e2e2f0', '#edf8fb', '#fde9e0'
    ];
    return colorblindPalette[index % colorblindPalette.length];
};

export const GridDisplay: React.FC<GridDisplayProps> = ({
                                                            grid,
                                                            objectsById,
                                                            iterations,
                                                            colorTheme = "scientific",
                                                            onCellSelect,
                                                            showEmptyCells = true,
                                                            fitToContainer = true,
                                                            clusterThreshold = 0.25,
                                                            highlightCells = [],
                                                        }) => {
    const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>(null);
    const [zoomedCell, setZoomedCell] = useState<{ i: number; j: number } | null>(null);
    const [zoomedCluster, setZoomedCluster] = useState<number | null>(null);
    const [containerDimensions, setContainerDimensions] = useState({width: 0, height: 0});
    const [activeHighlights, setActiveHighlights] = useState<{ i: number, j: number }[]>([]);
    const [showClusterInfo, setShowClusterInfo] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);

    const containerRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Handle empty cells
    const EMPTY_CELL_INDEX = grid.emptyIndex || -1;

    // Helper function to get grid value at position (i,j)
    const getGridValue = (i: number, j: number): number => {
        return grid.grid[i][j];
    };

    // Update active highlights when the prop changes
    useEffect(() => {
        if (highlightCells && highlightCells.length > 0) {
            setActiveHighlights(highlightCells);

            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }

            highlightTimerRef.current = setTimeout(() => {
                setActiveHighlights([]);
            }, 1500);
        }

        return () => {
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, [highlightCells]);

    // Use ResizeObserver for reliable container size tracking
    useEffect(() => {
        if (fitToContainer && containerRef.current) {
            const updateDimensions = () => {
                if (containerRef.current) {
                    const {width, height} = containerRef.current.getBoundingClientRect();
                    setContainerDimensions({width, height});
                }
            };

            updateDimensions();

            if (!resizeObserverRef.current) {
                resizeObserverRef.current = new ResizeObserver(updateDimensions);
                resizeObserverRef.current.observe(containerRef.current);
            }

            window.addEventListener('resize', updateDimensions);

            return () => {
                if (resizeObserverRef.current) {
                    resizeObserverRef.current.disconnect();
                    resizeObserverRef.current = null;
                }
                window.removeEventListener('resize', updateDimensions);
            };
        }
    }, [fitToContainer]);

    // Identify clusters using NCD matrix
    const clusterInfo = useMemo(() => {
        if (!grid || !grid.numericNcdMatrix) return new Map<number, ClusterInfo>();

        const itemClusters = new Map<number, number>();
        const clusters = new Map<number, ClusterInfo>();
        let currentClusterId = 0;

        const areSimilar = (idx1: number, idx2: number) => {
            if (idx1 === EMPTY_CELL_INDEX || idx2 === EMPTY_CELL_INDEX) return false;
            return grid.numericNcdMatrix[idx1][idx2] < clusterThreshold;
        };

        for (let i = 0; i < grid.height; i++) {
            for (let j = 0; j < grid.width; j++) {
                const itemIdx = grid.grid[i][j];
                if (itemIdx === EMPTY_CELL_INDEX) continue;
                if (itemClusters.has(itemIdx)) continue;

                const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                let assignedToExistingCluster = false;

                for (const [di, dj] of directions) {
                    const ni = (i + di + grid.height) % grid.height;
                    const nj = (j + dj + grid.width) % grid.width;
                    const neighborIdx = grid.grid[ni][nj];

                    if (neighborIdx === EMPTY_CELL_INDEX) continue;

                    if (itemClusters.has(neighborIdx) && areSimilar(itemIdx, neighborIdx)) {
                        const neighborCluster = itemClusters.get(neighborIdx)!;
                        itemClusters.set(itemIdx, neighborCluster);
                        const cluster = clusters.get(neighborCluster)!;
                        cluster.memberCount++;
                        assignedToExistingCluster = true;
                        break;
                    }
                }

                if (!assignedToExistingCluster) {
                    itemClusters.set(itemIdx, currentClusterId);

                    const h = (currentClusterId * 137) % 360;
                    const s = 70 + (currentClusterId % 3) * 10;
                    const l = 65 + (currentClusterId % 5) * 5;

                    clusters.set(currentClusterId, {
                        clusterId: currentClusterId,
                        memberCount: 1,
                        color: colorTheme === "scientific"
                            ? `hsl(${h}, ${s}%, ${l}%)`
                            : getColorblindFriendlyColor(currentClusterId)
                    });

                    currentClusterId++;
                }
            }
        }

        const itemToClusterInfo = new Map<number, ClusterInfo>();
        for (const [itemIdx, clusterId] of itemClusters.entries()) {
            itemToClusterInfo.set(itemIdx, clusters.get(clusterId)!);
        }

        return itemToClusterInfo;
    }, [grid, EMPTY_CELL_INDEX, clusterThreshold, colorTheme]);

    // Get a list of items in the selected cluster
    const clusterItems = useMemo(() => {
        if (zoomedCluster === null || !grid) return [];

        const items: { i: number, j: number, id: string, label: string }[] = [];

        for (let i = 0; i < grid.height; i++) {
            for (let j = 0; j < grid.width; j++) {
                const itemIdx = grid.grid[i][j];

                if (itemIdx !== EMPTY_CELL_INDEX) {
                    const clusterData = clusterInfo.get(itemIdx);
                    if (clusterData && clusterData.clusterId === zoomedCluster) {
                        const objectId = grid.indexToIdMap.get(itemIdx) || '';
                        const object = objectsById[objectId];

                        items.push({
                            i, j,
                            id: objectId,
                            label: object?.label || 'Unknown'
                        });
                    }
                }
            }
        }

        return items;
    }, [zoomedCluster, grid, clusterInfo, objectsById, EMPTY_CELL_INDEX]);

    // Function to zoom in
    const zoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.2, 3));
    };

    // Function to zoom out
    const zoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
    };

    // Function to reset zoom
    const resetZoom = () => {
        setZoomLevel(1);
    };

    // Handle cell click
// Handle cell click
    const handleCellClick = (indexId: number, i: number, j: number) => {
        // Skip handling if clicking on an empty cell when they're not shown
        if (indexId === EMPTY_CELL_INDEX && !showEmptyCells) return;

        // Always update the selected cell state
        setSelectedCell({i, j});

        // Toggle zoomed state if clicking the same cell again
        if (zoomedCell?.i === i && zoomedCell?.j === j) {
            setZoomedCell(null);
            setZoomedCluster(null);
            setShowClusterInfo(false);
        } else {
            // Set new zoomed cell
            setZoomedCell({i, j});

            // Get and set cluster information
            const clusterData = clusterInfo.get(indexId);
            if (clusterData) {
                setZoomedCluster(clusterData.clusterId);
                setShowClusterInfo(true);
            } else {
                setZoomedCluster(null);
                setShowClusterInfo(false);
            }
        }

        // Always call the cell select callback if provided
        const objectId = grid.indexToIdMap.get(indexId);
        if (objectId && onCellSelect) {
            onCellSelect(objectId, i, j);
        }
    };

    // Check if two adjacent cells are highly similar
    const areSimilarCells = (i1: number, j1: number, i2: number, j2: number) => {
        if (!grid || !grid.numericNcdMatrix) return false;

        const idx1 = getGridValue(i1, j1);
        const idx2 = getGridValue(i2, j2);

        if (idx1 === EMPTY_CELL_INDEX || idx2 === EMPTY_CELL_INDEX) return false;
        return grid.numericNcdMatrix[idx1][idx2] < clusterThreshold;
    };

    // Early return if grid data isn't available
    if (!grid || !grid.grid || grid.grid.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
                Loading grid data...
            </div>
        );
    }

    // Check if a cell is part of the "slack space"
    const isSlackSpace = (i: number, j: number) => {
        return i === grid.height - 1 || j === grid.width - 1;
    };

    // Check if a cell should be highlighted
    const isHighlighted = (i: number, j: number) => {
        return activeHighlights.some(cell => cell.i === i && cell.j === j);
    };

    // Render only non-empty cells if showEmptyCells is false
// Render only non-empty cells if showEmptyCells is false
    const renderGridCells = () => {
        const cells = [];
        const nonEmptyCells = [];

        // First collect all non-empty cells if we're not showing empty ones
        if (!showEmptyCells) {
            for (let i = 0; i < grid.height; i++) {
                for (let j = 0; j < grid.width; j++) {
                    const indexId = grid.grid[i][j];

                    if (indexId !== EMPTY_CELL_INDEX) {
                        nonEmptyCells.push({i, j, indexId});
                    }
                }
            }
        }

        // Determine which cells to render
        const cellsToRender = showEmptyCells
            ? Array.from({length: grid.height * grid.width}, (_, idx) => {
                const i = Math.floor(idx / grid.width);
                const j = idx % grid.width;
                return {i, j, indexId: grid.grid[i][j]};
            })
            : nonEmptyCells;

        // Render each cell
        for (const {i, j, indexId} of cellsToRender) {
            // Skip rendering empty cells if not showing them
            if (indexId === EMPTY_CELL_INDEX && !showEmptyCells) continue;

            const cellIsHighlighted = isHighlighted(i, j);
            const isCellZoomed = zoomedCell?.i === i && zoomedCell?.j === j;

            // For empty cells, render minimal content but fill the space
            if (indexId === EMPTY_CELL_INDEX) {
                cells.push(
                    <div
                        key={`empty-${i}-${j}-${iterations}`}
                        className={`
                        w-full h-full flex items-center justify-center
                        ${isSlackSpace(i, j) ? 'bg-blue-50 bg-opacity-20 border-blue-200 border-r border-b' : 'bg-transparent'}
                        ${cellIsHighlighted ? 'bg-blue-100 bg-opacity-20' : ''}
                    `}
                        style={{
                            gridRow: i + 1,
                            gridColumn: j + 1,
                            margin: 0,
                            padding: 0
                        }}
                    >
                        <div className="flex items-center justify-center text-xxs text-gray-400 opacity-40">
                            ({i},{j})
                        </div>
                    </div>
                );
                continue;
            }

            // Non-empty cells
            const objectId = grid.indexToIdMap.get(indexId) || '';
            const object = objectsById[objectId];

            if (!object) {
                cells.push(
                    <div
                        key={`cell-${i}-${j}-${indexId}-${iterations}`}
                        className="w-full h-full flex flex-col items-center justify-center border border-red-300 bg-red-100"
                        style={{
                            gridRow: i + 1,
                            gridColumn: j + 1,
                            margin: 0,
                            padding: 0
                        }}
                    >
                        <div className="font-bold text-red-600 text-xs">Error</div>
                        <div className="text-xxs text-red-500">Missing: {indexId}</div>
                    </div>
                );
                continue;
            }

            const shortContent = object.label?.length > 20
                ? object.label.substring(0, 20) + "..."
                : object.label || "";

            const isSelected = selectedCell?.i === i && selectedCell?.j === j;

            // Get cluster color for this cell
            const clusterData = clusterInfo.get(indexId);
            const cellColor = clusterData?.color ||
                (colorTheme === "scientific" ? `hsl(200, 30%, 85%)` : getColorblindFriendlyColor(0));

            // Check for similar neighbors
            const hasRightSimilar = j < grid.width - 1 &&
                areSimilarCells(i, j, i, (j + 1) % grid.width);
            const hasBottomSimilar = i < grid.height - 1 &&
                areSimilarCells(i, j, (i + 1) % grid.height, j);
            const hasLeftSimilar = areSimilarCells(i, j, i, (j - 1 + grid.width) % grid.width);
            const hasTopSimilar = areSimilarCells(i, j, (i - 1 + grid.height) % grid.height, j);

            // Check if this cell is part of the zoomed cluster
            const isClusterZoomed = clusterData && zoomedCluster === clusterData.clusterId;

            cells.push(
                <div
                    key={`cell-${i}-${j}-${indexId}-${iterations}`}
                    className={`
                    w-full h-full flex flex-col items-center justify-center
                    cursor-pointer hover:shadow-md text-center text-gray-700
                    ${isSelected ? 'ring-2 ring-inset ring-blue-500 shadow-sm' : ''}
                    ${isSlackSpace(i, j) ? 'ring-1 ring-inset ring-blue-400' : ''}
                    ${cellIsHighlighted ? 'ring-2 ring-inset ring-blue-400 animate-pulse' : ''}
                    ${isCellZoomed ? 'ring-3 ring-inset ring-yellow-500 shadow-md z-20' : ''}
                    ${isClusterZoomed && !isCellZoomed ? 'ring-2 ring-inset ring-yellow-400 z-10' : ''}
                    relative overflow-hidden
                    transition-all duration-150
                `}
                    style={{
                        backgroundColor: cellColor,
                        gridRow: i + 1,
                        gridColumn: j + 1,
                        margin: 0,
                        padding: 0,
                        boxShadow: isCellZoomed ? '0 0 8px rgba(255, 200, 0, 0.5)' : 'none'
                    }}
                    onClick={() => handleCellClick(indexId, i, j)}
                >
                    {/* Position indicator with improved visibility */}
                    <div
                        className="absolute top-0.5 right-0.5 text-xxs font-medium bg-black bg-opacity-20 px-0.5 rounded text-white z-10">
                        ({i},{j})
                    </div>

                    {/* Cluster indicator with improved visibility */}
                    {clusterData && (
                        <div
                            className="absolute bottom-0.5 left-0.5 text-xxs font-bold opacity-90 px-1 py-0.5 rounded z-10"
                            style={{
                                color: getContrastColor(cellColor),
                                backgroundColor: `${cellColor}EE`
                            }}>
                            C{clusterData.clusterId}
                        </div>
                    )}

                    {/* Update the connection indicators for similar neighbors */}
                    {hasRightSimilar && (
                        <div
                            className="absolute right-0 top-1/2 w-2 h-1.5 bg-blue-500 opacity-90 z-10 rounded-full shadow-glow"
                            style={{
                                transform: 'translateY(-50%) translateX(50%)',
                                boxShadow: '0 0 3px 1px rgba(59, 130, 246, 0.6)'
                            }}></div>
                    )}
                    {hasBottomSimilar && (
                        <div
                            className="absolute bottom-0 left-1/2 w-1.5 h-2 bg-blue-500 opacity-90 z-10 rounded-full shadow-glow"
                            style={{
                                transform: 'translateX(-50%) translateY(50%)',
                                boxShadow: '0 0 3px 1px rgba(59, 130, 246, 0.6)'
                            }}></div>
                    )}
                    {hasLeftSimilar && (
                        <div
                            className="absolute left-0 top-1/2 w-2 h-1.5 bg-blue-500 opacity-90 z-10 rounded-full shadow-glow"
                            style={{
                                transform: 'translateY(-50%) translateX(-50%)',
                                boxShadow: '0 0 3px 1px rgba(59, 130, 246, 0.6)'
                            }}></div>
                    )}
                    {hasTopSimilar && (
                        <div
                            className="absolute top-0 left-1/2 w-1.5 h-2 bg-blue-500 opacity-90 z-10 rounded-full shadow-glow"
                            style={{
                                transform: 'translateX(-50%) translateY(-50%)',
                                boxShadow: '0 0 3px 1px rgba(59, 130, 246, 0.6)'
                            }}></div>
                    )}

                    {/* Content container with minimal padding */}
                    <div className="flex flex-col items-center justify-center w-full h-full p-1">
                        {/* Main content */}
                        <div className="font-semibold text-xs mb-0.5 truncate w-full">
                            {object.label}
                        </div>

                        <div
                            className="text-xxs text-gray-600 opacity-75 line-clamp-2 w-full overflow-hidden text-ellipsis">
                            {shortContent}
                        </div>

                        {/* ID indicator - simplified */}
                        <div className="text-xxs text-gray-500 mt-0.5 truncate w-full">
                            ID: {objectId.substring(0, 6)}...
                        </div>
                    </div>
                </div>
            );
        }

        return cells;
    };
    return (
        <div
            ref={containerRef}
            className="h-full w-full flex flex-col items-center justify-center overflow-hidden bg-gray-100 relative p-0"
        >
            {/* Zoom Controls */}
            <div className="absolute top-1 right-1 bg-gray-800 bg-opacity-75 rounded z-30 flex items-center">
                <button
                    className="text-white px-2 py-1 text-lg font-bold hover:bg-gray-700"
                    onClick={zoomIn}
                >
                    +
                </button>
                <button
                    className="text-white px-2 py-1 text-lg font-bold hover:bg-gray-700"
                    onClick={zoomOut}
                >
                    -
                </button>
                <button
                    className="text-white px-2 py-1 text-sm hover:bg-gray-700"
                    onClick={resetZoom}
                >
                    Reset
                </button>
            </div>

            <div
                ref={gridRef}
                className="grid w-full h-full transition-transform duration-200"
                style={{
                    gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
                    gridTemplateRows: `repeat(${grid.height}, 1fr)`,
                    maxWidth: '100%',
                    maxHeight: '100%',
                    gap: 0,
                    margin: 0,
                    padding: 0,
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    overflow: 'visible'
                }}
            >
                {renderGridCells()}
            </div>

            {/* Cluster information panel */}
            {showClusterInfo && zoomedCluster !== null && (
                <div
                    className="absolute bottom-2 right-2 bg-gray-800 bg-opacity-90 p-2 rounded-lg shadow-lg text-white z-40 max-w-xs">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="text-xs font-bold">Cluster {zoomedCluster}</h3>
                        <button
                            className="text-xxs bg-gray-700 hover:bg-gray-600 text-white px-2 py-0.5 rounded"
                            onClick={() => {
                                setShowClusterInfo(false);
                                setZoomedCluster(null);
                                setZoomedCell(null);
                            }}
                        >
                            Close
                        </button>
                    </div>

                    <div className="text-xxs mb-1">
                        <span className="text-gray-300">Items in cluster: </span>
                        <span className="font-bold">{clusterItems.length}</span>
                    </div>

                    {clusterItems.length > 0 && (
                        <div className="max-h-24 overflow-y-auto">
                            <div className="text-xxs font-medium mb-0.5 text-gray-300">Items:</div>
                            <ul className="text-xxs space-y-0.5">
                                {clusterItems.map((item, index) => (
                                    <li key={index} className="flex items-center justify-between">
                                        <span className="truncate mr-1">{item.label}</span>
                                        <span className="text-gray-400 whitespace-nowrap">({item.i},{item.j})</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Helper function to determine if text should be black or white based on background color
function getContrastColor(hexOrHsl: string): string {
    let r, g, b;

    if (hexOrHsl.startsWith('#')) {
        // Handle hex color
        const hex = hexOrHsl.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
    } else if (hexOrHsl.startsWith('hsl')) {
        // Approximate HSL to RGB (not perfect but good enough for contrast)
        const hslMatch = hexOrHsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (hslMatch) {
            const h = parseInt(hslMatch[1]) / 360;
            const s = parseInt(hslMatch[2]) / 100;
            const l = parseInt(hslMatch[3]) / 100;

            // HSL to RGB conversion (simplified)
            if (s === 0) {
                r = g = b = l * 255;
            } else {
                const hue2rgb = (p: number, q: number, t: number) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1 / 6) return p + (q - p) * 6 * t;
                    if (t < 1 / 2) return q;
                    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                    return p;
                };

                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1 / 3) * 255;
                g = hue2rgb(p, q, h) * 255;
                b = hue2rgb(p, q, h - 1 / 3) * 255;
            }
        } else {
            // Default to black if parsing fails
            return '#000000';
        }
    } else {
        // Default to black for unknown formats
        return '#000000';
    }

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for light colors, white for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff';
}
