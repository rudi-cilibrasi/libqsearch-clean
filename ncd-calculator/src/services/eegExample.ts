import {EEG_MANIFEST_SCHEMA, type EegAnalysisMode, type EegExperimentContext, type EegManifest, type EegObjectProvenance, type EegObjectRecord, type EegPortablePackage} from "@/types/eeg";
import {EEG} from "@/constants/modalConstants";
import type {SelectedItem} from "@/components/workbenchTypes";
import {parseEegSegments} from "@/services/eegSerializer";

const CORPUS_PATH = "corpora/eeg/ds003061-p300-v1";
const EXPECTED_CORPUS = "ds003061-p300-derived-v1";
const MAX_MANIFEST_BYTES = 512 * 1024;
export const MAX_EEG_PACKAGE_BYTES = 2 * 1024 * 1024;
const MAX_RECORD_BYTES = 128 * 1024;
const MAX_MODE_RECORDS = 16;
const LOAD_CONCURRENCY = 4;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:._-]{2,127}$/u;
const ASSET_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}\.eeg\.txt$/u;

const isObject = (value: unknown): value is Record<string, unknown> => (
    typeof value === "object" && value !== null && !Array.isArray(value)
);

const finiteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const validateRecord = (value: unknown, portable: boolean): EegObjectRecord => {
    if (!isObject(value)) throw new Error("EEG manifest contains a non-object record.");
    const record = value as unknown as EegObjectRecord;
    const location = record.electrode;
    const qc = record.qc;
    if (
        !ID_PATTERN.test(record.id)
        || typeof record.label !== "string" || record.label.trim().length === 0
        || typeof record.revealedLabel !== "string" || record.revealedLabel.trim().length === 0
        || !["condition", "electrode"].includes(record.mode)
        || !["target", "standard"].includes(record.condition)
        || !Number.isInteger(record.replicate) || record.replicate < 1
        || !isObject(location) || typeof location.name !== "string" || location.name.trim().length === 0
        || !finiteNumber(location.x) || Math.abs(location.x) > 1.25
        || !finiteNumber(location.y) || Math.abs(location.y) > 1.25
        || typeof location.coordinateSource !== "string" || location.coordinateSource.trim().length === 0
        || !Number.isInteger(record.sampleCount) || record.sampleCount < 8
        || !Number.isInteger(record.samplesPerSegment) || record.samplesPerSegment < 8
        || !Number.isInteger(record.segmentCount) || record.segmentCount < 1
        || record.sampleCount !== record.samplesPerSegment * record.segmentCount
        || (!portable && (typeof record.asset !== "string" || !ASSET_PATTERN.test(record.asset)))
        || (portable && typeof record.content !== "string")
        || !SHA256_PATTERN.test(record.sha256)
        || !Number.isInteger(record.utf8Bytes) || record.utf8Bytes <= 0 || record.utf8Bytes > MAX_RECORD_BYTES
        || !isObject(qc)
        || !Number.isInteger(qc.candidateEpochs) || qc.candidateEpochs < 1
        || !Number.isInteger(qc.acceptedEpochs) || qc.acceptedEpochs < 1
        || !Number.isInteger(qc.rejectedEpochs) || qc.rejectedEpochs < 0
        || qc.acceptedEpochs + qc.rejectedEpochs !== qc.candidateEpochs
        || !finiteNumber(qc.minimum) || !finiteNumber(qc.maximum) || qc.minimum > qc.maximum
        || !finiteNumber(qc.rms) || qc.rms < 0
        || !finiteNumber(qc.peakToPeak) || qc.peakToPeak < 0
        || !Array.isArray(qc.preview) || qc.preview.length !== record.samplesPerSegment
        || qc.preview.some(sample => !finiteNumber(sample))
    ) {
        throw new Error(`Invalid EEG manifest record: ${String(record.id ?? "unknown")}.`);
    }
    return record;
};

export const validateEegManifest = (value: unknown, portable = false): EegManifest => {
    if (!isObject(value)) throw new Error("EEG manifest must be a JSON object.");
    const manifest = value as unknown as EegManifest;
    const {source, preprocessing, encoding} = manifest;
    if (
        manifest.schemaVersion !== EEG_MANIFEST_SCHEMA
        || typeof manifest.corpusId !== "string" || !ID_PATTERN.test(manifest.corpusId)
        || typeof manifest.createdAt !== "string" || !Number.isFinite(Date.parse(manifest.createdAt))
        || !isObject(source)
        || typeof source.datasetId !== "string" || source.datasetId.trim().length === 0
        || typeof source.datasetVersion !== "string" || source.datasetVersion.trim().length === 0
        || typeof source.name !== "string" || source.name.trim().length === 0
        || !(source.doi === null || (typeof source.doi === "string" && source.doi.trim().length > 0))
        || !(source.url === null || (typeof source.url === "string" && source.url.startsWith("https://")))
        || typeof source.license !== "string" || source.license.trim().length === 0
        || typeof source.subject !== "string" || source.subject.trim().length === 0
        || typeof source.task !== "string" || source.task.trim().length === 0
        || typeof source.run !== "string" || source.run.trim().length === 0
        || source.exactPaperReproduction !== false
        || !isObject(preprocessing)
        || typeof preprocessing.software !== "string" || preprocessing.software.trim().length === 0
        || !Array.isArray(preprocessing.bandpassHz) || preprocessing.bandpassHz.length !== 2
        || preprocessing.bandpassHz.some(value => !finiteNumber(value))
        || preprocessing.bandpassHz[0] <= 0 || preprocessing.bandpassHz[1] <= preprocessing.bandpassHz[0]
        || typeof preprocessing.reference !== "string" || preprocessing.reference.trim().length === 0
        || !finiteNumber(preprocessing.sourceSamplingHz) || preprocessing.sourceSamplingHz <= 0
        || !finiteNumber(preprocessing.outputSamplingHz) || preprocessing.outputSamplingHz <= 0
        || !Array.isArray(preprocessing.epochWindowSeconds) || preprocessing.epochWindowSeconds.length !== 2
        || preprocessing.epochWindowSeconds.some(value => !finiteNumber(value))
        || !Array.isArray(preprocessing.baselineWindowSeconds) || preprocessing.baselineWindowSeconds.length !== 2
        || preprocessing.baselineWindowSeconds.some(value => !finiteNumber(value))
        || !finiteNumber(preprocessing.rejectionPeakToPeakMicrovolts) || preprocessing.rejectionPeakToPeakMicrovolts <= 0
        || !isObject(preprocessing.averaging)
        || !Number.isInteger(preprocessing.averaging.segmentsPerObject) || preprocessing.averaging.segmentsPerObject < 1
        || !Number.isInteger(preprocessing.averaging.epochsPerSegment) || preprocessing.averaging.epochsPerSegment < 1
        || preprocessing.normalization !== "z-score-each-average"
        || !isObject(encoding)
        || encoding.schemaVersion !== "complearn-eeg-ascii-v1"
        || !Number.isInteger(encoding.quantizationScale) || encoding.quantizationScale <= 0
        || !Number.isInteger(encoding.integerWidth) || encoding.integerWidth < 2 || encoding.integerWidth > 12
        || !Number.isInteger(encoding.clipAbsolute) || encoding.clipAbsolute <= 0
        || encoding.segmentSeparator !== "--" || encoding.lineEnding !== "LF"
        || !Array.isArray(manifest.records) || manifest.records.length < 4 || manifest.records.length > MAX_MODE_RECORDS * 2
    ) {
        throw new Error("EEG manifest does not match the supported corpus contract.");
    }
    const records = manifest.records.map(record => validateRecord(record, portable));
    if (new Set(records.map(record => record.id)).size !== records.length) {
        throw new Error("EEG object identifiers must be unique.");
    }
    for (const mode of ["condition", "electrode"] as const) {
        const count = records.filter(record => record.mode === mode).length;
        if (count !== 0 && (count < 4 || count > MAX_MODE_RECORDS)) {
            throw new Error(`EEG ${mode} mode requires between 4 and 16 objects.`);
        }
    }
    return {...manifest, records};
};

const sha256Hex = async (content: string): Promise<string> => {
    const bytes = new TextEncoder().encode(content);
    const owned = new Uint8Array(bytes.byteLength);
    owned.set(bytes);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", owned.buffer);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};

const validateContent = async (content: string, record: EegObjectRecord, encoding: EegManifest["encoding"]): Promise<void> => {
    const bytes = new TextEncoder().encode(content);
    if (bytes.byteLength !== record.utf8Bytes) throw new Error(`${record.label} byte count does not match its manifest.`);
    if (await sha256Hex(content) !== record.sha256) throw new Error(`${record.label} failed SHA-256 integrity verification.`);
    const segments = parseEegSegments(content, encoding);
    if (segments.length !== record.segmentCount || segments.some(segment => segment.length !== record.samplesPerSegment)) {
        throw new Error(`${record.label} shape does not match its manifest.`);
    }
    const quantizationTolerance = (1 / encoding.quantizationScale) + 1e-6;
    const derivedPreview = Array.from({length: record.samplesPerSegment}, (_, sampleIndex) => (
        segments.reduce((sum, segment) => sum + segment[sampleIndex], 0) / segments.length
    ));
    if (derivedPreview.some((sample, index) => Math.abs(sample - record.qc.preview[index]) > quantizationTolerance)) {
        throw new Error(`${record.label} waveform QC does not match its serialized signal.`);
    }
};

const manifestWithoutRecords = (manifest: EegManifest): Omit<EegManifest, "records"> => {
    const {records: _records, ...metadata} = manifest;
    return metadata;
};

const toItem = (manifest: EegManifest, record: EegObjectRecord, content: string, imported: boolean): SelectedItem => ({
    id: record.id,
    label: record.label,
    type: EEG,
    content,
    eegProvenance: {manifest: manifestWithoutRecords(manifest), record: {...record, content: undefined}, imported},
});

const corpusUrl = (path: string): string => {
    const base = import.meta.env.BASE_URL || "/";
    return `${base.endsWith("/") ? base : `${base}/`}${CORPUS_PATH}/${path}`;
};

const readBoundedResponse = async (response: Response, maximumBytes: number, description: string): Promise<string> => {
    if (!response.ok) throw new Error(`${description} request failed with HTTP ${response.status}.`);
    const advertisedLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(advertisedLength) && advertisedLength > maximumBytes) throw new Error(`${description} is too large.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximumBytes) throw new Error(`${description} is too large.`);
    try {
        return new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    } catch {
        throw new Error(`${description} is not valid UTF-8.`);
    }
};

const mapWithConcurrency = async <T, U>(values: readonly T[], concurrency: number, work: (value: T) => Promise<U>): Promise<U[]> => {
    const result = new Array<U>(values.length);
    let cursor = 0;
    const workers = Array.from({length: Math.min(concurrency, values.length)}, async () => {
        while (cursor < values.length) {
            const index = cursor++;
            result[index] = await work(values[index]);
        }
    });
    await Promise.all(workers);
    return result;
};

export const getEegExampleItems = async (mode: EegAnalysisMode, fetchImplementation: typeof fetch = fetch): Promise<SelectedItem[]> => {
    const manifestText = await readBoundedResponse(await fetchImplementation(corpusUrl("manifest.json")), MAX_MANIFEST_BYTES, "EEG manifest");
    let parsed: unknown;
    try { parsed = JSON.parse(manifestText); } catch { throw new Error("EEG manifest is not valid JSON."); }
    const manifest = validateEegManifest(parsed);
    if (manifest.corpusId !== EXPECTED_CORPUS || manifest.source.datasetId !== "ds003061") {
        throw new Error("Built-in EEG corpus identity does not match the pinned example.");
    }
    const records = manifest.records.filter(record => record.mode === mode);
    if (records.length < 4) throw new Error(`Built-in EEG corpus does not provide ${mode} mode.`);
    return mapWithConcurrency(records, LOAD_CONCURRENCY, async record => {
        const content = await readBoundedResponse(
            await fetchImplementation(corpusUrl(`records/${record.asset}`)),
            MAX_RECORD_BYTES,
            record.label,
        );
        await validateContent(content, record, manifest.encoding);
        return toItem(manifest, record, content, false);
    });
};

export const importEegPortablePackage = async (text: string, mode: EegAnalysisMode): Promise<SelectedItem[]> => {
    if (new TextEncoder().encode(text).byteLength > MAX_EEG_PACKAGE_BYTES) throw new Error("EEG package exceeds the 2 MiB limit.");
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new Error("EEG package is not valid JSON."); }
    const manifest = validateEegManifest(parsed, true) as EegPortablePackage;
    const records = manifest.records.filter(record => record.mode === mode);
    if (records.length < 4) throw new Error(`EEG package does not provide ${mode} mode.`);
    return Promise.all(records.map(async record => {
        await validateContent(record.content, record, manifest.encoding);
        return toItem(manifest, record, record.content, true);
    }));
};

export const verifyEegExampleItem = async (item: SelectedItem): Promise<void> => {
    if (!item.eegProvenance) return;
    if (!item.content) throw new Error(`${item.label} has no EEG signal content.`);
    await validateContent(item.content, item.eegProvenance.record, item.eegProvenance.manifest.encoding);
};

export const getEegExperimentContext = (items: readonly SelectedItem[]): EegExperimentContext | undefined => {
    const eegItems = items.filter(item => item.eegProvenance);
    if (eegItems.length === 0) return undefined;
    if (eegItems.length !== items.length) throw new Error("EEG objects cannot be mixed with other source types.");
    const first = eegItems[0].eegProvenance as EegObjectProvenance;
    const mode = first.record.mode;
    if (eegItems.some(item => item.eegProvenance?.manifest.corpusId !== first.manifest.corpusId || item.eegProvenance?.record.mode !== mode)) {
        throw new Error("EEG comparison objects must come from one corpus and one analysis mode.");
    }
    return {manifest: first.manifest, mode, records: eegItems.map(item => (item.eegProvenance as EegObjectProvenance).record)};
};
