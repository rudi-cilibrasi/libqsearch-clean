import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

const assetDirectory = path.join(process.cwd(), "public", "udhr", "v1");

const readAsset = (asset: string): ArrayBuffer => {
    const buffer = readFileSync(path.join(assetDirectory, asset));
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

const responseFor = (bytes: ArrayBuffer): Pick<Response, "ok" | "status" | "arrayBuffer"> => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.slice(0),
});

describe("versioned UDHR corpus", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubGlobal("crypto", webcrypto);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    test("publishes complete, explicit metadata for every supported source", async () => {
        const {UDHR_CORPUS, UDHR_LANGUAGES} = await import("../functions/udhr");

        expect(UDHR_LANGUAGES).toHaveLength(61);
        expect(new Set(UDHR_LANGUAGES.map(({id}) => id)).size).toBe(61);
        expect(UDHR_LANGUAGES.every(({articleCount, segmentCount, sourceStage}) => (
            articleCount === 30 && segmentCount === 30 && sourceStage === 4
        ))).toBe(true);
        expect(UDHR_CORPUS.corpusVersion).toContain("articles-nfc-v1");
        expect(UDHR_CORPUS.source.commit).toMatch(/^[a-f0-9]{40}$/u);

        expect(UDHR_LANGUAGES.find(({id}) => id === "fil")?.name).toBe("Tagalog");
        expect(UDHR_LANGUAGES.find(({id}) => id === "nor")?.name).toBe("Norwegian, Bokmål");
        expect(UDHR_LANGUAGES.find(({id}) => id === "fas")?.direction).toBe("rtl");
        expect(UDHR_LANGUAGES.find(({id}) => id === "bel")).toMatchObject({
            name: "Belarusian",
            sourceName: "Belarusan",
        });

        expect(UDHR_LANGUAGES.filter(({id}) => ["rus", "ukr", "bel"].includes(id)).map((language) => ({
            id: language.id,
            iso6393: language.iso6393,
            languageTag: language.languageTag,
            script: language.script,
        }))).toEqual([
            {id: "rus", iso6393: "rus", languageTag: "ru", script: "Cyrl"},
            {id: "ukr", iso6393: "ukr", languageTag: "uk", script: "Cyrl"},
            {id: "bel", iso6393: "bel", languageTag: "be", script: "Cyrl"},
        ]);
    });

    test("loads a same-origin UTF-8 asset and verifies its canonical content", async () => {
        const fetchMock = vi.fn().mockResolvedValue(responseFor(readAsset("eng.txt")));
        vi.stubGlobal("fetch", fetchMock);
        const {getTranslationResponse} = await import("../functions/udhr");

        const text = await getTranslationResponse("eng");

        expect(fetchMock).toHaveBeenCalledWith("/udhr/v1/eng.txt", {cache: "force-cache"});
        expect(text.split("\n")).toHaveLength(30);
        expect(text).toContain("All human beings are born free and equal in dignity and rights.");
        expect(text).not.toContain("Article 1");
        expect(text).not.toContain("Preamble");
    });

    test("deduplicates concurrent loads for the same language", async () => {
        const fetchMock = vi.fn().mockResolvedValue(responseFor(readAsset("fra.txt")));
        vi.stubGlobal("fetch", fetchMock);
        const {getTranslationResponse} = await import("../functions/udhr");

        const [first, second] = await Promise.all([
            getTranslationResponse("fra"),
            getTranslationResponse("fra"),
        ]);

        expect(first).toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("fails closed when an asset does not match its manifest digest", async () => {
        const bytes = new Uint8Array(readAsset("eng.txt"));
        bytes[bytes.length - 1] ^= 1;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor(bytes.buffer)));
        const {getTranslationResponse} = await import("../functions/udhr");

        await expect(getTranslationResponse("eng")).rejects.toThrow(
            /English failed corpus validation/u,
        );
    });

    test("rejects unknown language identifiers before requesting an asset", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const {getTranslationResponse} = await import("../functions/udhr");

        await expect(getTranslationResponse("unknown")).rejects.toThrow(
            "Unsupported UDHR language identifier: unknown",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
