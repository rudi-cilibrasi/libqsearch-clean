import React from "react";
import {GridState} from "@/services/kgrid.ts";

interface GridDisplayProps {
    grid: GridState,
    objectsById: Record<string, {label: string, content: string}>,
    iterations: number
}

export const GridDisplay: React.FC<GridDisplayProps> = ({ grid, objectsById, iterations }) => {
    // For debugging - log the grid content
    console.log(`Rendering grid at iteration ${iterations}, grid data:`,
        JSON.stringify(grid.grid));

    // Early return if grid data isn't available
    if (!grid || !grid.grid || grid.grid.length === 0) {
        return (
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                backgroundColor: "#f9f9f9",
                color: "#666"
            }}>
                Loading grid data...
            </div>
        );
    }

    // Generate a color based on the label with improved contrast
    const getColorForLabel = (label: string) => {
        let hash = 0;
        for (let i = 0; i < label.length; i++) {
            hash = label.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);
        // Increase saturation and reduce lightness for better visibility
        return `hsl(${h}, 80%, 75%)`;
    };

    // Calculate transition duration based on iterations (faster at start, slower later)
    const getTransitionDuration = () => {
        // Start with faster transitions, slow down as optimization progresses
        return Math.min(0.3, 0.1 + (iterations / 10000) * 0.2);
    };

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: `repeat(${grid.width}, 1fr)`,
                gridTemplateRows: `repeat(${grid.height}, 1fr)`,
                gap: "4px",
                padding: "8px",
                backgroundColor: "#eee",
                borderRadius: "4px",
                width: "100%",
                minHeight: "250px"
            }}
        >
            {grid.grid.map((row, i) =>
                row.map((indexId, j) => {
                    // Generate a unique key that changes when cell content changes
                    const cellKey = `cell-${i}-${j}-${indexId}-${iterations}`;
                    const objectId = grid.indexToIdMap.get(indexId) || '';
                    const object = objectsById[objectId];

                    if (!object) {
                        console.error(`Missing object for ID: ${indexId} (${objectId}) at position (${i},${j})`);
                        return (
                            <div
                                key={cellKey}
                                style={{
                                    backgroundColor: "pink",
                                    border: "1px solid red",
                                    padding: "8px",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "12px",
                                    minHeight: "80px",
                                }}
                            >
                                <div style={{ fontWeight: "bold" }}>Error</div>
                                <div>Missing: {indexId}</div>
                            </div>
                        );
                    }

                    const cellColor = getColorForLabel(object.label);
                    const shortContent = object.content?.length > 40
                        ? object.content.substring(0, 40) + "..."
                        : object.content || "";

                    return (
                        <div
                            key={cellKey}
                            style={{
                                backgroundColor: cellColor,
                                border: "1px solid #ddd",
                                borderRadius: "4px",
                                padding: "8px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                minHeight: "80px",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                transition: `all ${getTransitionDuration()}s ease-in-out`,
                                position: "relative"
                            }}
                        >
                            {/* Add a small position indicator in the corner */}
                            <div style={{
                                position: "absolute",
                                top: "2px",
                                right: "2px",
                                fontSize: "9px",
                                color: "rgba(0,0,0,0.5)"
                            }}>
                                ({i},{j})
                            </div>

                            <div style={{
                                fontWeight: "bold",
                                marginBottom: "4px",
                                fontSize: "14px",
                                textAlign: "center"
                            }}>
                                {object.label}
                            </div>
                            <div style={{
                                fontSize: "10px",
                                textAlign: "center",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                maxWidth: "100%"
                            }}>
                                {shortContent}
                            </div>

                            {/* Add a small ID indicator at the bottom */}
                            <div style={{
                                marginTop: "4px",
                                fontSize: "9px",
                                opacity: 0.7
                            }}>
                                ID: {indexId}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};
