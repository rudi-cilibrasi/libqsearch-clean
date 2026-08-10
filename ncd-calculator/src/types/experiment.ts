import type {GenBankSequenceProvenance} from "@/services/genbankSequencePipeline";
import type {UdhrLanguageRecord} from "@/functions/udhr";
import type {AstronomyExampleProvenance} from "@/services/astronomyExample";
import type {EegObjectProvenance} from "@/types/eeg";
import type {
  CompressionProvenance,
  PairCompressionRecord,
  SingleCompressionRecord,
} from "@/types/compression";
import type {QSearchBalancedSplit, QSearchSummary} from "@/types/qsearch";

export type ExperimentObjectSource =
  | {
      readonly kind: "genbank";
      readonly provenance: GenBankSequenceProvenance;
    }
  | {
      readonly kind: "udhr";
      readonly corpus: {
        readonly schemaVersion: number;
        readonly corpusVersion: string;
        readonly assetBasePath: string;
        readonly source: Readonly<Record<string, string>>;
        readonly summary: Readonly<Record<string, number>>;
      };
      readonly record: UdhrLanguageRecord;
    }
  | {
      readonly kind: "built-in-example";
      readonly exampleId: string;
    }
  | {
      readonly kind: "astronomy";
      readonly provenance: AstronomyExampleProvenance;
    }
  | {
      readonly kind: "eeg";
      readonly provenance: EegObjectProvenance;
    }
  | {
      readonly kind: "local-file";
      readonly fileName: string;
    }
  | {
      readonly kind: "imported-distance-matrix";
      readonly fileName: string;
    };

export interface ExperimentInputObjectMetadata {
  readonly id: string;
  readonly displayLabel: string;
  readonly source: ExperimentObjectSource;
}

export interface CompleteCompressionRecords {
  readonly singles: readonly SingleCompressionRecord[];
  readonly orderedPairs: readonly PairCompressionRecord[];
}

export interface ClusteringExperimentTiming {
  readonly startedAt: string;
  readonly completedAt: string;
}

export interface ExportedExperimentObject extends ExperimentInputObjectMetadata {
  readonly index: number;
  readonly data: {
    readonly mediaType: "text/plain; charset=utf-8";
    readonly encoding: "utf-8";
    readonly utf8Bytes: number;
    readonly sha256: string;
    readonly text: string;
  } | null;
  readonly contentKey: string | null;
}

export interface ExportedTreeNode {
  readonly index: number;
  readonly kind: "leaf" | "branch";
  readonly nativeLabel: string | null;
  readonly objectId: string | null;
  readonly displayLabel: string | null;
  readonly connections: readonly number[];
}

export interface ExportedTreeEdge {
  readonly source: number;
  readonly target: number;
  readonly support: number | null;
  readonly supportKind: "repeated-search-stability" | null;
}

export interface ExportedBalancedSplit extends QSearchBalancedSplit {
  readonly leftObjects: readonly Pick<ExportedExperimentObject, "index" | "id" | "displayLabel">[];
  readonly rightObjects: readonly Pick<ExportedExperimentObject, "index" | "id" | "displayLabel">[];
}

export interface ClusteringExperimentExport {
  readonly format: "complearn-clustering-experiment";
  readonly schemaVersion: 1;
  readonly schema: string;
  readonly exportedAt: string;
  readonly experiment: {
    readonly id: string;
    readonly timing: ClusteringExperimentTiming;
    readonly input: {
      readonly kind: "objects" | "distance-matrix";
      readonly sourceFileName: string | null;
      readonly objectCount: number;
      readonly objects: readonly ExportedExperimentObject[];
    };
    readonly distanceAnalysis: {
      readonly objectOrder: readonly Pick<ExportedExperimentObject, "index" | "id" | "displayLabel">[];
      readonly directedNcdMatrix: readonly (readonly number[])[] | null;
      readonly reflectedMinimumNcdMatrix: readonly (readonly number[])[];
      readonly compression: {
        readonly provenance: CompressionProvenance;
        readonly records: CompleteCompressionRecords | null;
      };
    };
    readonly quartetTree: {
      readonly rooted: false;
      readonly nodes: readonly ExportedTreeNode[];
      readonly edges: readonly ExportedTreeEdge[];
      readonly edgeSupport: Readonly<Record<string, number>>;
      readonly balancedSplit: ExportedBalancedSplit;
      readonly search: QSearchSummary;
    };
  };
  readonly integrity: {
    readonly algorithm: "SHA-256";
    readonly scope: "input-manifest + distance-analysis + quartet-tree";
    readonly canonicalization: "complearn-export-integrity-v1";
    readonly sha256: string;
  };
}
