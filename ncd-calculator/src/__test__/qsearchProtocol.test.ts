import {describe, expect, test} from "vitest";
import {
  aggregateQSearchRuns,
  extractTreeSplits,
  getBalancedTreeSplit,
  getQSearchBaseSeed,
  getQSearchRunCount,
  getQSearchSeeds,
  getTopologyKey,
} from "@/services/QSearchProtocol";
import type {QTreeData} from "@/types/qsearch";

const treeForSplit = (left: [string, string], right: [string, string]): QTreeData => ({
  nodes: [
    {index: 0, label: left[0], connections: [4]},
    {index: 1, label: left[1], connections: [4]},
    {index: 2, label: right[0], connections: [5]},
    {index: 3, label: right[1], connections: [5]},
    {index: 4, label: "node 4", connections: [0, 1, 5]},
    {index: 5, label: "node 5", connections: [2, 3, 4]},
  ],
});

const eightLeafTree: QTreeData = {
  nodes: [
    {index: 0, label: "A", connections: [8]},
    {index: 1, label: "B", connections: [8]},
    {index: 2, label: "C", connections: [9]},
    {index: 3, label: "D", connections: [10]},
    {index: 4, label: "E", connections: [11]},
    {index: 5, label: "F", connections: [12]},
    {index: 6, label: "G", connections: [13]},
    {index: 7, label: "H", connections: [13]},
    {index: 8, label: "node 8", connections: [0, 1, 9]},
    {index: 9, label: "node 9", connections: [2, 8, 10]},
    {index: 10, label: "node 10", connections: [3, 9, 11]},
    {index: 11, label: "node 11", connections: [4, 10, 12]},
    {index: 12, label: "node 12", connections: [5, 11, 13]},
    {index: 13, label: "node 13", connections: [6, 7, 12]},
  ],
};

describe("repeated seeded QSearch", () => {
  test("canonicalizes unrooted topology by leaf split", () => {
    const ab = treeForSplit(["A", "B"], ["C", "D"]);
    const cd = treeForSplit(["D", "C"], ["B", "A"]);
    expect(getTopologyKey(ab)).toBe(getTopologyKey(cd));
    expect([...extractTreeSplits(ab).values()]).toEqual(['["A","B"]']);
  });

  test("selects the best score and reports topology and edge stability", () => {
    const ab = treeForSplit(["A", "B"], ["C", "D"]);
    const ac = treeForSplit(["A", "C"], ["B", "D"]);
    const result = aggregateQSearchRuns([
      {seed: 1, score: 0.80, tree: ab},
      {seed: 2, score: 0.90, tree: ab},
      {seed: 3, score: 0.95, tree: ac},
    ], 77);

    expect(result.search.selectedSeed).toBe(3);
    expect(result.search.selectedTopologyCount).toBe(1);
    expect(result.search.selectedTopologySupport).toBeCloseTo(1 / 3);
    expect(result.search.uniqueTopologyCount).toBe(2);
    expect(result.search.supportKind).toBe("repeated-search-stability");
    expect(result.edgeSupport["4-5"]).toBeCloseTo(1 / 3);
    expect(result.balancedSplit).toEqual({
      edgeKey: "4-5",
      leftLeafIndices: [0, 1],
      rightLeafIndices: [2, 3],
      support: 1 / 3,
    });
  });

  test("summarizes the most balanced unrooted split without changing topology", () => {
    const support = Object.fromEntries(
      [...extractTreeSplits(eightLeafTree).keys()].map((edge) => [edge, edge === "10-11" ? 0.75 : 1]),
    );
    expect(getBalancedTreeSplit(eightLeafTree, support)).toEqual({
      edgeKey: "10-11",
      leftLeafIndices: [0, 1, 2, 3],
      rightLeafIndices: [4, 5, 6, 7],
      support: 0.75,
    });
  });

  test("rejects duplicate leaf identifiers during topology aggregation", () => {
    const duplicateLeaves = treeForSplit(["same", "same"], ["C", "D"]);
    expect(() => getTopologyKey(duplicateLeaves)).toThrow("duplicate leaf identifiers");
  });

  test("uses deterministic bounded run schedules", () => {
    const baseSeed = getQSearchBaseSeed("same matrix");
    expect(getQSearchSeeds(baseSeed, 5)).toEqual(getQSearchSeeds(baseSeed, 5));
    expect(new Set(getQSearchSeeds(baseSeed, 5)).size).toBe(5);
    expect(getQSearchRunCount(8)).toBe(16);
    expect(getQSearchRunCount(80)).toBe(6);
    expect(getQSearchRunCount(200)).toBe(4);
  });

  test("fails fast on a disconnected or cyclic native result", () => {
    const invalid: QTreeData = {
      nodes: [
        {index: 0, label: "A", connections: [1]},
        {index: 1, label: "B", connections: [0]},
        {index: 2, label: "C", connections: [3]},
        {index: 3, label: "D", connections: [2]},
      ],
    };
    expect(() => extractTreeSplits(invalid)).toThrow("not a tree");
  });
});
