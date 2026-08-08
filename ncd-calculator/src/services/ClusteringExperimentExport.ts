import {validateMatrix} from "@/functions/matrix";
import {
  createPairCacheKey,
  createSingleCacheKey,
  fingerprintContent,
  reduceDirectedMatrix,
} from "@/services/CompressionProtocol";
import {extractTreeSplits, getBalancedTreeSplit} from "@/services/QSearchProtocol";
import type {CompressionAlgorithm, PairCompressionRecord, SingleCompressionRecord} from "@/types/compression";
import type {
  ClusteringExperimentExport,
  ClusteringExperimentTiming,
  CompleteCompressionRecords,
  ExportedBalancedSplit,
  ExportedExperimentObject,
  ExportedTreeEdge,
  ExportedTreeNode,
} from "@/types/experiment";
import type {NCDInput, NCDMatrixResponse} from "@/types/ncd";
import {getTreeEdgeKey, type QTreeResponse} from "@/types/qsearch";

export const CLUSTERING_EXPERIMENT_FORMAT = "complearn-clustering-experiment" as const;
export const CLUSTERING_EXPERIMENT_SCHEMA_VERSION = 1 as const;
export const CLUSTERING_EXPERIMENT_SCHEMA_URL =
  "https://raw.githubusercontent.com/rudi-cilibrasi/libqsearch-clean/main/ncd-calculator/public/schemas/clustering-experiment-v1.schema.json";

const MATRIX_TOLERANCE = 1e-12;
const SHA256_PREFIX = "sha256:";

const isValidCompressionSize = (value: number): boolean => Number.isFinite(value) && value > 0;

const calculateNcd = (sizeX: number, sizeY: number, sizeXY: number): number => (
  Math.max((sizeXY - Math.min(sizeX, sizeY)) / Math.max(sizeX, sizeY), 0)
);

interface CompleteCompressionRecordInput {
  readonly algorithm: CompressionAlgorithm;
  readonly contentKeys: readonly string[];
  readonly cachedSizes: ReadonlyMap<string, number>;
  readonly newSingles: readonly SingleCompressionRecord[];
  readonly newOrderedPairs: readonly PairCompressionRecord[];
}

interface BuildClusteringExperimentInput {
  readonly input: NCDInput;
  readonly matrix: NCDMatrixResponse;
  readonly compressionRecords: CompleteCompressionRecords | null;
  readonly tree: QTreeResponse;
  readonly timing: ClusteringExperimentTiming;
  readonly exportedAt?: string;
}

const assertIsoTimestamp = (value: string, field: string): void => {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${field} must be an ISO-8601 timestamp`);
  }
};

const sha256 = async (value: string): Promise<string> => {
  const fingerprint = await fingerprintContent(value);
  if (!fingerprint.startsWith(SHA256_PREFIX)) throw new Error("SHA-256 fingerprint has an invalid format");
  return fingerprint.slice(SHA256_PREFIX.length);
};

const cloneMatrix = (matrix: readonly (readonly number[])[]): number[][] => (
  matrix.map((row) => [...row])
);

const assertSameMatrix = (
  actual: readonly (readonly number[])[],
  expected: readonly (readonly number[])[],
  message: string,
): void => {
  if (actual.length !== expected.length) throw new Error(message);
  for (let row = 0; row < actual.length; row += 1) {
    if (actual[row].length !== expected[row].length) throw new Error(message);
    for (let column = 0; column < actual[row].length; column += 1) {
      if (Math.abs(actual[row][column] - expected[row][column]) > MATRIX_TOLERANCE) {
        throw new Error(`${message} at [${row}][${column}]`);
      }
    }
  }
};

const recordKey = (record: PairCompressionRecord): string => (
  `${record.sourceContentKey}\u0000${record.targetContentKey}`
);

const setConsistentSize = (sizes: Map<string, number>, key: string, value: number, description: string): void => {
  if (!isValidCompressionSize(value)) throw new Error(`${description} has an invalid compressed size`);
  const previous = sizes.get(key);
  if (previous !== undefined && previous !== value) {
    throw new Error(`${description} has conflicting compressed sizes`);
  }
  sizes.set(key, value);
};

/** Reconstruct the complete compressed-size record set from cache hits and worker misses. */
export const collectCompleteCompressionRecords = ({
  algorithm,
  contentKeys,
  cachedSizes,
  newSingles,
  newOrderedPairs,
}: CompleteCompressionRecordInput): CompleteCompressionRecords => {
  if (!contentKeys.length) throw new Error("Compression records require at least one content key");

  const allowedContentKeys = new Set(contentKeys);
  const newSingleSizes = new Map<string, number>();
  for (const record of newSingles) {
    if (!allowedContentKeys.has(record.contentKey)) {
      throw new Error(`Worker returned a single-object record outside this experiment: ${record.contentKey}`);
    }
    setConsistentSize(newSingleSizes, record.contentKey, record.compressedSize, `Single-object record ${record.contentKey}`);
  }
  const singles: SingleCompressionRecord[] = [];
  for (const contentKey of [...new Set(contentKeys)]) {
    const cachedSize = cachedSizes.get(createSingleCacheKey(algorithm, contentKey));
    const newSize = newSingleSizes.get(contentKey);
    if (cachedSize !== undefined && newSize !== undefined && cachedSize !== newSize) {
      throw new Error(`Cache and worker disagree on the single-object size for ${contentKey}`);
    }
    const compressedSize = newSize ?? cachedSize;
    if (!isValidCompressionSize(compressedSize ?? Number.NaN)) {
      throw new Error(`Missing a valid single-object compressed size for ${contentKey}`);
    }
    singles.push({contentKey, compressedSize: compressedSize!});
  }

  const newPairSizes = new Map<string, number>();
  for (const record of newOrderedPairs) {
    if (!allowedContentKeys.has(record.sourceContentKey) || !allowedContentKeys.has(record.targetContentKey)) {
      throw new Error("Worker returned an ordered-pair record outside this experiment");
    }
    setConsistentSize(
      newPairSizes,
      recordKey(record),
      record.compressedSize,
      `Ordered-pair record ${record.sourceContentKey} -> ${record.targetContentKey}`,
    );
  }
  const orderedPairs: PairCompressionRecord[] = [];
  const seenPairs = new Set<string>();
  for (let source = 0; source < contentKeys.length; source += 1) {
    for (let target = 0; target < contentKeys.length; target += 1) {
      if (source === target) continue;
      const sourceContentKey = contentKeys[source];
      const targetContentKey = contentKeys[target];
      const key = `${sourceContentKey}\u0000${targetContentKey}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const cachedSize = cachedSizes.get(createPairCacheKey(algorithm, sourceContentKey, targetContentKey));
      const newSize = newPairSizes.get(key);
      if (cachedSize !== undefined && newSize !== undefined && cachedSize !== newSize) {
        throw new Error(`Cache and worker disagree on ${sourceContentKey} -> ${targetContentKey}`);
      }
      const compressedSize = newSize ?? cachedSize;
      if (!isValidCompressionSize(compressedSize ?? Number.NaN)) {
        throw new Error(`Missing a valid ordered-pair compressed size for ${sourceContentKey} -> ${targetContentKey}`);
      }
      orderedPairs.push({sourceContentKey, targetContentKey, compressedSize: compressedSize!});
    }
  }
  return {singles, orderedPairs};
};

const assertSearchSummary = (tree: QTreeResponse): void => {
  const {search} = tree;
  const unsignedInteger = (value: number) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
  if (
    !search.pipelineVersion
    || !Number.isInteger(search.runCount)
    || search.runCount < 1
    || !unsignedInteger(search.baseSeed)
    || !unsignedInteger(search.selectedSeed)
    || ![search.selectedScore, search.scoreMinimum, search.scoreMean, search.scoreMaximum].every(Number.isFinite)
    || search.scoreMinimum > search.scoreMean
    || search.scoreMean > search.scoreMaximum
    || Math.abs(search.selectedScore - search.scoreMaximum) > MATRIX_TOLERANCE
    || !Number.isInteger(search.selectedTopologyCount)
    || search.selectedTopologyCount < 1
    || search.selectedTopologyCount > search.runCount
    || !Number.isInteger(search.uniqueTopologyCount)
    || search.uniqueTopologyCount < 1
    || search.uniqueTopologyCount > search.runCount
    || !Number.isFinite(search.selectedTopologySupport)
    || Math.abs(search.selectedTopologySupport - (search.selectedTopologyCount / search.runCount)) > MATRIX_TOLERANCE
    || search.supportKind !== "repeated-search-stability"
  ) {
    throw new Error("Quartet tree search metadata is inconsistent");
  }
};

const buildExportedObjects = async (input: NCDInput): Promise<ExportedExperimentObject[]> => {
  const kind = input.kind ?? "objects";
  if (!input.objectMetadata || input.objectMetadata.length !== input.labels.length) {
    throw new Error("Experiment object metadata must match the object labels");
  }
  if (input.contents.length !== input.labels.length) {
    throw new Error("Experiment contents must match the object labels");
  }

  const objects: ExportedExperimentObject[] = [];
  for (let index = 0; index < input.labels.length; index += 1) {
    const metadata = input.objectMetadata[index];
    if (metadata.id !== input.labels[index]) {
      throw new Error(`Experiment metadata is out of order at object ${index}`);
    }
    if (!metadata.displayLabel.trim() || (
      input.displayLabels
      && metadata.displayLabel !== input.displayLabels[index]
    )) {
      throw new Error(`Experiment display metadata is inconsistent at object ${index}`);
    }
    if (kind === "distance-matrix") {
      if (metadata.source.kind !== "imported-distance-matrix") {
        throw new Error(`Imported matrix object ${metadata.id} has invalid source metadata`);
      }
      if (metadata.source.fileName !== input.sourceFileName) {
        throw new Error(`Imported matrix source filename is inconsistent at object ${index}`);
      }
      objects.push({...metadata, index, data: null, contentKey: null});
      continue;
    }

    const text = input.contents[index];
    const encoded = new TextEncoder().encode(text);
    const digest = await sha256(text);
    objects.push({
      ...metadata,
      index,
      contentKey: `${SHA256_PREFIX}${digest}`,
      data: {
        mediaType: "text/plain; charset=utf-8",
        encoding: "utf-8",
        utf8Bytes: encoded.byteLength,
        sha256: digest,
        text,
      },
    });
  }
  return objects;
};

const validateCompressionRecords = (
  objects: readonly ExportedExperimentObject[],
  directedMatrix: readonly (readonly number[])[],
  records: CompleteCompressionRecords,
): void => {
  const singleSizes = new Map(records.singles.map((record) => [record.contentKey, record.compressedSize]));
  const pairSizes = new Map(records.orderedPairs.map((record) => [recordKey(record), record.compressedSize]));
  if (singleSizes.size !== records.singles.length || pairSizes.size !== records.orderedPairs.length) {
    throw new Error("Compression records contain duplicate keys");
  }

  for (let source = 0; source < objects.length; source += 1) {
    const sourceKey = objects[source].contentKey;
    if (!sourceKey) throw new Error(`Object ${source} is missing its content key`);
    const sizeX = singleSizes.get(sourceKey);
    if (!isValidCompressionSize(sizeX ?? Number.NaN)) {
      throw new Error(`Compression records omit C(x) for object ${source}`);
    }
    for (let target = 0; target < objects.length; target += 1) {
      if (source === target) continue;
      const targetKey = objects[target].contentKey;
      if (!targetKey) throw new Error(`Object ${target} is missing its content key`);
      const sizeY = singleSizes.get(targetKey);
      const sizeXY = pairSizes.get(`${sourceKey}\u0000${targetKey}`);
      if (!isValidCompressionSize(sizeY ?? Number.NaN) || !isValidCompressionSize(sizeXY ?? Number.NaN)) {
        throw new Error(`Compression records omit C(x,y) for [${source}][${target}]`);
      }
      const expected = calculateNcd(sizeX!, sizeY!, sizeXY!);
      if (Math.abs(expected - directedMatrix[source][target]) > MATRIX_TOLERANCE) {
        throw new Error(`Compression records do not reproduce directed NCD [${source}][${target}]`);
      }
    }
  }
};

const buildTree = (
  tree: QTreeResponse,
  objects: readonly ExportedExperimentObject[],
): ClusteringExperimentExport["experiment"]["quartetTree"] => {
  assertSearchSummary(tree);
  extractTreeSplits(tree);
  const objectById = new Map(objects.map((object) => [object.id, object]));
  const nodeByIndex = new Map(tree.nodes.map((node) => [node.index, node]));
  const leafIds = tree.nodes.filter((node) => node.connections.length === 1).map((node) => node.label);
  if (leafIds.length !== objects.length || leafIds.some((id) => !objectById.has(id))) {
    throw new Error("Quartet tree leaves do not match the experiment objects");
  }

  const nodes: ExportedTreeNode[] = tree.nodes.map((node) => {
    const isLeaf = node.connections.length === 1;
    const object = isLeaf ? objectById.get(node.label) : undefined;
    return {
      index: node.index,
      kind: isLeaf ? "leaf" : "branch",
      nativeLabel: isLeaf ? null : (node.label || null),
      objectId: object?.id ?? null,
      displayLabel: object?.displayLabel ?? null,
      connections: [...node.connections],
    };
  });

  const edgeKeys = new Set<string>();
  const edges: ExportedTreeEdge[] = [];
  for (const node of tree.nodes) {
    for (const connection of node.connections) {
      const edgeKey = getTreeEdgeKey(node.index, connection);
      if (edgeKeys.has(edgeKey)) continue;
      edgeKeys.add(edgeKey);
      const support = tree.edgeSupport[edgeKey];
      if (support !== undefined && (!Number.isFinite(support) || support < 0 || support > 1)) {
        throw new Error(`Quartet tree has invalid support for edge ${edgeKey}`);
      }
      edges.push({
        source: Math.min(node.index, connection),
        target: Math.max(node.index, connection),
        support: support ?? null,
        supportKind: support === undefined ? null : tree.search.supportKind,
      });
    }
  }
  if (Object.keys(tree.edgeSupport).some((edgeKey) => !edgeKeys.has(edgeKey))) {
    throw new Error("Quartet tree support references a missing edge");
  }

  const expectedBalancedSplit = getBalancedTreeSplit(tree, tree.edgeSupport);
  if (JSON.stringify(expectedBalancedSplit) !== JSON.stringify(tree.balancedSplit)) {
    throw new Error("Quartet tree balanced-split metadata is inconsistent");
  }
  const splitObjects = (indices: readonly number[]) => indices.map((index) => {
    const node = nodeByIndex.get(index);
    const object = node ? objectById.get(node.label) : undefined;
    if (!object) throw new Error(`Balanced split references non-leaf node ${index}`);
    return {index: object.index, id: object.id, displayLabel: object.displayLabel};
  });
  const balancedSplit: ExportedBalancedSplit = {
    ...tree.balancedSplit,
    leftLeafIndices: [...tree.balancedSplit.leftLeafIndices],
    rightLeafIndices: [...tree.balancedSplit.rightLeafIndices],
    leftObjects: splitObjects(tree.balancedSplit.leftLeafIndices),
    rightObjects: splitObjects(tree.balancedSplit.rightLeafIndices),
  };

  return {
    rooted: false,
    nodes,
    edges,
    edgeSupport: {...tree.edgeSupport},
    balancedSplit,
    search: {...tree.search},
  };
};

type ExportedInput = ClusteringExperimentExport["experiment"]["input"];
type ExportedDistanceAnalysis = ClusteringExperimentExport["experiment"]["distanceAnalysis"];
type ExportedQuartetTree = ClusteringExperimentExport["experiment"]["quartetTree"];

/**
 * Build the compact integrity material without copying raw input text.
 * Object SHA-256 values bind the omitted text bytes to this manifest.
 */
export const getClusteringExperimentIntegrityMaterial = (
  input: ExportedInput,
  distanceAnalysis: ExportedDistanceAnalysis,
  quartetTree: ExportedQuartetTree,
): string => JSON.stringify({
  inputManifest: {
    kind: input.kind,
    sourceFileName: input.sourceFileName,
    objectCount: input.objectCount,
    objects: input.objects.map(({data, ...object}) => ({
      ...object,
      data: data === null ? null : {
        mediaType: data.mediaType,
        encoding: data.encoding,
        utf8Bytes: data.utf8Bytes,
        sha256: data.sha256,
      },
    })),
  },
  distanceAnalysis,
  quartetTree,
});

export const buildClusteringExperimentExport = async ({
  input,
  matrix,
  compressionRecords,
  tree,
  timing,
  exportedAt = new Date().toISOString(),
}: BuildClusteringExperimentInput): Promise<ClusteringExperimentExport> => {
  assertIsoTimestamp(timing.startedAt, "Experiment start time");
  assertIsoTimestamp(timing.completedAt, "Experiment completion time");
  assertIsoTimestamp(exportedAt, "Export time");
  if (Date.parse(timing.completedAt) < Date.parse(timing.startedAt)) {
    throw new Error("Experiment completion time precedes its start time");
  }
  if (matrix.labels.length !== input.labels.length || matrix.labels.some((label, index) => label !== input.labels[index])) {
    throw new Error("Matrix labels do not match the experiment input order");
  }
  const matrixError = validateMatrix(matrix.labels, matrix.ncdMatrix);
  if (matrixError) throw new Error(`Cannot export an invalid NCD matrix: ${matrixError}`);

  const kind = input.kind ?? "objects";
  if (kind === "objects" && input.sourceFileName !== undefined) {
    throw new Error("Object experiments must not claim an imported matrix source file");
  }
  if (kind === "distance-matrix" && !input.sourceFileName?.trim()) {
    throw new Error("Imported matrix experiments require the source filename");
  }
  const objects = await buildExportedObjects(input);
  const directedNcdMatrix = matrix.directedNcdMatrix ? cloneMatrix(matrix.directedNcdMatrix) : null;
  if (kind === "objects") {
    if (!directedNcdMatrix || matrix.provenance.source !== "computed" || !compressionRecords) {
      throw new Error("Computed experiments require directed NCD and complete compression records");
    }
    assertSameMatrix(
      reduceDirectedMatrix(directedNcdMatrix),
      matrix.ncdMatrix,
      "Reflected-minimum matrix does not match the directed matrix",
    );
    validateCompressionRecords(objects, directedNcdMatrix, compressionRecords);
  } else if (directedNcdMatrix || compressionRecords || matrix.provenance.source !== "imported") {
    throw new Error("Imported matrix experiments must not claim computed compression records");
  }

  const objectOrder = objects.map(({index, id, displayLabel}) => ({index, id, displayLabel}));
  const distanceAnalysis = {
    objectOrder,
    directedNcdMatrix,
    reflectedMinimumNcdMatrix: cloneMatrix(matrix.ncdMatrix),
    compression: {
      provenance: {...matrix.provenance},
      records: compressionRecords ? {
        singles: compressionRecords.singles.map((record) => ({...record})),
        orderedPairs: compressionRecords.orderedPairs.map((record) => ({...record})),
      } : null,
    },
  };
  const quartetTree = buildTree(tree, objects);
  const exportedInput = {
    kind,
    sourceFileName: input.sourceFileName ?? null,
    objectCount: objects.length,
    objects,
  };
  const resultDigest = await sha256(
    getClusteringExperimentIntegrityMaterial(exportedInput, distanceAnalysis, quartetTree),
  );

  return {
    format: CLUSTERING_EXPERIMENT_FORMAT,
    schemaVersion: CLUSTERING_EXPERIMENT_SCHEMA_VERSION,
    schema: CLUSTERING_EXPERIMENT_SCHEMA_URL,
    exportedAt,
    experiment: {
      id: `${SHA256_PREFIX}${resultDigest}`,
      timing: {...timing},
      input: exportedInput,
      distanceAnalysis,
      quartetTree,
    },
    integrity: {
      algorithm: "SHA-256",
      scope: "input-manifest + distance-analysis + quartet-tree",
      canonicalization: "complearn-export-integrity-v1",
      sha256: resultDigest,
    },
  };
};

export const serializeClusteringExperimentExport = (value: ClusteringExperimentExport): string => (
  JSON.stringify(value)
);

export const getClusteringExperimentFilename = (exportedAt: string): string => {
  assertIsoTimestamp(exportedAt, "Export time");
  return `complearn-clustering-${exportedAt.replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z")}.json`;
};
