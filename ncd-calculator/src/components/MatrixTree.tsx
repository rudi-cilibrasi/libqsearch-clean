import React from "react";
import MatrixTable from "./MatrixTable";
import {QSearchTree3D} from "./QSearchTree3D";
import {KGridVisualizer} from "@/components/KGridVisualizer.tsx";
import {LabelManager} from "@/functions/labelUtils.ts";

interface MatrixTreeProps {
  hasMatrix: boolean;
  labels: string[];
  ncdMatrix: number[][];
  errorMsg?: string;
  qSearchTreeResult?: any;
  labelManager: LabelManager
}

export const MatrixTree: React.FC<MatrixTreeProps> = ({
  hasMatrix,
  labels,
  ncdMatrix,
  errorMsg,
  qSearchTreeResult,
  labelManager
}) => {
  return (
    <div style={{ marginTop: "10px", textAlign: "left" }}>
      {hasMatrix && labels.length !== 0 && (
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <MatrixTable
            ncdMatrix={ncdMatrix}
            labels={labels}
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
        <KGridVisualizer labels={labels} ncdMatrix={ncdMatrix} labelManager={labelManager}/>
        {qSearchTreeResult &&
          qSearchTreeResult.nodes &&
          qSearchTreeResult.nodes.length !== 0 && (
            <QSearchTree3D data={qSearchTreeResult} />
          )}
      </div>
    </div>
  );
};
