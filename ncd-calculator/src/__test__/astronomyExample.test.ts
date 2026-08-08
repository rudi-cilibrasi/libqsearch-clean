import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, test, vi} from "vitest";
import {
    getAstronomyExampleItems,
    validateAstronomyManifest,
    verifyAstronomyExampleItem,
} from "../services/astronomyExample";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const corpusRoot = path.resolve(
    testDirectory,
    "../../public/corpora/astronomy/grs1915-rxte-v1",
);
const manifestBytes = readFileSync(path.join(corpusRoot, "manifest.json"));
const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
    records: Array<{asset: string}>;
};

const responseFor = (url: string, corruptAsset?: string): Response => {
    const relativePath = url.split("corpora/astronomy/grs1915-rxte-v1/")[1];
    if (!relativePath) return new Response("not found", {status: 404});
    const bytes = relativePath === "manifest.json"
        ? Buffer.from(manifestBytes)
        : readFileSync(path.join(corpusRoot, relativePath));
    if (corruptAsset && relativePath.endsWith(corruptAsset)) {
        bytes[0] = bytes[0] === 48 ? 49 : 48;
    }
    return new Response(bytes, {
        status: 200,
        headers: {"content-length": String(bytes.byteLength)},
    });
};

describe("GRS 1915+105 astronomy example", () => {
    test("loads and verifies sixteen ordered, provenance-bearing records", async () => {
        const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));

        const items = await getAstronomyExampleItems(fetchImplementation as typeof fetch);

        expect(items).toHaveLength(16);
        expect(items.map(item => item.label)).toEqual([
            "Delta 1", "Delta 2", "Delta 3", "Delta 4",
            "Gamma 1", "Gamma 2", "Gamma 3", "Gamma 4",
            "Phi 1", "Phi 2", "Phi 3", "Phi 4",
            "Theta 1", "Theta 2", "Theta 3", "Theta 4",
        ]);
        expect(new Set(items.map(item => item.id)).size).toBe(16);
        expect(items.every(item => item.content?.split("\n").length === 481)).toBe(true);
        expect(items.every(item => item.astronomyProvenance?.exactPaperReproduction === false)).toBe(true);
        expect(fetchImplementation).toHaveBeenCalledTimes(17);
    });

    test("fails closed when a record does not match its SHA-256 digest", async () => {
        const corruptAsset = manifest.records[0].asset;
        const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => (
            responseFor(String(input), corruptAsset)
        ));

        await expect(getAstronomyExampleItems(fetchImplementation as typeof fetch)).rejects.toThrow(
            "failed SHA-256 integrity verification",
        );
    });

    test("rehashes persisted records immediately before computation", async () => {
        const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => responseFor(String(input)));
        const [item] = await getAstronomyExampleItems(fetchImplementation as typeof fetch);
        await expect(verifyAstronomyExampleItem(item)).resolves.toBeUndefined();

        const changed = {...item, content: `0${item.content?.slice(1)}`};
        await expect(verifyAstronomyExampleItem(changed)).rejects.toThrow(
            "failed pre-computation SHA-256 verification",
        );
    });

    test("keeps no more than four record requests in flight", async () => {
        let active = 0;
        let maximumActive = 0;
        const fetchImplementation = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("manifest.json")) return responseFor(url);
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await new Promise(resolve => setTimeout(resolve, 2));
            active -= 1;
            return responseFor(url);
        });

        await getAstronomyExampleItems(fetchImplementation as typeof fetch);

        expect(maximumActive).toBe(4);
    });

    test("rejects a manifest that claims to reproduce the private paper intervals", () => {
        const changed = JSON.parse(manifestBytes.toString("utf8")) as {
            paperContext: {exactReproduction: boolean};
        };
        changed.paperContext.exactReproduction = true;

        expect(() => validateAstronomyManifest(changed)).toThrow(
            "does not match the supported corpus contract",
        );
    });
});
