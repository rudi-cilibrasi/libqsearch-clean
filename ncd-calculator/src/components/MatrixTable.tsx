import React from "react";
import NCDMatrixInfo from "@/components/NCDMatrixInfo";

interface MatrixTableProps {
  ncdMatrix: number[][];
  labels: string[];
}

interface CellStyle {
  color: string;
}

const MatrixTable: React.FC<MatrixTableProps> = ({
                                                   ncdMatrix,
                                                   labels,
                                                 }) => {
  const getCellStyle = (value: number): CellStyle => {
    const red = Math.round(255 * value);
    const green = Math.round(255 * (1 - value));
    const color = `rgba(${red}, ${green}, 0, 1)`;
    return { color };
  };

  return (
      <div className="flex flex-col items-start w-full">
          <div className="w-4/5 max-w-[600px] mx-auto">
              <NCDMatrixInfo/>
          </div>
          <table
              className="border-collapse mx-auto w-4/5 max-w-[600px]"
            style={{overflowX: "auto"}}
        >
          <thead>
          <tr>
            <th
                style={{
                  padding: "10px",
                  border: "1px solid #ccc",
                }}
            >
              {`${ncdMatrix.length}x${ncdMatrix.length}`}
            </th>
            {labels.map((label, index) => (
                <th
                    key={index}
                    style={{
                      padding: "10px",
                      border: "1px solid #ccc",
                    }}
                >
                  {label.toUpperCase()}
                </th>
            ))}
          </tr>
          </thead>
          <tbody>
          {ncdMatrix.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                    style={{
                      padding: "10px",
                      border: "1px solid #ccc",
                    }}
                >
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
