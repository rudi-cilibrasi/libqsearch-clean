import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, test, vi} from "vitest";
import {FastaSearch} from "../components/FastaSearch";
import {InputHolder} from "../components/InputHolder";
import {Language} from "../components/Language";
import ListEditor from "../components/ListEditor";
import {getWorkbenchExampleItems} from "../components/workbenchExamples";
import {FASTA, LANGUAGE} from "../constants/modalConstants";
import {STORAGE_VERSION, STORAGE_VERSION_NAME} from "../cache/LocalStorageKeyManager";

const getAstronomyExampleItemsMock = vi.hoisted(() => vi.fn(async () => (
    Array.from({length: 16}, (_, index) => ({
        id: `astronomy:test:${index}`,
        label: `Astronomy ${index + 1}`,
        type: "file_upload" as const,
        content: "1,2,3,4\n".repeat(480),
    }))
)));

const getEegExampleItemsMock = vi.hoisted(() => vi.fn(async (mode: "condition" | "electrode") => (
    Array.from({length: 16}, (_, index) => ({
        id: `eeg:test:${mode}:${index}`,
        label: `${mode === "condition" ? "Condition object" : "Electrode object"} ${index + 1}`,
        type: "eeg" as const,
        content: "+00001\n".repeat(8),
    }))
)));

vi.mock("../services/astronomyExample", () => ({
    getAstronomyExampleItems: getAstronomyExampleItemsMock,
    verifyAstronomyExampleItem: vi.fn(async () => undefined),
}));

vi.mock("../services/eegExample", () => ({
    MAX_EEG_PACKAGE_BYTES: 2 * 1024 * 1024,
    getEegExampleItems: getEegExampleItemsMock,
    importEegPortablePackage: vi.fn(async () => []),
    verifyEegExampleItem: vi.fn(async () => undefined),
    getEegExperimentContext: vi.fn(() => undefined),
}));

const compressionWorkerLifecycleMocks = vi.hoisted(() => ({
    initialize: vi.fn(),
    terminate: vi.fn(),
}));

vi.mock("../services/CompressionService", () => ({
    CompressionService: {
        getInstance: () => compressionWorkerLifecycleMocks,
        getAvailableAlgorithms: () => ["lzma", "zstd", "gzip", "brotli"],
        getAlgorithmInfo: (algorithm: string) => ({
            name: ({lzma: "LZMA", zstd: "Zstandard", gzip: "gzip / DEFLATE", brotli: "Brotli"})[
                algorithm as "lzma" | "zstd" | "gzip" | "brotli"
            ],
            description: `${algorithm} compression`,
        }),
    },
}));

describe("NCD workbench", () => {
    test("provides a valid four-object example set with independent copies", () => {
        const firstSet = getWorkbenchExampleItems();
        const secondSet = getWorkbenchExampleItems();

        expect(firstSet).toHaveLength(4);
        expect(new Set(firstSet.map((item) => item.id)).size).toBe(4);
        expect(firstSet.every((item) => (item.content?.length ?? 0) > 500)).toBe(true);
        expect(firstSet[0]).not.toBe(secondSet[0]);
    });

    test("shows a concise object count and exposes an accessible remove action", () => {
        const onRemoveItem = vi.fn();
        const items = getWorkbenchExampleItems();

        render(<InputHolder selectedItems={items} onRemoveItem={onRemoveItem} MIN_ITEMS={4}/>);

        expect(screen.getByText("4 objects")).toBeInTheDocument();
        expect(screen.queryByText("Selected objects")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Remove Sequence alpha"}));
        expect(onRemoveItem).toHaveBeenCalledWith("example-alpha");
    });

    test("keeps the empty state concise", () => {
        render(<InputHolder selectedItems={[]} onRemoveItem={vi.fn()} MIN_ITEMS={4}/>);

        expect(screen.getByText("No objects yet")).toBeInTheDocument();
        expect(screen.getByText("4 more needed")).toBeInTheDocument();
        expect(screen.getByLabelText("0 of 4 required objects selected")).toBeInTheDocument();
    });

    test("does not require sign-in for a comparison set larger than 16 objects", () => {
        const example = getWorkbenchExampleItems()[0];
        const items = Array.from({length: 17}, (_, index) => ({
            ...example,
            id: `large-set-${index}`,
            label: `Object ${index + 1}`,
        }));

        render(<InputHolder selectedItems={items} onRemoveItem={vi.fn()} MIN_ITEMS={4}/>);

        expect(screen.getByText("17 objects")).toBeInTheDocument();
        expect(screen.queryByText(/sign in to prepare/i)).not.toBeInTheDocument();
    });

    test("opens source modes directly at their useful controls", () => {
        render(
            <FastaSearch
                addItem={vi.fn()}
                selectedItems={[]}
            />
        );

        expect(screen.getByLabelText("GenBank query")).toBeInTheDocument();
        expect(screen.queryByText("Find a sequence record")).not.toBeInTheDocument();
        expect(screen.queryByText("01 / GenBank source")).not.toBeInTheDocument();

        cleanup();
        render(<Language addItem={vi.fn()} selectedItems={[]}/>);

        expect(screen.getByLabelText("Filter languages")).toHaveAttribute(
            "aria-describedby",
            "language-search-count",
        );
        expect(screen.getByText("431 languages")).toBeInTheDocument();
        expect(screen.getByRole("region", {name: "Available UDHR language groups"})).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("list")).toBeInTheDocument();
        const german = screen.getByRole("button", {name: "German, 2 variants"});
        expect(german).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(german);
        expect(german).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("button", {name: "German, Standard (1901)"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "German, Standard (1996)"})).toBeInTheDocument();
        expect(screen.queryByText("de-1901")).not.toBeInTheDocument();
        expect(screen.queryByText("Compare written languages")).not.toBeInTheDocument();
    });

    test("searches language metadata and adds explicit variants with unique labels", () => {
        const addItem = vi.fn();
        render(<Language addItem={addItem} selectedItems={[]}/>);

        const search = screen.getByLabelText("Filter languages");
        fireEvent.change(search, {target: {value: "bosnian cyrillic"}});
        expect(screen.getByText("1 language")).toBeInTheDocument();
        const bosnian = screen.getByRole("button", {name: "Bosnian, 2 variants"});
        fireEvent.click(bosnian);
        fireEvent.click(screen.getByRole("button", {name: "Bosnian (Cyrillic)"}));
        fireEvent.click(screen.getByRole("button", {name: "Bosnian (Latin)"}));

        expect(addItem).toHaveBeenNthCalledWith(1, expect.objectContaining({
            id: "udhr:bos_cyrl",
            label: "Bosnian (Cyrillic)",
        }));
        expect(addItem).toHaveBeenNthCalledWith(2, expect.objectContaining({
            id: "udhr:bos_latn",
            label: "Bosnian (Latin)",
        }));

        fireEvent.change(search, {target: {value: "francoprovencal"}});
        expect(screen.getByRole("button", {name: "Francoprovençal, 4 variants"})).toBeInTheDocument();
    });

    test("announces unavailable incomplete records and prevents selection", () => {
        render(<Language addItem={vi.fn()} selectedItems={[]}/>);
        fireEvent.change(screen.getByLabelText("Filter languages"), {target: {value: "csw"}});

        const unavailable = screen.getByRole("button", {name: "Cree, Swampy, unavailable for comparison"});
        expect(unavailable).toBeDisabled();
        expect(screen.getByText("Unavailable")).toBeInTheDocument();
    });

    test("places the primary computation action in the bottom action row", () => {
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={vi.fn()}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                />
            </MemoryRouter>
        );

        const showSimilarity = screen.getByRole("button", {name: "Show Similarity"});
        expect(showSimilarity.closest(".workbench-actions")).not.toBeNull();
        expect(showSimilarity.closest(".workbench-sourcebar")).toBeNull();
    });

    test("loads the verified astronomy example from one concise action", async () => {
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={vi.fn()}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", {name: "Astronomy example"}));

        expect(await screen.findByText("16 objects")).toBeInTheDocument();
        expect(screen.getByText("Astronomy 1")).toBeInTheDocument();
        expect(screen.getByText("Astronomy 16")).toBeInTheDocument();
        expect(getAstronomyExampleItemsMock).toHaveBeenCalledOnce();
    });

    test("offers the P300 corpus as a dedicated source with explicit analysis modes", async () => {
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={vi.fn()}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                    setOpenLogin={vi.fn()}
                    authenticated={false}
                />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("tab", {name: "P300 EEG"}));
        expect(screen.getByRole("heading", {name: "EEG source"})).toBeInTheDocument();
        expect(screen.getByRole("radio", {name: /Condition mode/u})).toBeChecked();
        fireEvent.click(screen.getByRole("button", {name: "Load condition example"}));

        expect(await screen.findByText("16 objects")).toBeInTheDocument();
        expect(screen.getByText("Condition object 1")).toBeInTheDocument();
        expect(getEegExampleItemsMock).toHaveBeenCalledWith("condition");
    });

    test("supports arrow-key navigation across source tabs", () => {
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={vi.fn()}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                    setOpenLogin={vi.fn()}
                    authenticated={false}
                />
            </MemoryRouter>
        );
        const genbank = screen.getByRole("tab", {name: "GenBank sequences"});
        genbank.focus();
        fireEvent.keyDown(genbank, {key: "End"});
        expect(screen.getByRole("tab", {name: "P300 EEG"})).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tabpanel", {name: "P300 EEG"})).toBeInTheDocument();
    });

    test("does not prewarm an unused compression worker", () => {
        compressionWorkerLifecycleMocks.initialize.mockClear();
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={vi.fn()}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                />
            </MemoryRouter>
        );

        expect(compressionWorkerLifecycleMocks.initialize).not.toHaveBeenCalled();
    });

    test("passes source metadata with the built-in comparison set", async () => {
        const onComputedNcdInput = vi.fn();
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={onComputedNcdInput}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", {name: "Sequence example"}));
        fireEvent.click(screen.getByRole("button", {name: "Show Similarity"}));

        await waitFor(() => expect(onComputedNcdInput).toHaveBeenCalledOnce());
        expect(onComputedNcdInput).toHaveBeenCalledWith(expect.objectContaining({
            kind: "objects",
            compression: "auto",
            objectMetadata: expect.arrayContaining([
                expect.objectContaining({
                    id: "example-alpha",
                    displayLabel: "Sequence alpha",
                    source: {kind: "built-in-example", exampleId: "example-alpha"},
                }),
            ]),
        }));
        expect(screen.queryByRole("button", {name: "Export tree"})).not.toBeInTheDocument();
    });

    test("carries an explicit compressor choice into the computation", async () => {
        const onComputedNcdInput = vi.fn();
        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={onComputedNcdInput}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole("button", {name: "Sequence example"}));
        fireEvent.change(screen.getByLabelText("Compression algorithm"), {target: {value: "gzip"}});
        expect(screen.getByText("gzip compression")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {name: "Show Similarity"}));

        await waitFor(() => expect(onComputedNcdInput).toHaveBeenCalledOnce());
        expect(onComputedNcdInput).toHaveBeenCalledWith(expect.objectContaining({
            kind: "objects",
            compression: "gzip",
        }));
    });

    test("upgrades saved UDHR identifiers to canonical language names", async () => {
        localStorage.setItem(STORAGE_VERSION_NAME, STORAGE_VERSION.toString());
        localStorage.setItem("searchMode", JSON.stringify({searchMode: FASTA}));
        localStorage.setItem("selectedItems", JSON.stringify([
            {id: "eng", label: "eng", type: LANGUAGE, content: ""},
            {id: "fra", label: "fra", type: LANGUAGE, content: ""},
        ]));

        render(
            <MemoryRouter>
                <ListEditor
                    onComputedNcdInput={vi.fn()}
                    setIsLoading={vi.fn()}
                    resetDisplay={vi.fn()}
                />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText("English")).toBeInTheDocument();
            expect(screen.getByText("French")).toBeInTheDocument();
        });
        expect(screen.queryByText("eng")).not.toBeInTheDocument();
        expect(screen.queryByText("fra")).not.toBeInTheDocument();
        localStorage.clear();
    });
});
