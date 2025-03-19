import React, {useState, useEffect, useRef, useMemo} from "react";
import {GridState} from "@/services/kgrid.ts";

interface GridDisplayProps {
    grid: GridState,
    objectsById: Record<string, {label: string, content: string}>,
    iterations: number
}

export const GridDisplay = ({ grid, objectsById, iterations }) => {
    // Use useRef to track if we need to force an update
    const lastDataHash = useRef("");
    const [forceUpdateKey, setForceUpdateKey] = useState(0);

    // Generate a hash of the current grid data to detect changes
    const currentDataHash = useMemo(() => {
        if (!grid || !grid.grid) return "";
        return JSON.stringify(grid.grid);
    }, [grid]);

    // Force re-render whenever the grid data actually changes
    // This ensures the display updates even when React doesn't detect changes
    useEffect(() => {
        if (lastDataHash.current !== currentDataHash) {
            lastDataHash.current = currentDataHash;
            setForceUpdateKey(prev => prev + 1);
        }
    }, [currentDataHash, iterations]);

    // If grid is not ready yet, show loading
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

    // Generate a color based on the label
    const getColorForLabel = (label) => {
        let hash = 0;
        for (let i = 0; i < label.length; i++) {
            hash = label.charCodeAt(i) + ((hash << 5) - hash);
        }
        const h = Math.abs(hash % 360);
        return `hsl(${h}, 70%, 80%)`;
    };

    // Log the actual grid data being rendered for debugging
    console.log(`Rendering grid with key ${forceUpdateKey}, iteration ${iterations}:`,
        JSON.stringify(grid.grid));

    return (
        <div
            key={`grid-display-${forceUpdateKey}`}
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
                row.map((id, j) => {
                    // Ensure ID is a string
                    const stringId = String(id);

                    // Find the object data
                    const object = objectsById[stringId];

                    // Unique and consistent key for each cell
                    const cellKey = `cell-${i}-${j}-${forceUpdateKey}-${stringId}`;

                    // Handle missing objects gracefully
                    if (!object) {
                        console.error(`Missing object for ID: ${stringId} at position (${i},${j})`);
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
                                <div>Missing: {stringId}</div>
                            </div>
                        );
                    }

                    // Generate a color based on the label
                    const cellColor = getColorForLabel(object.label);

                    // Truncate content for display
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
                            }}
                        >
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
                                opacity: 0.7,
                            }}>
                                ID: {stringId}
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
                        </div>
                    );
                })
            )}
        </div>
    );
};
