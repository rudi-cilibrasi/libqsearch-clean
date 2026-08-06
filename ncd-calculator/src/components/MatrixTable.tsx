import React from "react";

interface MatrixTableProps {
    ncdMatrix: number[][];
    labels: string[]
}
export const MatrixTable: React.FC<MatrixTableProps> = ({ ncdMatrix, labels}) => {
    const formatLabel = (label: string): string => (
        label.length > 16 ? `${label.substring(0, 14)}…` : label
    );

    const getCellStyle = (value: number): React.CSSProperties => {
        const intensity = Math.max(0, Math.min(value, 1));
        const lightness = Math.round(95 - intensity * 48);
        const textColor = intensity > 0.62 ? "#fffdf7" : "#16211b";

        return {
            backgroundColor: `hsl(151 25% ${lightness}%)`,
            color: textColor,
            padding: "6px",
            textAlign: "center",
            border: "1px solid #7e877f",
            fontFamily: "var(--font-mono)",
            fontWeight: 500,
            fontSize: "0.85rem"
        };
    };

    const getDiagonalCellStyle = (): React.CSSProperties => {
        return {
            backgroundColor: "#a6462b",
            color: "#fffdf7",
            padding: "6px",
            textAlign: "center",
            border: "1px solid #7c321f",
            fontFamily: "var(--font-mono)",
            fontWeight: "bold",
            fontSize: "0.85rem"
        };
    };

    const getHeaderStyle = (): React.CSSProperties => {
        return {
            padding: "6px",
            backgroundColor: "#142c23",
            color: "#eef0e8",
            border: "1px solid #53635a",
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

    const getRowHeaderStyle = (): React.CSSProperties => {
        return {
            padding: "6px",
            backgroundColor: "#142c23",
            color: "#eef0e8",
            border: "1px solid #53635a",
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
        <div className="distance-matrix">
            <div className="distance-matrix__table-wrap">
                    <table>
                        <caption>Pairwise normalized compression distance matrix</caption>
                        <thead>
                        <tr>
                            <th style={{...getHeaderStyle(), width: '112px'}}>ID</th>
                            {labels.map((label, index) => (
                                <th key={index} title={label} style={{...getHeaderStyle(), width: '112px', maxWidth: '112px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                    {formatLabel(label)}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {ncdMatrix.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                                <th title={labels[rowIndex]} style={{...getRowHeaderStyle(), width: '112px', maxWidth: '112px', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                    {formatLabel(labels[rowIndex])}
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

                <div className="distance-matrix__legend">
                    <div>
                        <div className="flex items-center mb-1">
                            <span className="distance-matrix__swatch distance-matrix__swatch--near"></span>
                            <span className="font-bold">0.0000</span> (identical)
                        </div>
                        <div className="flex items-center">
                            <span className="distance-matrix__swatch distance-matrix__swatch--far"></span>
                            <span className="font-bold">1.0000</span> (different)
                        </div>
                    </div>
                    <div>
                        <p className="font-bold text-yellow-300 mb-1">Reading the matrix</p>
                        <p className="text-sm">Lower values indicate higher similarity</p>
                        <p className="text-sm">Diagonal cells show self-comparison (always 0)</p>
                    </div>
                </div>
        </div>
    );
};
