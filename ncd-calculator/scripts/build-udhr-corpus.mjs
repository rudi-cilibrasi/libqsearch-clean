import {execFileSync} from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  UDHR_ASSET_BASE_PATH,
  UDHR_AUDIT_SCHEMA_VERSION,
  UDHR_CORPUS_VERSION,
  UDHR_DISPLAY_NAME_OVERRIDES,
  UDHR_EXPECTED_COMPARISON_COUNTS,
  UDHR_EXPECTED_COUNTS,
  UDHR_FEATURED_LANGUAGE_SOURCES,
  UDHR_SCHEMA_VERSION,
  UDHR_SOURCE_COMMIT,
} from "./udhr-corpus-config.mjs";
import {
  assertCanonicalAsset,
  extractCanonicalUdhr,
  parseTrustedXml,
  sha256,
} from "./udhr-corpus-common.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectDirectory, "public", "udhr", "v2");
const generatedDirectory = path.join(projectDirectory, "src", "generated");
const manifestPath = path.join(generatedDirectory, "udhr-manifest-v2.json");
const auditPath = path.join(generatedDirectory, "udhr-audit-v2.json");
const rawBaseUrl = `https://raw.githubusercontent.com/eric-muller/udhr/${UDHR_SOURCE_COMMIT}/data/udhr`;
const auditOnly = process.argv.includes("--audit-only");

const sourceArgumentIndex = process.argv.indexOf("--source-dir");
const requestedSourceDirectory = sourceArgumentIndex >= 0
  ? process.argv[sourceArgumentIndex + 1]
  : undefined;

if (sourceArgumentIndex >= 0 && !requestedSourceDirectory) {
  throw new Error("--source-dir requires a path to a Unicode UDHR repository checkout");
}

const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

const resolveLocalSource = (requestedPath) => {
  if (!requestedPath) return null;
  const absolutePath = path.resolve(requestedPath);
  const repositoryRoot = existsSync(path.join(absolutePath, "data", "udhr", "index.xml"))
    ? absolutePath
    : path.resolve(absolutePath, "..", "..");
  const dataDirectory = existsSync(path.join(absolutePath, "index.xml"))
    ? absolutePath
    : path.join(repositoryRoot, "data", "udhr");

  if (!existsSync(path.join(dataDirectory, "index.xml"))) {
    throw new Error(`Could not find data/udhr/index.xml under ${absolutePath}`);
  }

  const commit = execFileSync("git", ["-C", repositoryRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  if (commit !== UDHR_SOURCE_COMMIT) {
    throw new Error(`Source checkout is ${commit}; expected pinned commit ${UDHR_SOURCE_COMMIT}`);
  }
  return dataDirectory;
};

const localSourceDirectory = resolveLocalSource(requestedSourceDirectory);

const readSource = async (fileName) => {
  if (localSourceDirectory) {
    return readFile(path.join(localSourceDirectory, fileName), "utf8");
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${rawBaseUrl}/${fileName}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "unknown download failure";
  throw new Error(`Unable to download ${fileName} after 3 attempts: ${reason}`);
};

const mapWithConcurrency = async (values, concurrency, mapper) => {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    {length: Math.min(concurrency, values.length)},
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(values[currentIndex], currentIndex);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

const indexXml = await readSource("index.xml");
const parsedIndex = parseTrustedXml(indexXml, "index.xml");
const indexRecords = parsedIndex.udhrs?.udhr;
if (!Array.isArray(indexRecords)) {
  throw new Error("index.xml: missing UDHR records");
}

const normalizedIndexRecords = indexRecords.map((record) => ({
  available: record["@_status"] === "y",
  bcp47: record["@_bcp47"],
  direction: record["@_dir"],
  iso6393: record["@_iso639-3"],
  name: record["@_n"],
  ohchrTranslationId: record["@_ohchr"] || null,
  script: record["@_iso15924"],
  sourceKey: record["@_f"],
  stage: Number(record["@_stage"]),
}));

const sourceKeys = new Set();
for (const record of normalizedIndexRecords) {
  if (
    !record.sourceKey
    || !/^[A-Za-z0-9_-]+$/u.test(record.sourceKey)
    || sourceKeys.has(record.sourceKey)
    || !record.iso6393
    || !record.bcp47
    || !record.script
    || !record.direction
    || !record.name
    || !Number.isInteger(record.stage)
  ) {
    throw new Error(`Invalid or duplicate source-index record: ${record.sourceKey ?? "<missing>"}`);
  }
  sourceKeys.add(record.sourceKey);
}

const availableRecords = normalizedIndexRecords.filter(({available}) => available);
const eligibleRecords = availableRecords
  .filter(({stage}) => stage === 4)
  .sort((left, right) => compareText(left.sourceKey, right.sourceKey));
if (eligibleRecords.some(({direction}) => !["ltr", "rtl"].includes(direction))) {
  throw new Error("Eligible UDHR records contain an unsupported writing direction");
}
const ohchrLinkedRecords = eligibleRecords.filter(({ohchrTranslationId}) => ohchrTranslationId);
const unicodeCompleteRecords = eligibleRecords.filter(({ohchrTranslationId}) => !ohchrTranslationId);
const uniqueLanguages = new Set(eligibleRecords.map(({iso6393}) => iso6393));

const observedCounts = {
  indexed: normalizedIndexRecords.length,
  available: availableRecords.length,
  complete: eligibleRecords.length,
  uniqueLanguages: uniqueLanguages.size,
  ohchrLinked: ohchrLinkedRecords.length,
  unicodeComplete: unicodeCompleteRecords.length,
};
for (const [key, expected] of Object.entries(UDHR_EXPECTED_COUNTS)) {
  if (observedCounts[key] !== expected) {
    throw new Error(`Pinned-source count ${key} is ${observedCounts[key]}; expected ${expected}`);
  }
}

const legacyIds = new Set();
const featuredSourceKeys = new Set();
const featuredBySourceKey = new Map();
for (const [legacyId, sourceKey] of UDHR_FEATURED_LANGUAGE_SOURCES) {
  if (legacyIds.has(legacyId) || featuredSourceKeys.has(sourceKey)) {
    throw new Error("Featured UDHR configuration contains duplicate identifiers or source keys");
  }
  if (!eligibleRecords.some((record) => record.sourceKey === sourceKey)) {
    throw new Error(`${sourceKey}: featured record is not eligible in the pinned source`);
  }
  legacyIds.add(legacyId);
  featuredSourceKeys.add(sourceKey);
  featuredBySourceKey.set(sourceKey, legacyId);
}

// Validate every eligible source before writing. A single invalid record leaves
// the previously generated snapshot untouched.
const generated = await mapWithConcurrency(eligibleRecords, 8, async (indexRecord) => {
  const xml = await readSource(`udhr_${indexRecord.sourceKey}.xml`);
  const canonical = extractCanonicalUdhr(xml, indexRecord.sourceKey, {
    requireCompleteArticles: false,
    minimumCodePoints: 1,
  });
  const expectedMetadata = {
    direction: indexRecord.direction,
    iso6393: indexRecord.iso6393,
    languageTag: indexRecord.bcp47,
    name: indexRecord.name,
    script: indexRecord.script,
  };
  for (const [key, expected] of Object.entries(expectedMetadata)) {
    if (canonical[key] !== expected) {
      throw new Error(`${indexRecord.sourceKey}: XML ${key} metadata does not match index.xml`);
    }
  }

  const digest = sha256(canonical.text);
  const legacyId = featuredBySourceKey.get(indexRecord.sourceKey);
  const displayName = legacyId === undefined
    ? canonical.name
    : (UDHR_DISPLAY_NAME_OVERRIDES[legacyId] ?? canonical.name);
  const recordId = `udhr:${indexRecord.sourceKey}`;
  const asset = `${indexRecord.sourceKey}.${digest.slice(0, 16)}.txt`;
  const comparisonExclusionReasons = [
    ...(!canonical.hasCompleteArticles ? ["article-coverage"] : []),
    ...(canonical.characterCount < 2_000 ? ["short-content"] : []),
  ];
  return {
    text: canonical.text,
    record: {
      id: recordId,
      languageId: canonical.iso6393,
      sourceKey: indexRecord.sourceKey,
      name: displayName,
      ...(displayName === canonical.name ? {} : {sourceName: canonical.name}),
      ...(legacyId === undefined ? {} : {legacyId}),
      languageTag: canonical.languageTag,
      script: canonical.script,
      direction: canonical.direction,
      provenanceTier: indexRecord.ohchrTranslationId ? "ohchr-linked" : "unicode-complete",
      ohchrTranslationId: indexRecord.ohchrTranslationId,
      sourceStage: 4,
      comparisonReady: comparisonExclusionReasons.length === 0,
      comparisonExclusionReasons,
      asset,
      sha256: digest,
      utf8Bytes: canonical.utf8Bytes,
      characterCount: canonical.characterCount,
      segmentCount: canonical.segmentCount,
      articleCount: canonical.articleCount,
      articleNumbers: canonical.articleNumbers,
    },
  };
});

const records = generated.map(({record}) => record);
const recordIds = new Set(records.map(({id}) => id));
const assets = new Set(records.map(({asset}) => asset));
if (recordIds.size !== records.length || assets.size !== records.length) {
  throw new Error("Generated UDHR records contain duplicate identifiers or asset names");
}

const legacyAliases = Object.fromEntries(UDHR_FEATURED_LANGUAGE_SOURCES.map(
  ([legacyId, sourceKey]) => [legacyId, `udhr:${sourceKey}`],
));
for (const recordId of Object.values(legacyAliases)) {
  const record = records.find(({id}) => id === recordId);
  if (!record?.comparisonReady) {
    throw new Error(`${recordId}: featured record is not comparison-ready`);
  }
}
const indexDigest = sha256(indexXml);
const sourceIndexAsset = `source/index.${indexDigest.slice(0, 16)}.xml`;
const languageRecordCounts = new Map();
for (const {languageId} of records) {
  languageRecordCounts.set(languageId, (languageRecordCounts.get(languageId) ?? 0) + 1);
}
const multiRecordLanguages = [...languageRecordCounts.values()].filter((count) => count > 1).length;
const comparisonReadyRecords = records.filter(({comparisonReady}) => comparisonReady);
const comparisonReadyLanguages = new Set(comparisonReadyRecords.map(({languageId}) => languageId));
const corpusSummary = {
  ...observedCounts,
  comparisonReady: comparisonReadyRecords.length,
  comparisonReadyLanguages: comparisonReadyLanguages.size,
};
if (
  corpusSummary.comparisonReady !== UDHR_EXPECTED_COMPARISON_COUNTS.readyRecords
  || corpusSummary.comparisonReadyLanguages !== UDHR_EXPECTED_COMPARISON_COUNTS.readyLanguages
  || records.length - corpusSummary.comparisonReady !== UDHR_EXPECTED_COMPARISON_COUNTS.excludedRecords
) {
  throw new Error("Pinned-source comparison-readiness counts changed unexpectedly");
}

const availableByStage = Object.fromEntries([1, 2, 3, 4].map((stage) => [
  String(stage),
  availableRecords.filter((record) => record.stage === stage).length,
]));
const audit = {
  schemaVersion: UDHR_AUDIT_SCHEMA_VERSION,
  corpusVersion: UDHR_CORPUS_VERSION,
  source: {
    commit: UDHR_SOURCE_COMMIT,
    indexSha256: indexDigest,
  },
  policy: {
    include: "status=y and stage=4",
    exclude: "unavailable records and available stages 1-3",
    provenance: "OHCHR linkage is retained as a tier and is not an inclusion requirement",
  },
  counts: {
    ...corpusSummary,
    featured: UDHR_FEATURED_LANGUAGE_SOURCES.length,
    availableByStage,
    languageCodesWithMultipleRecords: multiRecordLanguages,
    extraVariantRecords: records.length - uniqueLanguages.size,
    validated: records.length,
    failures: 0,
  },
  comparisonExclusions: records
    .filter(({comparisonReady}) => !comparisonReady)
    .map(({id, sourceKey, articleNumbers, characterCount, comparisonExclusionReasons}) => ({
      id,
      sourceKey,
      articleNumbers,
      characterCount,
      reasons: comparisonExclusionReasons,
    })),
  excluded: {
    unavailable: normalizedIndexRecords
      .filter(({available}) => !available)
      .map(({sourceKey}) => sourceKey)
      .sort(compareText),
    incompleteAvailable: availableRecords
      .filter(({stage}) => stage !== 4)
      .map(({sourceKey, stage}) => ({sourceKey, stage}))
      .sort((left, right) => compareText(left.sourceKey, right.sourceKey)),
  },
};

const manifest = {
  schemaVersion: UDHR_SCHEMA_VERSION,
  corpusVersion: UDHR_CORPUS_VERSION,
  assetBasePath: UDHR_ASSET_BASE_PATH,
  source: {
    name: "Unicode UDHR Project",
    repository: "https://github.com/eric-muller/udhr",
    commit: UDHR_SOURCE_COMMIT,
    indexAsset: sourceIndexAsset,
    indexSha256: indexDigest,
    upstreamAuthority: "United Nations Human Rights (OHCHR)",
    upstreamUrl: "https://www.ohchr.org/en/human-rights/universal-declaration/translations",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    selection: "All available stage-4 records; Articles 1-30 body text only",
    normalization: "Unicode NFC; CRLF to LF; horizontal Unicode whitespace collapsed; empty XML paragraphs ignored",
  },
  summary: corpusSummary,
  legacyAliases,
  records,
};

if (auditOnly) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  await mkdir(path.dirname(outputDirectory), {recursive: true});
  await mkdir(generatedDirectory, {recursive: true});
  const stagingDirectory = await mkdtemp(path.join(path.dirname(outputDirectory), ".v2-stage-"));
  const stagingRecordsDirectory = path.join(stagingDirectory, "records");
  const stagingIndexPath = path.join(stagingDirectory, sourceIndexAsset);
  const manifestTemporaryPath = `${manifestPath}.tmp-${process.pid}`;
  const auditTemporaryPath = `${auditPath}.tmp-${process.pid}`;

  try {
    await mkdir(stagingRecordsDirectory, {recursive: true});
    await mkdir(path.dirname(stagingIndexPath), {recursive: true});
    await Promise.all(generated.map(({record, text}) => (
      writeFile(path.join(stagingRecordsDirectory, record.asset), text, "utf8")
    )));
    await writeFile(stagingIndexPath, indexXml, "utf8");

    // Re-read every staged asset before publication so the generator verifies
    // the exact bytes it will commit, not only its in-memory representation.
    await mapWithConcurrency(records, 16, async (record) => {
      const text = await readFile(path.join(stagingRecordsDirectory, record.asset), "utf8");
      assertCanonicalAsset(text, record);
    });
    if (sha256(await readFile(stagingIndexPath, "utf8")) !== indexDigest) {
      throw new Error("Staged source index does not match its SHA-256 digest");
    }

    await writeFile(manifestTemporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await writeFile(auditTemporaryPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

    const backupDirectory = `${outputDirectory}.backup-${process.pid}`;
    const manifestBackupPath = `${manifestPath}.backup-${process.pid}`;
    const auditBackupPath = `${auditPath}.backup-${process.pid}`;
    await rm(backupDirectory, {recursive: true, force: true});
    await rm(manifestBackupPath, {force: true});
    await rm(auditBackupPath, {force: true});
    let outputBackedUp = false;
    let manifestBackedUp = false;
    let auditBackedUp = false;
    let outputPublished = false;
    let manifestPublished = false;
    let auditPublished = false;
    try {
      if (existsSync(outputDirectory)) {
        await rename(outputDirectory, backupDirectory);
        outputBackedUp = true;
      }
      if (existsSync(manifestPath)) {
        await rename(manifestPath, manifestBackupPath);
        manifestBackedUp = true;
      }
      if (existsSync(auditPath)) {
        await rename(auditPath, auditBackupPath);
        auditBackedUp = true;
      }

      await rename(stagingDirectory, outputDirectory);
      outputPublished = true;
      await rename(manifestTemporaryPath, manifestPath);
      manifestPublished = true;
      await rename(auditTemporaryPath, auditPath);
      auditPublished = true;
    } catch (error) {
      if (auditPublished) await rm(auditPath, {force: true});
      if (manifestPublished) await rm(manifestPath, {force: true});
      if (outputPublished) await rm(outputDirectory, {recursive: true, force: true});
      if (auditBackedUp) await rename(auditBackupPath, auditPath);
      if (manifestBackedUp) await rename(manifestBackupPath, manifestPath);
      if (outputBackedUp) await rename(backupDirectory, outputDirectory);
      throw error;
    }
    await rm(backupDirectory, {recursive: true, force: true});
    await rm(manifestBackupPath, {force: true});
    await rm(auditBackupPath, {force: true});
  } finally {
    await rm(stagingDirectory, {recursive: true, force: true});
    await rm(manifestTemporaryPath, {force: true});
    await rm(auditTemporaryPath, {force: true});
  }

  console.log(
    `Generated ${records.length} verified UDHR records across ${uniqueLanguages.size} languages (${UDHR_CORPUS_VERSION}).`,
  );
}
