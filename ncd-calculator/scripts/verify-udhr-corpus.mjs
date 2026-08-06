import {readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  UDHR_CORPUS_VERSION,
  UDHR_LANGUAGE_SOURCES,
  UDHR_SCHEMA_VERSION,
  UDHR_SOURCE_COMMIT,
} from "./udhr-corpus-config.mjs";
import {assertCanonicalAsset} from "./udhr-corpus-common.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(projectDirectory, "src", "generated", "udhr-manifest.json");
const assetDirectory = path.join(projectDirectory, "public", "udhr", "v1");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.schemaVersion !== UDHR_SCHEMA_VERSION) {
  throw new Error(`Unexpected UDHR schema version: ${manifest.schemaVersion}`);
}
if (manifest.corpusVersion !== UDHR_CORPUS_VERSION) {
  throw new Error(`Unexpected UDHR corpus version: ${manifest.corpusVersion}`);
}
if (manifest.source?.commit !== UDHR_SOURCE_COMMIT) {
  throw new Error(`Unexpected UDHR source commit: ${manifest.source?.commit}`);
}
if (!Array.isArray(manifest.languages) || manifest.languages.length !== UDHR_LANGUAGE_SOURCES.length) {
  throw new Error(`Expected ${UDHR_LANGUAGE_SOURCES.length} UDHR language records`);
}

const expectedMappings = new Map(UDHR_LANGUAGE_SOURCES);
const observedIds = new Set();
for (const language of manifest.languages) {
  if (observedIds.has(language.id)) {
    throw new Error(`Duplicate UDHR language identifier: ${language.id}`);
  }
  observedIds.add(language.id);
  if (expectedMappings.get(language.id) !== language.sourceKey) {
    throw new Error(`${language.id}: source key does not match the pinned configuration`);
  }
  if (language.sourceStage !== 4 || language.articleCount !== 30) {
    throw new Error(`${language.id}: source completeness metadata is invalid`);
  }
  if (!/^[a-f0-9]{64}$/u.test(language.sha256)) {
    throw new Error(`${language.id}: invalid SHA-256 digest`);
  }
  if (language.asset !== `${language.id}.txt`) {
    throw new Error(`${language.id}: asset name is not canonical`);
  }

  const text = await readFile(path.join(assetDirectory, language.asset), "utf8");
  assertCanonicalAsset(text, language);
}

const expectedAssets = manifest.languages.map(({asset}) => asset).sort();
const observedAssets = (await readdir(assetDirectory))
  .filter((fileName) => fileName.endsWith(".txt"))
  .sort();
if (JSON.stringify(observedAssets) !== JSON.stringify(expectedAssets)) {
  throw new Error("UDHR asset directory contains missing or stale text files");
}

console.log(`Verified ${manifest.languages.length} UDHR assets (${manifest.corpusVersion}).`);
