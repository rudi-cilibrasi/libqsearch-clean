import {createHash} from "node:crypto";
import {XMLParser, XMLValidator} from "fast-xml-parser";

const CONTROL_CHARACTERS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/u;
const NUMERIC_CHARACTER_REFERENCE = /&#(?:x([0-9A-Fa-f]+)|([0-9]+));/gu;

const parser = new XMLParser({
  attributeNamePrefix: "@_",
  ignoreAttributes: false,
  parseTagValue: false,
  removeNSPrefix: true,
  trimValues: false,
});

export const asArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

export const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

export const countCodePoints = (value) => Array.from(value).length;

export const normalizeSegment = (value) => String(value)
  .normalize("NFC")
  .replace(/\r\n?/gu, "\n")
  .replace(/[\t\f\v]+/gu, " ")
  .replace(/\p{Zs}+/gu, " ")
  // Source formatting may wrap one XML paragraph across physical lines. A
  // canonical line is reserved for an article boundary, never source layout.
  .replace(/ *\n+ */gu, " ")
  .replace(/ {2,}/gu, " ")
  .trim();

const decodeNumericCharacterReferences = (xml, sourceName) => xml.replace(
  NUMERIC_CHARACTER_REFERENCE,
  (_match, hexadecimal, decimal) => {
    const codePoint = Number.parseInt(hexadecimal ?? decimal, hexadecimal ? 16 : 10);
    if (
      !Number.isInteger(codePoint)
      || codePoint < 0
      || codePoint > 0x10FFFF
      || (codePoint >= 0xD800 && codePoint <= 0xDFFF)
    ) {
      throw new Error(`${sourceName}: invalid numeric character reference`);
    }
    return String.fromCodePoint(codePoint);
  },
);

export const parseTrustedXml = (xml, sourceName) => {
  if (xml.includes("<!DOCTYPE") || xml.includes("<!ENTITY")) {
    throw new Error(`${sourceName}: document type and entity declarations are not allowed`);
  }

  const validation = XMLValidator.validate(xml);
  if (validation !== true) {
    throw new Error(`${sourceName}: invalid XML: ${validation.err.msg}`);
  }

  // fast-xml-parser deliberately leaves numeric references untouched. Decode
  // only numeric Unicode scalar references before parsing; named or custom
  // entity expansion remains disabled.
  return parser.parse(decodeNumericCharacterReferences(xml, sourceName));
};

const assertOnlyKeys = (value, allowedKeys, context) => {
  const unknownKeys = Object.keys(value).filter(
    (key) => !key.startsWith("@_") && !allowedKeys.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(`${context}: unsupported XML element(s): ${unknownKeys.join(", ")}`);
  }
};

const readParagraphs = (container, context) => {
  if (!container || typeof container !== "object") {
    throw new Error(`${context}: expected a structured XML element`);
  }

  assertOnlyKeys(container, new Set(["#text", "title", "para", "orderedlist"]), context);
  const paragraphs = asArray(container.para);
  const listParagraphs = asArray(container.orderedlist).flatMap((orderedList, listIndex) => {
    assertOnlyKeys(orderedList, new Set(["#text", "listitem"]), `${context}.orderedlist[${listIndex}]`);
    return asArray(orderedList.listitem).flatMap((listItem, itemIndex) => {
      assertOnlyKeys(listItem, new Set(["#text", "para"]), `${context}.listitem[${itemIndex}]`);
      return asArray(listItem.para);
    });
  });

  return [...paragraphs, ...listParagraphs].map((paragraph, paragraphIndex) => {
    if (typeof paragraph !== "string") {
      throw new Error(`${context}: paragraph ${paragraphIndex + 1} is not plain text`);
    }
    const normalized = normalizeSegment(paragraph);
    if (CONTROL_CHARACTERS.test(normalized)) {
      throw new Error(`${context}: paragraph ${paragraphIndex + 1} contains control characters`);
    }
    return normalized;
  }).filter(Boolean);
};

export const extractCanonicalUdhr = (
  xml,
  sourceKey,
  {requireCompleteArticles = true, minimumCodePoints = 2_000} = {},
) => {
  const parsed = parseTrustedXml(xml, `udhr_${sourceKey}.xml`);
  const document = parsed.udhr;
  if (!document || typeof document !== "object") {
    throw new Error(`${sourceKey}: missing udhr root element`);
  }
  if (document["@_key"] !== sourceKey) {
    throw new Error(`${sourceKey}: source key does not match the XML root`);
  }

  const articles = asArray(document.article);
  if (articles.length === 0) {
    throw new Error(`${sourceKey}: contains no articles`);
  }

  const articleNumbers = articles.map((article, articleIndex) => {
    const articleNumber = Number(article["@_number"]);
    if (
      !Number.isInteger(articleNumber)
      || articleNumber < 1
      || articleNumber > 30
      || (articleIndex > 0 && articleNumber <= Number(articles[articleIndex - 1]["@_number"]))
    ) {
      throw new Error(`${sourceKey}: invalid or non-increasing article number`);
    }
    return articleNumber;
  });
  const hasCompleteArticles = (
    articleNumbers.length === 30
    && articleNumbers.every((articleNumber, index) => articleNumber === index + 1)
  );
  if (requireCompleteArticles && !hasCompleteArticles) {
    throw new Error(`${sourceKey}: expected Articles 1-30, found ${articleNumbers.join(",")}`);
  }

  const articleSegments = articles.map((article, articleIndex) => {
    const articleNumber = articleNumbers[articleIndex];
    const segments = readParagraphs(article, `${sourceKey}.article[${articleNumber}]`);
    if (segments.length === 0) {
      throw new Error(`${sourceKey}: Article ${articleNumber} has no body paragraphs`);
    }
    // Paragraph and list-item boundaries differ slightly between translations.
    // Collapse them within each article so the serialized structure contributes
    // exactly the same 30 article boundaries to every NCD input.
    return segments.join(" ");
  });

  // Articles 1-30 are the aligned content shared by every selected source.
  // Preambles are intentionally excluded because the Amharic source does not
  // contain one; mixing coverage would bias compression-based comparisons.
  const segments = articleSegments;
  const text = segments.join("\n");
  if (text !== text.normalize("NFC")) {
    throw new Error(`${sourceKey}: canonical text is not NFC normalized`);
  }
  if (CONTROL_CHARACTERS.test(text)) {
    throw new Error(`${sourceKey}: canonical text contains control characters`);
  }
  if (countCodePoints(text) < minimumCodePoints) {
    throw new Error(`${sourceKey}: canonical body is unexpectedly short`);
  }

  return {
    articleCount: articles.length,
    articleNumbers,
    characterCount: countCodePoints(text),
    direction: document["@_dir"],
    iso6393: document["@_iso639-3"],
    languageTag: document["@_lang"],
    name: document["@_n"],
    script: document["@_iso15924"],
    segmentCount: segments.length,
    hasCompleteArticles,
    text,
    utf8Bytes: Buffer.byteLength(text, "utf8"),
  };
};

export const assertCanonicalAsset = (text, language) => {
  const context = `${language.id}.txt`;
  if (Buffer.byteLength(text, "utf8") !== language.utf8Bytes) {
    throw new Error(`${context}: UTF-8 byte length does not match the manifest`);
  }
  if (countCodePoints(text) !== language.characterCount) {
    throw new Error(`${context}: character count does not match the manifest`);
  }
  if (text.split("\n").length !== language.segmentCount) {
    throw new Error(`${context}: segment count does not match the manifest`);
  }
  if (text !== text.normalize("NFC")) {
    throw new Error(`${context}: text is not NFC normalized`);
  }
  if (text.endsWith("\n") || text.includes("\r") || text.includes("\n\n")) {
    throw new Error(`${context}: text has non-canonical line boundaries`);
  }
  if (CONTROL_CHARACTERS.test(text)) {
    throw new Error(`${context}: text contains control characters`);
  }
  if (sha256(text) !== language.sha256) {
    throw new Error(`${context}: SHA-256 does not match the manifest`);
  }
};
