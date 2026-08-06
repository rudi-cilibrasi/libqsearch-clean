# UDHR comparison corpus

Updated 2026-08-06 (Asia/Ho_Chi_Minh).

## Purpose

The language workbench needs stable byte sequences. Runtime PDF extraction did not provide them: PDF text order depends on layout and font maps, several configured PDFs yielded empty or truncated text, and the previous implementation encoded PDF.js Unicode strings as UTF-8 before decoding those bytes as unrelated legacy encodings. That operation changed valid characters and introduced control characters in some languages. A cached failure could then become a permanent NCD input.

The replacement is a generated, versioned corpus. It is reproducible, lazy-loaded, and verified before any selected text reaches compression.

## Provenance

The source is the [Unicode UDHR Project repository](https://github.com/eric-muller/udhr), pinned to commit `588b3f4b2d0467aff54842a4b926551b69d5a66a`. The source index marks all 61 selected records as stage 4, available, and linked to an OHCHR translation. Stage 4 means that OHCHR is identified as the source and complete XML is available. The generated manifest retains the exact source key, OHCHR translation identifier, ISO 639-3 code, BCP 47 tag, ISO 15924 script, and writing direction for every record. When a current user-facing English name differs from the pinned index, the manifest also retains the original index label as `sourceName`.

Stable application identifiers are mapped explicitly in `scripts/udhr-corpus-config.mjs`. This matters for variants: examples include Portuguese (Portugal), German in 1901 orthography, monotonic Greek, Norwegian Bokmål, Northern Uzbek in Latin script, Western Farsi, Central Kurdish, and Tagalog. The interface displays the source language name and BCP 47 tag rather than presenting those records as unspecified varieties.

## Canonical representation

Every text contains the body of Articles 1–30 in source order. Preambles are excluded because the selected Amharic record has no preamble; including preambles only where present would make the compared documents cover different material. Source notes, document titles, localized article headings, list markers, and article numbers are also excluded because they are metadata or presentation rather than article body text.

Paragraph and list-item boundaries vary slightly among translations. The generator joins all body paragraphs within an article using one ASCII space, then joins the 30 articles using line feed (`U+000A`). The result therefore has exactly 30 structural segments for every language without changing word order or characters. Empty XML paragraph elements are ignored. Text is normalized to Unicode NFC, CRLF is converted to LF, horizontal Unicode space characters are collapsed to an ASCII space, and C0/C1 control characters are rejected. NFC is used instead of NFKC because compatibility normalization can erase distinctions that belong to the source orthography.

Generation fails unless the XML is well formed, contains no document-type or custom-entity declarations, has the expected source key, contains Articles 1–30 in order, gives every article non-empty body text, has at least 2,000 Unicode code points, and matches the source-index metadata. Numeric Unicode character references are decoded with scalar-value validation; arbitrary entity expansion remains disabled.

## Runtime integrity and scaling

The generated manifest at `src/generated/udhr-manifest.json` records each asset's SHA-256 digest, UTF-8 byte length, Unicode code-point count, segment count, and article count. `src/functions/udhr.ts` fetches the selected same-origin asset, decodes UTF-8 with `fatal: true`, repeats the structural checks, and verifies the digest with Web Crypto. Any mismatch stops the calculation and is shown in the workbench. The application does not silently substitute empty text.

Assets are loaded on demand, so adding supported languages does not grow the main JavaScript bundle or require 61 startup requests. Concurrent requests for one language are deduplicated. Successful content is cached only in memory; persistent transfer caching is delegated to the browser's HTTP cache. This avoids duplicate local-storage copies and prevents an old extraction error from surviving a corpus upgrade.

Production builds run `npm run udhr:verify` before Vite. This offline check reads every asset and validates its metadata and digest. Unit tests cover manifest invariants, successful UTF-8 loading, request deduplication, unknown identifiers, and failure on modified bytes.

## Scientific interpretation

This corpus makes the input bytes reproducible; it does not make an NCD result a direct measure of semantic, historical, or genealogical language distance. UTF-8 byte width, writing system, orthographic conventions, translation choices, corpus length, and compressor behavior all affect empirical NCD. Comparisons across scripts are especially sensitive to byte representation. Results should be described as compressor-based similarity among these specific UDHR article encodings, with the corpus version and compression algorithm reported.

### East Slavic comparison

The snapshot includes Russian (`rus`, BCP 47 `ru`), Ukrainian (`ukr`, `uk`), and Belarusian (`bel`, `be`), all encoded in Cyrillic and extracted from the same Articles 1–30 boundary. The pinned Unicode index calls the Belarusian record `Belarusan`; the interface displays the current English name `Belarusian`, while the manifest retains `Belarusan` as `sourceName`. Both labels refer to the same ISO 639-3 language code, `bel`.

An unrooted quartet tree requires exactly four or more objects. To examine the three East Slavic records in a quartet, select all three and add a declared comparison language. Polish is a useful West Slavic comparison, but it is an outgroup chosen for the experiment, not an East Slavic language. The inferred topology remains a compressor-based relationship among these translations and must not be presented as a validated linguistic family tree.

### English in the European UDHR example

For the eight-record English, French, Spanish, Portuguese, Italian, Swedish, German, and Dutch example, the selected unrooted QSearch topology contains the balanced split `{French, Spanish, Portuguese, Italian}` versus `{English, Swedish, German, Dutch}`. Thus English is already on the Germanic side of the inferred topology even though several individual English-to-Romance NCD values are lower than the English-to-Germanic values. A tree is fitted to all pairwise distances simultaneously; it is not a nearest-neighbor list.

This pairwise attraction must not be "corrected" using the expected family labels. The original CompLearn UDHR experiment also observed English leaning toward Romance and attributed that signal to its large Latin-derived vocabulary. A local sensitivity check on 2026-08-06 found the same qualitative English-to-Romance attraction with gzip, bzip2, and XZ, so substituting a compressor is not a principled correction. See Cilibrasi and Vitányi, *Clustering by Compression*, language-tree discussion: <https://homepages.cwi.nl/~paulv/papers/cluster.pdf>.

If the research objective is historical genealogy rather than similarity among complete translations, it requires a separate, explicitly labeled experiment using suitable evidence such as a controlled basic-vocabulary or cognate corpus. That method would be domain-specific and should not silently replace the feature-free UDHR NCD result. Increasing the amount of comparable, independently sourced text per language can improve compressor resolution, but it cannot guarantee a predetermined topology and must use a versioned corpus assembled without consulting the desired output.

SHA-256 verifies that the deployed bytes match this repository's reviewed snapshot. It does not independently certify the linguistic accuracy of each upstream translation. Changes to source records, canonicalization, or compressor settings require a new corpus version and should not be combined with prior matrices without explicit compatibility analysis.

## Updating the snapshot

Do not edit generated text assets or the manifest by hand. To reproduce the current snapshot from an existing source checkout:

```bash
git -C /path/to/udhr checkout 588b3f4b2d0467aff54842a4b926551b69d5a66a
npm run udhr:refresh -- --source-dir /path/to/udhr
npm run udhr:verify
npm run test -- --run src/__test__/udhrCorpus.test.ts
```

Without `--source-dir`, `udhr:refresh` downloads the XML files from the immutable commit on GitHub. For a future source update, first change the pinned commit and corpus version in `scripts/udhr-corpus-config.mjs`. Review upstream history and status for every changed record, regenerate, inspect manifest and text diffs, run the complete verification suite, and record the scientific compatibility decision in this document.
