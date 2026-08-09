import type {SelectedItem} from "../components/workbenchTypes";
import type {GenBankRecordSuggestion, GenBankSearchScope} from "./genbank";

export type GenBankPreflightSeverity = "error" | "warning" | "info";

export interface GenBankPreflightIssue {
  readonly code:
    | "MISSING_METADATA"
    | "MIXED_SCOPE"
    | "INCOMPLETE_RECORD"
    | "LENGTH_OUTLIER"
    | "DUPLICATE_ORGANISM"
    | "CIRCULAR_ORIGIN";
  readonly severity: GenBankPreflightSeverity;
  readonly message: string;
  readonly recordIds?: readonly string[];
}

export interface GenBankPreflightReport {
  readonly recordCount: number;
  readonly scope?: GenBankSearchScope | "unknown";
  readonly issues: readonly GenBankPreflightIssue[];
  readonly errors: readonly GenBankPreflightIssue[];
  readonly warnings: readonly GenBankPreflightIssue[];
  readonly canRun: boolean;
}

const inferScope = (title: string): GenBankRecordSuggestion["scope"] => {
  const normalized = title.toLowerCase();
  if (/(mitochondrion|mitochondrial).*(complete genome)|complete.*(mitochondrion|mitochondrial)/u.test(normalized)) {
    return "mitochondrial-genome";
  }
  if (/\b(coi|cox1)\b|cytochrome c oxidase subunit i\b/u.test(normalized)) return "coi";
  if (/\bcytb\b|cytochrome b\b/u.test(normalized)) return "cytb";
  return "unknown";
};

interface PreflightRecord {
  readonly id: string;
  readonly organism: string;
  readonly title: string;
  readonly length: number;
  readonly scope: GenBankRecordSuggestion["scope"];
  readonly isComplete: boolean;
}

const toPreflightRecord = (item: SelectedItem): PreflightRecord | null => {
  if (item.genBankCandidate) {
    return {
      id: item.genBankCandidate.accessionVersion,
      organism: item.genBankCandidate.organism,
      title: item.genBankCandidate.title,
      length: item.genBankCandidate.length,
      scope: item.genBankCandidate.scope,
      isComplete: item.genBankCandidate.isComplete,
    };
  }
  if (item.genBankProvenance) {
    const scope = inferScope(item.genBankProvenance.title);
    return {
      id: item.genBankProvenance.accessionVersion,
      organism: item.genBankProvenance.organism,
      title: item.genBankProvenance.title,
      length: item.genBankProvenance.expectedLength,
      scope,
      isComplete: scope === "mitochondrial-genome"
        ? /complete/iu.test(item.genBankProvenance.title) && !/partial/iu.test(item.genBankProvenance.title)
        : !/partial/iu.test(item.genBankProvenance.title),
    };
  }
  return null;
};

export const analyzeGenBankExperiment = (items: readonly SelectedItem[]): GenBankPreflightReport => {
  const fastaItems = items.filter(item => item.type === "fasta");
  const records = fastaItems.map(toPreflightRecord);
  const completeRecords = records.filter((record): record is PreflightRecord => record !== null);
  const issues: GenBankPreflightIssue[] = [];

  if (completeRecords.length !== fastaItems.length) {
    issues.push({
      code: "MISSING_METADATA",
      severity: "error",
      message: "Every GenBank selection must include verified record metadata before comparison.",
      recordIds: fastaItems.filter(item => !toPreflightRecord(item)).map(item => item.id),
    });
  }

  const scopes = new Set(completeRecords.map(record => record.scope));
  if (scopes.has("unknown")) {
    issues.push({
      code: "MISSING_METADATA",
      severity: "error",
      message: "At least one exact-accession record has an unclassified locus or genome scope.",
      recordIds: completeRecords.filter(record => record.scope === "unknown").map(record => record.id),
    });
  }
  if (scopes.size > 1) {
    issues.push({
      code: "MIXED_SCOPE",
      severity: "error",
      message: `The comparison mixes sequence scopes: ${[...scopes].join(", ")}. Select one locus or genome scope.`,
    });
  }

  const incomplete = completeRecords.filter(record => !record.isComplete);
  if (incomplete.length > 0) {
    issues.push({
      code: "INCOMPLETE_RECORD",
      severity: "error",
      message: "Partial records cannot be mixed into the default research comparison.",
      recordIds: incomplete.map(record => record.id),
    });
  }

  if (completeRecords.length > 1) {
    const lengths = completeRecords.map(record => record.length);
    const minimum = Math.min(...lengths);
    const maximum = Math.max(...lengths);
    if (minimum > 0 && maximum / minimum > 1.5) {
      issues.push({
        code: "LENGTH_OUTLIER",
        severity: "warning",
        message: `Sequence lengths differ by ${(maximum / minimum).toFixed(1)}×; inspect possible scope or completeness outliers.`,
      });
    }

    const byOrganism = new Map<string, string[]>();
    for (const record of completeRecords) {
      const key = record.organism.toLowerCase();
      byOrganism.set(key, [...(byOrganism.get(key) ?? []), record.id]);
    }
    const duplicates = [...byOrganism.values()].filter(ids => ids.length > 1).flat();
    if (duplicates.length > 0) {
      issues.push({
        code: "DUPLICATE_ORGANISM",
        severity: "warning",
        message: "Multiple records represent the same organism. Confirm that strain- or population-level comparison is intentional.",
        recordIds: duplicates,
      });
    }
  }

  const scope = scopes.size === 1 ? [...scopes][0] : undefined;
  if (scope === "mitochondrial-genome") {
    issues.push({
      code: "CIRCULAR_ORIGIN",
      severity: "info",
      message: "Mitochondrial genomes are circular. Confirm a compatible sequence origin and strand because ordinary compression is not rotation-invariant.",
    });
  }

  const errors = issues.filter(issue => issue.severity === "error");
  const warnings = issues.filter(issue => issue.severity === "warning");
  return {recordCount: completeRecords.length, scope, issues, errors, warnings, canRun: errors.length === 0};
};
