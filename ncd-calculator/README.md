# CompLearn NCD Calculator

Browser-based normalized compression distance analysis for GenBank sequences, Universal Declaration of Human Rights translations, and local files. Compression, matrix construction, and layout optimization run in web workers so the interface remains responsive.

## Start the interface

```bash
cd ncd-calculator
npm install
npm run dev
```

Open `http://localhost:3000`. The built-in example set and local-file workflow do not require the Node backend. GenBank search and authentication use the backend API configured in `src/configs/api.tsx`.

## Workbench workflow

The calculator opens directly at its input controls. Choose GenBank, UDHR, or local files as the object source, or select **Try example data** beside the source tabs for an immediate self-contained run.

1. Add at least four objects, or use the example data.
2. Select **Show Similarity**. The page reports compression progress and exposes quartet-tree, K-grid, and distance-matrix result views.

The example data contains two intentionally related sequence pairs. It exercises the same compression pipeline as uploaded content and is suitable for interface and worker verification; it is not a scientific benchmark dataset.

The quartet-tree result opens in a planar 2D presentation so topology and labels can be read without manipulating a camera. The view automatically fits after layout and when the viewport changes, and provides explicit zoom, fit, and reset controls. **Interactive 3D** remains available for spatial exploration; its camera also fits the complete tree on entry and resize, while node selection reports whether the selected point is a leaf or an internal node.

Pair compression is explicitly order-dependent. The worker first constructs the complete directed matrix with separate `C(x || y)` and `C(y || x)` cells, then derives the symmetric QSearch/K-grid input by taking the minimum of each pair of reflected matrix cells. Both matrices are retained in the typed result. Directed compression results are stored in a SHA-256 content-addressed, versioned cache; incompatible legacy caches are removed automatically. QSearch uses a deterministic multi-start seed schedule and records selected-topology frequency and per-edge split stability for reproducibility. These diagnostics are kept out of the primary interface and retained in the typed result, explicit DOT exports, and technical documentation. The complete numerical contract is in [`docs/NCD_QSEARCH_REPRODUCIBILITY.md`](docs/NCD_QSEARCH_REPRODUCIBILITY.md).

## Verification

```bash
npm run build
npm run graphviz:verify-dev
npm run lint
npm run test
npm run typecheck
cd .. && make wasm-calculator
```

The planar renderer remains a lazy Graphviz/WASM chunk so it does not delay the landing page. In development, Graphviz is served directly rather than through Vite's disposable hashed dependency cache; `graphviz:verify-dev` checks that resolution and runs automatically during a build. Production builds separately verify that Graphviz was bundled into relative assets and fail if an unresolved `@hpcc-js/wasm` module specifier would reach the browser.

After changing dependencies or switching branches while the development server is running, restart Vite so its module graph matches the installed packages:

```bash
npm run dev -- --force
```

The planar-tree interface reports initialization failures and offers **Retry renderer**. The shared loader deduplicates concurrent initialization and clears failed attempts before retrying.

Focused interface coverage is in `src/__test__/landingPage.test.tsx` and `src/__test__/workbench.test.tsx`.

### Reproducible UDHR inputs

UDHR comparisons use a versioned UTF-8 snapshot generated from the Unicode UDHR Project at a pinned commit. Corpus v2 stores all 501 available stage-4 records locally, representing 431 ISO 639-3 language groups. Of those records, 465 link to an OHCHR translation and 36 retain a separate `unicode-complete` provenance tier. The audit accepts 496 records across 426 language codes for aligned comparison; five upstream XML records are preserved but blocked because they do not contain Articles 1–30 in full.

The interface presents the complete catalog as 431 concise language groups. A group with one record can be added directly; a group with multiple scripts, editions, regions, orthographies, or other source variants requires an explicit record choice. Stable `udhr:<source-key>` identifiers remain separate from presentation labels. Variant labels are globally unique, so selecting two records from one language keeps them distinguishable in the comparison set, distance matrix, K-grid, and quartet tree. Search covers group and source names, identifiers, BCP 47 tags, and human-readable script names with accent-insensitive multi-token matching. See [`docs/UDHR_LANGUAGE_BROWSER.md`](docs/UDHR_LANGUAGE_BROWSER.md) for the grouping and label contract.

The browser loads only selected same-origin, digest-addressed text assets, with at most six requests in flight. It decodes UTF-8 in fatal mode and verifies the byte count, Unicode code-point count, article count, NFC normalization, and SHA-256 digest before compression. A failed check stops the calculation. Assets use an in-memory promise cache and the browser HTTP cache instead of application-managed local storage.

```bash
npm run udhr:verify
npm run udhr:audit
npm run udhr:refresh
```

`udhr:verify` is offline and runs automatically before every production build. `udhr:audit` validates the complete pinned source without publishing files. `udhr:refresh` stages and regenerates the corpus from the immutable source commit configured in `scripts/udhr-corpus-config.mjs`; review the generated manifest, audit report, text changes, and source commit before accepting an update. The scientific scope is documented in [`docs/UDHR_CORPUS.md`](docs/UDHR_CORPUS.md), with the v2 implementation contract in [`docs/UDHR_CORPUS_V2_PIPELINE.md`](docs/UDHR_CORPUS_V2_PIPELINE.md) and grouped-browser contract in [`docs/UDHR_LANGUAGE_BROWSER.md`](docs/UDHR_LANGUAGE_BROWSER.md).

Compressor-based NCD converges toward its theoretical properties as compressed inputs grow. For very short or extremely periodic inputs, gzip headers, framing, and pair separators can dominate the compressed size and produce a nonzero empirical NCD even for repeated content. Formula tests therefore use synthetic compressed sizes, while compressor integration tests use the realistic mitochondrial fixture. The matrix diagonal remains exactly zero by definition in the worker pipeline.

## Visual system

The landing page and workbench share a restrained scientific/editorial system: warm paper, dark green structural surfaces, oxide annotations, serif headings, monospace metadata, square controls, and thin rules. Decorative gradients, glow effects, generic cards, and promotional copy are intentionally avoided. The design keeps the NCD equation, comparison set, computation state, and result matrix visually primary.

The production interface is for end users. Internal identifiers, seeds, protocol versions, worker throughput, iteration counts, objective values, cache state, and raw optimizer diagnostics belong in exports, logs, tests, or technical documents rather than the GUI. See [`docs/END_USER_UI_POLICY.md`](docs/END_USER_UI_POLICY.md).

Updated 2026-08-07 (Asia/Ho_Chi_Minh).
