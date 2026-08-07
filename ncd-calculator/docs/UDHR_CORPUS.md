# UDHR comparison corpus

Updated 2026-08-07 (Asia/Ho_Chi_Minh).

## Purpose

The language workbench needs stable byte sequences. Runtime PDF extraction did not provide them: PDF text order depends on layout and font maps, several configured PDFs yielded empty or truncated text, and the previous implementation encoded PDF.js Unicode strings as UTF-8 before decoding those bytes as unrelated legacy encodings. That operation changed valid characters and introduced control characters in some languages. A cached failure could then become a permanent NCD input.

The replacement is a generated, versioned corpus. It is reproducible, lazy-loaded, and verified before any selected text reaches compression.

## Provenance

The source is the [Unicode UDHR Project repository](https://github.com/eric-muller/udhr), pinned to commit `588b3f4b2d0467aff54842a4b926551b69d5a66a`. Corpus v2 includes every source-index record marked available at stage 4: 501 records representing 431 ISO 639-3 language codes. The manifest retains the exact source key, OHCHR translation identifier where present, ISO 639-3 code, BCP 47 tag, ISO 15924 script, writing direction, article numbers, and source name. Content identity is the variant-safe `udhr:<source-key>` record ID; ISO 639-3 remains a language-group identifier and is not assumed to identify one unique text.

The 465 records with a non-empty OHCHR identifier use the `ohchr-linked` provenance tier. The other 36 stage-4 records use `unicode-complete`. Both tiers preserve the Unicode source and pass the same structural and byte-integrity checks, but the second tier must not be described as OHCHR-linked. The checked-in audit report records these counts and every exclusion decision.

The current language browser continues to expose its reviewed 61-record subset while the grouped browser is developed separately. Its historical three-letter application IDs resolve through `legacyAliases` to canonical record IDs, so saved selections such as `deu` migrate to `udhr:deu_1901`. The interface uses concise names such as `Portuguese`, `German`, and `Norwegian`; exact upstream names remain in `sourceName`, and variant metadata remains in the manifest.

## Canonical representation

Canonical assets contain available article body text in source order. Preambles are excluded because coverage differs between translations; including them selectively would make compared documents cover different material. Source notes, document titles, localized article headings, list markers, and article numbers are also excluded because they are metadata or presentation rather than article body text.

Paragraph and list-item boundaries vary slightly among translations. The generator joins all body paragraphs and source-layout line wraps within an article using one ASCII space, then joins articles using line feed (`U+000A`). A comparison-ready record therefore has exactly 30 structural segments. Empty XML paragraph elements are ignored. Text is normalized to Unicode NFC, CRLF is converted to LF, horizontal Unicode space characters are collapsed to an ASCII space, and C0/C1 control characters are rejected. NFC is used instead of NFKC because compatibility normalization can erase distinctions that belong to the source orthography.

Generation fails unless the XML is well formed, contains no document-type or custom-entity declarations, has the expected source key, gives every present article non-empty body text, uses unique increasing article numbers in the range 1–30, and matches the source-index metadata. Numeric Unicode character references are decoded with scalar-value validation; arbitrary entity expansion remains disabled. A separate comparison-readiness gate requires Articles 1–30 exactly and at least 2,000 Unicode code points.

The audit found five stage-4 records that do not meet aligned article coverage: `csw`, `ike`, and `ojb` stop at Article 23; `kwi` lacks Article 1; and `ykg` stops at Article 29. Their canonical bytes and provenance are retained, but `comparisonReady` is false and the runtime refuses to send them to compression. This preserves all 501 upstream records without pretending that source stage alone guarantees equivalent experimental coverage. The result is 496 comparison-ready records representing 426 language codes.

## Runtime integrity and scaling

The generated manifest at `src/generated/udhr-manifest-v2.json` records each asset's SHA-256 digest, UTF-8 byte length, Unicode code-point count, segment count, article numbers, provenance tier, and comparison readiness. Filenames contain the first 16 hexadecimal digits of the full SHA-256 digest. `src/functions/udhr.ts` fetches the selected same-origin asset, decodes UTF-8 with `fatal: true`, repeats the structural checks, and verifies the full digest with Web Crypto. Any mismatch stops the calculation and is shown in the workbench. The application does not silently substitute empty text.

All 501 assets are checked into `public/udhr/v2/records`, currently occupying about 6.3 MB. Vite copies them into the deployment without importing their text into the JavaScript bundle. The browser makes no corpus request when it opens or searches the language list. It loads only selected records after the user starts a calculation, caps the shared queue at six active requests, and deduplicates concurrent requests for one record. Successful content is cached only in memory; persistent transfer caching is delegated to the browser's HTTP cache. Digest-addressed filenames make long-lived cache entries immutable without application-managed local-storage copies.

Production builds run `npm run udhr:verify` before Vite. This offline check reads all 501 assets, verifies the pinned source-index digest, manifest and audit counts, record and asset uniqueness, legacy aliases, provenance tiers, comparison readiness, and content digests. Unit tests cover the catalog counts, legacy resolution, immutable URLs, request deduplication, the six-request bound, comparison exclusions, unknown identifiers, and failure on modified bytes.

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
npm test -- src/__test__/udhrCorpus.test.ts
```

`npm run udhr:audit` validates all eligible source XML and prints the deterministic report without publishing files. Without `--source-dir`, audit and refresh download XML from the immutable commit on GitHub; normal builds and runtime never contact upstream. Refresh validates every record, writes a staged v2 directory, re-reads and verifies every staged byte, and only then replaces the published v2 assets and generated metadata.

For a future source update, change the pinned commit, corpus version, expected source counts, and expected comparison-readiness counts in `scripts/udhr-corpus-config.mjs`. Review upstream history and every audit difference, regenerate twice to check determinism, inspect manifest and content diffs, run the complete verification suite, and record the scientific compatibility decision in this document. See `docs/UDHR_CORPUS_V2_PIPELINE.md` for the implementation contract.
