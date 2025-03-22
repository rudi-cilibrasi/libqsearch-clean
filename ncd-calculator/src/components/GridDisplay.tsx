import React, { useState } from "react";
import { GridState } from "@/services/kgrid.ts";

interface GridDisplayProps {
    grid: GridState;
    objectsById: Record<string, { label: string; content: number[] }>;
    iterations: number;
    colorTheme?: string;
    onCellSelect?: (objectId: string, i: number, j: number) => void;
}

export const GridDisplay: React.FC<GridDisplayProps> = ({
                                                            grid,
                                                            objectsById,
                                                            iterations,
                                                            colorTheme = "scientific",
                                                            onCellSelect
                                                        }) => {
    const [selectedCell, setSelectedCell] = useState<{ i: number; j: number } | null>(null);

    // Generate color for cells based on label - use more subtle colors
    const getColorForLabel = (label: string, theme: string) => {
        let hash = 0;
        for (let i = 0; i < label.length; i++) {
            hash = label.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);

        if (theme === "scientific") {
            // More subtle scientific colors with better text contrast
            return `hsl(${h}, 80%, 85%)`; // Higher lightness for better text visibility
        } else {
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
            return colorblindPalette[Math.abs(hash) % colorblindPalette.length];
        }
    };

    // Handle cell click
    const handleCellClick = (indexId: number, i: number, j: number) => {
        setSelectedCell({ i, j });

        const objectId = grid.indexToIdMap.get(indexId);
        if (objectId && onCellSelect) {
            onCellSelect(objectId, i, j);
        }
    };

    // Early return if grid data isn't available
    if (!grid || !grid.grid || grid.grid.length === 0) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
                Loading grid data...
            </div>
        );
    }

    return (
        <div
            className="grid gap-2 p-2 bg-gray-100 w-full h-full"
            style={{
                gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
                gridTemplateRows: `repeat(${grid.height}, 1fr)`
            }}
        >
            {grid.grid.map((row, i) =>
                row.map((indexId, j) => {
                    const objectId = grid.indexToIdMap.get(indexId) || '';
                    const object = objectsById[objectId];

                    if (!object) {
                        return (
                            <div
                                key={`cell-${i}-${j}-${indexId}-${iterations}`}
                                className="flex flex-col items-center justify-center rounded p-2 border border-red-300 bg-red-100"
                            >
                                <div className="font-bold text-red-600">Error</div>
                                <div className="text-xs text-red-500">Missing: {indexId}</div>
                            </div>
                        );
                    }

                    const shortContent = object.label?.length > 20
                        ? object.label.substring(0, 40) + "..."
                        : object.label || "";

                    const isSelected = selectedCell?.i === i && selectedCell?.j === j;
                    const cellColor = getColorForLabel(object.label, colorTheme);

                    return (
                        <div
                            key={`cell-${i}-${j}-${indexId}-${iterations}`}
                            className={`
                flex flex-col items-center justify-center rounded p-2 relative
                cursor-pointer hover:shadow-md text-center text-gray-700
                ${isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''}
              `}
                            style={{
                                backgroundColor: cellColor,
                                transition: 'all 0.2s ease-in-out'
                            }}
                            onClick={() => handleCellClick(indexId, i, j)}
                        >
                            {/* Position indicator */}
                            <div className="absolute top-1 right-1 text-xs text-gray-500 opacity-60">
                                ({i},{j})
                            </div>

                            {/* Main content */}
                            <div className="font-semibold text-sm mb-1 truncate w-full">
                                {object.label}
                            </div>

                            <div className="text-xs text-gray-600 opacity-75 line-clamp-2 w-full overflow-hidden text-ellipsis">
                                {shortContent}
                            </div>

                            {/* ID indicator */}
                            <div className="text-xs text-gray-500 mt-1">
                                ID: {objectId.substring(0, 8)}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};
