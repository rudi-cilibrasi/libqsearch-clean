export const UDHR_SOURCE_COMMIT = "588b3f4b2d0467aff54842a4b926551b69d5a66a";
export const UDHR_SCHEMA_VERSION = 2;
export const UDHR_AUDIT_SCHEMA_VERSION = 1;
export const UDHR_CORPUS_VERSION = "unicode-udhr-588b3f4b-stage4-articles-nfc-v2";
export const UDHR_ASSET_BASE_PATH = "udhr/v2/records";

/**
 * Counts are part of the pinned-source contract. An upstream or filtering
 * change must update these values intentionally instead of silently changing
 * the scientific corpus.
 */
export const UDHR_EXPECTED_COUNTS = Object.freeze({
  indexed: 615,
  available: 586,
  complete: 501,
  uniqueLanguages: 431,
  ohchrLinked: 465,
  unicodeComplete: 36,
});
export const UDHR_EXPECTED_COMPARISON_COUNTS = Object.freeze({
  readyRecords: 496,
  readyLanguages: 426,
  excludedRecords: 5,
});

/**
 * Concise user-facing English names for records whose pinned upstream label
 * includes a historical name, region, script, orthography, or inverted form.
 * The manifest retains each exact upstream label as sourceName.
 */
export const UDHR_DISPLAY_NAME_OVERRIDES = Object.freeze({
  bel: "Belarusian",
  cmn: "Chinese",
  deu: "German",
  ell: "Greek",
  fas: "Farsi",
  gle: "Irish",
  jav: "Javanese",
  khm: "Khmer",
  kur: "Kurdish",
  mon: "Mongolian",
  msa: "Malay",
  nor: "Norwegian",
  por: "Portuguese",
  ron: "Romanian",
  tuk: "Turkmen",
  uzb: "Uzbek",
});

/**
 * Stable application identifiers mapped to the exact Unicode UDHR source keys.
 *
 * Application identifiers are kept stable so existing saved selections continue
 * to work. The generated manifest carries the authoritative ISO 639-3, BCP 47,
 * script, direction, and display-name metadata from the source XML.
 */
export const UDHR_FEATURED_LANGUAGE_SOURCES = Object.freeze([
  ["eng", "eng"],
  ["fra", "fra"],
  ["rus", "rus"],
  ["ukr", "ukr"],
  ["bel", "bel"],
  ["spa", "spa"],
  ["cmn", "cmn_hans"],
  ["hin", "hin"],
  ["ben", "ben"],
  ["por", "por_PT"],
  ["jpn", "jpn"],
  ["deu", "deu_1901"],
  ["jav", "jav"],
  ["kor", "kor"],
  ["vie", "vie"],
  ["mar", "mar"],
  ["tam", "tam"],
  ["tur", "tur"],
  ["ita", "ita"],
  ["tha", "tha"],
  ["bul", "bul"],
  ["ces", "ces"],
  ["dan", "dan"],
  ["nld", "nld"],
  ["est", "est"],
  ["ell", "ell_monotonic"],
  ["hun", "hun"],
  ["isl", "isl"],
  ["gle", "gle"],
  ["lav", "lav"],
  ["lit", "lit"],
  ["nor", "nob"],
  ["pol", "pol"],
  ["ron", "ron_1953"],
  ["slk", "slk"],
  ["slv", "slv"],
  ["swe", "swe"],
  ["hye", "hye"],
  ["kat", "kat"],
  ["kaz", "kaz"],
  ["kir", "kir"],
  ["mon", "khk"],
  ["tgk", "tgk"],
  ["tuk", "tuk_cyrl"],
  ["uzb", "uzn_latn"],
  ["amh", "amh"],
  ["hau", "hau_3"],
  ["ibo", "ibo"],
  ["yor", "yor"],
  ["zul", "zul"],
  ["swa", "swh"],
  ["fas", "pes_1"],
  ["heb", "heb"],
  ["kur", "ckb"],
  ["urd", "urd"],
  ["khm", "khm"],
  ["lao", "lao"],
  ["mya", "mya"],
  ["ind", "ind"],
  ["msa", "mly_latn"],
  ["fil", "tgl"],
]);
