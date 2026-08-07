import rawManifest from "../generated/udhr-manifest-v2.json";

export type UdhrProvenanceTier = "ohchr-linked" | "unicode-complete";
export type UdhrComparisonExclusionReason = "article-coverage" | "short-content";

export interface UdhrLanguageRecord {
  readonly id: string;
  readonly languageId: string;
  readonly sourceKey: string;
  readonly name: string;
  readonly sourceName?: string;
  readonly legacyId?: string;
  readonly languageTag: string;
  readonly script: string;
  readonly direction: "ltr" | "rtl";
  readonly provenanceTier: UdhrProvenanceTier;
  readonly ohchrTranslationId: string | null;
  readonly sourceStage: 4;
  readonly comparisonReady: boolean;
  readonly comparisonExclusionReasons: readonly UdhrComparisonExclusionReason[];
  readonly asset: string;
  readonly sha256: string;
  readonly utf8Bytes: number;
  readonly characterCount: number;
  readonly segmentCount: number;
  readonly articleCount: number;
  readonly articleNumbers: readonly number[];
}

export interface UdhrLanguageGroup {
  readonly id: string;
  readonly name: string;
  readonly records: readonly UdhrLanguageRecord[];
  readonly comparisonReadyRecords: readonly UdhrLanguageRecord[];
}

interface UdhrSourceRecord {
  readonly name: string;
  readonly repository: string;
  readonly commit: string;
  readonly indexAsset: string;
  readonly indexSha256: string;
  readonly upstreamAuthority: string;
  readonly upstreamUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly selection: string;
  readonly normalization: string;
}

interface UdhrSummary {
  readonly indexed: number;
  readonly available: number;
  readonly complete: number;
  readonly uniqueLanguages: number;
  readonly ohchrLinked: number;
  readonly unicodeComplete: number;
  readonly comparisonReady: number;
  readonly comparisonReadyLanguages: number;
}

interface UdhrManifest {
  readonly schemaVersion: 2;
  readonly corpusVersion: string;
  readonly assetBasePath: string;
  readonly source: UdhrSourceRecord;
  readonly summary: UdhrSummary;
  readonly legacyAliases: Readonly<Record<string, string>>;
  readonly records: readonly UdhrLanguageRecord[];
}

const CONTROL_CHARACTERS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RECORD_ID_PATTERN = /^udhr:[A-Za-z0-9_-]+$/u;
const SOURCE_KEY_PATTERN = /^[A-Za-z0-9_-]+$/u;
const ASSET_PATTERN = /^[A-Za-z0-9_-]+\.[a-f0-9]{16}\.txt$/u;
const MAX_CONCURRENT_LOADS = 6;
const manifest = rawManifest as UdhrManifest;

const assertManifest = (value: UdhrManifest): void => {
  if (
    value.schemaVersion !== 2
    || typeof value.corpusVersion !== "string"
    || !value.corpusVersion
    || typeof value.assetBasePath !== "string"
    || !/^udhr\/v2\/records$/u.test(value.assetBasePath)
    || typeof value.source?.commit !== "string"
    || !SHA256_PATTERN.test(value.source.indexSha256)
    || !Array.isArray(value.records)
    || value.records.length !== value.summary?.complete
    || typeof value.legacyAliases !== "object"
    || value.legacyAliases === null
  ) {
    throw new Error("The bundled UDHR manifest has an unsupported format");
  }

  const ids = new Set<string>();
  const sourceKeys = new Set<string>();
  const assets = new Set<string>();
  const languageIds = new Set<string>();
  const comparisonReadyLanguageIds = new Set<string>();
  let comparisonReady = 0;
  let ohchrLinked = 0;
  let unicodeComplete = 0;

  for (const record of value.records) {
    const hasCompleteArticles = (
      Array.isArray(record.articleNumbers)
      && record.articleNumbers.length === 30
      && record.articleNumbers.every((articleNumber: number, index: number) => (
        articleNumber === index + 1
      ))
    );
    const expectedExclusionReasons: readonly UdhrComparisonExclusionReason[] = [
      ...(!hasCompleteArticles ? ["article-coverage" as const] : []),
      ...(record.characterCount < 2_000 ? ["short-content" as const] : []),
    ];
    if (
      typeof record.id !== "string"
      || !RECORD_ID_PATTERN.test(record.id)
      || record.id !== `udhr:${record.sourceKey}`
      || ids.has(record.id)
      || !SOURCE_KEY_PATTERN.test(record.sourceKey)
      || sourceKeys.has(record.sourceKey)
      || typeof record.languageId !== "string"
      || !record.languageId
      || typeof record.name !== "string"
      || !record.name
      || (record.sourceName !== undefined && (
        typeof record.sourceName !== "string" || !record.sourceName
      ))
      || (record.legacyId !== undefined && (
        typeof record.legacyId !== "string" || !record.legacyId
      ))
      || typeof record.languageTag !== "string"
      || !record.languageTag
      || typeof record.script !== "string"
      || !record.script
      || !["ltr", "rtl"].includes(record.direction)
      || record.sourceStage !== 4
      || !Array.isArray(record.articleNumbers)
      || record.articleNumbers.length !== record.articleCount
      || record.segmentCount !== record.articleCount
      || record.articleNumbers.some((articleNumber: number, index: number) => (
        !Number.isInteger(articleNumber)
        || articleNumber < 1
        || articleNumber > 30
        || (index > 0 && articleNumber <= record.articleNumbers[index - 1])
      ))
      || record.comparisonReady !== (hasCompleteArticles && record.characterCount >= 2_000)
      || !Array.isArray(record.comparisonExclusionReasons)
      || record.comparisonExclusionReasons.length !== expectedExclusionReasons.length
      || record.comparisonExclusionReasons.some((
        reason: UdhrComparisonExclusionReason,
        index: number,
      ) => (
        reason !== expectedExclusionReasons[index]
      ))
      || !ASSET_PATTERN.test(record.asset)
      || assets.has(record.asset)
      || !SHA256_PATTERN.test(record.sha256)
      || record.asset !== `${record.sourceKey}.${record.sha256.slice(0, 16)}.txt`
      || !Number.isInteger(record.utf8Bytes)
      || record.utf8Bytes <= 0
      || !Number.isInteger(record.characterCount)
      || record.characterCount <= 0
    ) {
      throw new Error(`The bundled UDHR manifest is invalid at record ${record.id}`);
    }

    if (record.provenanceTier === "ohchr-linked") {
      if (typeof record.ohchrTranslationId !== "string" || !record.ohchrTranslationId) {
        throw new Error(`The bundled UDHR provenance is invalid at record ${record.id}`);
      }
      ohchrLinked += 1;
    } else if (record.provenanceTier === "unicode-complete") {
      if (record.ohchrTranslationId !== null) {
        throw new Error(`The bundled UDHR provenance is invalid at record ${record.id}`);
      }
      unicodeComplete += 1;
    } else {
      throw new Error(`The bundled UDHR provenance is invalid at record ${record.id}`);
    }

    if (record.comparisonReady) {
      comparisonReady += 1;
      comparisonReadyLanguageIds.add(record.languageId);
    }
    ids.add(record.id);
    sourceKeys.add(record.sourceKey);
    assets.add(record.asset);
    languageIds.add(record.languageId);
  }

  if (
    languageIds.size !== value.summary.uniqueLanguages
    || comparisonReady !== value.summary.comparisonReady
    || comparisonReadyLanguageIds.size !== value.summary.comparisonReadyLanguages
    || ohchrLinked !== value.summary.ohchrLinked
    || unicodeComplete !== value.summary.unicodeComplete
  ) {
    throw new Error("The bundled UDHR manifest summary is inconsistent");
  }

  const legacyIds = new Set<string>();
  for (const [legacyId, recordId] of Object.entries(value.legacyAliases)) {
    if (legacyIds.has(legacyId)) {
      throw new Error(`The bundled UDHR manifest duplicates legacy alias ${legacyId}`);
    }
    const record = value.records.find(({id}) => id === recordId);
    if (!record || record.legacyId !== legacyId || !record.comparisonReady) {
      throw new Error(`The bundled UDHR legacy alias is invalid at ${legacyId}`);
    }
    legacyIds.add(legacyId);
  }
};

assertManifest(manifest);

export const UDHR_CORPUS = Object.freeze({
  schemaVersion: manifest.schemaVersion,
  corpusVersion: manifest.corpusVersion,
  assetBasePath: manifest.assetBasePath,
  source: Object.freeze({...manifest.source}),
  summary: Object.freeze({...manifest.summary}),
});

export const UDHR_RECORDS: readonly UdhrLanguageRecord[] = Object.freeze(
  manifest.records.map((record) => Object.freeze({
    ...record,
    articleNumbers: Object.freeze([...record.articleNumbers]),
    comparisonExclusionReasons: Object.freeze([...record.comparisonExclusionReasons]),
  })),
);

const recordById = new Map(UDHR_RECORDS.map((record) => [record.id, record]));
const legacyAliases = new Map(Object.entries(manifest.legacyAliases));

/**
 * Records retained by the original reviewed browser. Legacy IDs continue to
 * resolve to these records, but the grouped browser uses UDHR_LANGUAGE_GROUPS.
 */
export const UDHR_FEATURED_LANGUAGES: readonly UdhrLanguageRecord[] = Object.freeze(
  Object.keys(manifest.legacyAliases).map((legacyId) => {
    const record = recordById.get(manifest.legacyAliases[legacyId]);
    if (!record) throw new Error(`Missing featured UDHR record for ${legacyId}`);
    return record;
  }),
);

/** @deprecated Use UDHR_RECORDS or UDHR_LANGUAGE_GROUPS explicitly. */
export const UDHR_LANGUAGES: readonly UdhrLanguageRecord[] = UDHR_RECORDS;

const compareText = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const getNameSortKey = (name: string): string => name
  .normalize("NFKD")
  .replace(/\p{Mark}+/gu, "")
  .toLocaleLowerCase("en");

const removeTrailingVariant = (name: string): string => {
  const concise = name.replace(/\s*\([^()]+\)\s*$/u, "").trim();
  return concise || name;
};

const deriveGroupName = (
  languageId: string,
  records: readonly UdhrLanguageRecord[],
): string => {
  if (languageId === "und") return "Unclassified records";

  const featured = records.find(({legacyId}) => legacyId !== undefined);
  if (featured) return featured.name;

  const exactSource = records.find(({sourceKey}) => sourceKey === languageId);
  if (exactSource) return exactSource.name;

  return records
    .map(({name}) => removeTrailingVariant(name))
    .sort((left, right) => left.length - right.length || compareText(left, right))[0];
};

const groupedRecords = new Map<string, UdhrLanguageRecord[]>();
for (const record of UDHR_RECORDS) {
  const group = groupedRecords.get(record.languageId);
  if (group) group.push(record);
  else groupedRecords.set(record.languageId, [record]);
}

export const UDHR_LANGUAGE_GROUPS: readonly UdhrLanguageGroup[] = Object.freeze(
  [...groupedRecords].map(([languageId, records]) => {
    const sortedRecords = Object.freeze([...records].sort((left, right) => (
      compareText(left.sourceKey, right.sourceKey)
    )));
    return Object.freeze({
      id: languageId,
      name: deriveGroupName(languageId, sortedRecords),
      records: sortedRecords,
      comparisonReadyRecords: Object.freeze(sortedRecords.filter(({comparisonReady}) => comparisonReady)),
    });
  }).sort((left, right) => (
    compareText(getNameSortKey(left.name), getNameSortKey(right.name))
    || compareText(left.id, right.id)
  )),
);

const groupByLanguageId = new Map(UDHR_LANGUAGE_GROUPS.map((group) => [group.id, group]));
const baseRecordLabels = new Map<string, string>();
const baseLabelCounts = new Map<string, number>();
for (const group of UDHR_LANGUAGE_GROUPS) {
  for (const record of group.records) {
    const label = group.records.length === 1
      ? group.name
      : (record.sourceName ?? record.name);
    baseRecordLabels.set(record.id, label);
    baseLabelCounts.set(label, (baseLabelCounts.get(label) ?? 0) + 1);
  }
}
const displayLabelByRecordId = new Map<string, string>();
for (const record of UDHR_RECORDS) {
  const baseLabel = baseRecordLabels.get(record.id) ?? record.name;
  displayLabelByRecordId.set(
    record.id,
    (baseLabelCounts.get(baseLabel) ?? 0) > 1
      ? `${baseLabel} [${record.sourceKey}]`
      : baseLabel,
  );
}
if (new Set(displayLabelByRecordId.values()).size !== UDHR_RECORDS.length) {
  throw new Error("The bundled UDHR record display labels are not globally unique");
}

/**
 * A concise, globally unique presentation label for matrices, trees, and the
 * comparison set. Source keys appear only when upstream variant names collide.
 */
export const getUdhrRecordDisplayLabel = (identifier: string): string | undefined => {
  const record = getUdhrLanguage(identifier);
  if (!record) return undefined;
  return displayLabelByRecordId.get(record.id);
};

export const getUdhrLanguageGroup = (languageId: string): UdhrLanguageGroup | undefined => (
  groupByLanguageId.get(languageId)
);

export const UDHR_SCRIPT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  Adlm: "Adlam", Arab: "Arabic", Armn: "Armenian", Beng: "Bengali", Cakm: "Chakma",
  Cans: "Canadian Aboriginal syllabics", Cher: "Cherokee", Cyrl: "Cyrillic", Deva: "Devanagari",
  Ethi: "Ethiopic", Geor: "Georgian", Gran: "Grantha", Grek: "Greek", Gujr: "Gujarati",
  Guru: "Gurmukhi", Hang: "Hangul", Hani: "Han", Hans: "Simplified Han", Hant: "Traditional Han",
  Hebr: "Hebrew", Java: "Javanese", Jpan: "Japanese", Khmr: "Khmer", Knda: "Kannada",
  Kore: "Korean", Lana: "Tai Tham", Laoo: "Lao", Latn: "Latin", Mlym: "Malayalam",
  Mymr: "Myanmar", Sinh: "Sinhala", Syrc: "Syriac", Taml: "Tamil", Tavt: "Tai Viet",
  Telu: "Telugu", Tfng: "Tifinagh", Thaa: "Thaana", Thai: "Thai", Tibt: "Tibetan",
  Vaii: "Vai", Yiii: "Yi",
});

const memoryCache = new Map<string, string>();
const pendingLoads = new Map<string, Promise<string>>();
let activeLoads = 0;
const loadWaiters: Array<() => void> = [];

const acquireLoadSlot = async (): Promise<void> => {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads += 1;
    return;
  }
  await new Promise<void>((resolve) => loadWaiters.push(resolve));
  activeLoads += 1;
};

const releaseLoadSlot = (): void => {
  activeLoads -= 1;
  loadWaiters.shift()?.();
};

const withLoadSlot = async <T>(operation: () => Promise<T>): Promise<T> => {
  await acquireLoadSlot();
  try {
    return await operation();
  } finally {
    releaseLoadSlot();
  }
};

export const resolveUdhrRecordId = (identifier: string): string | undefined => {
  if (recordById.has(identifier)) return identifier;
  return legacyAliases.get(identifier);
};

export const getUdhrLanguage = (identifier: string): UdhrLanguageRecord | undefined => {
  const recordId = resolveUdhrRecordId(identifier);
  return recordId === undefined ? undefined : recordById.get(recordId);
};

export const LANGUAGE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  ...Object.fromEntries(UDHR_RECORDS.map(({id, name}) => [
    id,
    getUdhrRecordDisplayLabel(id) ?? name,
  ])),
  ...Object.fromEntries([...legacyAliases].map(([legacyId, recordId]) => [
    legacyId,
    getUdhrRecordDisplayLabel(recordId) ?? recordById.get(recordId)?.name ?? legacyId,
  ])),
});

export class UdhrCorpusError extends Error {
  public readonly recordId: string;
  public readonly languageId: string;

  public constructor(recordId: string, message: string) {
    super(message);
    this.name = "UdhrCorpusError";
    this.recordId = recordId;
    this.languageId = recordId;
  }
}

const digestSha256 = async (bytes: ArrayBuffer): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this browser context");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const validateTranslation = async (
  record: UdhrLanguageRecord,
  bytes: ArrayBuffer,
  text: string,
): Promise<void> => {
  if (bytes.byteLength !== record.utf8Bytes) {
    throw new Error("UTF-8 byte length does not match the versioned manifest");
  }
  if (Array.from(text).length !== record.characterCount) {
    throw new Error("Unicode character count does not match the versioned manifest");
  }
  if (text.split("\n").length !== record.segmentCount) {
    throw new Error("article count does not match the versioned manifest");
  }
  if (
    text !== text.normalize("NFC")
    || text.includes("\r")
    || text.includes("\n\n")
    || text.endsWith("\n")
    || CONTROL_CHARACTERS.test(text)
  ) {
    throw new Error("text is not in the canonical corpus format");
  }
  if (await digestSha256(bytes) !== record.sha256) {
    throw new Error("SHA-256 integrity check failed");
  }
};

const loadTranslation = async (record: UdhrLanguageRecord): Promise<string> => {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const assetUrl = `${baseUrl}${manifest.assetBasePath}/${encodeURIComponent(record.asset)}`;

  let response: Response;
  try {
    response = await fetch(assetUrl, {cache: "force-cache"});
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network request failed";
    throw new UdhrCorpusError(record.id, `Unable to load ${record.name}: ${reason}`);
  }

  if (!response.ok) {
    throw new UdhrCorpusError(
      record.id,
      `Unable to load ${record.name}: corpus asset returned HTTP ${response.status}`,
    );
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "response body could not be read";
    throw new UdhrCorpusError(record.id, `Unable to load ${record.name}: ${reason}`);
  }
  try {
    const text = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    await validateTranslation(record, bytes, text);
    return text;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "validation failed";
    throw new UdhrCorpusError(record.id, `${record.name} failed corpus validation: ${reason}`);
  }
};

/**
 * Lazily loads one immutable, same-origin, comparison-ready UDHR asset.
 *
 * Loads are capped at six concurrent requests. Concurrent requests for one
 * record share a promise, successful text stays in memory, and the HTTP cache
 * persists digest-named assets without application-managed storage.
 */
export const getTranslationResponse = async (identifier: string): Promise<string> => {
  const record = getUdhrLanguage(identifier);
  if (!record) {
    throw new UdhrCorpusError(identifier, `Unsupported UDHR record identifier: ${identifier}`);
  }
  if (!record.comparisonReady) {
    throw new UdhrCorpusError(
      record.id,
      `${record.name} is not available for comparison because its source lacks aligned Articles 1-30`,
    );
  }

  const cached = memoryCache.get(record.id);
  if (cached !== undefined) return cached;

  const pending = pendingLoads.get(record.id);
  if (pending) return pending;

  const load = withLoadSlot(() => loadTranslation(record))
    .then((text) => {
      memoryCache.set(record.id, text);
      return text;
    })
    .finally(() => pendingLoads.delete(record.id));
  pendingLoads.set(record.id, load);
  return load;
};
