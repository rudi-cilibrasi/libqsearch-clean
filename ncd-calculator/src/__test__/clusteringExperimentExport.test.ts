import {webcrypto} from "node:crypto";
import {beforeAll, describe, expect, test, vi} from "vitest";
import {
  buildClusteringExperimentExport,
  collectCompleteCompressionRecords,
  getClusteringExperimentFilename,
  getClusteringExperimentIntegrityMaterial,
  serializeClusteringExperimentExport,
} from "@/services/ClusteringExperimentExport";
import {
  createPairCacheKey,
  createSingleCacheKey,
  fingerprintContent,
  getCompressionProvenance,
  IMPORTED_MATRIX_PROVENANCE,
  reduceDirectedMatrix,
} from "@/services/CompressionProtocol";
import type {ExperimentInputObjectMetadata} from "@/types/experiment";
import type {NCDInput} from "@/types/ncd";
import type {QTreeResponse} from "@/types/qsearch";

const CONTENTS = ["alpha", "beta", "gamma", "delta"];
const LABELS = ["object-a", "object-b", "object-c", "object-d"];
const DISPLAY_LABELS = ["Alpha", "Beta", "Gamma", "Delta"];
const DIRECTED_MATRIX = [
  [0, 0.1, 0.8, 0.9],
  [0.2, 0, 0.7, 0.8],
  [0.9, 0.8, 0, 0.1],
  [0.8, 0.9, 0.2, 0],
];
const TIMING = {
  startedAt: "2026-08-08T08:00:00.000Z",
  completedAt: "2026-08-08T08:01:00.000Z",
};
const EXPORTED_AT = "2026-08-08T08:02:03.456Z";

const TREE: QTreeResponse = {
  nodes: [
    {index: 0, label: LABELS[0], connections: [4]},
    {index: 1, label: LABELS[1], connections: [4]},
    {index: 2, label: LABELS[2], connections: [5]},
    {index: 3, label: LABELS[3], connections: [5]},
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
    runCount: 16,
    baseSeed: 123,
    selectedSeed: 456,
    selectedScore: 0.99,
    scoreMinimum: 0.9,
    scoreMean: 0.95,
    scoreMaximum: 0.99,
    selectedTopologyCount: 16,
    selectedTopologySupport: 1,
    uniqueTopologyCount: 1,
    supportKind: "repeated-search-stability",
  },
};

const objectMetadata = (): ExperimentInputObjectMetadata[] => LABELS.map((id, index) => ({
  id,
  displayLabel: DISPLAY_LABELS[index],
  source: {kind: "built-in-example", exampleId: id},
}));

const computedFixture = async () => {
  const contentKeys = await Promise.all(CONTENTS.map(fingerprintContent));
  const singles = contentKeys.map((contentKey) => ({contentKey, compressedSize: 100}));
  const orderedPairs = contentKeys.flatMap((sourceContentKey, source) => (
    contentKeys.flatMap((targetContentKey, target) => source === target ? [] : [{
      sourceContentKey,
      targetContentKey,
      compressedSize: 100 + (DIRECTED_MATRIX[source][target] * 100),
    }])
  ));
  const compressionRecords = collectCompleteCompressionRecords({
    algorithm: "lzma",
    contentKeys,
    cachedSizes: new Map(),
    newSingles: singles,
    newOrderedPairs: orderedPairs,
  });
  const input: NCDInput = {
    labels: [...LABELS],
    displayLabels: [...DISPLAY_LABELS],
    contents: [...CONTENTS],
    kind: "objects",
    objectMetadata: objectMetadata(),
  };
  return {contentKeys, compressionRecords, input};
};

describe("clustering experiment JSON export", () => {
  beforeAll(() => vi.stubGlobal("crypto", webcrypto));

  test("exports reproducible inputs, compression records, matrices, and tree metadata", async () => {
    const {contentKeys, compressionRecords, input} = await computedFixture();
    const exported = await buildClusteringExperimentExport({
      input,
      matrix: {
        labels: [...LABELS],
        directedNcdMatrix: DIRECTED_MATRIX,
        ncdMatrix: reduceDirectedMatrix(DIRECTED_MATRIX),
        provenance: getCompressionProvenance("lzma"),
      },
      compressionRecords,
      tree: TREE,
      timing: TIMING,
      exportedAt: EXPORTED_AT,
    });

    expect(exported.format).toBe("complearn-clustering-experiment");
    expect(exported.schemaVersion).toBe(1);
    expect(exported.experiment.input.objects).toHaveLength(4);
    expect(exported.experiment.input.objects[0]).toMatchObject({
      id: "object-a",
      displayLabel: "Alpha",
      contentKey: contentKeys[0],
      data: {text: "alpha", utf8Bytes: 5},
    });
    expect(exported.experiment.distanceAnalysis.compression.records?.singles).toHaveLength(4);
    expect(exported.experiment.distanceAnalysis.compression.records?.orderedPairs).toHaveLength(12);
    expect(exported.experiment.distanceAnalysis.directedNcdMatrix).toEqual(DIRECTED_MATRIX);
    expect(exported.experiment.quartetTree.rooted).toBe(false);
    expect(exported.experiment.quartetTree.balancedSplit.leftObjects.map(({id}) => id))
      .toEqual(["object-a", "object-b"]);
    expect(exported.experiment.quartetTree.edges.find(({source, target}) => source === 4 && target === 5))
      .toMatchObject({support: 1, supportKind: "repeated-search-stability"});

    const resultMaterial = getClusteringExperimentIntegrityMaterial(
      exported.experiment.input,
      exported.experiment.distanceAnalysis,
      exported.experiment.quartetTree,
    );
    expect(exported.integrity.sha256).toBe((await fingerprintContent(resultMaterial)).slice("sha256:".length));
    expect(exported.experiment.id).toBe(`sha256:${exported.integrity.sha256}`);
    expect(serializeClusteringExperimentExport(exported)).not.toContain("\n");
    expect(getClusteringExperimentFilename(EXPORTED_AT)).toBe("complearn-clustering-20260808T080203Z.json");
  });

  test("reconstructs a complete record set from cache hits and worker misses", async () => {
    const contentKeys = await Promise.all(CONTENTS.slice(0, 2).map(fingerprintContent));
    const cache = new Map<string, number>([
      [createSingleCacheKey("lzma", contentKeys[0]), 100],
      [createPairCacheKey("lzma", contentKeys[0], contentKeys[1]), 120],
    ]);
    const records = collectCompleteCompressionRecords({
      algorithm: "lzma",
      contentKeys,
      cachedSizes: cache,
      newSingles: [{contentKey: contentKeys[1], compressedSize: 110}],
      newOrderedPairs: [{
        sourceContentKey: contentKeys[1],
        targetContentKey: contentKeys[0],
        compressedSize: 121,
      }],
    });

    expect(records.singles.map(({compressedSize}) => compressedSize)).toEqual([100, 110]);
    expect(records.orderedPairs.map(({compressedSize}) => compressedSize)).toEqual([120, 121]);
  });

  test("exports an imported matrix without inventing raw inputs or compressor metadata", async () => {
    const ncdMatrix = reduceDirectedMatrix(DIRECTED_MATRIX);
    const input: NCDInput = {
      labels: [...LABELS],
      displayLabels: [...DISPLAY_LABELS],
      contents: ncdMatrix.map((row) => JSON.stringify(row)),
      kind: "distance-matrix",
      sourceFileName: "published-distances.json",
      objectMetadata: LABELS.map((id, index) => ({
        id,
        displayLabel: DISPLAY_LABELS[index],
        source: {kind: "imported-distance-matrix", fileName: "published-distances.json"},
      })),
    };
    const exported = await buildClusteringExperimentExport({
      input,
      matrix: {labels: [...LABELS], ncdMatrix, provenance: IMPORTED_MATRIX_PROVENANCE},
      compressionRecords: null,
      tree: TREE,
      timing: TIMING,
      exportedAt: EXPORTED_AT,
    });

    expect(exported.experiment.input.sourceFileName).toBe("published-distances.json");
    expect(exported.experiment.input.objects.every(({data, contentKey}) => data === null && contentKey === null)).toBe(true);
    expect(exported.experiment.distanceAnalysis.directedNcdMatrix).toBeNull();
    expect(exported.experiment.distanceAnalysis.compression.records).toBeNull();
    expect(exported.experiment.distanceAnalysis.compression.provenance.source).toBe("imported");
  });

  test("fails rather than exporting internally inconsistent results", async () => {
    const {compressionRecords, input} = await computedFixture();
    const invalidReduced = reduceDirectedMatrix(DIRECTED_MATRIX);
    invalidReduced[0][1] = invalidReduced[1][0] = 0.5;

    await expect(buildClusteringExperimentExport({
      input,
      matrix: {
        labels: [...LABELS],
        directedNcdMatrix: DIRECTED_MATRIX,
        ncdMatrix: invalidReduced,
        provenance: getCompressionProvenance("lzma"),
      },
      compressionRecords,
      tree: TREE,
      timing: TIMING,
      exportedAt: EXPORTED_AT,
    })).rejects.toThrow("Reflected-minimum matrix does not match");
  });
});
