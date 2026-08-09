import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {describe, expect, test, vi} from "vitest";
import {FastaSearchSuggestion} from "../components/FastaSearchSuggestion";
import type {GenBankRecordSearchPage} from "../services/genbank";
import {GenBankSearchService} from "../services/GenBankSearchService";

const page = (requestedPage: number, hasMore: boolean): GenBankRecordSearchPage => ({
  records: [{
    uid: String(requestedPage),
    accession: `NC_00000${requestedPage}`,
    accessionVersion: `NC_00000${requestedPage}.1`,
    title: `Species ${requestedPage} mitochondrion, complete genome`,
    organism: `Species ${requestedPage}`,
    taxId: String(requestedPage),
    length: 16_000 + requestedPage,
    scope: "mitochondrial-genome",
    isComplete: true,
    sourceDatabase: "RefSeq",
    recordUrl: `https://www.ncbi.nlm.nih.gov/nuccore/NC_00000${requestedPage}.1`,
  }],
  page: requestedPage,
  pageSize: 5,
  total: hasMore ? 2 : requestedPage,
  hasMore,
});

describe("GenBank suggestion interaction", () => {
  test("preserves accession versions and loads explicit next pages", async () => {
    const searchRecords = vi.fn()
      .mockResolvedValueOnce(page(1, true))
      .mockResolvedValueOnce(page(2, false));
    const service = {searchRecords} as unknown as GenBankSearchService;
    const addItem = vi.fn();
    render(<FastaSearchSuggestion
      searchTerm="dog"
      scope="mitochondrial-genome"
      addItem={addItem}
      genbankSearchService={service}
      selectedItems={[]}
    />);

    await screen.findByText("NC_000001.1");
    fireEvent.click(screen.getByRole("button", {name: "Add Species 1, NC_000001.1"}));
    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
      id: "NC_000001.1",
      genBankCandidate: expect.objectContaining({accessionVersion: "NC_000001.1"}),
    }));

    fireEvent.click(screen.getByRole("button", {name: "Load more"}));
    await screen.findByText("NC_000002.1");
    expect(searchRecords).toHaveBeenLastCalledWith(expect.objectContaining({page: 2}));
  });

  test("aborts the obsolete request when the query changes", async () => {
    const observedSignals: AbortSignal[] = [];
    const searchRecords = vi.fn(({signal}: {signal: AbortSignal}) => {
      observedSignals.push(signal);
      return new Promise<GenBankRecordSearchPage>(() => undefined);
    });
    const service = {searchRecords} as unknown as GenBankSearchService;
    const view = render(<FastaSearchSuggestion
      searchTerm="dog"
      scope="mitochondrial-genome"
      addItem={vi.fn()}
      genbankSearchService={service}
      selectedItems={[]}
    />);
    await waitFor(() => expect(searchRecords).toHaveBeenCalledTimes(1));
    view.rerender(<FastaSearchSuggestion
      searchTerm="cat"
      scope="mitochondrial-genome"
      addItem={vi.fn()}
      genbankSearchService={service}
      selectedItems={[]}
    />);
    expect(observedSignals[0].aborted).toBe(true);
  });
});
