import React, {useEffect, useMemo, useState} from "react";
import {GridState} from "@/services/kgrid.ts";

interface GridDisplayProps {
    grid: GridState;
    objectsById: Record<string, { label: string; content: number[] }>;
    iterations: number;
    colorTheme?: string;
    onCellSelect?: (objectId: string, i: number, j: number) => void;
    cellDimensions?: { width: string; height: string };
    showEmptyCells?: boolean;
    fitToContainer?: boolean;
    clusterThreshold?: number; // Threshold for considering items as part of the same cluster
}

// Custom type for cluster information
interface ClusterInfo {
    clusterId: number;
    memberCount: number;
    color: string;
}

export const GridDisplay: React.FC<GridDisplayProps> = ({
                                                            grid,
                                                            objectsById,
                                                            iterations,
                                                            colorTheme = "scientific",
                                                            onCellSelect,
                                                            cellDimensions,
                                                            showEmptyCells = true,
                                                            fitToContainer = false,
                                                            clusterThreshold = 0.3, // Default threshold for NCD similarity
                                                        }) => {
    const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>(null);
    const [containerDimensions, setContainerDimensions] = useState({width: 0, height: 0});
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Handle empty cells
    const EMPTY_CELL_INDEX = grid.emptyIndex || -1;

    // Helper function to get grid value at position (i,j)
    const getGridValue = (i: number, j: number): number => {
        return grid.grid[i * grid.width + j];
    };

    // Track container size for responsive layout
    useEffect(() => {
        if (fitToContainer && containerRef.current) {
            const updateDimensions = () => {
                if (containerRef.current) {
                    setContainerDimensions({
                        width: containerRef.current.offsetWidth,
                        height: containerRef.current.offsetHeight
                    });
                }
            };

            updateDimensions();
            window.addEventListener('resize', updateDimensions);

            return () => {
                window.removeEventListener('resize', updateDimensions);
            };
        }
    }, [fitToContainer]);

    // Identify clusters using NCD matrix
    // This uses a simple approach to group items with similar NCD values
    const clusterInfo = useMemo(() => {
        if (!grid || !grid.numericNcdMatrix) return new Map<number, ClusterInfo>();

        // Maps item indices to cluster IDs
        const itemClusters = new Map<number, number>();
        // Maps cluster IDs to cluster information
        const clusters = new Map<number, ClusterInfo>();

        // First pass: identify clusters
        let currentClusterId = 0;

        // Helper function to check if two items are similar
        const areSimilar = (idx1: number, idx2: number) => {
            if (idx1 === EMPTY_CELL_INDEX || idx2 === EMPTY_CELL_INDEX) return false;
            // Lower NCD values mean MORE similarity
            return grid.numericNcdMatrix[idx1][idx2] < clusterThreshold;
        };

        // Process all items to create clusters
        for (let i = 0; i < grid.height; i++) {
            for (let j = 0; j < grid.width; j++) {
                const cellIndex = i * grid.width + j;
                const itemIdx = grid.grid[cellIndex];
                if (itemIdx === EMPTY_CELL_INDEX) continue;

                // If already assigned to a cluster, skip
                if (itemClusters.has(itemIdx)) continue;

                // Check neighbors with wraparound to see if they're in clusters
                const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // Right, down, left, up
                let assignedToExistingCluster = false;

                for (const [di, dj] of directions) {
                    // Use modulo for proper wraparound
                    const ni = (i + di + grid.height) % grid.height;
                    const nj = (j + dj + grid.width) % grid.width;
                    const neighborCellIndex = ni * grid.width + nj;
                    const neighborIdx = grid.grid[neighborCellIndex];

                    if (neighborIdx === EMPTY_CELL_INDEX) continue;

                    // If neighbor is already in a cluster and is similar
                    if (itemClusters.has(neighborIdx) && areSimilar(itemIdx, neighborIdx)) {
                        const neighborCluster = itemClusters.get(neighborIdx)!;
                        itemClusters.set(itemIdx, neighborCluster);

                        // Update cluster member count
                        const cluster = clusters.get(neighborCluster)!;
                        cluster.memberCount++;

                        assignedToExistingCluster = true;
                        break;
                    }
                }

                // If not assigned to an existing cluster, create a new one
                if (!assignedToExistingCluster) {
                    itemClusters.set(itemIdx, currentClusterId);

                    // Generate a cluster color based on the cluster ID
                    const h = (currentClusterId * 137) % 360; // Golden ratio to distribute colors
                    const s = 70 + (currentClusterId % 3) * 10; // Vary saturation
                    const l = 65 + (currentClusterId % 5) * 5; // Vary lightness

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

        // Return a map from item index to cluster info
        const itemToClusterInfo = new Map<number, ClusterInfo>();
        for (const [itemIdx, clusterId] of itemClusters.entries()) {
            itemToClusterInfo.set(itemIdx, clusters.get(clusterId)!);
        }

        return itemToClusterInfo;
    }, [grid, EMPTY_CELL_INDEX, clusterThreshold, colorTheme]);

    // Handle cell click
    const handleCellClick = (indexId: number, i: number, j: number) => {
        if (indexId === EMPTY_CELL_INDEX && !showEmptyCells) return;

        setSelectedCell({i, j});

        const objectId = grid.indexToIdMap.get(indexId);
        if (objectId && onCellSelect) {
            onCellSelect(objectId, i, j);
        }
    };

    // Get colorblind-friendly colors
    const getColorblindFriendlyColor = (index: number) => {
        // Colorblind-friendly palette with better contrast
        const colorblindPalette = [
            '#cce6ff', // light blue
            '#dae8c3', // light green
            '#f2dfeb', // light pink
            '#f4e1d2', // light orange
            '#e0e0e0', // light gray
            '#f9e8c9', // light yellow
            '#deebf7', // pale blue
            '#e2e2f0', // pale purple
            '#edf8fb', // pale cyan
            '#fde9e0'  // pale red
        ];
        return colorblindPalette[index % colorblindPalette.length];
    };

    // Check if two adjacent cells are highly similar
    const areSimilarCells = (i1: number, j1: number, i2: number, j2: number) => {
        if (!grid || !grid.numericNcdMatrix) return false;

        const idx1 = getGridValue(i1, j1);
        const idx2 = getGridValue(i2, j2);

        if (idx1 === EMPTY_CELL_INDEX || idx2 === EMPTY_CELL_INDEX) return false;

        // Lower NCD values mean MORE similarity
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

    // Calculate dimensions for fitting the grid to container
    const calculateCellDimensions = () => {
        if (!fitToContainer || !containerDimensions.width || !containerDimensions.height) {
            return cellDimensions;
        }

        const cellWidth = `${(containerDimensions.width / grid.width) - 8}px`; // Subtract gap
        const cellHeight = `${(containerDimensions.height / grid.height) - 8}px`; // Subtract gap

        return {width: cellWidth, height: cellHeight};
    };

    const dynamicCellDimensions = calculateCellDimensions();

    // Determine if we should use fixed or auto dimensions
    const gridTemplateStyle = dynamicCellDimensions ?
        {} : // Will use cell dimensions through inline styles
        {
            gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
            gridTemplateRows: `repeat(${grid.height}, 1fr)`
        };

    // Calculate if a cell is part of the "slack space" (extra row/column)
    const isSlackSpace = (i: number, j: number) => {
        return i === grid.height - 1 || j === grid.width - 1;
    };

    // Create a grid of cells to display
    const renderGridCells = () => {
        const cells = [];

        for (let i = 0; i < grid.height; i++) {
            for (let j = 0; j < grid.width; j++) {
                const cellIndex = i * grid.width + j;
                const indexId = grid.grid[cellIndex];

                // Handle empty cells
                if (indexId === EMPTY_CELL_INDEX) {
                    if (!showEmptyCells) continue;

                    cells.push(
                        <div
                            key={`empty-${i}-${j}-${iterations}`}
                            className={`
                                rounded border border-dashed border-gray-300 bg-gray-50 opacity-40
                                ${isSlackSpace(i, j) ? 'border-blue-300 bg-blue-50' : ''}
                            `}
                            style={dynamicCellDimensions}
                        >
                            <div className="flex items-center justify-center h-full text-xs text-gray-400">
                                <span>({i},{j})</span>
                            </div>
                        </div>
                    );
                    continue;
                }

                const objectId = grid.indexToIdMap.get(indexId) || '';
                const object = objectsById[objectId];

                if (!object) {
                    cells.push(
                        <div
                            key={`cell-${i}-${j}-${indexId}-${iterations}`}
                            className="flex flex-col items-center justify-center rounded p-2 border border-red-300 bg-red-100"
                            style={dynamicCellDimensions}
                        >
                            <div className="font-bold text-red-600">Error</div>
                            <div className="text-xs text-red-500">Missing: {indexId}</div>
                        </div>
                    );
                    continue;
                }

                const shortContent = object.label?.length > 20
                    ? object.label.substring(0, 40) + "..."
                    : object.label || "";

                const isSelected = selectedCell?.i === i && selectedCell?.j === j;

                // Get cluster color for this cell (or fallback to basic color)
                const clusterData = clusterInfo.get(indexId);
                const cellColor = clusterData?.color ||
                    (colorTheme === "scientific" ? `hsl(200, 30%, 85%)` : getColorblindFriendlyColor(0));

                // Check for similar neighbors to draw connection indicators
                const hasRightSimilar = j < grid.width - 1 &&
                    areSimilarCells(i, j, i, (j + 1) % grid.width);
                const hasBottomSimilar = i < grid.height - 1 &&
                    areSimilarCells(i, j, (i + 1) % grid.height, j);
                const hasLeftSimilar = areSimilarCells(i, j, i, (j - 1 + grid.width) % grid.width);
                const hasTopSimilar = areSimilarCells(i, j, (i - 1 + grid.height) % grid.height, j);

                cells.push(
                    <div
                        key={`cell-${i}-${j}-${indexId}-${iterations}`}
                        className={`
                            flex flex-col items-center justify-center rounded p-2 relative
                            cursor-pointer hover:shadow-md text-center text-gray-700
                            ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}
                            ${isSlackSpace(i, j) ? 'ring-1 ring-blue-400' : ''}
                        `}
                        style={{
                            backgroundColor: cellColor,
                            transition: 'all 0.2s ease-in-out',
                            ...(dynamicCellDimensions || {})
                        }}
                        onClick={() => handleCellClick(indexId, i, j)}
                    >
                        {/* Position indicator */}
                        <div className="absolute top-1 right-1 text-xs text-gray-500 opacity-60">
                            ({i},{j})
                        </div>

                        {/* Cluster indicator (if part of a cluster) - moved to bottom left */}
                        {clusterData && (
                            <div className="absolute bottom-1 left-1 text-xs font-bold opacity-80 px-1 rounded"
                                 style={{
                                     color: getContrastColor(cellColor),
                                     backgroundColor: `${cellColor}CC` // Add semi-transparent background to improve readability
                                 }}>
                                C{clusterData.clusterId}
                            </div>
                        )}

                        {/* Connection indicators for similar neighbors */}
                        {hasRightSimilar && (
                            <div className="absolute right-0 top-1/2 w-2 h-1 bg-blue-600 opacity-70 rounded-full"
                                 style={{transform: 'translateY(-50%)'}}></div>
                        )}
                        {hasBottomSimilar && (
                            <div className="absolute bottom-0 left-1/2 w-1 h-2 bg-blue-600 opacity-70 rounded-full"
                                 style={{transform: 'translateX(-50%)'}}></div>
                        )}
                        {hasLeftSimilar && (
                            <div className="absolute left-0 top-1/2 w-2 h-1 bg-blue-600 opacity-70 rounded-full"
                                 style={{transform: 'translateY(-50%)'}}></div>
                        )}
                        {hasTopSimilar && (
                            <div className="absolute top-0 left-1/2 w-1 h-2 bg-blue-600 opacity-70 rounded-full"
                                 style={{transform: 'translateX(-50%)'}}></div>
                        )}

                        {/* Main content */}
                        <div className="font-semibold text-sm mb-1 truncate w-full">
                            {object.label}
                        </div>

                        <div
                            className="text-xs text-gray-600 opacity-75 line-clamp-2 w-full overflow-hidden text-ellipsis">
                            {shortContent}
                        </div>

                        {/* ID indicator */}
                        <div className="text-xs text-gray-500 mt-1">
                            ID: {objectId.substring(0, 8)}
                        </div>
                    </div>
                );
            }
        }

        return cells;
    };

    return (
        <div
            ref={containerRef}
            className="grid gap-2 p-2 bg-gray-100 w-full h-full overflow-auto"
            style={{
                ...gridTemplateStyle,
                gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
                gridTemplateRows: `repeat(${grid.height}, 1fr)`
            }}
        >
            {renderGridCells()}
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
