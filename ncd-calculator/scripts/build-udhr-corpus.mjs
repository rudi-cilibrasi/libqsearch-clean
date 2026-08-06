import {execFileSync} from "node:child_process";
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {
  UDHR_CORPUS_VERSION,
  UDHR_LANGUAGE_SOURCES,
  UDHR_SCHEMA_VERSION,
  UDHR_SOURCE_COMMIT,
} from "./udhr-corpus-config.mjs";
import {extractCanonicalUdhr, parseTrustedXml, sha256} from "./udhr-corpus-common.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, "..");
const outputDirectory = path.join(projectDirectory, "public", "udhr", "v1");
const manifestPath = path.join(projectDirectory, "src", "generated", "udhr-manifest.json");
const rawBaseUrl = `https://raw.githubusercontent.com/eric-muller/udhr/${UDHR_SOURCE_COMMIT}/data/udhr`;

const sourceArgumentIndex = process.argv.indexOf("--source-dir");
const requestedSourceDirectory = sourceArgumentIndex >= 0
  ? process.argv[sourceArgumentIndex + 1]
  : undefined;

if (sourceArgumentIndex >= 0 && !requestedSourceDirectory) {
  throw new Error("--source-dir requires a path to a Unicode UDHR repository checkout");
}

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
  const response = await fetch(`${rawBaseUrl}/${fileName}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Unable to download ${fileName}: HTTP ${response.status}`);
  }
  return response.text();
};

const indexXml = await readSource("index.xml");
const parsedIndex = parseTrustedXml(indexXml, "index.xml");
const indexRecords = parsedIndex.udhrs?.udhr;
if (!Array.isArray(indexRecords)) {
  throw new Error("index.xml: missing UDHR records");
}
const indexBySourceKey = new Map(indexRecords.map((record) => [record["@_f"], record]));

const configuredIds = new Set(UDHR_LANGUAGE_SOURCES.map(([id]) => id));
const configuredSourceKeys = new Set(UDHR_LANGUAGE_SOURCES.map(([, sourceKey]) => sourceKey));
if (
  configuredIds.size !== UDHR_LANGUAGE_SOURCES.length
  || configuredSourceKeys.size !== UDHR_LANGUAGE_SOURCES.length
) {
  throw new Error("UDHR configuration contains duplicate identifiers or source keys");
}

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

// Validate and retain the complete generated corpus in memory before writing
// anything, so a bad upstream record cannot partially replace a known-good set.
const generated = await mapWithConcurrency(UDHR_LANGUAGE_SOURCES, 8, async ([id, sourceKey]) => {
  const indexRecord = indexBySourceKey.get(sourceKey);
  if (!indexRecord) {
    throw new Error(`${sourceKey}: missing from Unicode UDHR index`);
  }
  if (indexRecord["@_stage"] !== "4" || indexRecord["@_status"] !== "y") {
    throw new Error(`${sourceKey}: source is not marked complete and available`);
  }
  if (!indexRecord["@_ohchr"]) {
    throw new Error(`${sourceKey}: source is not linked to an OHCHR translation`);
  }

  const xml = await readSource(`udhr_${sourceKey}.xml`);
  const canonical = extractCanonicalUdhr(xml, sourceKey);
  const expectedMetadata = {
    direction: indexRecord["@_dir"],
    iso6393: indexRecord["@_iso639-3"],
    languageTag: indexRecord["@_bcp47"],
    name: indexRecord["@_n"],
    script: indexRecord["@_iso15924"],
  };
  for (const [key, expected] of Object.entries(expectedMetadata)) {
    if (canonical[key] !== expected) {
      throw new Error(`${sourceKey}: XML ${key} metadata does not match index.xml`);
    }
  }

  const asset = `${id}.txt`;
  return {
    text: canonical.text,
    language: {
      id,
      sourceKey,
      name: canonical.name,
      languageTag: canonical.languageTag,
      iso6393: canonical.iso6393,
      script: canonical.script,
      direction: canonical.direction,
      ohchrTranslationId: indexRecord["@_ohchr"],
      sourceStage: Number(indexRecord["@_stage"]),
      asset,
      sha256: sha256(canonical.text),
      utf8Bytes: canonical.utf8Bytes,
      characterCount: canonical.characterCount,
      segmentCount: canonical.segmentCount,
      articleCount: canonical.articleCount,
    },
  };
});

const languages = generated.map(({language}) => language);

const manifest = {
  schemaVersion: UDHR_SCHEMA_VERSION,
  corpusVersion: UDHR_CORPUS_VERSION,
  source: {
    name: "Unicode UDHR Project",
    repository: "https://github.com/eric-muller/udhr",
    commit: UDHR_SOURCE_COMMIT,
    upstreamAuthority: "United Nations Human Rights (OHCHR)",
    upstreamUrl: "https://www.ohchr.org/en/human-rights/universal-declaration/translations",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    selection: "Articles 1-30 body text; preambles, notes, and headings excluded",
    normalization: "Unicode NFC; CRLF to LF; horizontal Unicode whitespace collapsed; empty XML paragraphs ignored",
  },
  languages,
};

await mkdir(outputDirectory, {recursive: true});
await mkdir(path.dirname(manifestPath), {recursive: true});
await Promise.all(generated.map(({language, text}) => (
  writeFile(path.join(outputDirectory, language.asset), text, "utf8")
)));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${languages.length} verified UDHR translations (${UDHR_CORPUS_VERSION}).`);
