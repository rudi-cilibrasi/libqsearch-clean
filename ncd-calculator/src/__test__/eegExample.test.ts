import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, test, vi} from "vitest";
import {getEegExampleItems, importEegPortablePackage, verifyEegExampleItem} from "../services/eegExample";
import type {EegDatasetSource} from "../types/eeg";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const corpusRoot = path.resolve(testDirectory, "../../public/corpora/eeg/ds003061-p300-v1");
const manifestBytes = readFileSync(path.join(corpusRoot, "manifest.json"));

const responseFor = (url: string, corrupt = false): Response => {
    const relative = url.split("corpora/eeg/ds003061-p300-v1/")[1];
    if (!relative) return new Response("not found", {status: 404});
    const bytes = Buffer.from(readFileSync(path.join(corpusRoot, relative)));
    if (corrupt && relative.startsWith("records/")) bytes[0] = bytes[0] === 43 ? 45 : 43;
    return new Response(bytes, {status: 200, headers: {"content-length": String(bytes.byteLength)}});
};

describe("ds003061-derived P300 corpus", () => {
    test("loads one bounded analysis mode with blinded labels and provenance", async () => {
        const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));
        const items = await getEegExampleItems("condition", fetchImplementation as typeof fetch);
        expect(items).toHaveLength(16);
        expect(items[0].label).toMatch(/^Condition object \d{2}$/u);
        expect(items.every(item => item.content?.includes("--\n"))).toBe(true);
        expect(items.every(item => item.content?.includes("target") === false)).toBe(true);
        expect(items.every(item => item.eegProvenance?.manifest.source.exactPaperReproduction === false)).toBe(true);
        expect(fetchImplementation).toHaveBeenCalledTimes(17);
    });

    test("fails closed on a modified signal and rechecks persisted content", async () => {
        const corruptFetch = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input), true));
        await expect(getEegExampleItems("condition", corruptFetch as typeof fetch)).rejects.toThrow("integrity verification");

        const validFetch = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));
        const [item] = await getEegExampleItems("electrode", validFetch as typeof fetch);
        await expect(verifyEegExampleItem({...item, content: `-${item.content?.slice(1)}`})).rejects.toThrow("integrity verification");
    });

    test("imports the builder's self-contained BIDS derivative format", async () => {
        const manifest = JSON.parse(manifestBytes.toString("utf8")) as {records: Array<{asset: string; content?: string}>};
        manifest.records.forEach(record => {
            record.content = readFileSync(path.join(corpusRoot, "records", record.asset), "utf8");
        });
        const items = await importEegPortablePackage(JSON.stringify(manifest), "electrode");
        expect(items).toHaveLength(16);
        expect(items.every(item => item.eegProvenance?.imported === true)).toBe(true);
    });

    test("accepts explicit private-study identity without claiming OpenNeuro provenance", async () => {
        const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
            corpusId: string;
            source: EegDatasetSource;
            records: Array<{asset: string; content?: string}>;
        };
        manifest.corpusId = "private-study-p300-v1";
        manifest.source = {...manifest.source, datasetId: "private-study", datasetVersion: "2026.1", doi: null, url: null};
        manifest.records.forEach(record => {
            record.content = readFileSync(path.join(corpusRoot, "records", record.asset), "utf8");
        });

        const items = await importEegPortablePackage(JSON.stringify(manifest), "condition");

        expect(items).toHaveLength(16);
        expect(items[0].eegProvenance?.manifest.source).toMatchObject({datasetId: "private-study", doi: null, url: null});
    });
});
