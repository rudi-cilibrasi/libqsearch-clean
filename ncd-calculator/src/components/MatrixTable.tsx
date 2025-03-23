import React from "react";

interface MatrixTableProps {
    ncdMatrix: number[][];
    labels: string[]
}
export const MatrixTable: React.FC<MatrixTableProps> = ({ ncdMatrix, labels}) => {
    // Generate color for cells with high contrast, but with more pleasant colors
    const getCellStyle = (value: number) => {
        // Use a softer color gradient based on value
        // Lower values (more similar) = softer blue
        // Higher values (more different) = lighter blue-gray

        // Calculate a better color using a more pleasant gradient
        const intensity = value; // 0.0 to 1.0

        // Create a softer blue palette
        const r = Math.round(220 - (intensity * 100)); // 220 to 120
        const g = Math.round(230 - (intensity * 70));  // 230 to 160
        const b = 255; // Keep blue high for theme consistency

        // Calculate text color using YIQ formula for best contrast
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        const textColor = brightness > 145 ? "#1a1a3a" : "#ffffff"; // Darker text for contrast

        return {
            backgroundColor: `rgb(${r}, ${g}, ${b})`,
            color: textColor,
            padding: "6px",
            textAlign: "center",
            border: "1px solid #2a2a4a",
            fontFamily: "monospace",
            fontWeight: textColor === "#ffffff" ? "bold" : "normal",
            fontSize: "0.85rem"
        };
    };

    // Get diagonal cell style - softer dark color
    const getDiagonalCellStyle = () => {
        return {
            backgroundColor: "#3a3a5c", // Softer dark color
            color: "#ffffff",
            padding: "6px",
            textAlign: "center",
            border: "1px solid #2a2a4a",
            fontFamily: "monospace",
            fontWeight: "bold",
            fontSize: "0.85rem"
        };
    };

    // Get header cell style - more pleasant blue
    const getHeaderStyle = () => {
        return {
            padding: "6px",
            backgroundColor: "#4a4a9f", // Softer blue
            color: "white",
            border: "1px solid #3a3a7c",
            position: "sticky",
            top: 0,
            left: 0,
            fontWeight: "bold",
            textAlign: "center",
            whiteSpace: "nowrap",
            zIndex: 10,
            fontSize: "0.85rem"
        };
    };

    // Get row header style - matches header
    const getRowHeaderStyle = () => {
        return {
            padding: "6px",
            backgroundColor: "#4a4a9f", // Softer blue
            color: "white",
            border: "1px solid #3a3a7c",
            position: "sticky",
            left: 0,
            fontWeight: "bold",
            textAlign: "left",
            whiteSpace: "nowrap",
            zIndex: 5,
            fontSize: "0.85rem"
        };
    };

    return (
        <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden h-full">
            <div className="p-4">
                <div className="overflow-auto max-h-[calc(100vh-300px)] border border-gray-700 rounded">
                    <table className="border-collapse w-full bg-gray-900 table-fixed">
                        <thead>
                        <tr>
                            <th style={{...getHeaderStyle(), width: '80px'}}>ID</th>
                            {labels.map((label, index) => (
                                <th key={index} style={{...getHeaderStyle(), width: '80px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                    {label.length > 8 ? `${label.substring(0, 6)}...` : label}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {ncdMatrix.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                <th style={{...getRowHeaderStyle(), width: '80px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                    {labels[rowIndex].length > 8 ? `${labels[rowIndex].substring(0, 6)}...` : labels[rowIndex]}
                                </th>
                                {row.map((value, colIndex) => (
                                    <td
                                        key={colIndex}
                                        style={rowIndex === colIndex ? getDiagonalCellStyle() : getCellStyle(value)}
                                        title={`${labels[rowIndex]} vs ${labels[colIndex]}: ${value.toFixed(4)}`}
                                    >
                                        {value.toFixed(4)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4 text-white bg-gray-800 p-3 rounded">
                    <div>
                        <div className="flex items-center mb-1">
                            <span className="inline-block w-5 h-5 mr-2" style={{ backgroundColor: "rgb(120, 160, 255)" }}></span>
                            <span className="font-bold">0.0000</span> (identical)
                        </div>
                        <div className="flex items-center">
                            <span className="inline-block w-5 h-5 mr-2" style={{ backgroundColor: "rgb(220, 230, 255)" }}></span>
                            <span className="font-bold">1.0000</span> (different)
                        </div>
                    </div>
                    <div>
                        <p className="font-bold text-yellow-300 mb-1">Reading the Matrix</p>
                        <p className="text-sm">Lower values indicate higher similarity</p>
                        <p className="text-sm">Diagonal cells show self-comparison (always 0)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
