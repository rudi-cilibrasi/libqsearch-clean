import {createHash} from "node:crypto";
import {readFile, readdir, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const corpusRoot = path.resolve(scriptDirectory, "../public/corpora/eeg/ds003061-p300-v1");
const manifestPath = path.join(corpusRoot, "manifest.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));

const fail = (message) => {
    throw new Error(`EEG corpus verification failed: ${message}`);
};

if (
    manifest.schemaVersion !== "complearn-eeg-manifest-v1"
    || manifest.corpusId !== "ds003061-p300-derived-v1"
    || manifest.source?.datasetId !== "ds003061"
    || manifest.source?.datasetVersion !== "1.1.2"
    || manifest.source?.license !== "CC0"
    || manifest.source?.exactPaperReproduction !== false
    || manifest.encoding?.schemaVersion !== "complearn-eeg-ascii-v1"
    || manifest.encoding?.segmentSeparator !== "--"
    || manifest.encoding?.lineEnding !== "LF"
    || !Array.isArray(manifest.records)
    || manifest.records.length !== 32
) fail("manifest identity or record count is invalid");

for (const mode of ["condition", "electrode"]) {
    if (manifest.records.filter(record => record.mode === mode).length !== 16) fail(`${mode} mode must contain 16 records`);
}

const assets = new Set();
const ids = new Set();
for (const record of manifest.records) {
    if (ids.has(record.id) || assets.has(record.asset)) fail(`duplicate record identity for ${record.id}`);
    ids.add(record.id);
    assets.add(record.asset);
    if (!/^[a-z0-9][a-z0-9._-]+\.eeg\.txt$/u.test(record.asset)) fail(`unsafe asset name ${record.asset}`);
    const assetPath = path.join(corpusRoot, "records", record.asset);
    const relative = path.relative(path.join(corpusRoot, "records"), assetPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) fail(`asset escapes corpus root: ${record.asset}`);
    const bytes = await readFile(assetPath);
    if (bytes.byteLength !== record.utf8Bytes) fail(`${record.id} byte length does not match`);
    if (createHash("sha256").update(bytes).digest("hex") !== record.sha256) fail(`${record.id} checksum does not match`);
    const content = bytes.toString("ascii");
    if (!content.endsWith("\n") || content.includes("\r")) fail(`${record.id} line endings are not canonical`);
    const segments = content.slice(0, -1).split("\n--\n");
    if (segments.length !== record.segmentCount) fail(`${record.id} segment count does not match`);
    const samplePattern = new RegExp(`^[+-]\\d{${manifest.encoding.integerWidth}}$`, "u");
    const parsedSegments = [];
    for (const segment of segments) {
        const rows = segment.split("\n");
        if (rows.length !== record.samplesPerSegment || rows.some(row => !samplePattern.test(row))) {
            fail(`${record.id} sample shape or row encoding is invalid`);
        }
        parsedSegments.push(rows.map(row => Number.parseInt(row, 10) / manifest.encoding.quantizationScale));
    }
    if (record.sampleCount !== record.segmentCount * record.samplesPerSegment) fail(`${record.id} sample count does not match`);
    if (!Array.isArray(record.qc?.preview) || record.qc.preview.length !== record.samplesPerSegment) fail(`${record.id} preview shape does not match`);
    const tolerance = (1 / manifest.encoding.quantizationScale) + 1e-6;
    for (let sampleIndex = 0; sampleIndex < record.samplesPerSegment; sampleIndex += 1) {
        const derived = parsedSegments.reduce((sum, segment) => sum + segment[sampleIndex], 0) / parsedSegments.length;
        if (Math.abs(derived - record.qc.preview[sampleIndex]) > tolerance) fail(`${record.id} preview does not match serialized signal`);
    }
}

const diskAssets = (await readdir(path.join(corpusRoot, "records"))).filter(name => name.endsWith(".eeg.txt"));
if (diskAssets.length !== assets.size || diskAssets.some(asset => !assets.has(asset))) fail("record directory contains stale or missing assets");
if ((await stat(manifestPath)).size > 512 * 1024) fail("manifest exceeds runtime bound");

console.log(`Verified ${manifest.records.length} ds003061-derived EEG objects.`);
