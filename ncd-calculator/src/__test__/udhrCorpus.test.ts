import {webcrypto} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";

import {afterEach, beforeEach, describe, expect, test, vi} from "vitest";

const assetDirectory = path.join(process.cwd(), "public", "udhr", "v2", "records");

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

    test("publishes the complete audited catalog and deterministic language groups", async () => {
        const {
            getUdhrLanguageGroup,
            getUdhrRecordDisplayLabel,
            UDHR_CORPUS,
            UDHR_FEATURED_LANGUAGES,
            UDHR_LANGUAGE_GROUPS,
            UDHR_LANGUAGES,
            UDHR_RECORDS,
        } = await import("../functions/udhr");

        expect(UDHR_RECORDS).toHaveLength(501);
        expect(new Set(UDHR_RECORDS.map(({id}) => id)).size).toBe(501);
        expect(new Set(UDHR_RECORDS.map(({languageId}) => languageId)).size).toBe(431);
        expect(UDHR_RECORDS.filter(({provenanceTier}) => provenanceTier === "ohchr-linked")).toHaveLength(465);
        expect(UDHR_RECORDS.filter(({provenanceTier}) => provenanceTier === "unicode-complete")).toHaveLength(36);
        expect(UDHR_RECORDS.filter(({comparisonReady}) => comparisonReady)).toHaveLength(496);
        expect(UDHR_RECORDS.filter(({comparisonReady}) => !comparisonReady).map(({sourceKey}) => sourceKey))
            .toEqual(["csw", "ike", "kwi", "ojb", "ykg"]);

        expect(UDHR_LANGUAGES).toBe(UDHR_RECORDS);
        expect(UDHR_LANGUAGE_GROUPS).toHaveLength(431);
        expect(new Set(UDHR_LANGUAGE_GROUPS.map(({id}) => id)).size).toBe(431);
        expect(new Set(UDHR_LANGUAGE_GROUPS.map(({name}) => name)).size).toBe(431);
        expect(UDHR_LANGUAGE_GROUPS.flatMap(({records}) => records)).toHaveLength(501);
        expect(UDHR_LANGUAGE_GROUPS.filter(({records}) => records.length > 1)).toHaveLength(46);
        expect(UDHR_LANGUAGE_GROUPS.every((group) => (
            group.records.every(({languageId}) => languageId === group.id)
        ))).toBe(true);

        const displayLabels = UDHR_RECORDS.map(({id}) => getUdhrRecordDisplayLabel(id));
        expect(displayLabels.every(Boolean)).toBe(true);
        expect(new Set(displayLabels).size).toBe(501);
        expect(getUdhrLanguageGroup("deu")).toMatchObject({name: "German"});
        expect(getUdhrLanguageGroup("deu")?.records.map(({id}) => (
            getUdhrRecordDisplayLabel(id)
        ))).toEqual(["German, Standard (1901)", "German, Standard (1996)"]);
        expect(getUdhrLanguageGroup("mal")?.records.map(({id}) => (
            getUdhrRecordDisplayLabel(id)
        ))).toEqual(["Malayalam [mal]", "Malayalam [mal_chillus]"]);
        expect(getUdhrLanguageGroup("und")?.name).toBe("Unclassified records");

        expect(UDHR_FEATURED_LANGUAGES).toHaveLength(61);
        expect(new Set(UDHR_FEATURED_LANGUAGES.map(({id}) => id)).size).toBe(61);
        expect(UDHR_FEATURED_LANGUAGES.every(({articleCount, segmentCount, sourceStage, comparisonReady}) => (
            articleCount === 30 && segmentCount === 30 && sourceStage === 4 && comparisonReady
        ))).toBe(true);
        expect(UDHR_CORPUS.schemaVersion).toBe(2);
        expect(UDHR_CORPUS.corpusVersion).toContain("stage4-articles-nfc-v2");
        expect(UDHR_CORPUS.assetBasePath).toBe("udhr/v2/records");
        expect(UDHR_CORPUS.source.commit).toMatch(/^[a-f0-9]{40}$/u);

        expect(UDHR_FEATURED_LANGUAGES.find(({legacyId}) => legacyId === "fil")?.name).toBe("Tagalog");
        expect(UDHR_FEATURED_LANGUAGES.find(({legacyId}) => legacyId === "fas")?.direction).toBe("rtl");
        expect(UDHR_FEATURED_LANGUAGES.find(({legacyId}) => legacyId === "bel")).toMatchObject({
            id: "udhr:bel",
            name: "Belarusian",
            sourceName: "Belarusan",
        });
        expect(Object.fromEntries(UDHR_FEATURED_LANGUAGES.filter(({sourceName}) => sourceName).map((record) => (
            [record.legacyId, {name: record.name, sourceName: record.sourceName}]
        )))).toEqual({
            bel: {name: "Belarusian", sourceName: "Belarusan"},
            cmn: {name: "Chinese", sourceName: "Chinese, Mandarin (Simplified)"},
            deu: {name: "German", sourceName: "German, Standard (1901)"},
            ell: {name: "Greek", sourceName: "Greek (monotonic)"},
            fas: {name: "Farsi", sourceName: "Farsi, Western"},
            gle: {name: "Irish", sourceName: "Gaelic, Irish"},
            jav: {name: "Javanese", sourceName: "Javanese (Latin)"},
            khm: {name: "Khmer", sourceName: "Khmer, Central"},
            kur: {name: "Kurdish", sourceName: "Kurdish, Central"},
            mon: {name: "Mongolian", sourceName: "Mongolian, Halh (Cyrillic)"},
            msa: {name: "Malay", sourceName: "Malay (Latin)"},
            nor: {name: "Norwegian", sourceName: "Norwegian, Bokmål"},
            por: {name: "Portuguese", sourceName: "Portuguese (Portugal)"},
            ron: {name: "Romanian", sourceName: "Romanian (1953)"},
            tuk: {name: "Turkmen", sourceName: "Turkmen (Cyrillic)"},
            uzb: {name: "Uzbek", sourceName: "Uzbek, Northern (Latin)"},
        });

        expect(UDHR_FEATURED_LANGUAGES.filter(({legacyId}) => ["rus", "ukr", "bel"].includes(legacyId ?? "")).map((record) => ({
            id: record.id,
            languageId: record.languageId,
            languageTag: record.languageTag,
            script: record.script,
        }))).toEqual([
            {id: "udhr:rus", languageId: "rus", languageTag: "ru", script: "Cyrl"},
            {id: "udhr:ukr", languageId: "ukr", languageTag: "uk", script: "Cyrl"},
            {id: "udhr:bel", languageId: "bel", languageTag: "be", script: "Cyrl"},
        ]);
    });

    test("loads a digest-addressed same-origin asset through a legacy alias", async () => {
        const module = await import("../functions/udhr");
        const english = module.getUdhrLanguage("eng");
        expect(english).toBeDefined();
        const fetchMock = vi.fn().mockResolvedValue(responseFor(readAsset(english!.asset)));
        vi.stubGlobal("fetch", fetchMock);

        const text = await module.getTranslationResponse("eng");

        expect(module.resolveUdhrRecordId("eng")).toBe("udhr:eng");
        expect(fetchMock).toHaveBeenCalledWith(
            `/udhr/v2/records/${english!.asset}`,
            {cache: "force-cache"},
        );
        expect(text.split("\n")).toHaveLength(30);
        expect(text).toContain("All human beings are born free and equal in dignity and rights.");
        expect(text).not.toContain("Article 1");
        expect(text).not.toContain("Preamble");
    });

    test("deduplicates concurrent loads for one canonical record", async () => {
        const module = await import("../functions/udhr");
        const french = module.getUdhrLanguage("fra");
        const fetchMock = vi.fn().mockResolvedValue(responseFor(readAsset(french!.asset)));
        vi.stubGlobal("fetch", fetchMock);

        const [first, second] = await Promise.all([
            module.getTranslationResponse("fra"),
            module.getTranslationResponse("udhr:fra"),
        ]);

        expect(first).toBe(second);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("limits concurrent lazy loads to six records", async () => {
        const module = await import("../functions/udhr");
        const records = module.UDHR_RECORDS.filter(({comparisonReady}) => comparisonReady).slice(0, 8);
        const recordByAsset = new Map(records.map((record) => [record.asset, record]));
        let active = 0;
        let maximumActive = 0;
        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
            const urlParts = url.split("/");
            const asset = decodeURIComponent(urlParts[urlParts.length - 1] ?? "");
            const record = recordByAsset.get(asset);
            if (!record) throw new Error(`Unexpected test asset ${asset}`);
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            await new Promise((resolve) => setTimeout(resolve, 10));
            active -= 1;
            return responseFor(readAsset(record.asset));
        });
        vi.stubGlobal("fetch", fetchMock);

        await Promise.all(records.map(({id}) => module.getTranslationResponse(id)));

        expect(fetchMock).toHaveBeenCalledTimes(8);
        expect(maximumActive).toBe(6);
    });

    test("fails closed when an asset does not match its manifest digest", async () => {
        const module = await import("../functions/udhr");
        const english = module.getUdhrLanguage("eng");
        const bytes = new Uint8Array(readAsset(english!.asset));
        bytes[bytes.length - 1] ^= 1;
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseFor(bytes.buffer)));

        await expect(module.getTranslationResponse("eng")).rejects.toThrow(
            /English failed corpus validation/u,
        );
    });

    test("rejects comparison-ineligible and unknown records before fetching", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        const {getTranslationResponse} = await import("../functions/udhr");

        await expect(getTranslationResponse("udhr:csw")).rejects.toThrow(
            /lacks aligned Articles 1-30/u,
        );
        await expect(getTranslationResponse("unknown")).rejects.toThrow(
            "Unsupported UDHR record identifier: unknown",
        );
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
