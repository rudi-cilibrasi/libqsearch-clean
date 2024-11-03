import React from "react";

const MatrixTable = ({ncdMatrix, labels, searchTerm, executionTime}) => {
    const getCellStyle = (value) => {
        const red = Math.round(255 * value);
        const green = Math.round(255 * (1 - value));
        const color = `rgba(${red}, ${green}, 0, 1)`;
        return {color};
    }

    return (
        <div style={{display: "flex", flexDirection: "column", alignItems: "flex-start"}}>
            <p style={{fontSize: "18px", marginBottom: "8px", paddingLeft: "75px"}}>
                NCD matrix for <b><i>{searchTerm}</i></b> (total time: {executionTime.toFixed(2)}ms)
            </p>

            <table style={{
                borderCollapse: "collapse",
                margin: "15px auto",
                width: "80%",
                maxWidth: "600px",
                overflowX: "auto"
            }}>
                <thead>
                <tr>
                    <th style={{
                        padding: "10px",
                        border: "1px solid #ccc"
                    }}>{ncdMatrix.length + "x" + ncdMatrix.length}</th>
                    {labels.map((label, index) => (
                        <th key={index} style={{padding: "10px", border: "1px solid #ccc"}}>
                            {label.toUpperCase()}
                        </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {ncdMatrix.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        <th style={{padding: "10px", border: "1px solid #ccc"}}>
                            {labels[rowIndex].toUpperCase()}
                        </th>
                        {row.map((value, colIndex) => (
                            <td
                                key={colIndex}
                                style={{
                                    padding: "10px",
                                    border: "1px solid #ccc",
                                    textAlign: "center",
                                    ...getCellStyle(value),
                                }}
                            >
                                {value.toFixed(4)}
                            </td>
                        ))}
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
};

export default MatrixTable;