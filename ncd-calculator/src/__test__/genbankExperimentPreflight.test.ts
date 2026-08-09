import {describe, expect, test} from "vitest";
import type {SelectedItem} from "../components/workbenchTypes";
import type {GenBankRecordSuggestion} from "../services/genbank";
import {analyzeGenBankExperiment} from "../services/genbankExperimentPreflight";

const item = (accessionVersion: string, overrides: Partial<GenBankRecordSuggestion> = {}): SelectedItem => ({
  id: accessionVersion,
  label: accessionVersion,
  type: "fasta",
  genBankCandidate: {
    uid: accessionVersion.replace(/\D/gu, "") || "1",
    accession: accessionVersion.split(".")[0],
    accessionVersion,
    title: "Example species mitochondrion, complete genome",
    organism: `Species ${accessionVersion}`,
    taxId: "1",
    length: 16_500,
    scope: "mitochondrial-genome",
    isComplete: true,
    sourceDatabase: "RefSeq",
    recordUrl: `https://www.ncbi.nlm.nih.gov/nuccore/${accessionVersion}`,
    ...overrides,
  },
});

describe("GenBank experiment preflight", () => {
  test("accepts one comparable complete scope and explains circular-origin sensitivity", () => {
    const report = analyzeGenBankExperiment([
      item("NC_000001.1"),
      item("NC_000002.1"),
      item("NC_000003.1"),
      item("NC_000004.1"),
    ]);
    expect(report.canRun).toBe(true);
    expect(report.issues).toContainEqual(expect.objectContaining({code: "CIRCULAR_ORIGIN", severity: "info"}));
  });

  test("blocks mixed scopes, partial records, and missing metadata", () => {
    const report = analyzeGenBankExperiment([
      item("NC_000001.1"),
      item("AB123456.1", {scope: "coi", isComplete: false, title: "partial COI gene"}),
      {id: "NC_000003.1", label: "missing", type: "fasta"},
    ]);
    expect(report.canRun).toBe(false);
    expect(report.errors.map(issue => issue.code)).toEqual(expect.arrayContaining([
      "MISSING_METADATA",
      "MIXED_SCOPE",
      "INCOMPLETE_RECORD",
    ]));
  });

  test("warns about large length differences and repeated organisms", () => {
    const report = analyzeGenBankExperiment([
      item("NC_000001.1", {organism: "Same species", length: 10_000}),
      item("NC_000002.1", {organism: "Same species", length: 20_000}),
    ]);
    expect(report.warnings.map(issue => issue.code)).toEqual(expect.arrayContaining([
      "LENGTH_OUTLIER",
      "DUPLICATE_ORGANISM",
    ]));
  });
});
