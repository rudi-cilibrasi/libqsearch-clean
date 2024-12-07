import React from "react";
import MatrixTable from "./MatrixTable";
import { QSearchTree3D } from "./QSearchTree3D";

interface QSearchTreeNode {
  id: string;
  name: string;
  children?: QSearchTreeNode[];
}

interface MatrixTreeProps {
  hasMatrix: boolean;
  labels: string[];
  ncdMatrix: number[][];
  confirmedSearchTerm: string;
  errorMsg?: string;
  qSearchTreeResult?: any;
  executionTime: number;
}

export const MatrixTree: React.FC<MatrixTreeProps> = ({
  hasMatrix,
  labels,
  ncdMatrix,
  confirmedSearchTerm,
  errorMsg,
  qSearchTreeResult,
  executionTime,
}) => {
  return (
    <div style={{ marginTop: "10px", textAlign: "left" }}>
      {hasMatrix && labels.length !== 0 && (
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <MatrixTable
            ncdMatrix={ncdMatrix}
            labels={labels}
            searchTerm={confirmedSearchTerm}
            executionTime={executionTime}
          />
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {errorMsg && errorMsg.includes("no result") && (
          <p style={{ fontSize: "18px" }}>There is no result for the input </p>
        )}
      </div>
      <div>
        {qSearchTreeResult &&
          qSearchTreeResult.nodes &&
          qSearchTreeResult.nodes.length !== 0 && (
            <QSearchTree3D data={qSearchTreeResult} />
          )}
      </div>
    </div>
  );
};
