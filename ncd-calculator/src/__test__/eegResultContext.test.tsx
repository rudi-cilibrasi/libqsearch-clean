import axe, {type AxeResults} from "axe-core";
import {fireEvent, render, screen} from "@testing-library/react";
import {describe, expect, test} from "vitest";
import {EegAnalysisPanel, EegQuartetContext} from "../components/EegResultContext";
import type {EegExperimentContext, EegObjectRecord} from "../types/eeg";

const record = (condition: "target" | "standard", index: number, mode: "condition" | "electrode" = "condition", electrode = "Pz"): EegObjectRecord => ({
    id: `${mode}-${electrode}-${condition}-${index}`,
    label: `${mode === "condition" ? "Condition object" : `${electrode} · object`} ${index}`,
    revealedLabel: `${electrode} · ${condition} ${index}`,
    mode, condition, replicate: index,
    electrode: {name: electrode, x: electrode === "C3" ? -.4 : electrode === "C4" ? .4 : 0, y: 0, coordinateSource: "test"},
    sampleCount: 8, samplesPerSegment: 8, segmentCount: 1, sha256: `${index}`.repeat(64).slice(0, 64), utf8Bytes: 56,
    qc: {
        candidateEpochs: 10, acceptedEpochs: 9, rejectedEpochs: 1,
        minimum: -1, maximum: 1, rms: 1, peakToPeak: 2,
        preview: condition === "target" ? [0, 1, 1, 0, -1, -1, 0, 1] : [0, -1, -1, 0, 1, 1, 0, -1],
    },
});

const context = (records: EegObjectRecord[], mode: "condition" | "electrode" = "condition"): EegExperimentContext => ({
    mode,
    records,
    manifest: {
        schemaVersion: "complearn-eeg-manifest-v1",
        corpusId: "test-eeg-corpus",
        createdAt: "2026-08-10T00:00:00.000Z",
        source: {
            datasetId: "ds003061", datasetVersion: "1.1.2", name: "Oddball", doi: "10.18112/openneuro.ds003061.v1.1.2",
            url: "https://openneuro.org/datasets/ds003061/versions/1.1.2", license: "CC0", subject: "001", task: "P300", run: "1", exactPaperReproduction: false,
        },
        preprocessing: {
            software: "MNE test", bandpassHz: [0.5, 10], reference: "average", sourceSamplingHz: 256, outputSamplingHz: 128,
            epochWindowSeconds: [-.2, .6], baselineWindowSeconds: [-.2, 0], rejectionPeakToPeakMicrovolts: 200,
            averaging: {segmentsPerObject: 1, epochsPerSegment: 3}, normalization: "z-score-each-average",
        },
        encoding: {schemaVersion: "complearn-eeg-ascii-v1", quantizationScale: 100, integerWidth: 5, clipAbsolute: 9999, segmentSeparator: "--", lineEnding: "LF"},
    },
});

const conditionRecords = [record("target", 1), record("target", 2), record("standard", 3), record("standard", 4)];
const separatedMatrix = [[0, .1, .9, .8], [.1, 0, .8, .9], [.9, .8, 0, .1], [.8, .9, .1, 0]];
const violationSummary = (results: AxeResults): string[] => results.violations.map(violation => violation.id);

describe("EEG result context", () => {
    test("places condition-blind waveform QC and provenance beside the quartet result", () => {
        render(<EegQuartetContext context={context(conditionRecords)}/>);
        expect(screen.getByRole("heading", {name: "Waveform QC and provenance"})).toBeInTheDocument();
        expect(screen.getByRole("img", {name: /Envelope of all selected EEG/u})).toBeInTheDocument();
        expect(screen.getByRole("link", {name: /ds003061/u})).toHaveAttribute("href", expect.stringContaining("openneuro.org"));
        expect(screen.queryByText("Pz · target 1")).not.toBeInTheDocument();
    });

    test("reveals labels only after the user requests evaluation", () => {
        render(<EegAnalysisPanel context={context(conditionRecords)} ncdMatrix={separatedMatrix}/>);
        expect(screen.getByText("Labels are hidden")).toBeInTheDocument();
        expect(screen.queryByText("Balanced accuracy")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Reveal labels & evaluate"}));
        expect(screen.getByText("Balanced accuracy")).toBeInTheDocument();
        expect(screen.getByRole("row", {name: /NCD 100.0% 100.0% 100.0%/u})).toBeInTheDocument();
        expect(screen.getByRole("row", {name: /Euclidean/u})).toBeInTheDocument();
        expect(screen.getByRole("row", {name: /Correlation/u})).toBeInTheDocument();
        expect(screen.getByRole("row", {name: /DTW/u})).toBeInTheDocument();
    });

    test("provides a keyboard-readable scalp map and conventional paired baselines", () => {
        const electrodeRecords = [
            record("target", 1, "electrode", "C3"), record("standard", 2, "electrode", "C3"),
            record("target", 3, "electrode", "C4"), record("standard", 4, "electrode", "C4"),
        ];
        render(<EegAnalysisPanel context={context(electrodeRecords, "electrode")} ncdMatrix={separatedMatrix}/>);
        expect(screen.getByRole("img", {name: /^Scalp map of paired NCD distances/u})).toBeInTheDocument();
        expect(screen.getByRole("table", {name: "Paired condition distances by electrode"})).toBeInTheDocument();
        expect(screen.getAllByRole("img", {name: /C[34], NCD/u})).toHaveLength(2);
    });

    test("has no automatically detectable WCAG A/AA violations", async () => {
        const {container} = render(<EegAnalysisPanel context={context(conditionRecords)} ncdMatrix={separatedMatrix}/>);
        const results = await axe.run(container, {
            runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]},
            rules: {"color-contrast": {enabled: false}},
        });
        expect(violationSummary(results)).toEqual([]);
    });
});
