jest.mock("../configurations/envLoader", () => ({
    __esModule: true,
    default: {GENBANK_API_KEY: "server-secret", NCBI_EMAIL: "research@example.org"},
}));

import axios from "axios";
import {NcbiRequestScheduler, prepareNcbiUrl} from "../genbank/ncbiClient";

describe("NCBI request validation", () => {
    test("pins the E-utilities host and replaces client credentials", () => {
        const url = new URL(prepareNcbiUrl(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=42&api_key=attacker",
        ));
        expect(url.searchParams.get("api_key")).toBe("server-secret");
        expect(url.searchParams.get("email")).toBe("research@example.org");
        expect(url.searchParams.get("tool")).toBe("complearn-ncd");
    });

    test.each([
        "http://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore",
        "https://example.org/entrez/eutils/esearch.fcgi?db=nuccore",
        "https://eutils.ncbi.nlm.nih.gov/private?db=nuccore",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=protein",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=dog&retmax=10000&retmode=json",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=NC_1.1,NC_1.1&retmode=json",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_1.1&rettype=gb&retmode=text",
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=dog&retmode=json&evil=true",
    ])("rejects an unsafe target: %s", target => {
        expect(() => prepareNcbiUrl(target)).toThrow();
    });

    test("accepts the bounded request shapes used by sequence search and retrieval", () => {
        expect(() => prepareNcbiUrl(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nuccore&term=txid9615%5BOrganism%5D&retstart=0&retmax=5&retmode=json&sort=relevance&usehistory=y",
        )).not.toThrow();
        expect(() => prepareNcbiUrl(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=nuccore&id=NC_002008.4&retmode=json&version=2.0",
        )).not.toThrow();
        expect(() => prepareNcbiUrl(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=nuccore&id=NC_002008.4&rettype=fasta&retmode=text",
        )).not.toThrow();
    });

    test("spaces concurrent upstream requests according to the shared rate budget", async () => {
        jest.useFakeTimers();
        const request = jest.spyOn(axios, "request").mockResolvedValue({
            data: "ok",
            status: 200,
            statusText: "OK",
            headers: {},
            config: {headers: {}},
        });
        const scheduler = new NcbiRequestScheduler(2);

        const first = scheduler.request({url: "https://example.test/first"});
        const second = scheduler.request({url: "https://example.test/second"});
        await jest.advanceTimersByTimeAsync(0);
        expect(request).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(499);
        expect(request).toHaveBeenCalledTimes(1);
        await jest.advanceTimersByTimeAsync(1);
        await expect(Promise.all([first, second])).resolves.toHaveLength(2);
        expect(request).toHaveBeenCalledTimes(2);

        request.mockRestore();
        jest.useRealTimers();
    });

    test("does not dispatch or retry a request that the browser has cancelled", async () => {
        const request = jest.spyOn(axios, "request");
        const controller = new AbortController();
        controller.abort();

        await expect(new NcbiRequestScheduler(10).request({
            url: "https://example.test/cancelled",
            signal: controller.signal,
        })).rejects.toMatchObject({code: "ERR_CANCELED"});
        expect(request).not.toHaveBeenCalled();
        request.mockRestore();
    });
});
