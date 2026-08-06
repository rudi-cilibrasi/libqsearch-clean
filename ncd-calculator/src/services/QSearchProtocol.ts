import type {
  QSearchBalancedSplit,
  QSearchNativeRun,
  QTreeData,
  QTreeResponse,
} from "@/types/qsearch";
import {getTreeEdgeKey} from "@/types/qsearch";

export const QSEARCH_PIPELINE_VERSION = "qsearch-multistart-v2";
export const QSEARCH_MAX_RUN_COUNT = 64;

const compareText = (left: string, right: string): number => left.localeCompare(right, "en");

const assertTree = (tree: QTreeData): void => {
  if (!tree.nodes.length) throw new Error("QSearch returned an empty tree");
  const nodes = new Map(tree.nodes.map((node) => [node.index, node]));
  if (nodes.size !== tree.nodes.length) throw new Error("QSearch returned duplicate node indices");

  let edgeCount = 0;
  for (const node of tree.nodes) {
    const uniqueConnections = new Set(node.connections);
    if (uniqueConnections.size !== node.connections.length) {
      throw new Error(`QSearch node ${node.index} contains duplicate connections`);
    }
    for (const connection of uniqueConnections) {
      const neighbor = nodes.get(connection);
      if (!neighbor?.connections.includes(node.index)) {
        throw new Error(`QSearch edge ${node.index}-${connection} is not reciprocal`);
      }
      if (node.index < connection) edgeCount += 1;
    }
  }
  if (edgeCount !== tree.nodes.length - 1) throw new Error("QSearch result is not a tree");

  const visited = new Set<number>();
  const pending = [tree.nodes[0].index];
  while (pending.length) {
    const index = pending.pop()!;
    if (visited.has(index)) continue;
    visited.add(index);
    pending.push(...(nodes.get(index)?.connections ?? []));
  }
  if (visited.size !== tree.nodes.length) throw new Error("QSearch result is disconnected");

  const leafLabels = tree.nodes
    .filter((node) => node.connections.length === 1)
    .map((node) => node.label);
  if (leafLabels.some((label) => !label)) {
    throw new Error("QSearch returned an unlabeled leaf");
  }
  if (new Set(leafLabels).size !== leafLabels.length) {
    throw new Error("QSearch returned duplicate leaf identifiers");
  }
};

const labelsOnSide = (
  tree: QTreeData,
  start: number,
  blocked: number,
): string[] => {
  const nodes = new Map(tree.nodes.map((node) => [node.index, node]));
  const visited = new Set<number>([blocked]);
  const pending = [start];
  const labels: string[] = [];
  while (pending.length) {
    const index = pending.pop()!;
    if (visited.has(index)) continue;
    visited.add(index);
    const node = nodes.get(index);
    if (!node) throw new Error(`QSearch edge references missing node ${index}`);
    if (node.connections.length === 1) labels.push(node.label);
    pending.push(...node.connections);
  }
  return labels.sort(compareText);
};

const canonicalSplit = (left: string[], right: string[]): string => {
  const leftKey = JSON.stringify(left);
  const rightKey = JSON.stringify(right);
  if (left.length < right.length) return leftKey;
  if (right.length < left.length) return rightKey;
  return compareText(leftKey, rightKey) <= 0 ? leftKey : rightKey;
};

const leafIndicesOnSide = (
  tree: QTreeData,
  start: number,
  blocked: number,
): number[] => {
  const nodes = new Map(tree.nodes.map((node) => [node.index, node]));
  const visited = new Set<number>([blocked]);
  const pending = [start];
  const indices: number[] = [];
  while (pending.length) {
    const index = pending.pop()!;
    if (visited.has(index)) continue;
    visited.add(index);
    const node = nodes.get(index);
    if (!node) throw new Error(`QSearch edge references missing node ${index}`);
    if (node.connections.length === 1) indices.push(node.index);
    pending.push(...node.connections);
  }
  return indices.sort((left, right) => left - right);
};

const orderIndexSides = (left: number[], right: number[]): [number[], number[]] => {
  if (left.length < right.length) return [left, right];
  if (right.length < left.length) return [right, left];
  return JSON.stringify(left) <= JSON.stringify(right) ? [left, right] : [right, left];
};

/** Return every non-trivial unrooted split and the edge that induces it. */
export const extractTreeSplits = (tree: QTreeData): Map<string, string> => {
  assertTree(tree);
  const leafCount = tree.nodes.filter((node) => node.connections.length === 1).length;
  const result = new Map<string, string>();

  for (const node of tree.nodes) {
    for (const connection of node.connections) {
      if (node.index >= connection) continue;
      const left = labelsOnSide(tree, node.index, connection);
      const right = labelsOnSide(tree, connection, node.index);
      if (left.length + right.length !== leafCount) {
        throw new Error("QSearch split does not contain every leaf exactly once");
      }
      if (Math.min(left.length, right.length) < 2) continue;
      result.set(getTreeEdgeKey(node.index, connection), canonicalSplit(left, right));
    }
  }
  return result;
};

export const getTopologyKey = (tree: QTreeData): string => (
  JSON.stringify([...extractTreeSplits(tree).values()].sort(compareText))
);

/**
 * Choose the internal edge with the most even number of leaves on either side.
 * Support and a canonical index ordering only break equal-balance ties. This
 * does not root or modify the inferred topology.
 */
export const getBalancedTreeSplit = (
  tree: QTreeData,
  edgeSupport: Readonly<Record<string, number>>,
): QSearchBalancedSplit => {
  const candidates = [...extractTreeSplits(tree).keys()].map((edgeKey) => {
    const [first, second] = edgeKey.split("-").map(Number);
    if (!Number.isInteger(first) || !Number.isInteger(second)) {
      throw new Error(`QSearch produced an invalid edge key: ${edgeKey}`);
    }
    const [leftLeafIndices, rightLeafIndices] = orderIndexSides(
      leafIndicesOnSide(tree, first, second),
      leafIndicesOnSide(tree, second, first),
    );
    const support = edgeSupport[edgeKey];
    if (!Number.isFinite(support) || support < 0 || support > 1) {
      throw new Error(`QSearch produced invalid split support for edge ${edgeKey}`);
    }
    return {
      edgeKey,
      leftLeafIndices,
      rightLeafIndices,
      support,
      imbalance: Math.abs(leftLeafIndices.length - rightLeafIndices.length),
      orderKey: `${JSON.stringify(leftLeafIndices)}|${JSON.stringify(rightLeafIndices)}`,
    };
  });
  if (!candidates.length) throw new Error("QSearch tree contains no non-trivial split");

  const selected = candidates.sort((left, right) => (
    left.imbalance - right.imbalance
    || right.support - left.support
    || compareText(left.orderKey, right.orderKey)
    || compareText(left.edgeKey, right.edgeKey)
  ))[0];
  return {
    edgeKey: selected.edgeKey,
    leftLeafIndices: selected.leftLeafIndices,
    rightLeafIndices: selected.rightLeafIndices,
    support: selected.support,
  };
};

const sameLeafSet = (left: QTreeData, right: QTreeData): boolean => {
  const leaves = (tree: QTreeData) => tree.nodes
    .filter((node) => node.connections.length === 1)
    .map((node) => node.label)
    .sort(compareText);
  return JSON.stringify(leaves(left)) === JSON.stringify(leaves(right));
};

export const aggregateQSearchRuns = (
  runs: readonly QSearchNativeRun[],
  baseSeed: number,
): QTreeResponse => {
  if (!runs.length) throw new Error("QSearch produced no search runs");
  if (runs.some((run) => !Number.isFinite(run.score))) {
    throw new Error("QSearch produced a non-finite tree score");
  }
  if (runs.some((run) => !sameLeafSet(runs[0].tree, run.tree))) {
    throw new Error("QSearch runs do not contain the same leaf set");
  }

  const analyzed = runs.map((run) => ({...run, topologyKey: getTopologyKey(run.tree)}));
  const topologyCounts = new Map<string, number>();
  const splitCounts = new Map<string, number>();
  for (const run of analyzed) {
    topologyCounts.set(run.topologyKey, (topologyCounts.get(run.topologyKey) ?? 0) + 1);
    for (const split of new Set(extractTreeSplits(run.tree).values())) {
      splitCounts.set(split, (splitCounts.get(split) ?? 0) + 1);
    }
  }

  const selected = [...analyzed].sort((left, right) => {
    const scoreDifference = right.score - left.score;
    if (scoreDifference !== 0) return scoreDifference;
    const frequencyDifference = (topologyCounts.get(right.topologyKey) ?? 0)
      - (topologyCounts.get(left.topologyKey) ?? 0);
    if (frequencyDifference) return frequencyDifference;
    const topologyDifference = compareText(left.topologyKey, right.topologyKey);
    return topologyDifference || left.seed - right.seed;
  })[0];

  const edgeSupport = Object.fromEntries(
    [...extractTreeSplits(selected.tree)].map(([edge, split]) => [
      edge,
      (splitCounts.get(split) ?? 0) / runs.length,
    ]),
  );
  const scores = analyzed.map((run) => run.score);
  const selectedTopologyCount = topologyCounts.get(selected.topologyKey) ?? 1;

  return {
    ...selected.tree,
    edgeSupport,
    balancedSplit: getBalancedTreeSplit(selected.tree, edgeSupport),
    search: {
      pipelineVersion: QSEARCH_PIPELINE_VERSION,
      runCount: runs.length,
      baseSeed,
      selectedSeed: selected.seed,
      selectedScore: selected.score,
      scoreMinimum: Math.min(...scores),
      scoreMean: scores.reduce((total, score) => total + score, 0) / scores.length,
      scoreMaximum: Math.max(...scores),
      selectedTopologyCount,
      selectedTopologySupport: selectedTopologyCount / runs.length,
      uniqueTopologyCount: topologyCounts.size,
      supportKind: "repeated-search-stability",
    },
  };
};

export const getQSearchRunCount = (objectCount: number): number => {
  if (objectCount <= 16) return 16;
  if (objectCount <= 64) return 10;
  if (objectCount <= 128) return 6;
  return 4;
};

/** FNV-1a produces a stable uint32 seed without depending on browser crypto. */
export const getQSearchBaseSeed = (matrixInput: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < matrixInput.length; index += 1) {
    hash ^= matrixInput.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const getQSearchSeeds = (baseSeed: number, count: number): number[] => {
	if (!Number.isInteger(count) || count < 1 || count > QSEARCH_MAX_RUN_COUNT) {
		throw new Error(`QSearch run count must be between 1 and ${QSEARCH_MAX_RUN_COUNT}`);
	}
  let state = baseSeed >>> 0;
  return Array.from({length: count}, () => {
    state = (state + 0x9e3779b9) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97);
    return (mixed ^ (mixed >>> 15)) >>> 0;
  });
};
