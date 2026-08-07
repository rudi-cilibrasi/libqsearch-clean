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

vi.mock("../services/CompressionService", () => ({
    CompressionService: {
        getInstance: () => ({initialize: vi.fn(), terminate: vi.fn()}),
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

    test("opens source modes directly at their useful controls", () => {
        render(
            <FastaSearch
                addItem={vi.fn()}
                selectedItems={[]}
                getAllFastaSuggestionWithLastIndex={() => ({})}
                getFastaSuggestionStartIndex={() => 0}
                setFastaSuggestionStartIndex={vi.fn()}
            />
        );

        expect(screen.getByLabelText("GenBank query")).toBeInTheDocument();
        expect(screen.queryByText("Find a sequence record")).not.toBeInTheDocument();
        expect(screen.queryByText("01 / GenBank source")).not.toBeInTheDocument();

        cleanup();
        render(<Language addItem={vi.fn()} selectedItems={[]}/>);

        expect(screen.getByLabelText("Filter languages")).toBeInTheDocument();
        expect(screen.getByRole("region", {name: "Available languages"})).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("list")).toBeInTheDocument();
        expect(screen.queryByText("Compare written languages")).not.toBeInTheDocument();
    });

    test("places the primary computation action in the bottom action row", () => {
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

        const showSimilarity = screen.getByRole("button", {name: "Show Similarity"});
        expect(showSimilarity.closest(".workbench-actions")).not.toBeNull();
        expect(showSimilarity.closest(".workbench-sourcebar")).toBeNull();
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
                    setOpenLogin={vi.fn()}
                    authenticated={false}
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
