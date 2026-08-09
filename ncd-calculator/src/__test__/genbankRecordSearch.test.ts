import {beforeEach, describe, expect, test, vi} from "vitest";
import {sendRequestToProxy} from "../functions/fetchProxy";
import {GenBankSearchService} from "../services/GenBankSearchService";

vi.mock("../functions/fetchProxy", () => ({sendRequestToProxy: vi.fn()}));

const summaryRecord = (overrides: Record<string, unknown> = {}) => ({
  uid: "42",
  accessionversion: "NC_012920.1",
  title: "Homo sapiens mitochondrion, complete genome",
  organism: "Homo sapiens",
  taxid: "9606",
  slen: 16569,
  updatedate: "2024/01/01",
  ...overrides,
});

describe("typed GenBank record search", () => {
  beforeEach(() => vi.clearAllMocks());

  test("retrieves an exact versioned accession without substituting an organism search", async () => {
    vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
      result: {uids: ["42"], "42": summaryRecord()},
    });
    const signal = new AbortController().signal;
    const result = await new GenBankSearchService().searchRecords({
      query: "NC_012920.1",
      scope: "mitochondrial-genome",
      signal,
    });

    expect(result.records[0]).toMatchObject({
      accessionVersion: "NC_012920.1",
      organism: "Homo sapiens",
      length: 16569,
      scope: "mitochondrial-genome",
      isComplete: true,
      sourceDatabase: "RefSeq",
    });
    expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
    expect(sendRequestToProxy).toHaveBeenCalledWith(
      {externalUrl: expect.stringContaining("esummary.fcgi")},
      {signal},
    );
  });

  test("searches a resolved animal taxonomy within one scope and exposes pagination", async () => {
    vi.mocked(sendRequestToProxy)
      .mockResolvedValueOnce({esearchresult: {idlist: ["42"], count: "7"}})
      .mockResolvedValueOnce({result: {uids: ["42"], "42": summaryRecord({
        accessionversion: "NC_002008.4",
        title: "Canis lupus familiaris mitochondrion, complete genome",
        organism: "Canis lupus familiaris",
        taxid: "9615",
        slen: 16727,
      })}});

    const result = await new GenBankSearchService().searchRecords({
      query: "dog",
      scope: "mitochondrial-genome",
      page: 1,
      pageSize: 5,
    });

    expect(result).toMatchObject({total: 7, hasMore: true, resolvedTaxId: "9615"});
    const searchUrl = new URL(vi.mocked(sendRequestToProxy).mock.calls[0][0].externalUrl);
    expect(searchUrl.searchParams.get("term")).toContain("txid9615[Organism:exp]");
    expect(searchUrl.searchParams.get("term")).toContain("mitochondrial genome");
  });

  test("keeps upstream failures distinct from an empty result", async () => {
    vi.mocked(sendRequestToProxy).mockRejectedValueOnce(new Error("offline"));
    await expect(new GenBankSearchService().searchRecords({
      query: "NC_012920.1",
      scope: "mitochondrial-genome",
    })).rejects.toMatchObject({code: "UPSTREAM_UNAVAILABLE"});
  });

  test("rejects an exact-accession lookup that resolves to a different version", async () => {
    vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
      result: {uids: ["42"], "42": summaryRecord({accessionversion: "NC_012920.2"})},
    });
    await expect(new GenBankSearchService().searchRecords({
      query: "NC_012920.1",
      scope: "mitochondrial-genome",
    })).rejects.toMatchObject({code: "NO_MATCH"});
  });

  test("reuses a short-lived typed result without another proxy call", async () => {
    vi.mocked(sendRequestToProxy).mockResolvedValueOnce({
      result: {uids: ["42"], "42": summaryRecord()},
    });
    const service = new GenBankSearchService();
    const request = {query: "NC_012920.1", scope: "mitochondrial-genome"} as const;

    await service.searchRecords(request);
    await service.searchRecords(request);
    expect(sendRequestToProxy).toHaveBeenCalledTimes(1);
  });
});
