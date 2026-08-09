import {fireEvent, render, screen, within} from "@testing-library/react";
import {describe, expect, test} from "vitest";
import {ClusterReport} from "@/components/ClusterReport";
import type {NCDMatrixResponse} from "@/types/ncd";
import type {QTreeResponse} from "@/types/qsearch";

const PROVENANCE = {
    source: "computed",
    algorithm: "lzma",
    compressorRevision: "test",
    pipelineVersion: "ncd-pipeline-v3",
    cacheSchemaVersion: 3,
    directedMatrixForm: "ordered",
    matrixReduction: "reflected-minimum",
    pairSeparator: "\n###\n",
} as const;

const STRONG_RESPONSE: NCDMatrixResponse = {
    labels: ["a", "b", "c", "d"],
    ncdMatrix: [
        [0, 0.10, 0.90, 0.88],
        [0.10, 0, 0.85, 0.90],
        [0.90, 0.85, 0, 0.12],
        [0.88, 0.90, 0.12, 0],
    ],
    provenance: PROVENANCE,
};

const WEAK_RESPONSE: NCDMatrixResponse = {
    ...STRONG_RESPONSE,
    ncdMatrix: [
        [0, 0.5, 0.5, 0.5],
        [0.5, 0, 0.5, 0.5],
        [0.5, 0.5, 0, 0.5],
        [0.5, 0.5, 0.5, 0],
    ],
};

const THREE_GROUP_RESPONSE: NCDMatrixResponse = {
    labels: ["a", "b", "c", "d", "e", "f"],
    ncdMatrix: [
        [0, 0.08, 0.82, 0.84, 0.88, 0.86],
        [0.08, 0, 0.80, 0.83, 0.87, 0.89],
        [0.82, 0.80, 0, 0.10, 0.81, 0.85],
        [0.84, 0.83, 0.10, 0, 0.84, 0.82],
        [0.88, 0.87, 0.81, 0.84, 0, 0.09],
        [0.86, 0.89, 0.85, 0.82, 0.09, 0],
    ],
    provenance: PROVENANCE,
};

const LABEL_MAP = new Map([
    ["a", "Alpha"],
    ["b", "Beta"],
    ["c", "Gamma"],
    ["d", "Delta"],
    ["e", "Epsilon"],
    ["f", "Phi"],
]);

const TREE: QTreeResponse = {
    nodes: [
        {index: 0, label: "Alpha", connections: [4]},
        {index: 1, label: "Beta", connections: [4]},
        {index: 2, label: "Gamma", connections: [5]},
        {index: 3, label: "Delta", connections: [5]},
        {index: 4, label: "", connections: [0, 1, 5]},
        {index: 5, label: "", connections: [2, 3, 4]},
    ],
    edgeSupport: {"4-5": 0.875},
    balancedSplit: {
        edgeKey: "4-5",
        leftLeafIndices: [0, 1],
        rightLeafIndices: [2, 3],
        support: 0.875,
    },
    search: {
        pipelineVersion: "qsearch-multistart-v2",
        runCount: 16,
        baseSeed: 1,
        selectedSeed: 2,
        selectedScore: 0.95,
        scoreMinimum: 0.9,
        scoreMean: 0.93,
        scoreMaximum: 0.95,
        selectedTopologyCount: 14,
        selectedTopologySupport: 0.875,
        uniqueTopologyCount: 2,
        supportKind: "repeated-search-stability",
    },
};

describe("explainable cluster report", () => {
    test("renders a plain-language strong-separation report with direct evidence", () => {
        render(<ClusterReport ncdMatrixResponse={STRONG_RESPONSE} labelMap={LABEL_MAP} qSearchTreeResult={TREE}/>);

        expect(screen.getByRole("heading", {name: "Suggested structure"})).toBeInTheDocument();
        expect(screen.getByText("Strong separation")).toBeInTheDocument();
        expect(screen.getAllByText("Alpha + Beta")).toHaveLength(2);
        expect(screen.getByText("NCD 0.100 · lower means closer")).toBeInTheDocument();
        expect(screen.getByLabelText("2 suggested groups")).toBeInTheDocument();
        expect(screen.getByText("LZMA compression")).toBeInTheDocument();

        fireEvent.click(screen.getByText("Research details and limitations"));
        expect(screen.getByText(/14 of 16 deterministic restarts \(88%\)/)).toBeInTheDocument();
        expect(screen.getByText(/not bootstrap support or scientific confidence/)).toBeInTheDocument();
        expect(screen.queryByText("qsearch-multistart-v2")).not.toBeInTheDocument();
        expect(screen.queryByText("0.95")).not.toBeInTheDocument();
    });

    test("uses explicit exploratory language for an ambiguous matrix", () => {
        render(<ClusterReport ncdMatrixResponse={WEAK_RESPONSE} labelMap={LABEL_MAP}/>);

        expect(screen.getByText("Weak separation")).toBeInTheDocument();
        expect(screen.getByText(/groups overlap.*exploratory/i)).toBeInTheDocument();
        fireEvent.click(screen.getByText("Research details and limitations"));
        const table = screen.getByRole("table", {name: "Silhouette evaluated for candidate group counts"});
        expect(within(table).getAllByText("0.000").length).toBeGreaterThan(0);
    });

    test("allows a researcher to override and restore the suggested group count", () => {
        render(<ClusterReport ncdMatrixResponse={THREE_GROUP_RESPONSE} labelMap={LABEL_MAP}/>);

        const groupCount = screen.getByLabelText("Number of groups");
        expect(groupCount).toHaveValue("3");
        expect(screen.getByLabelText("3 suggested groups")).toBeInTheDocument();

        fireEvent.change(groupCount, {target: {value: "2"}});
        expect(screen.getByText("2 groups are shown by your selection.")).toBeInTheDocument();
        expect(screen.getByLabelText("2 selected groups")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Use suggested 3"})).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {name: "Use suggested 3"}));
        expect(groupCount).toHaveValue("3");
        expect(screen.getByLabelText("3 suggested groups")).toBeInTheDocument();
    });

    test("identifies imported matrices without inventing compressor provenance", () => {
        render(
            <ClusterReport
                ncdMatrixResponse={{
                    ...STRONG_RESPONSE,
                    provenance: {
                        ...PROVENANCE,
                        source: "imported",
                        algorithm: "unknown",
                        directedMatrixForm: "unknown",
                        matrixReduction: "unknown",
                    },
                }}
                labelMap={LABEL_MAP}
            />,
        );

        expect(screen.getByText("Imported distance matrix")).toBeInTheDocument();
        expect(screen.queryByText("UNKNOWN compression")).not.toBeInTheDocument();
    });
});
