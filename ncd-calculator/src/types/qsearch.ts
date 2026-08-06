export interface QTreeNode {
  index: number;
  label: string;
  connections: number[];
}

export interface QTreeData {
  nodes: QTreeNode[];
}

export interface QSearchNativeRun {
  seed: number;
  score: number;
  tree: QTreeData;
}

export interface QSearchSummary {
  pipelineVersion: string;
  runCount: number;
  baseSeed: number;
  selectedSeed: number;
  selectedScore: number;
  scoreMinimum: number;
  scoreMean: number;
  scoreMaximum: number;
  selectedTopologyCount: number;
  selectedTopologySupport: number;
  uniqueTopologyCount: number;
  supportKind: "repeated-search-stability";
}

/**
 * The internal edge whose two sides have the closest leaf counts.
 *
 * This is a deterministic display aid for an unrooted tree, not an inferred
 * root or an independently optimized biological grouping.
 */
export interface QSearchBalancedSplit {
  edgeKey: string;
  leftLeafIndices: number[];
  rightLeafIndices: number[];
  /** Repeated-search frequency of this split. */
  support: number;
}

export interface QTreeResponse extends QTreeData {
  /** Repeated-search split frequency, keyed by the normalized node-index edge. */
  edgeSupport: Record<string, number>;
  balancedSplit: QSearchBalancedSplit;
  search: QSearchSummary;
}

export const getTreeEdgeKey = (first: number, second: number): string => (
  `${Math.min(first, second)}-${Math.max(first, second)}`
);
