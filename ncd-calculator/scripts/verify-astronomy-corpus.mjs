import {createHash} from "node:crypto";
import {readFile, readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const corpusRoot = path.join(projectRoot, "public/corpora/astronomy/grs1915-rxte-v1");
const manifestPath = path.join(corpusRoot, "manifest.json");
const expectedClasses = ["delta", "gamma", "phi", "theta"];
const expectedArchiveMd5 = "72f3ca22510b26a8c59d839185102982";
const sha256Pattern = /^[a-f0-9]{64}$/u;
const samplePattern = /^\d+,\d+,\d+,\d+$/u;

const fail = (message) => {
    throw new Error(`Astronomy corpus verification failed: ${message}`);
};

const manifestBytes = await readFile(manifestPath);
let manifest;
try {
    manifest = JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(manifestBytes));
} catch {
    fail("manifest.json is not valid UTF-8 JSON");
}

if (
    manifest.schemaVersion !== "astronomy-corpus-v1"
    || manifest.datasetId !== "grs1915-rxte-public-analogue-v1"
    || manifest.source?.articleId !== 4220409
    || manifest.source?.fileId !== 6886539
    || manifest.source?.archiveMd5 !== expectedArchiveMd5
    || manifest.source?.license !== "CC BY 4.0"
    || manifest.paperContext?.exactReproduction !== false
    || manifest.selection?.classes?.join(",") !== expectedClasses.join(",")
    || manifest.selection?.recordsPerClass !== 4
    || manifest.selection?.sampleCount !== 480
    || manifest.selection?.cadenceSeconds !== 0.125
    || !Array.isArray(manifest.records)
    || manifest.records.length !== 16
) {
    fail("manifest metadata does not match astronomy-corpus-v1");
}

const ids = new Set();
const labels = new Set();
const assets = new Set();
const classCounts = new Map(expectedClasses.map(className => [className, 0]));
for (const record of manifest.records) {
    const expectedId = `astronomy:grs1915:${record.class}:${String(record.sourceIndex).padStart(3, "0")}`;
    if (
        !expectedClasses.includes(record.class)
        || record.id !== expectedId
        || record.sourceFile !== `classified_lcs/grs1915_lc${record.sourceIndex}.txt`
        || record.sampleCount !== 480
        || record.cadenceSeconds !== 0.125
        || !sha256Pattern.test(record.sha256)
        || record.asset !== `${record.class}-${String(record.sourceIndex).padStart(3, "0")}.${record.sha256.slice(0, 16)}.csv`
        || !Number.isInteger(record.utf8Bytes)
        || record.utf8Bytes <= 0
        || record.utf8Bytes > 64 * 1024
    ) {
        fail(`invalid record metadata for ${record.id ?? "unknown"}`);
    }
    if (ids.has(record.id) || labels.has(record.label) || assets.has(record.asset)) {
        fail(`duplicate ID, label, or asset for ${record.id}`);
    }
    ids.add(record.id);
    labels.add(record.label);
    assets.add(record.asset);
    classCounts.set(record.class, classCounts.get(record.class) + 1);

    const content = await readFile(path.join(corpusRoot, "records", record.asset));
    const digest = createHash("sha256").update(content).digest("hex");
    if (content.byteLength !== record.utf8Bytes || digest !== record.sha256) {
        fail(`${record.asset} does not match its byte count and SHA-256 digest`);
    }
    let text;
    try {
        text = new TextDecoder("utf-8", {fatal: true}).decode(content);
    } catch {
        fail(`${record.asset} is not valid UTF-8`);
    }
    if (!text.endsWith("\n") || text.includes("\r")) {
        fail(`${record.asset} does not use canonical LF line endings`);
    }
    const samples = text.slice(0, -1).split("\n");
    if (samples.length !== 480 || samples.some(sample => !samplePattern.test(sample))) {
        fail(`${record.asset} is not a 480-row, four-column integer series`);
    }
}

for (const [className, count] of classCounts) {
    if (count !== 4) fail(`expected four ${className} records, found ${count}`);
}

const directoryAssets = new Set(
    (await readdir(path.join(corpusRoot, "records"))).filter(name => name.endsWith(".csv")),
);
if (directoryAssets.size !== assets.size || [...directoryAssets].some(asset => !assets.has(asset))) {
    fail("record directory contains missing or unreferenced CSV assets");
}

console.log(`Verified ${manifest.records.length} GRS 1915+105 records (${manifest.records.length * 480} samples).`);
