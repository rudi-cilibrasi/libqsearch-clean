import {render, screen} from "@testing-library/react";
import {describe, expect, test} from "vitest";

import {GridDisplay} from "@/components/GridDisplay";
import type {GridState} from "@/datastructures/kgrid";

const GRID: GridState = {
  width: 2,
  height: 2,
  grid: [[0, 1], [2, 3]],
  numericNcdMatrix: [
    [0, 0.9, 0.95, 0.94],
    [0.9, 0, 0.95, 0.95],
    [0.95, 0.95, 0, 0.93],
    [0.94, 0.95, 0.93, 0],
  ],
  idToIndexMap: new Map([["eng", 0], ["fra", 1], ["deu", 2], ["nld", 3]]),
  indexToIdMap: new Map([[0, "eng"], [1, "fra"], [2, "deu"], [3, "nld"]]),
  factorMatrix: [[1, 1], [1, 1]],
  objectiveValue: 0,
  emptyIndex: -1,
};

const OBJECTS = {
  eng: {label: "English", content: GRID.numericNcdMatrix[0]},
  fra: {label: "French", content: GRID.numericNcdMatrix[1]},
  deu: {label: "German, Standard (1901)", content: GRID.numericNcdMatrix[2]},
  nld: {label: "Dutch", content: GRID.numericNcdMatrix[3]},
};

describe("K-grid display labels", () => {
  test("shows canonical names without exposing internal language identifiers", () => {
    render(
      <GridDisplay
        grid={GRID}
        objectsById={OBJECTS}
        iterations={0}
        fitToContainer={false}
      />,
    );

    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("French")).toBeInTheDocument();
    expect(screen.getByText("German, Standard (1901)")).toBeInTheDocument();
    expect(screen.getByText("Dutch")).toBeInTheDocument();
    expect(screen.queryByText(/ID:/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/\beng\b/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^C\d+$/u)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\(\d+,\d+\)$/u)).not.toBeInTheDocument();
  });

  test("does not expose coordinates for empty grid cells", () => {
    render(
      <GridDisplay
        grid={{...GRID, grid: [[0, 1], [2, -1]]}}
        objectsById={OBJECTS}
        iterations={0}
        fitToContainer={false}
      />,
    );

    expect(screen.queryByText(/^\(\d+,\d+\)$/u)).not.toBeInTheDocument();
  });
});
