import React from "react";

const MatrixTable = ({ ncdMatrix, labels }) => {
  const getCellStyle = (value) => {
    const red = Math.round(255 * value);
    const green = Math.round(255 * (1 - value));
    const color = `rgba(${red}, ${green}, 0, 1)`;
    return { color };
  }

  return (
    <table style={{ borderCollapse: "collapse", margin: "20px auto", width: "80%", maxWidth: "600px", overflowX: "auto" }}>
      <thead>
        <tr>
          <th style={{ padding: "10px", border: "1px solid #ccc" }}>{ ncdMatrix.length + "x" + ncdMatrix.length}</th>
          {labels.map((label, index) => (
            <th key={index} style={{ padding: "10px", border: "1px solid #ccc" }}>
              {label.toUpperCase()}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {ncdMatrix.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <th style={{ padding: "10px", border: "1px solid #ccc" }}>
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
  );
};

export default MatrixTable;