import rawManifest from "../generated/udhr-manifest.json";

export interface UdhrLanguageRecord {
  readonly id: string;
  readonly sourceKey: string;
  readonly name: string;
  readonly sourceName?: string;
  readonly languageTag: string;
  readonly iso6393: string;
  readonly script: string;
  readonly direction: "ltr" | "rtl";
  readonly ohchrTranslationId: string;
  readonly sourceStage: 4;
  readonly asset: string;
  readonly sha256: string;
  readonly utf8Bytes: number;
  readonly characterCount: number;
  readonly segmentCount: number;
  readonly articleCount: 30;
}

interface UdhrSourceRecord {
  readonly name: string;
  readonly repository: string;
  readonly commit: string;
  readonly upstreamAuthority: string;
  readonly upstreamUrl: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly selection: string;
  readonly normalization: string;
}

interface UdhrManifest {
  readonly schemaVersion: 1;
  readonly corpusVersion: string;
  readonly source: UdhrSourceRecord;
  readonly languages: readonly UdhrLanguageRecord[];
}

const CONTROL_CHARACTERS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ASSET_PATTERN = /^[a-z]{3}\.txt$/u;
const manifest = rawManifest as UdhrManifest;

const assertManifest = (value: UdhrManifest): void => {
  if (
    value.schemaVersion !== 1
    || typeof value.corpusVersion !== "string"
    || !value.corpusVersion
    || typeof value.source?.commit !== "string"
    || !Array.isArray(value.languages)
  ) {
    throw new Error("The bundled UDHR manifest has an unsupported format");
  }

  const ids = new Set<string>();
  const sourceKeys = new Set<string>();
  for (const language of value.languages) {
    if (
      typeof language.id !== "string"
      || !/^[a-z]{3}$/u.test(language.id)
      || ids.has(language.id)
      || sourceKeys.has(language.sourceKey)
      || typeof language.name !== "string"
      || !language.name
      || (language.sourceName !== undefined && (
        typeof language.sourceName !== "string" || !language.sourceName
      ))
      || typeof language.languageTag !== "string"
      || typeof language.iso6393 !== "string"
      || typeof language.script !== "string"
      || !["ltr", "rtl"].includes(language.direction)
      || language.articleCount !== 30
      || language.segmentCount !== 30
      || language.sourceStage !== 4
      || language.asset !== `${language.id}.txt`
      || !ASSET_PATTERN.test(language.asset)
      || !SHA256_PATTERN.test(language.sha256)
      || !Number.isInteger(language.utf8Bytes)
      || language.utf8Bytes <= 0
      || !Number.isInteger(language.characterCount)
      || language.characterCount < 2_000
    ) {
      throw new Error(`The bundled UDHR manifest is invalid at language ${language.id}`);
    }
    ids.add(language.id);
    sourceKeys.add(language.sourceKey);
  }
};

assertManifest(manifest);

export const UDHR_CORPUS = Object.freeze({
  schemaVersion: manifest.schemaVersion,
  corpusVersion: manifest.corpusVersion,
  source: Object.freeze({...manifest.source}),
});

export const UDHR_LANGUAGES: readonly UdhrLanguageRecord[] = Object.freeze(
  manifest.languages.map((language) => Object.freeze({...language})),
);

const languageById = new Map(UDHR_LANGUAGES.map((language) => [language.id, language]));
const memoryCache = new Map<string, string>();
const pendingLoads = new Map<string, Promise<string>>();

export const LANGUAGE_NAMES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(UDHR_LANGUAGES.map(({id, name}) => [id, name])),
);

export class UdhrCorpusError extends Error {
  public readonly languageId: string;

  public constructor(languageId: string, message: string) {
    super(message);
    this.name = "UdhrCorpusError";
    this.languageId = languageId;
  }
}

export const getUdhrLanguage = (languageId: string): UdhrLanguageRecord | undefined => (
  languageById.get(languageId)
);

const digestSha256 = async (bytes: ArrayBuffer): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this browser context");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const validateTranslation = async (
  language: UdhrLanguageRecord,
  bytes: ArrayBuffer,
  text: string,
): Promise<void> => {
  if (bytes.byteLength !== language.utf8Bytes) {
    throw new Error("UTF-8 byte length does not match the versioned manifest");
  }
  if (Array.from(text).length !== language.characterCount) {
    throw new Error("Unicode character count does not match the versioned manifest");
  }
  if (text.split("\n").length !== language.segmentCount) {
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
  if (await digestSha256(bytes) !== language.sha256) {
    throw new Error("SHA-256 integrity check failed");
  }
};

const loadTranslation = async (language: UdhrLanguageRecord): Promise<string> => {
  const baseUrl = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const assetUrl = `${baseUrl}udhr/v1/${encodeURIComponent(language.asset)}`;

  let response: Response;
  try {
    response = await fetch(assetUrl, {cache: "force-cache"});
  } catch (error) {
    const reason = error instanceof Error ? error.message : "network request failed";
    throw new UdhrCorpusError(language.id, `Unable to load ${language.name}: ${reason}`);
  }

  if (!response.ok) {
    throw new UdhrCorpusError(
      language.id,
      `Unable to load ${language.name}: corpus asset returned HTTP ${response.status}`,
    );
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "response body could not be read";
    throw new UdhrCorpusError(language.id, `Unable to load ${language.name}: ${reason}`);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", {fatal: true}).decode(bytes);
    await validateTranslation(language, bytes, text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "validation failed";
    throw new UdhrCorpusError(language.id, `${language.name} failed corpus validation: ${reason}`);
  }
  return text;
};

/**
 * Lazily loads one immutable, same-origin UDHR corpus asset.
 *
 * Concurrent requests for the same language share a promise. Successful text is
 * retained in memory while the browser HTTP cache handles persistence; this
 * avoids stale or corrupt application-managed localStorage copies.
 */
export const getTranslationResponse = async (languageId: string): Promise<string> => {
  const language = languageById.get(languageId);
  if (!language) {
    throw new UdhrCorpusError(languageId, `Unsupported UDHR language identifier: ${languageId}`);
  }

  const cached = memoryCache.get(languageId);
  if (cached !== undefined) return cached;

  const pending = pendingLoads.get(languageId);
  if (pending) return pending;

  const load = loadTranslation(language)
    .then((text) => {
      memoryCache.set(languageId, text);
      return text;
    })
    .finally(() => pendingLoads.delete(languageId));
  pendingLoads.set(languageId, load);
  return load;
};
