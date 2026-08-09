import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {describe, expect, test, vi} from "vitest";
import KGridVisualization from "@/components/KGridVisualization";
import type {GridObject} from "@/datastructures/kgrid";
import type {NCDMatrixResponse} from "@/types/ncd";
import type {QTreeResponse} from "@/types/qsearch";

vi.mock("@/components/KGridDualOptimization", () => ({
  KGridDualOptimization: ({onOptimizationStart}: {onOptimizationStart: () => void}) => (
    <button type="button" onClick={onOptimizationStart}>Start mock K-grid</button>
  ),
}));

vi.mock("@/components/QSearchTree3D", () => ({
  QSearchTree3D: () => <div>Quartet result</div>,
}));

const MATRIX: NCDMatrixResponse = {
  labels: ["eng", "fra", "deu", "nld"],
  ncdMatrix: [
    [0, 0.1, 0.8, 0.9],
    [0.1, 0, 0.85, 0.88],
    [0.8, 0.85, 0, 0.12],
    [0.9, 0.88, 0.12, 0],
  ],
  provenance: {
    source: "computed",
    algorithm: "lzma",
    compressorRevision: "test",
    pipelineVersion: "ncd-pipeline-v3",
    cacheSchemaVersion: 3,
    directedMatrixForm: "ordered",
    matrixReduction: "reflected-minimum",
    pairSeparator: "\n###\n",
  },
};

const OBJECTS: GridObject[] = MATRIX.labels.map((label, index) => ({
  id: label,
  label: new Map([
    ["eng", "English"],
    ["fra", "French"],
    ["deu", "German, Standard (1901)"],
    ["nld", "Dutch"],
  ]).get(label) ?? label,
  content: MATRIX.ncdMatrix[index],
}));

const TREE: QTreeResponse = {
  nodes: [
    {index: 0, label: "English", connections: [4]},
    {index: 1, label: "French", connections: [4]},
    {index: 2, label: "German, Standard (1901)", connections: [5]},
    {index: 3, label: "Dutch", connections: [5]},
    {index: 4, label: "node 4", connections: [0, 1, 5]},
    {index: 5, label: "node 5", connections: [2, 3, 4]},
  ],
  edgeSupport: {"4-5": 1},
  balancedSplit: {
    edgeKey: "4-5",
    leftLeafIndices: [0, 1],
    rightLeafIndices: [2, 3],
    support: 1,
  },
  search: {
    pipelineVersion: "qsearch-multistart-v2",
    runCount: 3,
    baseSeed: 1,
    selectedSeed: 2,
    selectedScore: 0.99,
    scoreMinimum: 0.98,
    scoreMean: 0.985,
    scoreMaximum: 0.99,
    selectedTopologyCount: 3,
    selectedTopologySupport: 1,
    uniqueTopologyCount: 1,
    supportKind: "repeated-search-stability",
  },
};

const LABEL_MAP = new Map([
  ["eng", "English"],
  ["fra", "French"],
  ["deu", "German, Standard (1901)"],
  ["nld", "Dutch"],
]);

describe("K-grid visualization lifecycle", () => {
  test("opens completed results on the quartet tree and stops K-grid work when the tree becomes active", async () => {
    const onOptimizationEnd = vi.fn();
    render(
      <KGridVisualization
        ncdMatrixResponse={MATRIX}
        objects={OBJECTS}
        labelMap={LABEL_MAP}
        onOptimizationEnd={onOptimizationEnd}
        qSearchTreeResult={TREE}
      />,
    );

    expect(screen.getByRole("button", {name: "Quartet tree"})).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", {name: "Cluster report"})).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Quartet result")).toBeInTheDocument();
    expect(screen.queryByRole("heading", {name: "Suggested structure"})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {name: "K-grid"}));
    fireEvent.click(screen.getByRole("button", {name: "Start mock K-grid"}));
    fireEvent.click(screen.getByRole("button", {name: "Quartet tree"}));

    await waitFor(() => expect(onOptimizationEnd).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", {name: "Quartet tree"})).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/Status:/)).not.toBeInTheDocument();
    expect(screen.queryByText("ncd-pipeline-v3")).not.toBeInTheDocument();
  });

  test("renders canonical object names rather than stable language identifiers", () => {
    render(
      <KGridVisualization
        ncdMatrixResponse={MATRIX}
        objects={OBJECTS}
        labelMap={LABEL_MAP}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "Distance matrix"}));

    expect(screen.getByRole("columnheader", {name: "Object"})).toBeInTheDocument();
    expect(screen.getByRole("columnheader", {name: "English"})).toBeInTheDocument();
    expect(screen.getByRole("columnheader", {name: "French"})).toBeInTheDocument();
    expect(screen.getByRole("columnheader", {name: "German, Standard (1901)"})).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", {name: "eng"})).not.toBeInTheDocument();
  });

  test("keeps implementation details out of the K-grid controls", () => {
    render(
      <KGridVisualization
        ncdMatrixResponse={MATRIX}
        objects={OBJECTS}
        labelMap={LABEL_MAP}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "K-grid"}));

    expect(screen.queryByText("Display Info")).not.toBeInTheDocument();
    expect(screen.queryByText("Grid Size:")).not.toBeInTheDocument();
    expect(screen.queryByText("Items:")).not.toBeInTheDocument();
  });
});
