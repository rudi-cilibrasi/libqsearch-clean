import {FILE_UPLOAD} from "../constants/modalConstants";
import type {SelectedItem} from "../components/workbenchTypes";

const CORPUS_PATH = "corpora/astronomy/grs1915-rxte-v1";
const EXPECTED_SCHEMA = "astronomy-corpus-v1";
const EXPECTED_DATASET = "grs1915-rxte-public-analogue-v1";
const EXPECTED_CLASSES = ["delta", "gamma", "phi", "theta"] as const;
const EXPECTED_RECORDS_PER_CLASS = 4;
const EXPECTED_SAMPLE_COUNT = 480;
const EXPECTED_CADENCE_SECONDS = 0.125;
const MAX_MANIFEST_BYTES = 128 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024;
const LOAD_CONCURRENCY = 4;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ASSET_PATTERN = /^(delta|gamma|phi|theta)-\d{3}\.[a-f0-9]{16}\.csv$/u;
const ID_PATTERN = /^astronomy:grs1915:(delta|gamma|phi|theta):\d{3}$/u;
const SAMPLE_PATTERN = /^\d+,\d+,\d+,\d+$/u;

type AstronomyClass = typeof EXPECTED_CLASSES[number];

export interface AstronomyRecordManifest {
    id: string;
    label: string;
    class: AstronomyClass;
    classOrdinal: number;
    sourceIndex: number;
    sourceFile: string;
    startMissionSeconds: string;
    sampleCount: number;
    cadenceSeconds: number;
    asset: string;
    sha256: string;
    utf8Bytes: number;
}

interface AstronomyManifest {
    schemaVersion: string;
    datasetId: string;
    source: {
        articleId: number;
        fileId: number;
        archiveMd5: string;
        license: string;
    };
    paperContext: {
        exactReproduction: boolean;
    };
    selection: {
        classes: string[];
        recordsPerClass: number;
        sampleCount: number;
        cadenceSeconds: number;
    };
    records: AstronomyRecordManifest[];
}

export interface AstronomyExampleProvenance {
    schemaVersion: typeof EXPECTED_SCHEMA;
    datasetId: typeof EXPECTED_DATASET;
    sourceArticleId: 4220409;
    sourceFileId: 6886539;
    sourceArchiveMd5: string;
    sourceRecord: string;
    sourceIndex: number;
    class: AstronomyClass;
    startMissionSeconds: string;
    sampleCount: typeof EXPECTED_SAMPLE_COUNT;
    cadenceSeconds: typeof EXPECTED_CADENCE_SECONDS;
    contentSha256: string;
    exactPaperReproduction: false;
}

const corpusUrl = (path: string): string => {
    const base = import.meta.env.BASE_URL || "/";
    return `${base.endsWith("/") ? base : `${base}/`}${CORPUS_PATH}/${path}`;
};

const isObject = (value: unknown): value is Record<string, unknown> => (
    typeof value === "object" && value !== null && !Array.isArray(value)
);

const sha256Hex = async (bytes: Uint8Array): Promise<string> => {
    const ownedBytes = new Uint8Array(bytes.byteLength);
    ownedBytes.set(bytes);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", ownedBytes.buffer);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

const readBoundedResponse = async (
    response: Response,
    maximumBytes: number,
    description: string,
): Promise<Uint8Array> => {
    if (!response.ok) {
        throw new Error(`${description} request failed with HTTP ${response.status}.`);
    }
    const advertisedLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(advertisedLength) && advertisedLength > maximumBytes) {
        throw new Error(`${description} exceeds the ${maximumBytes}-byte limit.`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) {
        throw new Error(`${description} exceeds the ${maximumBytes}-byte limit.`);
    }
    return bytes;
};

const validateRecord = (value: unknown): AstronomyRecordManifest => {
    if (!isObject(value)) throw new Error("Astronomy manifest contains a non-object record.");
    const record = value as unknown as AstronomyRecordManifest;
    if (
        !ID_PATTERN.test(record.id)
        || typeof record.label !== "string"
        || record.label.trim().length === 0
        || !EXPECTED_CLASSES.includes(record.class)
        || !Number.isInteger(record.classOrdinal)
        || record.classOrdinal < 1
        || record.classOrdinal > EXPECTED_RECORDS_PER_CLASS
        || !Number.isInteger(record.sourceIndex)
        || record.sourceIndex < 0
        || record.sourceFile !== `classified_lcs/grs1915_lc${record.sourceIndex}.txt`
        || typeof record.startMissionSeconds !== "string"
        || record.sampleCount !== EXPECTED_SAMPLE_COUNT
        || record.cadenceSeconds !== EXPECTED_CADENCE_SECONDS
        || !ASSET_PATTERN.test(record.asset)
        || !SHA256_PATTERN.test(record.sha256)
        || record.asset !== `${record.class}-${record.sourceIndex.toString().padStart(3, "0")}.${record.sha256.slice(0, 16)}.csv`
        || !Number.isInteger(record.utf8Bytes)
        || record.utf8Bytes <= 0
        || record.utf8Bytes > MAX_RECORD_BYTES
    ) {
        throw new Error(`Invalid astronomy manifest record: ${String(record.id ?? "unknown")}.`);
    }
    return record;
};

export const validateAstronomyManifest = (value: unknown): AstronomyManifest => {
    if (!isObject(value)) throw new Error("Astronomy manifest must be a JSON object.");
    const manifest = value as unknown as AstronomyManifest;
    if (
        manifest.schemaVersion !== EXPECTED_SCHEMA
        || manifest.datasetId !== EXPECTED_DATASET
        || !isObject(manifest.source)
        || manifest.source.articleId !== 4220409
        || manifest.source.fileId !== 6886539
        || manifest.source.archiveMd5 !== "72f3ca22510b26a8c59d839185102982"
        || manifest.source.license !== "CC BY 4.0"
        || !isObject(manifest.paperContext)
        || manifest.paperContext.exactReproduction !== false
        || !isObject(manifest.selection)
        || manifest.selection.recordsPerClass !== EXPECTED_RECORDS_PER_CLASS
        || manifest.selection.sampleCount !== EXPECTED_SAMPLE_COUNT
        || manifest.selection.cadenceSeconds !== EXPECTED_CADENCE_SECONDS
        || !Array.isArray(manifest.selection.classes)
        || manifest.selection.classes.join(",") !== EXPECTED_CLASSES.join(",")
        || !Array.isArray(manifest.records)
        || manifest.records.length !== EXPECTED_CLASSES.length * EXPECTED_RECORDS_PER_CLASS
    ) {
        throw new Error("Astronomy manifest does not match the supported corpus contract.");
    }

    const records = manifest.records.map(validateRecord);
    const ids = new Set(records.map(record => record.id));
    const assets = new Set(records.map(record => record.asset));
    const labels = new Set(records.map(record => record.label));
    if (ids.size !== records.length || assets.size !== records.length || labels.size !== records.length) {
        throw new Error("Astronomy manifest record IDs, labels, and assets must be unique.");
    }
    for (const className of EXPECTED_CLASSES) {
        const classRecords = records.filter(record => record.class === className);
        if (
            classRecords.length !== EXPECTED_RECORDS_PER_CLASS
            || classRecords.map(record => record.classOrdinal).sort().join(",") !== "1,2,3,4"
        ) {
            throw new Error(`Astronomy manifest requires four ordered ${className} records.`);
        }
    }
    if (records.reduce((sum, record) => sum + record.utf8Bytes, 0) > MAX_TOTAL_BYTES) {
        throw new Error("Astronomy corpus exceeds the one-megabyte runtime limit.");
    }
    return {...manifest, records};
};

const validateRecordContent = (content: string, record: AstronomyRecordManifest): void => {
    if (!content.endsWith("\n") || content.includes("\r")) {
        throw new Error(`${record.label} does not use canonical LF-delimited serialization.`);
    }
    const samples = content.slice(0, -1).split("\n");
    if (samples.length !== EXPECTED_SAMPLE_COUNT || samples.some(sample => !SAMPLE_PATTERN.test(sample))) {
        throw new Error(`${record.label} does not contain 480 canonical four-band samples.`);
    }
};

const loadRecord = async (
    record: AstronomyRecordManifest,
    manifest: AstronomyManifest,
    fetchImplementation: typeof fetch,
): Promise<SelectedItem> => {
    const response = await fetchImplementation(corpusUrl(`records/${record.asset}`));
    const bytes = await readBoundedResponse(response, MAX_RECORD_BYTES, record.label);
    if (bytes.byteLength !== record.utf8Bytes) {
        throw new Error(`${record.label} byte count does not match its manifest.`);
    }
    if (await sha256Hex(bytes) !== record.sha256) {
        throw new Error(`${record.label} failed SHA-256 integrity verification.`);
    }
    let content: string;
    try {
        content = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    } catch {
        throw new Error(`${record.label} is not valid UTF-8.`);
    }
    validateRecordContent(content, record);
    return {
        id: record.id,
        label: record.label,
        type: FILE_UPLOAD,
        content,
        astronomyProvenance: {
            schemaVersion: EXPECTED_SCHEMA,
            datasetId: EXPECTED_DATASET,
            sourceArticleId: 4220409,
            sourceFileId: 6886539,
            sourceArchiveMd5: manifest.source.archiveMd5,
            sourceRecord: record.sourceFile,
            sourceIndex: record.sourceIndex,
            class: record.class,
            startMissionSeconds: record.startMissionSeconds,
            sampleCount: EXPECTED_SAMPLE_COUNT,
            cadenceSeconds: EXPECTED_CADENCE_SECONDS,
            contentSha256: record.sha256,
            exactPaperReproduction: false,
        },
    };
};

const mapWithConcurrency = async <T, U>(
    values: readonly T[],
    concurrency: number,
    mapper: (value: T) => Promise<U>,
): Promise<U[]> => {
    const results = new Array<U>(values.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
        while (nextIndex < values.length) {
            const index = nextIndex++;
            results[index] = await mapper(values[index]);
        }
    };
    await Promise.all(Array.from({length: Math.min(concurrency, values.length)}, worker));
    return results;
};

export const getAstronomyExampleItems = async (
    fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<SelectedItem[]> => {
    const manifestResponse = await fetchImplementation(corpusUrl("manifest.json"));
    const manifestBytes = await readBoundedResponse(
        manifestResponse,
        MAX_MANIFEST_BYTES,
        "Astronomy manifest",
    );
    let parsed: unknown;
    try {
        parsed = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(manifestBytes));
    } catch {
        throw new Error("Astronomy manifest is not valid UTF-8 JSON.");
    }
    const manifest = validateAstronomyManifest(parsed);
    return mapWithConcurrency(
        manifest.records,
        LOAD_CONCURRENCY,
        record => loadRecord(record, manifest, fetchImplementation),
    );
};

/** Revalidate a persisted astronomy item immediately before compression. */
export const verifyAstronomyExampleItem = async (item: SelectedItem): Promise<void> => {
    const provenance = item.astronomyProvenance;
    if (!provenance) return;
    const validSourceIndex = Number.isInteger(provenance.sourceIndex) && provenance.sourceIndex >= 0;
    const sourceIndex = validSourceIndex ? provenance.sourceIndex.toString().padStart(3, "0") : "invalid";
    const expectedId = `astronomy:grs1915:${provenance.class}:${sourceIndex}`;
    if (
        item.type !== FILE_UPLOAD
        || item.id !== expectedId
        || provenance.schemaVersion !== EXPECTED_SCHEMA
        || provenance.datasetId !== EXPECTED_DATASET
        || provenance.sourceArticleId !== 4220409
        || provenance.sourceFileId !== 6886539
        || provenance.sourceArchiveMd5 !== "72f3ca22510b26a8c59d839185102982"
        || !validSourceIndex
        || provenance.sourceRecord !== `classified_lcs/grs1915_lc${provenance.sourceIndex}.txt`
        || !EXPECTED_CLASSES.includes(provenance.class)
        || typeof provenance.startMissionSeconds !== "string"
        || !/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/iu.test(provenance.startMissionSeconds)
        || provenance.sampleCount !== EXPECTED_SAMPLE_COUNT
        || provenance.cadenceSeconds !== EXPECTED_CADENCE_SECONDS
        || !SHA256_PATTERN.test(provenance.contentSha256)
        || provenance.exactPaperReproduction !== false
        || typeof item.content !== "string"
    ) {
        throw new Error(`${item.label || item.id} has invalid astronomy provenance.`);
    }
    const bytes = new TextEncoder().encode(item.content);
    if (bytes.byteLength > MAX_RECORD_BYTES || await sha256Hex(bytes) !== provenance.contentSha256) {
        throw new Error(`${item.label || item.id} failed pre-computation SHA-256 verification.`);
    }
    validateRecordContent(item.content, {
        id: item.id,
        label: item.label,
        class: provenance.class,
        classOrdinal: 1,
        sourceIndex: provenance.sourceIndex,
        sourceFile: provenance.sourceRecord,
        startMissionSeconds: provenance.startMissionSeconds,
        sampleCount: provenance.sampleCount,
        cadenceSeconds: provenance.cadenceSeconds,
        asset: `${provenance.class}-${sourceIndex}.${provenance.contentSha256.slice(0, 16)}.csv`,
        sha256: provenance.contentSha256,
        utf8Bytes: bytes.byteLength,
    });
};
