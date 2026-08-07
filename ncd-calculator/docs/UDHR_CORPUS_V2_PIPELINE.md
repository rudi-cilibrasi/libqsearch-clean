# UDHR corpus v2 pipeline

Updated 2026-08-07 (Asia/Ho_Chi_Minh).

## Scope and release boundary

Corpus v2 is the data-infrastructure release for the complete Unicode UDHR snapshot. It imports every record marked `status=y` and `stage=4` at the pinned source commit, assigns variant-safe identities, publishes local content-addressed assets, records provenance and audit decisions, and enforces bounded same-origin lazy loading. It does not yet replace the reviewed 61-record language browser with the planned grouped browser. The complete catalog is available to code as `UDHR_RECORDS`; `UDHR_LANGUAGES` remains the compatibility subset used by the current interface.

The pinned index contains 615 records. Of the 586 marked available, 501 are stage 4 and represent 431 ISO 639-3 language codes. Forty-six language codes have multiple complete records, producing 70 records beyond a one-record-per-code view. The pipeline preserves those variants instead of overwriting them by ISO code.

## Identity model

An ISO 639-3 code identifies a language grouping, not a unique byte sequence. The computational identity is therefore the Unicode source key with a namespace:

```text
record ID:   udhr:<source-key>
language ID: <ISO 639-3>
asset:       <source-key>.<first-16-SHA-256-hex>.txt
```

For example, the reviewed German record is `udhr:deu_1901`, belongs to language group `deu`, and is stored under a digest-addressed filename. Legacy application ID `deu` resolves to that canonical record through the generated `legacyAliases` map. Direct record IDs always take precedence over aliases, and the namespace prevents a legacy ID from colliding with a source key.

Each manifest record contains the source key, language ID, BCP 47 tag, ISO 15924 script, direction, concise display name where reviewed, exact upstream name when different, article numbers, content counts, digest, asset name, provenance tier, and comparison-readiness decision.

## Provenance tiers

The inclusion rule is source completeness, not OHCHR linkage:

```text
include when status = y and stage = 4
```

The 465 included records with an OHCHR identifier receive `ohchr-linked`. The 36 without one receive `unicode-complete`. Both tiers come from the same pinned Unicode repository and pass identical structural validation. The tier prevents a complete Unicode record from being silently described as an OHCHR-linked translation.

The source index itself is copied into the v2 snapshot with a digest-addressed filename. Its full SHA-256 appears in both the manifest and audit report. This allows offline verification that record-selection metadata is the reviewed pinned index.

## Pipeline stages and failure behavior

Generation proceeds through ordered gates:

1. Resolve an optional local source checkout and require its exact Git commit, or construct immutable raw URLs from the configured commit.
2. Parse `index.xml` with document types and entity declarations disabled.
3. Validate every index identity and compare aggregate counts with the configured pinned-source contract.
4. Select all available stage-4 records and verify that every reviewed legacy source remains eligible.
5. Download at most eight XML records concurrently. Each request has a 30-second timeout and three attempts.
6. Parse and canonicalize every selected XML record in memory before publishing anything.
7. Require XML metadata to match the index exactly.
8. Create content-addressed filenames and deterministic manifest and audit objects.
9. Write assets and the pinned index into a temporary sibling directory.
10. Re-read every staged asset and verify its exact bytes, counts, structure, and digest.
11. Replace the prior v2 asset directory only after all staged verification succeeds, then publish the generated manifest and audit report.

A source, parsing, metadata, or staged-byte failure exits nonzero. The generator does not skip a failing record to reach a preferred count. During publication, the previous asset directory, manifest, and audit are retained as temporary backups; if any replacement fails, all three are restored so a mixed corpus version is not left behind. `--audit-only` performs source acquisition and every record validation but does not replace published files.

## Canonical text and comparison readiness

Preambles, notes, titles, article headings, numbers, and list markers are excluded. Body paragraphs and source-layout line wraps within one article are joined with an ASCII space. Article boundaries are line feeds, and text is normalized to NFC. Control characters, malformed XML, arbitrary entity expansion, missing paragraph bodies, invalid article numbers, and metadata disagreement are rejected.

Source stage 4 does not by itself guarantee Articles 1–30. The pinned audit found five exceptions:

| Record | Available articles | Decision |
| --- | --- | --- |
| `udhr:csw` | 1–23 | retained, comparison blocked |
| `udhr:ike` | 1–23 | retained, comparison blocked |
| `udhr:kwi` | 2–30 | retained, comparison blocked |
| `udhr:ojb` | 1–23 | retained, comparison blocked |
| `udhr:ykg` | 1–29 | retained, comparison blocked |

A record is comparison-ready only when it has Articles 1–30 exactly and at least 2,000 Unicode code points. This yields 496 comparison-ready records across 426 language codes. The five exceptions remain reproducible corpus records, but `getTranslationResponse` rejects them before any request so they cannot enter an aligned NCD computation accidentally.

## Runtime lazy loading

Vite copies `public/udhr/v2` into the deployment as static files. Startup imports the metadata manifest, not the translation bodies. Selecting or filtering a language causes no asset request. When computation begins, the runtime resolves each selected identifier to a canonical record, rejects records that are not comparison-ready, and requests only the selected digest-addressed assets from the application origin.

The loader has two process-local caches. `pendingLoads` makes callers requesting one record share the same promise, while `memoryCache` retains successfully verified text for the session. A fair semaphore caps all active record loads at six. The browser HTTP cache provides persistence, so the application does not duplicate corpus bytes in local storage or IndexedDB.

For every response, the runtime requires an HTTP success status, strict UTF-8 decoding, exact UTF-8 byte and Unicode code-point counts, the recorded number of article segments, NFC, canonical line boundaries, absence of control characters, and the full SHA-256 digest. A digest prefix in the URL enables immutable HTTP caching; the full digest remains the integrity decision.

## Generated artifacts

```text
public/udhr/v2/records/*.txt
public/udhr/v2/source/index.<digest>.xml
src/generated/udhr-manifest-v2.json
src/generated/udhr-audit-v2.json
```

The manifest is consumed at runtime. The audit report records selection policy, source and comparison counts, variant counts, incomplete and unavailable exclusions, and the five comparison-readiness exclusions. Generated files must not be edited manually.

## Commands and review procedure

```bash
# Validate the complete pinned source without publishing files.
npm run udhr:audit

# Generate and stage the checked-in v2 snapshot.
npm run udhr:refresh

# Verify all checked-in data without network access.
npm run udhr:verify

# Run focused runtime and UI compatibility tests.
npm test -- src/__test__/udhrCorpus.test.ts src/__test__/workbench.test.tsx

# Verify the production bundle and all corpus assets.
npm run build
```

For an update, reviewers should compare the pinned commit, index digest, aggregate counts, provenance-tier counts, comparison exclusions, record identities, changed content digests, license notice, and documentation. Regeneration should be run twice; the second run should produce no tracked difference. An upstream count or comparison-readiness change requires an explicit configuration update and scientific review.

## Next release

The grouped language-browser release will expose the complete comparison-ready catalog as language groups with explicit variant selection. It must not infer that one variant is scientifically canonical merely because it sorts first. When multiple variants of one language are selected together, presentation labels must disambiguate them while computations continue to use record IDs.
