import {readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  UDHR_ASSET_BASE_PATH,
  UDHR_AUDIT_SCHEMA_VERSION,
  UDHR_CORPUS_VERSION,
  UDHR_EXPECTED_COMPARISON_COUNTS,
  UDHR_EXPECTED_COUNTS,
  UDHR_FEATURED_LANGUAGE_SOURCES,
  UDHR_SCHEMA_VERSION,
  UDHR_SOURCE_COMMIT,
} from "./udhr-corpus-config.mjs";
import {assertCanonicalAsset, sha256} from "./udhr-corpus-common.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const manifestPath = path.join(projectDirectory, "src", "generated", "udhr-manifest-v2.json");
const auditPath = path.join(projectDirectory, "src", "generated", "udhr-audit-v2.json");
const corpusDirectory = path.join(projectDirectory, "public", "udhr", "v2");
const assetDirectory = path.join(corpusDirectory, "records");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));

if (manifest.schemaVersion !== UDHR_SCHEMA_VERSION) {
  throw new Error(`Unexpected UDHR schema version: ${manifest.schemaVersion}`);
}
if (manifest.corpusVersion !== UDHR_CORPUS_VERSION) {
  throw new Error(`Unexpected UDHR corpus version: ${manifest.corpusVersion}`);
}
if (manifest.assetBasePath !== UDHR_ASSET_BASE_PATH) {
  throw new Error(`Unexpected UDHR asset base path: ${manifest.assetBasePath}`);
}
if (manifest.source?.commit !== UDHR_SOURCE_COMMIT) {
  throw new Error(`Unexpected UDHR source commit: ${manifest.source?.commit}`);
}
if (audit.schemaVersion !== UDHR_AUDIT_SCHEMA_VERSION || audit.corpusVersion !== UDHR_CORPUS_VERSION) {
  throw new Error("UDHR audit report is incompatible with the generated manifest");
}
if (
  audit.source?.commit !== manifest.source.commit
  || audit.source?.indexSha256 !== manifest.source.indexSha256
) {
  throw new Error("UDHR audit provenance does not match the generated manifest");
}
for (const [key, expected] of Object.entries(UDHR_EXPECTED_COUNTS)) {
  if (manifest.summary?.[key] !== expected || audit.counts?.[key] !== expected) {
    throw new Error(`UDHR ${key} count does not match the pinned-source contract`);
  }
}
if (!Array.isArray(manifest.records) || manifest.records.length !== UDHR_EXPECTED_COUNTS.complete) {
  throw new Error(`Expected ${UDHR_EXPECTED_COUNTS.complete} complete UDHR records`);
}
if (audit.counts?.validated !== manifest.records.length || audit.counts?.failures !== 0) {
  throw new Error("UDHR audit validation counts are inconsistent");
}
if (
  manifest.summary?.comparisonReady !== UDHR_EXPECTED_COMPARISON_COUNTS.readyRecords
  || manifest.summary?.comparisonReadyLanguages !== UDHR_EXPECTED_COMPARISON_COUNTS.readyLanguages
  || audit.counts?.comparisonReady !== UDHR_EXPECTED_COMPARISON_COUNTS.readyRecords
  || audit.counts?.comparisonReadyLanguages !== UDHR_EXPECTED_COMPARISON_COUNTS.readyLanguages
  || audit.comparisonExclusions?.length !== UDHR_EXPECTED_COMPARISON_COUNTS.excludedRecords
) {
  throw new Error("UDHR comparison-readiness counts do not match the pinned audit contract");
}

const expectedLegacyAliases = Object.fromEntries(UDHR_FEATURED_LANGUAGE_SOURCES.map(
  ([legacyId, sourceKey]) => [legacyId, `udhr:${sourceKey}`],
));
if (JSON.stringify(manifest.legacyAliases) !== JSON.stringify(expectedLegacyAliases)) {
  throw new Error("UDHR legacy aliases do not match the reviewed featured-record configuration");
}

const observedIds = new Set();
const observedSourceKeys = new Set();
const observedAssets = new Set();
const observedLanguageIds = new Set();
const observedComparisonReadyLanguageIds = new Set();
const expectedComparisonExclusions = [];
let ohchrLinked = 0;
let unicodeComplete = 0;
for (const record of manifest.records) {
  if (
    typeof record.id !== "string"
    || record.id !== `udhr:${record.sourceKey}`
    || !/^udhr:[A-Za-z0-9_-]+$/u.test(record.id)
    || observedIds.has(record.id)
    || observedSourceKeys.has(record.sourceKey)
    || observedAssets.has(record.asset)
    || typeof record.languageId !== "string"
    || !record.languageId
  ) {
    throw new Error(`Invalid or duplicate UDHR record identity: ${record.id}`);
  }
  observedIds.add(record.id);
  observedSourceKeys.add(record.sourceKey);
  observedAssets.add(record.asset);
  observedLanguageIds.add(record.languageId);

  if (
    record.sourceStage !== 4
    || !Array.isArray(record.articleNumbers)
    || record.articleNumbers.length !== record.articleCount
    || record.segmentCount !== record.articleCount
    || record.articleNumbers.some((articleNumber, index) => (
      !Number.isInteger(articleNumber)
      || articleNumber < 1
      || articleNumber > 30
      || (index > 0 && articleNumber <= record.articleNumbers[index - 1])
    ))
  ) {
    throw new Error(`${record.id}: source completeness metadata is invalid`);
  }
  const hasCompleteCoverage = (
    record.articleCount === 30
    && record.articleNumbers.every((articleNumber, index) => articleNumber === index + 1)
  );
  const expectedComparisonReady = hasCompleteCoverage && record.characterCount >= 2_000;
  const expectedExclusionReasons = [
    ...(!hasCompleteCoverage ? ["article-coverage"] : []),
    ...(record.characterCount < 2_000 ? ["short-content"] : []),
  ];
  if (
    record.comparisonReady !== expectedComparisonReady
    || !Array.isArray(record.comparisonExclusionReasons)
    || JSON.stringify(record.comparisonExclusionReasons) !== JSON.stringify(expectedExclusionReasons)
  ) {
    throw new Error(`${record.id}: comparison-readiness metadata is invalid`);
  }
  if (record.comparisonReady) {
    observedComparisonReadyLanguageIds.add(record.languageId);
  } else {
    expectedComparisonExclusions.push({
      id: record.id,
      sourceKey: record.sourceKey,
      articleNumbers: record.articleNumbers,
      characterCount: record.characterCount,
      reasons: expectedExclusionReasons,
    });
  }
  if (!/^[a-f0-9]{64}$/u.test(record.sha256)) {
    throw new Error(`${record.id}: invalid SHA-256 digest`);
  }
  if (record.asset !== `${record.sourceKey}.${record.sha256.slice(0, 16)}.txt`) {
    throw new Error(`${record.id}: asset name is not content-addressed`);
  }
  if (record.provenanceTier === "ohchr-linked") {
    if (typeof record.ohchrTranslationId !== "string" || !record.ohchrTranslationId) {
      throw new Error(`${record.id}: OHCHR-linked record is missing its translation identifier`);
    }
    ohchrLinked += 1;
  } else if (record.provenanceTier === "unicode-complete") {
    if (record.ohchrTranslationId !== null) {
      throw new Error(`${record.id}: Unicode-complete record has inconsistent OHCHR metadata`);
    }
    unicodeComplete += 1;
  } else {
    throw new Error(`${record.id}: unsupported provenance tier`);
  }

  const text = await readFile(path.join(assetDirectory, record.asset), "utf8");
  assertCanonicalAsset(text, record);
}

if (
  observedLanguageIds.size !== UDHR_EXPECTED_COUNTS.uniqueLanguages
  || observedComparisonReadyLanguageIds.size !== UDHR_EXPECTED_COMPARISON_COUNTS.readyLanguages
  || ohchrLinked !== UDHR_EXPECTED_COUNTS.ohchrLinked
  || unicodeComplete !== UDHR_EXPECTED_COUNTS.unicodeComplete
) {
  throw new Error("UDHR language or provenance counts are inconsistent");
}
if (JSON.stringify(audit.comparisonExclusions) !== JSON.stringify(expectedComparisonExclusions)) {
  throw new Error("UDHR audit exclusions do not match the manifest records");
}
for (const [legacyId, recordId] of Object.entries(manifest.legacyAliases)) {
  const record = manifest.records.find(({id}) => id === recordId);
  if (!record || record.legacyId !== legacyId) {
    throw new Error(`${legacyId}: legacy alias does not resolve to its featured record`);
  }
}

const expectedAssets = [...observedAssets].sort();
const files = await readdir(assetDirectory);
const actualAssets = files.filter((fileName) => fileName.endsWith(".txt")).sort();
if (JSON.stringify(actualAssets) !== JSON.stringify(expectedAssets)) {
  throw new Error("UDHR v2 asset directory contains missing or stale text files");
}

const sourceIndexPath = path.join(corpusDirectory, manifest.source.indexAsset);
const sourceIndex = await readFile(sourceIndexPath, "utf8");
if (
  manifest.source.indexSha256 !== audit.source?.indexSha256
  || sha256(sourceIndex) !== manifest.source.indexSha256
) {
  throw new Error("Pinned UDHR source index does not match its recorded SHA-256 digest");
}
const sourceFiles = (await readdir(path.join(corpusDirectory, "source"))).sort();
if (JSON.stringify(sourceFiles) !== JSON.stringify([path.basename(manifest.source.indexAsset)])) {
  throw new Error("UDHR v2 source directory contains missing or stale files");
}

console.log(
  `Verified ${manifest.records.length} UDHR records across ${observedLanguageIds.size} languages (${manifest.corpusVersion}).`,
);
